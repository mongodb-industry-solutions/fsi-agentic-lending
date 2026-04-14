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
        "existing_monthly_debt": data.get("existing_monthly_debt", 0),
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
    "jane-doe": "APP-2026-00002",
    "john-smith": "APP-2026-00003",
    "bob-johnson": "APP-2026-00004",
    "sarah-williams": "APP-2026-00005",
}


def _patch_structured_data_names(structured_data: dict, source_names: list[str], target_names: list[str]) -> dict:
    """Patch person names in structured_data when cloning docs across profiles.

    Replaces source borrower names with target borrower names in the ``persons``
    array (used by government_id, employment_letter, credit_report, etc.).
    Returns a new dict — does not mutate the input.
    """
    if not structured_data or not source_names or not target_names:
        return structured_data
    patched = dict(structured_data)
    persons = patched.get("persons")
    if isinstance(persons, list):
        new_persons = []
        for person in persons:
            person = dict(person)  # shallow copy to avoid mutating source
            if "full_name" in person:
                for si, sname in enumerate(source_names):
                    if si < len(target_names) and person["full_name"] == sname:
                        person["full_name"] = target_names[si]
                        break
            new_persons.append(person)
        patched["persons"] = new_persons
    return patched


def clone_demo_documents(source_app_id: str, target_app_id: str) -> int:
    """Clone all documents from a seeded application to a new application.

    When cloning across profiles, patches ``structured_data.persons[].full_name``
    to match the target application's borrower names.
    """
    db = _get_db()
    source_docs = list(db["documents"].find({"application_id": source_app_id}))
    if not source_docs:
        logger.warning(f"No source documents found for {source_app_id}")
        return 0

    # Look up borrower names for name-patching when cloning across profiles
    source_app = db["applications"].find_one({"application_id": source_app_id}, {"borrower_names": 1})
    target_app = db["applications"].find_one({"application_id": target_app_id}, {"borrower_names": 1})
    source_names = source_app.get("borrower_names", []) if source_app else []
    target_names = target_app.get("borrower_names", []) if target_app else []
    needs_patch = source_names and target_names and source_names != target_names

    now = datetime.now(timezone.utc)
    clones = []
    for doc in source_docs:
        clone = {k: v for k, v in doc.items() if k not in ("_id", "content_hash")}
        clone["application_id"] = target_app_id
        clone["created_at"] = now
        if needs_patch and clone.get("structured_data"):
            clone["structured_data"] = _patch_structured_data_names(
                clone["structured_data"], source_names, target_names
            )
        clones.append(clone)
    if clones:
        db["documents"].insert_many(clones)
    logger.info(f"Cloned {len(clones)} documents from {source_app_id} to {target_app_id}")
    return len(clones)


def clone_demo_credit_reports(source_app_id: str, target_app_id: str) -> int:
    """Clone credit reports from a seeded application's borrowers to a new application's borrowers.

    Seeded credit reports are linked by borrower_id. New demo apps create fresh
    borrower ObjectIds, so we must copy reports and re-link them to the new IDs.
    """
    db = _get_db()
    source_app = db["applications"].find_one({"application_id": source_app_id}, {"borrower_ids": 1})
    target_app = db["applications"].find_one({"application_id": target_app_id}, {"borrower_ids": 1})
    if not source_app or not target_app:
        return 0

    source_bids = source_app.get("borrower_ids", [])
    target_bids = target_app.get("borrower_ids", [])
    if not source_bids or not target_bids:
        return 0

    source_reports = list(db["credit_reports"].find({"borrower_id": {"$in": source_bids}}))
    if not source_reports:
        logger.warning(f"No source credit reports found for {source_app_id}")
        return 0

    now = datetime.now(timezone.utc)
    # Build a mapping: source borrower_id → target borrower_id (positional)
    bid_map = {}
    for i, sbid in enumerate(source_bids):
        if i < len(target_bids):
            bid_map[sbid] = target_bids[i]

    clones = []
    for report in source_reports:
        new_bid = bid_map.get(report["borrower_id"])
        if not new_bid:
            continue
        clone = {k: v for k, v in report.items() if k != "_id"}
        clone["borrower_id"] = new_bid
        clone["cloned_at"] = now
        clones.append(clone)

    if clones:
        db["credit_reports"].insert_many(clones)
    logger.info(f"Cloned {len(clones)} credit reports from {source_app_id} to {target_app_id}")
    return len(clones)


