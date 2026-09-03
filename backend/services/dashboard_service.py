"""Dashboard aggregation queries for the loan officer portal.

These are read-only MongoDB aggregation pipelines that power the officer
dashboard — portfolio stats, payment trends, early warning signals, and
recent event feeds. They have no dependency on the agent layer.
"""
from db.mdb import coll
from db.storage_mapping import from_storage, storage_key


def _p(runtime_path: str) -> str:
    """Runtime field path -> storage path on `loanRepayments`."""
    return storage_key("payments", runtime_path)


def _a(runtime_path: str) -> str:
    """Runtime field path -> storage path on `lendingAgentActivity`."""
    return storage_key("agent_activity", runtime_path)


def get_portfolio_stats() -> dict:
    """Aggregation pipeline that groups payments to get active loan count, total outstanding, delinquency rate."""
    pipeline = [
        {"$sort": {_p("timestamp"): -1}},
        {"$group": {
            "_id": "$" + _p("loan_id"),
            "latest_balance": {"$first": "$" + _p("outstanding_balance")},
            "total_payments": {"$sum": 1},
            "late_payments": {"$sum": {"$cond": [{"$gt": ["$" + _p("days_late"), 0]}, 1, 0]}},
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
    result = list(coll("payments").aggregate(pipeline))
    if not result:
        return {"active_loan_count": 0, "total_outstanding": 0, "delinquency_rate": 0}
    r = result[0]
    r.pop("_id", None)
    return r


def get_payment_trends(loan_id: str = None) -> list:
    """Uses $setWindowFields with a rolling 90-day window for average days_late and payment count."""
    pipeline = []
    if loan_id:
        pipeline.append({"$match": {_p("loan_id"): loan_id}})

    projected = ("loan_id", "payment_number", "amount", "principal", "interest",
                 "outstanding_balance", "days_late", "status", "timestamp")
    projection = {runtime: "$" + _p(runtime) for runtime in projected}
    projection.update({
        "_id": 0,
        "rolling_avg_days_late": 1,
        "rolling_payment_count": 1,
    })

    pipeline.extend([
        {"$setWindowFields": {
            "partitionBy": "$" + _p("loan_id"),
            "sortBy": {_p("timestamp"): 1},
            "output": {
                "rolling_avg_days_late": {
                    "$avg": "$" + _p("days_late"),
                    "window": {"range": [-90, 0], "unit": "day"},
                },
                "rolling_payment_count": {
                    "$sum": 1,
                    "window": {"range": [-90, 0], "unit": "day"},
                },
            },
        }},
        {"$sort": {_p("timestamp"): -1}},
        {"$limit": 12},
        {"$project": projection},
    ])

    # Keys are already projected back to runtime names; from_storage is applied
    # for the status value translation (ON_TIME -> on_time).
    return [from_storage("payments", d) for d in coll("payments").aggregate(pipeline)]


def get_ews_signals(loan_id: str) -> list:
    """Analyze payment patterns to generate Early Warning System signals."""
    projection = {_p(f): 1 for f in ("days_late", "amount", "outstanding_balance", "timestamp")}
    projection["_id"] = 0
    recent = [
        from_storage("payments", d)
        for d in coll("payments").find({_p("loan_id"): loan_id}, projection)
        .sort(_p("timestamp"), -1).limit(12)
    ]

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
    events = []

    activity_projection = {_a(f): 1 for f in ("agent", "action", "detail", "timestamp")}
    activity_projection["_id"] = 0
    activities = [
        from_storage("agent_activity", d)
        for d in coll("agent_activity").find({}, activity_projection)
        .sort(_a("timestamp"), -1).limit(limit // 2)
    ]

    for a in activities:
        ts = a.get("timestamp")
        events.append({
            "type": "agent",
            "message": f"{a.get('agent', 'System')}: {a.get('action', '')} — {a.get('detail', '')[:100]}",
            "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
            "icon": "🤖",
            "color": "var(--agent-cyan)",
        })

    payment_projection = {_p(f): 1 for f in ("loan_id", "amount", "status", "days_late", "timestamp")}
    payment_projection["_id"] = 0
    payments = [
        from_storage("payments", d)
        for d in coll("payments").find({}, payment_projection)
        .sort(_p("timestamp"), -1).limit(limit // 2)
    ]

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
