"""Application service — handles CRUD and aggregation for loan applications."""
import os
from datetime import datetime, timezone
from bson import ObjectId
from db.mdb import MongoDBConnector


def _get_db():
    connector = MongoDBConnector()
    return connector.db


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


def create_application(data: dict) -> dict:
    """Create a new loan application with borrower records."""
    db = _get_db()
    now = datetime.now(timezone.utc)

    # Create primary borrower
    primary_borrower = {
        "full_name": data["primary_name"],
        "application_id": None,  # Will update after app creation
        "created_at": now,
    }
    primary_id = db["borrowers"].insert_one(primary_borrower).inserted_id
    borrower_ids = [primary_id]
    borrower_names = [data["primary_name"]]

    # Create co-applicant if provided
    if data.get("co_applicant_name"):
        co_borrower = {
            "full_name": data["co_applicant_name"],
            "application_id": None,
            "created_at": now,
        }
        co_id = db["borrowers"].insert_one(co_borrower).inserted_id
        borrower_ids.append(co_id)
        borrower_names.append(data["co_applicant_name"])

    # Generate application ID
    count = db["applications"].count_documents({}) + 1
    application_id = f"APP-2026-{count:05d}"

    # Create application
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

    db["applications"].insert_one(application)

    # Update borrowers with application_id
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


def list_applications() -> list[dict]:
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
    ).sort("created_at", -1)
    return [serialize_doc(a) for a in apps]


def update_application_status(application_id: str, status: str, detail: str = "") -> bool:
    """Update application status and append to history."""
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
