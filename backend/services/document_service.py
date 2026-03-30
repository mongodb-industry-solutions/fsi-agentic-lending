"""Document service — handles document CRUD operations."""
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from db.mdb import get_db as _get_db
from services.application_service import serialize_doc


def list_documents(application_id: str) -> list[dict]:
    """List all documents for an application."""
    db = _get_db()
    docs = db["documents"].find({"application_id": application_id}).sort("created_at", 1)
    return [serialize_doc(d) for d in docs]


def get_document(doc_id: str) -> dict | None:
    """Get a single document by ID."""
    try:
        oid = ObjectId(doc_id)
    except (InvalidId, Exception):
        return None
    db = _get_db()
    doc = db["documents"].find_one({"_id": oid})
    return serialize_doc(doc)
