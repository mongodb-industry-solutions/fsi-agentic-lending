"""Agent execution routes — triggers LangGraph and streams results."""
import json
import asyncio
import logging
import threading
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from db.mdb import get_db as _get_db
from services import application_service
from agents.graph import get_graph
from agents.tools import log_agent_activity, update_application_status

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

    # Launch graph execution in a background thread (sync graph, async route)
    def _run_graph(app_id):
        try:
            graph = get_graph()
            initial_state = {
                "messages": [],
                "application_id": app_id,
                "current_agent": "supervisor",
                "documents_verified": False,
                "document_count": 0,
                "extraction_summary": "",
                "credit_pulled": False,
                "primary_credit_score": None,
                "co_applicant_credit_score": None,
                "gds_ratio": None,
                "tds_ratio": None,
                "risk_score": None,
                "risk_tier": None,
                "policy_citations": [],
                "decision": None,
                "decision_reasoning": "",
                "officer_notes": None,
                "activity_log": [],
            }
            graph.invoke(initial_state, config={"configurable": {"thread_id": app_id}})
        except Exception as e:
            error_msg = str(e)
            if "interrupt" in error_msg.lower() or "GraphInterrupt" in type(e).__name__:
                logging.getLogger(__name__).info(f"Agent pipeline paused for HITL review: {app_id}")
                log_agent_activity(app_id, "supervisor", "hitl_waiting", "Pipeline paused — awaiting officer decision")
            else:
                logging.getLogger(__name__).error(f"Agent pipeline failed for {app_id}: {e}")
                update_application_status(app_id, "error", f"Pipeline failed: {error_msg[:200]}")
                log_agent_activity(app_id, "supervisor", "pipeline_complete", f"Pipeline error: {e}")

    thread = threading.Thread(target=_run_graph, args=(app_id,), daemon=True)
    thread.start()

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
        db = _get_db()

        # Check application exists
        app = db["applications"].find_one({"application_id": app_id})
        if not app:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Application not found'})}\n\n"
            return

        yield f"data: {json.dumps({'type': 'connected', 'application_id': app_id})}\n\n"

        # Stream from agent_activity Change Stream
        pipeline = [{"$match": {"fullDocument.application_id": app_id}}]
        stream = db["agent_activity"].watch(pipeline, full_document="updateLookup")

        try:
            while True:
                change = await asyncio.to_thread(stream.try_next)
                if change:
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
                else:
                    await asyncio.sleep(0.5)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            stream.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
