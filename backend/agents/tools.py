"""MongoDB tools available to LangGraph agents."""
import os
import time as _time
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


def run_risk_aggregation(application_id: str) -> dict:
    """Run a 7-stage MongoDB aggregation pipeline for risk scoring.

    Stages: $match -> $lookup(credit) -> $lookup(docs) -> $addFields(ratios) ->
            $addFields(risk_points) -> $addFields(risk_score) -> $project
    """
    db = _get_db()
    start = _time.monotonic()

    pipeline = [
        # Stage 1: Match application
        {"$match": {"application_id": application_id}},

        # Stage 2: Lookup credit reports
        {"$lookup": {
            "from": "credit_reports",
            "localField": "borrower_ids",
            "foreignField": "borrower_id",
            "as": "credit_data",
        }},

        # Stage 3: Lookup income documents
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

        # Stage 4: Calculate base metrics
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

        # Stage 5: Risk factor scoring
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

        # Stage 6: Final risk score
        {"$addFields": {
            "risk_score": {"$max": [0, {"$min": [100,
                {"$add": [100, "$credit_risk_points", "$ltv_risk_points"]}
            ]}]},
        }},

        # Stage 7: Project clean output
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


def get_portfolio_stats() -> dict:
    """Aggregation pipeline that groups payments to get active loan count, total outstanding, delinquency rate."""
    db = _get_db()
    pipeline = [
        # Get all payments
        {"$sort": {"timestamp": -1}},
        # Group by loan — get latest balance and count late payments
        {"$group": {
            "_id": "$loan_id",
            "latest_balance": {"$first": "$outstanding_balance"},
            "total_payments": {"$sum": 1},
            "late_payments": {"$sum": {"$cond": [{"$gt": ["$days_late", 0]}, 1, 0]}},
        }},
        # Aggregate across all loans
        {"$group": {
            "_id": None,
            "active_loan_count": {"$sum": 1},
            "total_outstanding": {"$sum": "$latest_balance"},
            "delinquent_loans": {"$sum": {"$cond": [{"$gt": ["$late_payments", 0]}, 1, 0]}},
            "total_loan_count": {"$sum": 1},
        }},
        {"$addFields": {
            "delinquency_rate": {"$multiply": [
                {"$divide": ["$delinquent_loans", {"$max": ["$total_loan_count", 1]}]},
                100,
            ]},
        }},
    ]
    result = list(db["payments"].aggregate(pipeline))
    if not result:
        return {"active_loan_count": 0, "total_outstanding": 0, "delinquency_rate": 0}
    r = result[0]
    r.pop("_id", None)
    return r


def get_payment_trends(loan_id: str = None) -> list:
    """Uses $setWindowFields with a rolling 90-day window for average days_late and payment count."""
    db = _get_db()

    match_stage = {}
    if loan_id:
        match_stage = {"$match": {"loan_id": loan_id}}

    pipeline = []
    if match_stage:
        pipeline.append(match_stage)

    pipeline.extend([
        {"$setWindowFields": {
            "partitionBy": "$loan_id",
            "sortBy": {"timestamp": 1},
            "output": {
                "rolling_avg_days_late": {
                    "$avg": "$days_late",
                    "window": {"range": [-90, 0], "unit": "day"},
                },
                "rolling_payment_count": {
                    "$sum": 1,
                    "window": {"range": [-90, 0], "unit": "day"},
                },
            },
        }},
        {"$sort": {"timestamp": -1}},
        {"$limit": 12},
        {"$project": {
            "_id": 0,
            "loan_id": 1,
            "payment_number": 1,
            "amount": 1,
            "principal": 1,
            "interest": 1,
            "outstanding_balance": 1,
            "days_late": 1,
            "status": 1,
            "timestamp": 1,
            "rolling_avg_days_late": 1,
            "rolling_payment_count": 1,
        }},
    ])

    return list(db["payments"].aggregate(pipeline))


def get_ews_signals(loan_id: str) -> list:
    """Analyze payment patterns to generate Early Warning System signals."""
    db = _get_db()

    # Get recent payments for this loan
    recent = list(db["payments"].find(
        {"loan_id": loan_id},
        {"_id": 0, "days_late": 1, "amount": 1, "outstanding_balance": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(12))

    if not recent:
        return []

    # Analyze patterns
    late_count = sum(1 for p in recent[:3] if p.get("days_late", 0) > 0)
    amounts = [p.get("amount", 0) for p in recent]
    balances = [p.get("outstanding_balance", 0) for p in recent]

    # Payment pattern change
    payment_signal = {
        "signal": "Payment pattern change",
        "status": "red" if late_count >= 2 else "amber" if late_count == 1 else "green",
        "detail": f"{late_count} late in last 3 months" if late_count > 0 else "All payments on time",
        "icon": "📊",
    }

    # Income stability (payment amount consistency)
    if len(amounts) >= 3:
        avg = sum(amounts) / len(amounts)
        variance = sum((a - avg) ** 2 for a in amounts) / len(amounts)
        stddev = variance ** 0.5
        stability = "green" if stddev < avg * 0.05 else "amber" if stddev < avg * 0.15 else "red"
    else:
        stability = "green"
        stddev = 0
    income_signal = {
        "signal": "Income stability",
        "status": stability,
        "detail": f"{'Stable' if stability == 'green' else 'Variable'} — stddev ${stddev:,.0f}",
        "icon": "💰",
    }

    # Credit utilization trend (is outstanding balance increasing?)
    if len(balances) >= 3:
        trend = "increasing" if balances[0] > balances[2] else "decreasing"
        util_status = "red" if trend == "increasing" else "green"
    else:
        trend = "stable"
        util_status = "green"
    util_signal = {
        "signal": "Credit utilization trend",
        "status": util_status,
        "detail": f"Balance {trend} over 3 months",
        "icon": "📈",
    }

    # Behavioral score (based on late pattern)
    psi = late_count * 0.09  # Simple proxy
    behav_signal = {
        "signal": "Behavioral score drift",
        "status": "amber" if psi > 0.15 else "green",
        "detail": f"PSI {psi:.2f} (threshold: 0.20)",
        "icon": "🧠",
    }

    # External events (static for demo)
    ext_signal = {
        "signal": "External event",
        "status": "green",
        "detail": "No adverse events detected",
        "icon": "🌐",
    }

    return [payment_signal, income_signal, util_signal, behav_signal, ext_signal]


def get_recent_events(limit: int = 20) -> list:
    """Get recent loan events from agent_activity and payments."""
    db = _get_db()
    events = []

    # Recent agent activity
    activities = list(db["agent_activity"].find(
        {}, {"_id": 0, "agent": 1, "action": 1, "detail": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(limit // 2))

    for a in activities:
        ts = a.get("timestamp")
        events.append({
            "type": "agent",
            "message": f"{a.get('agent', 'System')}: {a.get('action', '')} — {a.get('detail', '')[:100]}",
            "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
            "icon": "🤖",
            "color": "var(--agent-cyan)",
        })

    # Recent payments
    payments = list(db["payments"].find(
        {}, {"_id": 0, "loan_id": 1, "amount": 1, "status": 1, "days_late": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(limit // 2))

    for p in payments:
        ts = p.get("timestamp")
        status = p.get("status", "on_time")
        events.append({
            "type": "payment",
            "message": f"Payment ${p.get('amount', 0):,.2f} received for {p.get('loan_id', '?')} — {'on time' if status == 'on_time' else f'{p.get(\"days_late\", 0)} days late'}",
            "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
            "icon": "💰" if status == "on_time" else "⚠",
            "color": "var(--success)" if status == "on_time" else "var(--danger)",
        })

    # Sort by timestamp descending
    events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
    return events[:limit]


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
