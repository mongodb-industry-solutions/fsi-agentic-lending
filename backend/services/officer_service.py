"""Loan officer service — the reviewing officer persona.

The demo has rich borrower personas but no officer identity; decisions were
attributed to a hardcoded `officer-demo` string. This introduces a single seeded
loan officer that flows through decision attribution (HITL audit, activity log,
status detail) and is displayed in the officer dashboard header.

Currently a singleton (`get_current_officer`), but shaped so multiple officers
can be added later without changing callers.
"""
import logging

from db.mdb import coll
from db.storage_mapping import from_storage, storage_filter, storage_key, to_storage
from services.application_service import serialize_doc

logger = logging.getLogger(__name__)

OFFICER_ID = "officer-001"

# The seeded reviewing officer. Also used as a graceful fallback if the DB has
# not been seeded yet, so the officer view works out of the box.
DEFAULT_OFFICER = {
    "officer_id": OFFICER_ID,
    "full_name": "Curtis Dean",
    "title": "Loan Officer",
    "nmls_id": "1120394",
    "email": "curtis.dean@lendflow.example",
    "avatar_seed": "curtis-dean",
    "seed_complete": True,
}


def seed_officer() -> None:
    """Idempotently upsert the singleton loan officer."""
    coll("officers").update_one(
        storage_filter("officers", {"officer_id": OFFICER_ID}),
        {"$set": to_storage("officers", DEFAULT_OFFICER)},
        upsert=True,
    )


def get_current_officer() -> dict:
    """Return the current reviewing officer (serialized), seeded or fallback."""
    try:
        doc = coll("officers").find_one(
            storage_filter("officers", {"officer_id": OFFICER_ID}), {"_id": 0}
        )
        if doc:
            return serialize_doc(from_storage("officers", doc))
    except Exception as e:  # pragma: no cover - defensive; fall back to constant
        logger.warning(f"Officer lookup failed, using default: {e}")
    return {k: v for k, v in DEFAULT_OFFICER.items() if k != "seed_complete"}


def get_officer_display(officer_id: str) -> str:
    """Human-readable attribution string for an officer_id (e.g. audit detail).

    Falls back to the raw id for unknown officers so attribution never breaks.
    """
    if not officer_id:
        return "an officer"
    try:
        stored = coll("officers").find_one(
            storage_filter("officers", {"officer_id": officer_id}),
            {"_id": 0, storage_key("officers", "full_name"): 1, "title": 1},
        )
        doc = from_storage("officers", stored) if stored else None
        if doc and doc.get("full_name"):
            title = doc.get("title")
            return f"{doc['full_name']} ({title})" if title else doc["full_name"]
    except Exception as e:  # pragma: no cover - defensive
        logger.warning(f"Officer display lookup failed for {officer_id}: {e}")
    if officer_id == OFFICER_ID:
        return f"{DEFAULT_OFFICER['full_name']} ({DEFAULT_OFFICER['title']})"
    return officer_id
