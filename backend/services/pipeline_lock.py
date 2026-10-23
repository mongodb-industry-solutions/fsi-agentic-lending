"""Distributed pipeline lock via MongoDB."""
from datetime import datetime, timezone
from pymongo.errors import DuplicateKeyError
from db.mdb import coll, get_db as _get_db


def acquire_pipeline_lock(app_id: str) -> bool:
    """Attempt to acquire a distributed pipeline lock via MongoDB.

    Uses insert with unique ``_id`` as an atomic compare-and-swap so only one
    process / pod can run the pipeline for a given application at a time.
    Release deletes the document; the TTL index on ``locked_at`` acts as a
    safety net for locks orphaned by crashes.
    """
    db = _get_db()
    try:
        coll("pipeline_locks").insert_one({
            "_id": app_id,
            "locked_at": datetime.now(timezone.utc),
        })
        return True
    except DuplicateKeyError:
        return False


def release_pipeline_lock(app_id: str):
    db = _get_db()
    coll("pipeline_locks").delete_one({"_id": app_id})
