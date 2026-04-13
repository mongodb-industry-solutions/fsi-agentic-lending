"""MongoDB tools available to LangGraph pipeline agents."""
import logging
import time as _time
from datetime import datetime, timezone
from db.mdb import get_db as _get_db
from services.vector_search import (
    search_policies,
    search_documents,
    OFFICER_PROJECTION,
    BORROWER_SAFE_PROJECTION,
)


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

    borrower_ids = app.get("borrower_ids", [])
    reports = list(db["credit_reports"].find(
        {"borrower_id": {"$in": borrower_ids}},
        {"_id": 0, "borrower_name": 1, "score": 1, "accounts": 1, "total_outstanding": 1, "payment_history": 1, "inquiries": 1, "derogatory_items": 1, "borrower_id": 1}
    ))

    sorted_reports = []
    for bid in borrower_ids:
        match = next((r for r in reports if r.get("borrower_id") == bid), None)
        if match:
            sorted_reports.append(match)
    return sorted_reports


def get_application_summary(application_id: str) -> dict:
    """Get application summary including income, property, loan details."""
    db = _get_db()
    app = db["applications"].find_one(
        {"application_id": application_id},
        {"_id": 0, "application_id": 1, "borrower_names": 1, "loan_amount": 1, "purchase_price": 1, "down_payment": 1, "product": 1, "property": 1, "income_summary": 1, "status": 1}
    )
    return app or {}


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


def run_risk_aggregation(application_id: str) -> dict:
    """Run a 7-stage MongoDB aggregation pipeline for risk scoring.

    Stages: $match -> $lookup(credit) -> $lookup(docs) -> $addFields(ratios) ->
            $addFields(risk_points) -> $addFields(risk_score) -> $project
    """
    db = _get_db()
    start = _time.monotonic()

    pipeline = [
        {"$match": {"application_id": application_id}},

        {"$lookup": {
            "from": "credit_reports",
            "localField": "borrower_ids",
            "foreignField": "borrower_id",
            "as": "credit_data",
        }},

        {"$lookup": {
            "from": "documents",
            "let": {"app_id": "$application_id"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$application_id", "$$app_id"]}}},
                {"$match": {"doc_type": {"$in": ["employment_letter", "income_tax", "paystubs"]}}},
                {"$project": {"_id": 0, "doc_type": 1, "status": 1}},
            ],
            "as": "income_docs",
        }},

        {"$addFields": {
            "monthly_income": {"$divide": [
                {"$ifNull": ["$income_summary.combined_gross", 0]}, 12
            ]},
            "primary_credit_score": {"$arrayElemAt": ["$credit_data.score", 0]},
            "co_credit_score": {"$arrayElemAt": ["$credit_data.score", 1]},
            "ltv": {"$cond": {
                "if": {"$gt": ["$purchase_price", 0]},
                "then": {"$multiply": [{"$divide": ["$loan_amount", "$purchase_price"]}, 100]},
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

        {"$project": {
            "_id": 0,
            "application_id": 1,
            "risk_score": 1,
            "monthly_income": 1,
            "ltv": 1,
            "primary_credit_score": 1,
            "co_credit_score": 1,
            "doc_count": 1,
            "loan_amount": 1,
            "purchase_price": 1,
            "credit_risk_points": 1,
            "ltv_risk_points": 1,
        }},
    ]

    results = list(db["applications"].aggregate(pipeline))
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
