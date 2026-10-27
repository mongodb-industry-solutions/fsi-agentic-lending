"""Borrower-safe tools for the Application Agent.

All tools use MongoDB projection allowlists (not denylists) to ensure
internal fields like risk_score, officer_notes, internal_context, and
decision_reasoning are NEVER returned to the borrower-facing agent.
"""
import logging
from datetime import datetime, timezone

from db.mdb import coll, get_db
from db.storage_mapping import from_storage, storage_filter, storage_key, to_storage
from services.vector_search import search_policies, BORROWER_SAFE_PROJECTION

logger = logging.getLogger(__name__)


def search_policies_borrower(query: str, limit: int = 5) -> list[dict]:
    """Search underwriting policies -- borrower-visible content only.

    Uses the same Atlas Vector Search index as the officer pipeline but
    projects only safe fields (title, content, category, section).
    Returns [] on any error to avoid leaking internal details into borrower context.
    """
    try:
        results = search_policies(query, limit=limit, projection=BORROWER_SAFE_PROJECTION)
        return [r for r in results if r.get("policy_id") != "SEARCH_UNAVAILABLE"]
    except Exception as e:
        logger.error(f"Borrower policy search failed: {e}")
        return []


def get_document_requirements(loan_type: str = "standard") -> list[dict]:
    """Return list of required documents for the loan type.

    The `type` keys must stay in lockstep with DOC_TYPES in
    scripts/ingest_pdfs.py — the checklist is built by looking up each
    requirement against the documents actually on file, so any type that
    is seeded but missing here would be invisible to the borrower.
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
            "type": "mortgage_application",
            "label": "Mortgage Application",
            "required": True,
            "description": "Completed and signed mortgage application form",
        },
        {
            "type": "investment_statements",
            "label": "Investment Statements",
            "required": False,
            "description": "RRSP, TFSA, or non-registered account statements supporting your down payment",
        },
        {
            "type": "other_property_docs",
            "label": "Existing Property Docs",
            "required": False,
            "description": "Mortgage statements and tax notices for any property you already own",
        },
        {
            "type": "utility_bills",
            "label": "Utility Bills",
            "required": False,
            "description": "Recent utility bill used to confirm your current address",
        },
        {
            "type": "credit_report",
            "label": "Credit Report",
            "required": False,
            "description": "Pulled automatically by the system -- no action needed from you",
        },
        {
            "type": "car_loan_statement",
            "label": "Car Loan Statement",
            "required": False,
            "description": "Current auto loan or lease statement, if you carry one",
        },
        {
            "type": "property_tax",
            "label": "Property Tax Notice",
            "required": False,
            "description": "Most recent municipal property tax assessment for the subject property",
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
    doc_k = lambda f: storage_key("documents", f)  # noqa: E731
    return [
        from_storage("documents", d)
        for d in coll("documents").find(
            storage_filter("documents", {"application_id": application_id}),
            {"_id": 0, doc_k("doc_type"): 1, "status": 1, doc_k("filename"): 1},
        )
    ]


def get_application_status_filtered(application_id: str) -> dict:
    """Get application status -- borrower-safe fields only.

    Uses a projection allowlist. NEVER projects: risk_score, officer_notes,
    internal_flags, decision_reasoning, risk_tier.
    """
    # Allowlist projection. Since the BIAN migration every internal field the
    # borrower must not see — risk_score, risk_tier, decision_reasoning — lives
    # under the single `assessment` sub-record, so it is excluded by omission.
    # NEVER add `assessment` here: one key would leak all ten at once.
    k = lambda f: storage_key("applications", f)  # noqa: E731
    projection = {
        "_id": 0,
        "statusSource": 1,
        **{k(f): 1 for f in (
            "application_id", "status_history", "loan_amount",
            "purchase_price", "product", "borrower_names",
            "created_at", "updated_at",
        )},
    }
    stored = coll("applications").find_one({k("application_id"): application_id}, projection)
    if not stored:
        return {"error": "Application not found"}
    from services.application_service import read_loan
    return read_loan(stored)


def get_pending_interventions(application_id: str) -> list[dict]:
    """Get pending interventions -- borrower_context only, never internal_context."""
    db = get_db()
    interventions = list(
        coll("interventions").find(
            storage_filter("interventions", {
                "application_id": application_id,
                "status": {"$in": ["pending", "active"]},
            }),
            {
                "_id": 1,
                "type": 1,
                "status": 1,
                storage_key("interventions", "borrower_context"): 1,
                storage_key("interventions", "created_at"): 1,
            },
        )
    )
    for intv in interventions:
        intv["_id"] = str(intv["_id"])
    return interventions


# ---------------------------------------------------------------------------
# Generative UI data functions — structured payloads for inline components
# ---------------------------------------------------------------------------


def get_document_checklist_data(application_id: str) -> dict:
    """Get document checklist with real-time status for each requirement."""
    reqs = get_document_requirements()
    submitted = get_application_documents_summary(application_id)
    submitted_types = {d.get("doc_type"): d.get("status", "missing") for d in submitted if d.get("doc_type")}
    items = []
    for r in reqs:
        status = submitted_types.get(r["type"], "missing")
        items.append({
            "type": r["type"],
            "label": r["label"],
            "required": r["required"],
            "description": r["description"],
            "status": status,
        })
    complete = sum(1 for i in items if i["status"] in ("verified", "processed", "parsed"))
    return {"items": items, "complete": complete, "total": len(items)}


def get_closing_timeline_data(application_id: str) -> dict:
    """Closing timeline steps for post-approval display.

    Currently hardcoded for demo — all approved apps start at the same
    step. Extend to query application.closing_stage when that field exists.
    """
    return {
        "steps": [
            {
                "label": "Rate Lock",
                "status": "complete",
                "detail": "Rate locked for 120 days",
            },
            {
                "label": "Document Preparation",
                "status": "active",
                "detail": "Final mortgage documents being prepared",
            },
            {
                "label": "Signing",
                "status": "upcoming",
                "detail": "Schedule signing with your lawyer",
            },
            {
                "label": "Funding",
                "status": "upcoming",
                "detail": "Mortgage funds disbursed to seller",
            },
        ],
    }


def submit_intervention_response(
    intervention_id: str, response: str, application_id: str = None, documents_uploaded: list = None
) -> dict:
    """Resolve an intervention with the borrower's response."""
    from bson import ObjectId
    from bson.errors import InvalidId

    try:
        oid = ObjectId(intervention_id)
    except (InvalidId, TypeError):
        return {"error": "Invalid intervention ID format"}

    query = {"_id": oid, "status": {"$in": ["pending", "active"]}}
    if application_id:
        query[storage_key("interventions", "application_id")] = application_id
    result = coll("interventions").update_one(
        query,
        {
            "$set": to_storage("interventions", {
                "status": "resolved",
                "resolved_at": datetime.now(timezone.utc),
                "resolution": {
                    "user_response": response,
                    "documents_uploaded": documents_uploaded or [],
                    "resolved_by": "application_agent",
                },
            })
        },
    )
    if result.modified_count == 0:
        return {"error": "Intervention not found or already resolved"}
    logger.info(f"Resolved intervention {intervention_id}")
    return {"status": "resolved", "intervention_id": intervention_id}
