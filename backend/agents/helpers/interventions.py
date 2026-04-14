"""Consolidated intervention creation for all pipeline agents."""
import logging
from datetime import datetime, timezone

from db.mdb import get_db

logger = logging.getLogger(__name__)


def create_intervention(
    application_id: str,
    intervention_type: str,
    source_node: str,
    risk_flag: str,
    severity: str,
    borrower_summary: str,
    action_required: str,
    doc_types: list[str] | None = None,
    internal_extras: dict | None = None,
) -> bool:
    """Insert an intervention document into MongoDB.

    Returns True on success, False on failure (logged, never raised).
    """
    try:
        db = get_db()

        existing = db["interventions"].find_one({
            "application_id": application_id,
            "type": intervention_type,
            "status": "pending",
        })
        if existing:
            logger.info(f"Skipping duplicate {intervention_type} intervention for {application_id}")
            return True

        internal_context = {
            "source_node": source_node,
            "risk_flag": risk_flag,
            "severity": severity,
        }
        if internal_extras:
            internal_context.update(internal_extras)

        db["interventions"].insert_one({
            "application_id": application_id,
            "type": intervention_type,
            "status": "pending",
            "internal_context": internal_context,
            "borrower_context": {
                "summary": borrower_summary,
                "action_required": action_required,
                "document_types_accepted": doc_types or [],
            },
            "resolution": None,
            "created_at": datetime.now(timezone.utc),
            "resolved_at": None,
        })
        return True
    except Exception as e:
        logger.warning(f"Failed to create {intervention_type} intervention for {application_id}: {e}")
        return False
