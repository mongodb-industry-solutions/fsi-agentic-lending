"""Document service — handles document CRUD operations."""
from datetime import datetime, timezone
from db.mdb import MongoDBConnector
from services.application_service import serialize_doc


def _get_db():
    connector = MongoDBConnector()
    return connector.db


def list_documents(application_id: str) -> list[dict]:
    """List all documents for an application."""
    db = _get_db()
    docs = db["documents"].find({"application_id": application_id}).sort("created_at", 1)
    return [serialize_doc(d) for d in docs]


def get_document(doc_id: str) -> dict | None:
    """Get a single document by ID."""
    from bson import ObjectId

    db = _get_db()
    doc = db["documents"].find_one({"_id": ObjectId(doc_id)})
    return serialize_doc(doc)
