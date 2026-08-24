"""Document service — handles document CRUD operations."""
import logging
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from db.mdb import get_db as _get_db
from db.collections_config import NAMES
from services.application_service import serialize_doc

logger = logging.getLogger(__name__)


def list_documents(application_id: str) -> list[dict]:
    """List all documents for an application."""
    db = _get_db()
    docs = db[NAMES.documents].find({"application_id": application_id}).sort("created_at", 1)
    result = [serialize_doc(d) for d in docs]
    logger.info(f"Listed {len(result)} documents for application {application_id}")
    return result


def get_document(doc_id: str) -> dict | None:
    """Get a single document by ID."""
    try:
        oid = ObjectId(doc_id)
    except (InvalidId, Exception):
        return None
    db = _get_db()
    doc = db[NAMES.documents].find_one({"_id": oid})
    return serialize_doc(doc)
