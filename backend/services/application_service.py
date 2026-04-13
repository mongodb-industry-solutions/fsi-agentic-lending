"""Application service — handles CRUD and aggregation for loan applications."""
import logging
import os
from datetime import datetime, timezone
from bson import ObjectId
from db.mdb import get_db as _get_db
from models.schemas import ApplicationStatus

logger = logging.getLogger(__name__)


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict."""
    if doc is None:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    if "borrower_ids" in doc:
        doc["borrower_ids"] = [str(bid) for bid in doc["borrower_ids"]]
    if "borrower_id" in doc:
        doc["borrower_id"] = str(doc["borrower_id"])
    return doc


def create_application(data: dict, profile_id: str = None, demo_session_id: str = None) -> dict:
    """Create a new loan application with borrower records."""
    db = _get_db()
    now = datetime.now(timezone.utc)

    primary_borrower = {
        "full_name": data["primary_name"],
        "application_id": None,
        "created_at": now,
    }
    primary_id = db["borrowers"].insert_one(primary_borrower).inserted_id
    borrower_ids = [primary_id]
    borrower_names = [data["primary_name"]]

    if data.get("co_applicant_name"):
        co_borrower = {
            "full_name": data["co_applicant_name"],
            "application_id": None,
            "created_at": now,
        }
        co_id = db["borrowers"].insert_one(co_borrower).inserted_id
        borrower_ids.append(co_id)
        borrower_names.append(data["co_applicant_name"])

    oid = ObjectId()
    application_id = f"APP-{str(oid)[-8:].upper()}"

    application = {
        "application_id": application_id,
        "borrower_ids": borrower_ids,
        "borrower_names": borrower_names,
        "loan_amount": data["loan_amount"],
        "purchase_price": data["purchase_price"],
        "down_payment": data["down_payment"],
        "product": data.get("product", "5yr Fixed (25yr Amort)"),
        "property": {
            "address": data["property_address"],
            "type": data.get("property_type", "Detached Home"),
            "purchase_price": data["purchase_price"],
            "annual_tax": data.get("annual_property_tax", 0),
        },
        "income_summary": {
            "combined_gross": data["combined_income"],
            "primary": data["primary_income"],
            "co_applicant": data.get("co_applicant_income", 0),
        },
        "status": "submitted",
        "status_history": [
            {"status": "submitted", "timestamp": now, "detail": "Application received"}
        ],
        "created_at": now,
        "updated_at": now,
    }

    if profile_id:
        application["profile_id"] = profile_id
    if demo_session_id:
        application["demo_session_id"] = demo_session_id

    db["applications"].insert_one(application)
    logger.info(f"Created application {application_id}")

    db["borrowers"].update_many(
        {"_id": {"$in": borrower_ids}},
        {"$set": {"application_id": application_id}},
    )

    return serialize_doc(application)


def get_application(application_id: str) -> dict | None:
    """Get full application with related documents and credit reports."""
    db = _get_db()

    app = db["applications"].find_one({"application_id": application_id})
    if not app:
        return None
    logger.info(f"Fetched application {application_id}")

    app = serialize_doc(app)

    # Attach documents
    docs = db["documents"].find({"application_id": application_id})
    app["documents"] = [serialize_doc(d) for d in docs]

    # Attach credit reports
    if app.get("borrower_ids"):
        borrower_oids = [ObjectId(bid) for bid in app["borrower_ids"]]
        reports = db["credit_reports"].find({"borrower_id": {"$in": borrower_oids}})
        app["credit_reports"] = [serialize_doc(r) for r in reports]

    return app


def list_applications(skip: int = 0, limit: int = 50) -> list[dict]:
    """List all applications (summary view)."""
    db = _get_db()
    apps = db["applications"].find(
        {},
        {
            "application_id": 1,
            "borrower_names": 1,
            "loan_amount": 1,
            "product": 1,
            "status": 1,
            "created_at": 1,
        },
    ).sort("created_at", -1).skip(skip).limit(limit)
    result = [serialize_doc(a) for a in apps]
    logger.info(f"Listed {len(result)} applications")
    return result


SEED_APPLICATION_IDS = {
    "marcus-delgado": "APP-2026-00001",
}


def clone_demo_documents(source_app_id: str, target_app_id: str) -> int:
    """Clone all documents from a seeded application to a new application."""
    db = _get_db()
    source_docs = list(db["documents"].find({"application_id": source_app_id}))
    if not source_docs:
        logger.warning(f"No source documents found for {source_app_id}")
        return 0
    now = datetime.now(timezone.utc)
    clones = []
    for doc in source_docs:
        clone = {k: v for k, v in doc.items() if k != "_id"}
        clone["application_id"] = target_app_id
        clone["created_at"] = now
        clones.append(clone)
    if clones:
        db["documents"].insert_many(clones)
    logger.info(f"Cloned {len(clones)} documents from {source_app_id} to {target_app_id}")
    return len(clones)


def _reset_application_state(app_id: str) -> None:
    """Wipe all transient state for an application (conversations, interventions, checkpoints, agent_activity)."""
    db = _get_db()
    now = datetime.now(timezone.utc)
    db["applications"].update_one(
        {"application_id": app_id},
        {
            "$set": {
                "status": "submitted",
                "updated_at": now,
                "status_history": [
                    {"status": "submitted", "timestamp": now, "detail": "Application received (demo reset)"}
                ],
            },
        },
    )
    db["conversations"].delete_many({"application_id": app_id})
    db["interventions"].delete_many({"application_id": app_id})
    db["checkpoints"].delete_many({"thread_id": app_id})
    db["checkpoint_writes"].delete_many({"thread_id": app_id})
    try:
        db["agent_activity"].delete_many({"application_id": app_id})
    except Exception as e:
        logger.warning(f"Could not delete agent_activity for {app_id}: {e}")
    logger.info(f"Reset application state for {app_id}")


def upsert_demo_application(profile_id: str, demo_session_id: str, data: dict) -> dict:
    """Create or reset a session-isolated demo application.

    If an application already exists for (profile_id, demo_session_id), reset it.
    Otherwise create a new one and clone documents from the seeded profile.
    """
    db = _get_db()
    existing = db["applications"].find_one({
        "profile_id": profile_id,
        "demo_session_id": demo_session_id,
    })

    if existing:
        app_id = existing["application_id"]
        _reset_application_state(app_id)
        logger.info(f"Reset existing demo application {app_id} for session {demo_session_id[:8]}")
        return {"application_id": app_id, "status": "submitted", "reset": True}

    app = create_application(data, profile_id=profile_id, demo_session_id=demo_session_id)
    app_id = app["application_id"]

    seed_app_id = SEED_APPLICATION_IDS.get(profile_id)
    if seed_app_id:
        clone_demo_documents(seed_app_id, app_id)

    return {"application_id": app_id, "status": "submitted", "reset": False}


def reset_all_demo_data() -> dict:
    """Wipe all demo-created applications and related data. Preserves seeded data."""
    db = _get_db()
    demo_apps = list(db["applications"].find(
        {"demo_session_id": {"$exists": True}},
        {"application_id": 1, "borrower_ids": 1},
    ))
    if not demo_apps:
        return {"deleted_applications": 0}

    app_ids = [a["application_id"] for a in demo_apps]
    borrower_ids = []
    for a in demo_apps:
        for bid in a.get("borrower_ids", []):
            borrower_ids.append(bid if isinstance(bid, ObjectId) else ObjectId(bid))

    db["documents"].delete_many({"application_id": {"$in": app_ids}})
    db["conversations"].delete_many({"application_id": {"$in": app_ids}})
    db["interventions"].delete_many({"application_id": {"$in": app_ids}})
    db["checkpoints"].delete_many({"thread_id": {"$in": app_ids}})
    db["checkpoint_writes"].delete_many({"thread_id": {"$in": app_ids}})
    try:
        db["agent_activity"].delete_many({"application_id": {"$in": app_ids}})
    except Exception as e:
        logger.warning(f"Could not delete agent_activity: {e}")
    if borrower_ids:
        db["borrowers"].delete_many({"_id": {"$in": borrower_ids}})
    result = db["applications"].delete_many({"demo_session_id": {"$exists": True}})
    logger.info(f"Reset demo: deleted {result.deleted_count} applications")
    return {"deleted_applications": result.deleted_count}


def update_application_status(application_id: str, status: str, detail: str = "") -> bool:
    """Update application status and append to history."""
    # Validate status
    try:
        ApplicationStatus(status)
    except ValueError:
        raise ValueError(f"Invalid application status: {status}")
    logger.info(f"Updating application {application_id} status to '{status}'")
    db = _get_db()
    now = datetime.now(timezone.utc)
    result = db["applications"].update_one(
        {"application_id": application_id},
        {
            "$set": {"status": status, "updated_at": now},
            "$push": {
                "status_history": {
                    "status": status,
                    "timestamp": now,
                    "detail": detail,
                }
            },
        },
    )
    return result.modified_count > 0
