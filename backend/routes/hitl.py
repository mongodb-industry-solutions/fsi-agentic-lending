"""Human-in-the-Loop decision routes."""
import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from langgraph.types import Command
from models.schemas import HITLDecisionRequest
from services import application_service
from db.mdb import get_db as _get_db
from agents.graph import get_graph
from agents.pipeline.tools import log_agent_activity

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
            db["agent_activity"]
            .find(
                {"application_id": app_id},
                {"_id": 0, "agent": 1, "action": 1, "detail": 1, "timestamp": 1},
            )
            .sort("timestamp", -1)
            .limit(20)
        )
    )

    # Serialize timestamps
    for a in activity:
        if hasattr(a.get("timestamp"), "isoformat"):
            a["timestamp"] = a["timestamp"].isoformat()

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
        db["hitl_audit"].insert_one,
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

    try:
        graph = get_graph()
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

    return {"application_id": app_id, "status": new_status, "detail": detail}
