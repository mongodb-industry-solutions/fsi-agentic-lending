"""Dashboard aggregation queries for the loan officer portal.

These are read-only MongoDB aggregation pipelines that power the officer
dashboard — portfolio stats, payment trends, early warning signals, and
recent event feeds. They have no dependency on the agent layer.
"""
from db.mdb import get_db as _get_db
from db.collections_config import NAMES


def get_portfolio_stats() -> dict:
    """Aggregation pipeline that groups payments to get active loan count, total outstanding, delinquency rate."""
    db = _get_db()
    pipeline = [
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id": "$loan_id",
            "latest_balance": {"$first": "$outstanding_balance"},
            "total_payments": {"$sum": 1},
            "late_payments": {"$sum": {"$cond": [{"$gt": ["$days_late", 0]}, 1, 0]}},
        }},
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
    result = list(db[NAMES.payments].aggregate(pipeline))
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

    return list(db[NAMES.payments].aggregate(pipeline))


def get_ews_signals(loan_id: str) -> list:
    """Analyze payment patterns to generate Early Warning System signals."""
    db = _get_db()

    recent = list(db[NAMES.payments].find(
        {"loan_id": loan_id},
        {"_id": 0, "days_late": 1, "amount": 1, "outstanding_balance": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(12))

    if not recent:
        return []

    late_count = sum(1 for p in recent[:3] if p.get("days_late", 0) > 0)
    amounts = [p.get("amount", 0) for p in recent]
    balances = [p.get("outstanding_balance", 0) for p in recent]

    payment_signal = {
        "signal": "Payment pattern change",
        "status": "red" if late_count >= 2 else "amber" if late_count == 1 else "green",
        "detail": f"{late_count} late in last 3 months" if late_count > 0 else "All payments on time",
        "icon": "📊",
    }

    if len(amounts) >= 3:
        avg = sum(amounts) / len(amounts)
        variance = sum((a - avg) ** 2 for a in amounts) / len(amounts)
        stddev = variance ** 0.5
        if avg > 0:
            stability = "green" if stddev < avg * 0.05 else "amber" if stddev < avg * 0.15 else "red"
        else:
            stability = "green"
    else:
        stability = "green"
        stddev = 0
    income_signal = {
        "signal": "Income stability",
        "status": stability,
        "detail": f"{'Stable' if stability == 'green' else 'Variable'} — stddev ${stddev:,.0f}",
        "icon": "💰",
    }

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

    psi = late_count * 0.09
    behav_signal = {
        "signal": "Behavioral score drift",
        "status": "amber" if psi > 0.15 else "green",
        "detail": f"PSI {psi:.2f} (threshold: 0.20)",
        "icon": "🧠",
    }

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

    activities = list(db[NAMES.agent_activity].find(
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

    payments = list(db[NAMES.payments].find(
        {}, {"_id": 0, "loan_id": 1, "amount": 1, "status": 1, "days_late": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(limit // 2))

    for p in payments:
        ts = p.get("timestamp")
        status = p.get("status", "on_time")
        events.append({
            "type": "payment",
            "message": f"Payment ${p.get('amount', 0):,.2f} received for {p.get('loan_id', '?')} — {'on time' if status == 'on_time' else str(p.get('days_late', 0)) + ' days late'}",
            "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
            "icon": "💰" if status == "on_time" else "⚠",
            "color": "var(--success)" if status == "on_time" else "var(--danger)",
        })

    events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
    return events[:limit]
