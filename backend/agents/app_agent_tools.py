"""Borrower-safe tools for the Application Agent.

All tools use MongoDB projection allowlists (not denylists) to ensure
internal fields like risk_score, officer_notes, internal_context, and
decision_reasoning are NEVER returned to the borrower-facing agent.
"""
import logging
from datetime import datetime, timezone

from db.mdb import get_db
from services.embedding_service import embed_query

logger = logging.getLogger(__name__)


def search_policies_borrower(query: str, limit: int = 5) -> list[dict]:
    """Search underwriting policies -- borrower-visible content only.

    Uses the same Atlas Vector Search index as the officer pipeline but
    projects only safe fields (title, content, category, section).
    """
    db = get_db()
    try:
        query_vector = embed_query(query)
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "policies_vector_idx",
                    "path": "embedding",
                    "queryVector": query_vector,
                    "numCandidates": 50,
                    "limit": limit,
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "policy_id": 1,
                    "title": 1,
                    "section": 1,
                    "content": 1,
                    "category": 1,
                    "score": {"$meta": "vectorSearchScore"},
                    # Explicitly excluded: internal_notes, risk_weights, override_rules
                }
            },
        ]
        results = list(db["underwriting_policies"].aggregate(pipeline))
        return results
    except Exception as e:
        logger.error(f"Borrower policy search failed: {e}")
        return []


def get_document_requirements(loan_type: str = "standard") -> list[dict]:
    """Return list of required documents for the loan type.

    Returns a structured list with labels, descriptions, and required status.
    """
    requirements = [
        {
            "type": "government_id",
            "label": "Government-issued ID",
            "required": True,
            "description": "Valid driver's licence, passport, or provincial ID",
        },
        {
            "type": "employment_letter",
            "label": "Employment Letter",
            "required": True,
            "description": "Current employer letter confirming position, salary, and tenure",
        },
        {
            "type": "paystubs",
            "label": "Pay Stubs",
            "required": True,
            "description": "Most recent 3-6 months of pay stubs",
        },
        {
            "type": "income_tax",
            "label": "CRA Tax Notices (NOA)",
            "required": True,
            "description": "Most recent 2 years of Notice of Assessment",
        },
        {
            "type": "bank_statements",
            "label": "Bank Statements",
            "required": True,
            "description": "3 consecutive months of primary bank account statements",
        },
        {
            "type": "purchase_agreement",
            "label": "Purchase Agreement",
            "required": True,
            "description": "Signed Agreement of Purchase and Sale",
        },
        {
            "type": "credit_report",
            "label": "Credit Report",
            "required": False,
            "description": "Pulled automatically by the system -- no action needed from you",
        },
        {
            "type": "property_inspection",
            "label": "Property Inspection",
            "required": False,
            "description": "May be required depending on property type and location",
        },
    ]
    return requirements


def get_application_documents_summary(application_id: str) -> list[dict]:
    """Return lightweight document inventory for an application (no embeddings or full text)."""
    db = get_db()
    return list(db["documents"].find(
        {"application_id": application_id},
        {"_id": 0, "doc_type": 1, "status": 1, "filename": 1},
    ))


def get_application_status_filtered(application_id: str) -> dict:
    """Get application status -- borrower-safe fields only.

    Uses a projection allowlist. NEVER projects: risk_score, officer_notes,
    internal_flags, decision_reasoning, risk_tier.
    """
    db = get_db()
    app = db["applications"].find_one(
        {"application_id": application_id},
        {
            "_id": 0,
            "application_id": 1,
            "status": 1,
            "status_history": 1,
            "loan_amount": 1,
            "purchase_price": 1,
            "product": 1,
            "borrower_names": 1,
            "created_at": 1,
            "updated_at": 1,
        },
    )
    if not app:
        return {"error": "Application not found"}
    return app


def get_pending_interventions(application_id: str) -> list[dict]:
    """Get pending interventions -- borrower_context only, never internal_context.

    Uses a projection allowlist that explicitly includes only borrower-safe fields.
    """
    db = get_db()
    interventions = list(
        db["interventions"].find(
            {
                "application_id": application_id,
                "status": {"$in": ["pending", "active"]},
            },
            {
                "_id": 1,
                "type": 1,
                "status": 1,
                "borrower_context": 1,  # SAFE -- written for the borrower
                "created_at": 1,
                # NEVER project: internal_context, severity, source_node, risk_flag
            },
        )
    )
    for intv in interventions:
        intv["_id"] = str(intv["_id"])
    return interventions


def submit_intervention_response(
    intervention_id: str, response: str, documents_uploaded: list = None
) -> dict:
    """Resolve an intervention with the borrower's response.

    Updates the intervention status to 'resolved' and records the resolution details.
    Only resolves interventions that are currently 'pending' or 'active'.
    """
    from bson import ObjectId

    db = get_db()
    result = db["interventions"].update_one(
        {"_id": ObjectId(intervention_id), "status": {"$in": ["pending", "active"]}},
        {
            "$set": {
                "status": "resolved",
                "resolved_at": datetime.now(timezone.utc),
                "resolution": {
                    "user_response": response,
                    "documents_uploaded": documents_uploaded or [],
                    "resolved_by": "application_agent",
                },
            }
        },
    )
    if result.modified_count == 0:
        return {"error": "Intervention not found or already resolved"}
    logger.info(f"Resolved intervention {intervention_id}")
    return {"status": "resolved", "intervention_id": intervention_id}
