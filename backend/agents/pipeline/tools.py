"""MongoDB tools available to LangGraph pipeline agents."""
import logging
import time as _time
from datetime import datetime, timezone
from db.mdb import coll
from db.collections_config import resolve
from db.storage_mapping import from_storage, storage_key, to_storage
from services.application_service import (
    read_loan,
    update_application_status as _update_application_status,
)
from services.vector_search import (
    search_policies,
    search_documents,
    OFFICER_PROJECTION,
    BORROWER_SAFE_PROJECTION,
)


def _k(runtime_path: str) -> str:
    """Runtime field path -> storage path on the `loans` collection."""
    return storage_key("applications", runtime_path)


def _doc_k(runtime_path: str) -> str:
    """Runtime field path -> storage path on `lendingDocuments`."""
    return storage_key("documents", runtime_path)


def get_application_documents(application_id: str) -> list[dict]:
    """Fetch all documents for an application."""
    fields = ("doc_type", "filename", "extracted_text", "structured_data", "status")
    projection = {_doc_k(f): 1 for f in fields}
    projection["_id"] = 0
    docs = coll("documents").find({_doc_k("application_id"): application_id}, projection)
    return [from_storage("documents", d) for d in docs]


def get_credit_reports(application_id: str) -> list[dict]:
    """Fetch credit reports for all borrowers on an application."""
    stored = coll("applications").find_one({_k("application_id"): application_id})
    if not stored:
        return []

    borrower_ids = from_storage("applications", stored).get("borrower_ids", [])
    cr_k = lambda f: storage_key("credit_reports", f)  # noqa: E731
    fields = ("borrower_name", "score", "accounts", "total_outstanding",
              "payment_history", "inquiries", "derogatory_items", "borrower_id")
    projection = {cr_k(f): 1 for f in fields}
    projection["_id"] = 0
    reports = [
        from_storage("credit_reports", r)
        for r in coll("credit_reports").find(
            {cr_k("borrower_id"): {"$in": borrower_ids}}, projection
        )
    ]

    sorted_reports = []
    for bid in borrower_ids:
        match = next((r for r in reports if r.get("borrower_id") == bid), None)
        if match:
            sorted_reports.append(match)
    return sorted_reports


def get_application_summary(application_id: str) -> dict:
    """Get application summary including income, property, loan details."""
    fields = ("application_id", "borrower_names", "loan_amount", "purchase_price",
              "down_payment", "product", "property", "income_summary")
    projection = {_k(f): 1 for f in fields}
    projection["_id"] = 0
    projection["statusSource"] = 1
    stored = coll("applications").find_one({_k("application_id"): application_id}, projection)
    return read_loan(stored) if stored else {}


_logger = logging.getLogger(__name__)


def log_agent_activity(application_id: str, agent: str, action: str, detail: str, checkpoint_id: str = None, run_id: str = None):
    """Log an agent action to the agent_activity collection."""
    try:
        entry = {
            "application_id": application_id,
            "agent": agent,
            "action": action,
            "detail": detail,
            "checkpoint_id": checkpoint_id,
            "timestamp": datetime.now(timezone.utc),
        }
        if run_id:
            entry["run_id"] = run_id
        coll("agent_activity").insert_one(to_storage("agent_activity", entry))
    except Exception as e:
        _logger.warning(f"Failed to log agent activity for {application_id}: {e}")


def run_risk_aggregation(application_id: str) -> dict:
    """Run a 7-stage MongoDB aggregation pipeline for risk scoring.

    Stages: $match -> $lookup(credit) -> $lookup(docs) -> $addFields(ratios) ->
            $addFields(risk_points) -> $addFields(risk_score) -> $project
    """
    start = _time.monotonic()

    cr_from = resolve("credit_reports")
    doc_from = resolve("documents")
    pipeline = [
        {"$match": {_k("application_id"): application_id}},

        {"$lookup": {
            "from": cr_from,
            "localField": _k("borrower_ids") + ".customerId",
            "foreignField": storage_key("credit_reports", "borrower_id"),
            "as": "credit_data",
        }},

        {"$lookup": {
            "from": doc_from,
            "let": {"app_id": "$" + _k("application_id")},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$" + _doc_k("application_id"), "$$app_id"]}}},
                {"$match": {_doc_k("doc_type"): {
                    "$in": ["employment_letter", "income_tax", "paystubs"]
                }}},
                {"$project": {"_id": 0, _doc_k("doc_type"): 1, _doc_k("status"): 1}},
            ],
            "as": "income_docs",
        }},

        {"$addFields": {
            "monthly_income": {"$divide": [
                {"$ifNull": ["$" + _k("income_summary.combined_gross"), 0]}, 12
            ]},
            "primary_credit_score": {"$arrayElemAt": ["$credit_data.score", 0]},
            "co_credit_score": {"$arrayElemAt": ["$credit_data.score", 1]},
            "ltv": {"$cond": {
                "if": {"$gt": ["$" + _k("purchase_price"), 0]},
                "then": {"$multiply": [
                    {"$divide": ["$" + _k("loan_amount"), "$" + _k("purchase_price")]}, 100
                ]},
                "else": 100,
            }},
            "doc_count": {"$size": "$income_docs"},
        }},

        {"$addFields": {
            "credit_risk_points": {"$add": [
                {"$cond": [{"$gte": [{"$ifNull": [{"$arrayElemAt": ["$credit_data.score", 0]}, 0]}, 750]}, -25,
                    {"$cond": [{"$gte": [{"$ifNull": [{"$arrayElemAt": ["$credit_data.score", 0]}, 0]}, 700]}, -15,
                        {"$cond": [{"$gte": [{"$ifNull": [{"$arrayElemAt": ["$credit_data.score", 0]}, 0]}, 680]}, -5, 0]}
                    ]}
                ]},
                {"$cond": [{"$gte": [{"$ifNull": [{"$arrayElemAt": ["$credit_data.score", 1]}, 0]}, 750]}, -10, 0]},
            ]},
            "ltv_risk_points": {"$cond": [{"$lte": ["$ltv", 80]}, -15, 0]},
        }},

        {"$addFields": {
            "risk_score": {"$max": [0, {"$min": [100,
                {"$add": [100, "$credit_risk_points", "$ltv_risk_points"]}
            ]}]},
        }},

        # Computed fields keep their runtime names; stored fields are renamed
        # back so the caller sees a native-shaped result.
        {"$project": {
            "_id": 0,
            "application_id": "$" + _k("application_id"),
            "loan_amount": "$" + _k("loan_amount"),
            "purchase_price": "$" + _k("purchase_price"),
            "risk_score": 1,
            "monthly_income": 1,
            "ltv": 1,
            "primary_credit_score": 1,
            "co_credit_score": 1,
            "doc_count": 1,
            "credit_risk_points": 1,
            "ltv_risk_points": 1,
        }},
    ]

    results = list(coll("applications").aggregate(pipeline))
    elapsed_ms = round((_time.monotonic() - start) * 1000)

    log_agent_activity(
        application_id, "underwriter", "aggregation_pipeline",
        f"7-stage aggregation pipeline completed in {elapsed_ms}ms"
    )

    result = results[0] if results else {}
    result["pipeline_elapsed_ms"] = elapsed_ms
    result["pipeline_stages"] = 7
    return result


def update_application_status(application_id: str, status: str, detail: str = ""):
    """Update application status.

    Delegates to the application service rather than writing directly. A status
    write must set both `statusSource` (operational) and `status` (the BIAN
    projection); having two write paths is how those two drift apart.
    """
    _update_application_status(application_id, status, detail)
