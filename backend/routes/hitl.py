"""Human-in-the-Loop decision routes."""
import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from langgraph.types import Command
from models.schemas import HITLDecisionRequest
from services import application_service
from db.mdb import get_db as _get_db
from db.mdb import coll
from db.storage_mapping import storage_filter, storage_key
from agents.graph import get_graph
from agents.pipeline.tools import log_agent_activity
from services.pipeline_lock import acquire_pipeline_lock as _acquire_pipeline_lock, release_pipeline_lock as _release_pipeline_lock

logger = logging.getLogger(__name__)
router = APIRouter(tags=["hitl"])


@router.get("/hitl/{app_id}/context")
async def get_hitl_context(app_id: str):
    """Get the HITL review package for an application."""
    app = application_service.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    db = _get_db()

    # Get recent agent activity
    activity = await asyncio.to_thread(
        lambda: list(
            coll("agent_activity")
            .find(
                storage_filter("agent_activity", {"application_id": app_id}),
                {"_id": 0, "agent": 1, "action": 1, "detail": 1,
                 storage_key("agent_activity", "timestamp"): 1},
            )
            .sort("timestamp", -1)
            .limit(20)
        )
    )

    # Serialize timestamps
    for a in activity:
        if hasattr(a.get("timestamp"), "isoformat"):
            a["timestamp"] = a["timestamp"].isoformat()

    # Enrich with graph state if available (has risk metrics from underwriter)
    try:
        graph = get_graph()
        graph_state = await asyncio.to_thread(
            graph.get_state,
            {"configurable": {"thread_id": app_id}},
        )
        if graph_state and graph_state.values:
            vals = graph_state.values
            for key in ("risk_score", "risk_tier", "gds_ratio", "tds_ratio",
                         "stress_gds", "stress_tds", "decision_reasoning", "primary_credit_score"):
                if vals.get(key) is not None and not app.get(key):
                    app[key] = vals[key]
    except Exception as e:
        logger.debug(f"Graph state not available for {app_id}: {e}")

    return {
        "application": app,
        "activity_trail": activity,
    }


@router.post("/hitl/{app_id}/decision")
async def submit_hitl_decision(app_id: str, req: HITLDecisionRequest):
    """Submit officer decision (approve/decline). Resumes LangGraph from checkpoint."""
    status_map = {"approve": "approved", "decline": "declined", "modify_and_continue": "processing"}
    new_status = status_map.get(req.action, "processing")
    detail = f"Officer decision: {req.action}"
    if req.officer_notes:
        detail += f" — {req.officer_notes}"

    app = application_service.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    db = _get_db()
    await asyncio.to_thread(
        coll("hitl_audit").insert_one,
        {
            "application_id": app_id,
            "officer_id": req.officer_id,
            "action": req.action,
            "notes": req.officer_notes,
            "conditions": req.conditions,
            "overrides": req.overrides.model_dump(exclude_none=True),
            "timestamp": datetime.now(timezone.utc),
        },
    )

    # Validate that there is a pending interrupt before resuming.
    # StateSnapshot.tasks is a tuple of PregelTask; each has .interrupts.
    graph = get_graph()
    graph_state = await asyncio.to_thread(
        graph.get_state,
        {"configurable": {"thread_id": app_id}},
    )
    pending_interrupts = any(
        getattr(t, "interrupts", ())
        for t in getattr(graph_state, "tasks", ())
    )
    if not pending_interrupts:
        # No graph checkpoint — apply decision directly (e.g., seeded demo app)
        logger.warning(f"No pending interrupt for {app_id} — applying decision directly")
        application_service.update_application_status(app_id, new_status, detail)
        log_agent_activity(app_id, "hitl_gate", "direct_decision",
            f"No graph checkpoint — officer decision applied directly: {req.action}. {req.officer_notes or ''}")
        return {"application_id": app_id, "status": new_status, "detail": detail}

    # Acquire pipeline lock to prevent concurrent graph execution
    if not _acquire_pipeline_lock(app_id):
        raise HTTPException(status_code=409, detail="Pipeline already running for this application")

    try:
        await asyncio.to_thread(
            graph.invoke,
            Command(resume={
                "action": req.action,
                "notes": req.officer_notes,
                "conditions": req.conditions,
                "overrides": req.overrides.model_dump(exclude_none=True),
                "officer_id": req.officer_id,
            }),
            {"configurable": {"thread_id": app_id}},
        )
    except Exception as e:
        logger.error(f"LangGraph resume failed for {app_id}: {e}")
        application_service.update_application_status(app_id, "hitl_error", f"Graph resume failed: {str(e)[:200]}")
        log_agent_activity(app_id, "hitl_gate", "resume_failed", f"Graph resume error: {str(e)[:200]}")
        raise HTTPException(status_code=500, detail=f"HITL resume failed: {str(e)[:200]}")
    finally:
        _release_pipeline_lock(app_id)

    return {"application_id": app_id, "status": new_status, "detail": detail}
