"""Human-in-the-Loop decision routes."""
import logging
from fastapi import APIRouter, HTTPException
from langgraph.types import Command
from models.schemas import HITLDecisionRequest
from services import application_service
from db.mdb import get_db as _get_db
from agents.graph import get_graph

router = APIRouter(tags=["hitl"])


@router.get("/hitl/{app_id}/context")
async def get_hitl_context(app_id: str):
    """Get the HITL review package for an application."""
    app = application_service.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    db = _get_db()

    # Get recent agent activity
    activity = list(
        db["agent_activity"]
        .find(
            {"application_id": app_id},
            {"_id": 0, "agent": 1, "action": 1, "detail": 1, "timestamp": 1},
        )
        .sort("timestamp", -1)
        .limit(20)
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
    # Update application status
    new_status = "approved" if req.action == "approve" else "declined"
    detail = f"Officer decision: {req.action}"
    if req.officer_notes:
        detail += f" — {req.officer_notes}"

    success = application_service.update_application_status(app_id, new_status, detail)
    if not success:
        raise HTTPException(status_code=404, detail="Application not found")

    # Resume LangGraph from checkpoint
    try:
        graph = get_graph()
        graph.invoke(
            Command(resume={"action": req.action, "notes": req.officer_notes}),
            config={"configurable": {"thread_id": app_id}},
        )
    except Exception as e:
        # Log but don't fail the response — status is already updated
        logging.getLogger(__name__).warning(f"LangGraph resume failed: {e}")

    return {"application_id": app_id, "status": new_status, "detail": detail}