def _reset_application_state(app_id: str) -> None:
    """Wipe all transient and cloned state for an application."""
    db = _get_db()
    now = datetime.now(timezone.utc)

    # Get borrower IDs for credit report cleanup
    app = db["applications"].find_one({"application_id": app_id}, {"borrower_ids": 1})
    borrower_ids = app.get("borrower_ids", []) if app else []

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
            "$unset": {
                "risk_score": "", "risk_tier": "", "gds_ratio": "", "tds_ratio": "",
                "stress_gds": "", "stress_tds": "", "primary_credit_score": "",
                "ltv": "", "decision_reasoning": "", "status_detail": "",
            },
        },
    )
    db["documents"].delete_many({"application_id": app_id})
    if borrower_ids:
        db["credit_reports"].delete_many({"borrower_id": {"$in": borrower_ids}})
    db["conversations"].delete_many({"application_id": app_id})
    db["interventions"].delete_many({"application_id": app_id})
    db["checkpoints"].delete_many({"thread_id": app_id})
    db["checkpoint_writes"].delete_many({"thread_id": app_id})
    db["pipeline_locks"].delete_many({"_id": app_id})
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
        profile = existing.get("profile_id")
        _reset_application_state(app_id)
        # Re-clone seed data after reset
        seed_app_id = SEED_APPLICATION_IDS.get(profile) or SEED_APPLICATION_IDS.get("marcus-delgado")
        if seed_app_id:
            clone_demo_documents(seed_app_id, app_id)
            clone_demo_credit_reports(seed_app_id, app_id)
        logger.info(f"Reset existing demo application {app_id} for session {demo_session_id[:8]}")
        return {"application_id": app_id, "status": "submitted", "reset": True}

    app = create_application(data, profile_id=profile_id, demo_session_id=demo_session_id)
    app_id = app["application_id"]

    # Clone seed data — fall back to default seed if profile not explicitly mapped
    seed_app_id = SEED_APPLICATION_IDS.get(profile_id) or SEED_APPLICATION_IDS.get("marcus-delgado")
    if seed_app_id:
        clone_demo_documents(seed_app_id, app_id)
        clone_demo_credit_reports(seed_app_id, app_id)

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
        db["credit_reports"].delete_many({"borrower_id": {"$in": borrower_ids}})
        db["borrowers"].delete_many({"_id": {"$in": borrower_ids}})
    result = db["applications"].delete_many({"demo_session_id": {"$exists": True}})
    logger.info(f"Reset demo: deleted {result.deleted_count} applications")
    return {"deleted_applications": result.deleted_count}


_VALID_TRANSITIONS = {
    "submitted": {"processing", "action_required", "error"},
    "processing": {"underwriting", "review", "approved", "declined", "action_required", "error"},
    "action_required": {"processing", "error"},  # processing: re-evaluate after borrower resolves
    "underwriting": {"review", "approved", "declined", "error"},
    "review": {"processing", "approved", "declined", "error", "hitl_error"},
    "approved": {"closing", "error"},
    "closing": {"funded", "error"},
    "funded": {"active", "error"},
    "active": {"error"},
    "declined": {"processing", "error"},  # Allow re-processing after decline override
    "error": {"processing", "submitted"},  # Allow retry
}


def update_application_status(application_id: str, status: str, detail: str = "") -> bool:
    """Update application status and append to history."""
    try:
        ApplicationStatus(status)
    except ValueError:
        raise ValueError(f"Invalid application status: {status}")

    # Validate transition (warn but don't block for demo flexibility)
    db = _get_db()
    current = db["applications"].find_one({"application_id": application_id}, {"status": 1})
    current_status = current.get("status") if current else None
    if current_status and current_status != status:
        allowed = _VALID_TRANSITIONS.get(current_status, set())
        if status not in allowed:
            logger.warning(
                f"Unusual status transition for {application_id}: {current_status} → {status} "
                f"(allowed: {allowed}). Proceeding anyway."
            )

    logger.info(f"Updating application {application_id} status to '{status}'")
    now = datetime.now(timezone.utc)
    result = db["applications"].update_one(
        {"application_id": application_id},
        {
            "$set": {"status": status, "status_detail": detail, "updated_at": now},
            "$push": {
                "status_history": {
                    "$each": [{"status": status, "timestamp": now, "detail": detail}],
                    "$slice": -50,
                }
            },
        },
    )
    return result.modified_count > 0
