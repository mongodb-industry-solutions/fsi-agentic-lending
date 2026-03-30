"""MongoDB tools available to LangGraph agents."""
import os
from datetime import datetime, timezone
from db.mdb import get_db as _get_db


def get_application_documents(application_id: str) -> list[dict]:
    """Fetch all documents for an application."""
    db = _get_db()
    docs = list(db["documents"].find(
        {"application_id": application_id},
        {"_id": 0, "doc_type": 1, "filename": 1, "extracted_text": 1, "structured_data": 1, "status": 1}
    ))
    return docs


def get_credit_reports(application_id: str) -> list[dict]:
    """Fetch credit reports for all borrowers on an application."""
    db = _get_db()
    app = db["applications"].find_one({"application_id": application_id})
    if not app:
        return []

    reports = list(db["credit_reports"].find(
        {"borrower_id": {"$in": app.get("borrower_ids", [])}},
        {"_id": 0, "borrower_name": 1, "score": 1, "accounts": 1, "total_outstanding": 1, "payment_history": 1, "inquiries": 1, "derogatory_items": 1}
    ))
    return reports


def get_application_summary(application_id: str) -> dict:
    """Get application summary including income, property, loan details."""
    db = _get_db()
    app = db["applications"].find_one(
        {"application_id": application_id},
        {"_id": 0, "application_id": 1, "borrower_names": 1, "loan_amount": 1, "purchase_price": 1, "down_payment": 1, "product": 1, "property": 1, "income_summary": 1, "status": 1}
    )
    return app or {}


def search_policies(query: str, limit: int = 5) -> list[dict]:
    """Search underwriting policies via Atlas Vector Search (autoEmbed).

    With autoEmbed, we pass queryString instead of queryVector.
    """
    db = _get_db()

    try:
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "policies_auto_embed_idx",
                    "path": "content",
                    "queryString": query,
                    "numCandidates": 50,
                    "limit": limit,
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "policy_id": 1,
                    "title": 1,
                    "content": 1,
                    "score": {"$meta": "vectorSearchScore"},
                }
            },
        ]
        results = list(db["underwriting_policies"].aggregate(pipeline))
        return results
    except Exception as e:
        # Fallback if vector search index not ready
        import logging
        logging.getLogger(__name__).warning(f"Vector search failed, falling back to scan: {e}")
        results = list(db["underwriting_policies"].find({}, {"_id": 0, "policy_id": 1, "title": 1, "content": 1}).limit(limit))
        return results


def log_agent_activity(application_id: str, agent: str, action: str, detail: str, checkpoint_id: str = None):
    """Log an agent action to the agent_activity time-series collection."""
    db = _get_db()
    db["agent_activity"].insert_one({
        "application_id": application_id,
        "agent": agent,
        "action": action,
        "detail": detail,
        "checkpoint_id": checkpoint_id,
        "timestamp": datetime.now(timezone.utc),
    })


def update_application_status(application_id: str, status: str, detail: str = ""):
    """Update application status."""
    db = _get_db()
    now = datetime.now(timezone.utc)
    db["applications"].update_one(
        {"application_id": application_id},
        {
            "$set": {"status": status, "updated_at": now},
            "$push": {"status_history": {"status": status, "timestamp": now, "detail": detail}},
        }
    )
