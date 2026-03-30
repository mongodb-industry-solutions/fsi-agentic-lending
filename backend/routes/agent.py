"""Agent execution routes — triggers LangGraph and streams results."""
import json
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from db.mdb import MongoDBConnector
from services import application_service

router = APIRouter(tags=["agent"])


@router.post("/agent/{app_id}/run")
async def run_agent(app_id: str):
    """Trigger agent execution for an application.

    TODO: Phase 4 — wire to LangGraph graph.astream()
    Currently returns a placeholder that logs mock activity.
    """
    app = application_service.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Update status to processing
    application_service.update_application_status(app_id, "processing", "Agent pipeline started")

    # TODO: Launch LangGraph execution in background
    # For now, return acknowledgment
    return {
        "application_id": app_id,
        "status": "processing",
        "message": "Agent pipeline started. Connect to /api/agent/{app_id}/stream for real-time updates.",
    }


@router.get("/agent/{app_id}/stream")
async def stream_agent(app_id: str):
    """SSE endpoint — streams agent reasoning and actions in real time.

    TODO: Phase 4 — wire to LangGraph graph.astream_events()
    Currently streams from agent_activity Change Stream.
    """

    async def event_generator():
        db = MongoDBConnector().db

        # Check application exists
        app = db["applications"].find_one({"application_id": app_id})
        if not app:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Application not found'})}\n\n"
            return

        yield f"data: {json.dumps({'type': 'connected', 'application_id': app_id})}\n\n"

        # Stream from agent_activity Change Stream
        pipeline = [{"$match": {"fullDocument.application_id": app_id}}]
        try:
            with db["agent_activity"].watch(pipeline, full_document="updateLookup") as stream:
                for change in stream:
                    doc = change.get("fullDocument", {})
                    event = {
                        "type": "agent_step",
                        "agent": doc.get("agent", ""),
                        "action": doc.get("action", ""),
                        "detail": doc.get("detail", ""),
                        "checkpoint_id": doc.get("checkpoint_id"),
                        "timestamp": doc.get("timestamp", "").isoformat()
                        if hasattr(doc.get("timestamp", ""), "isoformat")
                        else "",
                    }
                    yield f"data: {json.dumps(event)}\n\n"

                    # Check if agent pipeline is complete
                    if doc.get("action") == "pipeline_complete":
                        yield f"data: {json.dumps({'type': 'complete', 'application_id': app_id})}\n\n"
                        break
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
