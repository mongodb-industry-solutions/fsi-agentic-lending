"""Document service — handles document CRUD operations."""
import logging
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from db.mdb import coll, get_db as _get_db
from db.storage_mapping import from_storage, storage_filter, storage_key
from services.application_service import serialize_doc

logger = logging.getLogger(__name__)


def list_documents(application_id: str) -> list[dict]:
    """List all documents for an application."""
    docs = coll("documents").find(
        storage_filter("documents", {"application_id": application_id})
    ).sort(storage_key("documents", "created_at"), 1)
    result = [serialize_doc(from_storage("documents", d)) for d in docs]
    logger.info(f"Listed {len(result)} documents for application {application_id}")
    return result


def get_document(doc_id: str) -> dict | None:
    """Get a single document by ID."""
    try:
        oid = ObjectId(doc_id)
    except (InvalidId, Exception):
        return None
    db = _get_db()
    doc = coll("documents").find_one({"_id": oid})
    return serialize_doc(doc)
