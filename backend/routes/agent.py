"""Agent execution routes — triggers LangGraph and streams results."""
import json
import re
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

logger = logging.getLogger(__name__)

APP_ID_PATTERN = re.compile(r'^APP-[A-Z0-9]{8}$')

def _validate_app_id(app_id: str):
    if not APP_ID_PATTERN.match(app_id):
        raise HTTPException(status_code=400, detail=f"Invalid application ID format: {app_id}")

try:
    from langgraph.errors import GraphInterrupt
except ImportError:
    GraphInterrupt = None

router = APIRouter(tags=["agent"])

_running_apps = set()
_running_lock = threading.Lock()


@router.post("/agent/{app_id}/run")
async def run_agent(app_id: str, autonomy_level: str = "bounded"):
    """Trigger agent execution for an application.

    TODO: Phase 4 — wire to LangGraph graph.astream()
    Currently returns a placeholder that logs mock activity.
    """
    app = application_service.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Concurrency deduplication
    with _running_lock:
        if app_id in _running_apps:
            return {"status": "already_running", "application_id": app_id}
        _running_apps.add(app_id)

    # Update status to processing
    application_service.update_application_status(app_id, "processing", "Agent pipeline started")

    # Launch graph execution in a background thread (sync graph, async route)
    def _run_graph(app_id, autonomy_level):
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
                "autonomy_level": autonomy_level,
                "last_error": None,
                "retry_count": 0,
            }
            graph.invoke(initial_state, config={"configurable": {"thread_id": app_id}})
        except Exception as e:
            if GraphInterrupt is not None and isinstance(e, GraphInterrupt):
                logging.getLogger(__name__).info(f"Agent pipeline paused for HITL review: {app_id}")
                log_agent_activity(app_id, "supervisor", "hitl_waiting", "Pipeline paused — awaiting officer decision")
            else:
                logging.getLogger(__name__).error(f"Agent pipeline failed for {app_id}: {e}")
                from services.application_service import update_application_status
                update_application_status(app_id, "error", f"Pipeline failed: {str(e)[:200]}")
                log_agent_activity(app_id, "supervisor", "pipeline_complete", f"Pipeline error: {e}")
        finally:
            with _running_lock:
                _running_apps.discard(app_id)

    thread = threading.Thread(target=_run_graph, args=(app_id, autonomy_level), daemon=True)
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
        app = await asyncio.to_thread(db["applications"].find_one, {"application_id": app_id})
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


@router.get("/agent/{app_id}/run-stream")
async def run_and_stream(app_id: str, autonomy_level: str = "bounded"):
    """Combined endpoint: starts graph execution AND streams events via SSE.
    Eliminates the race condition between run and stream endpoints."""
    _validate_app_id(app_id)

    app = application_service.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    application_service.update_application_status(app_id, "processing", "Agent pipeline started")

    async def event_generator():
        graph = get_graph()
        initial_state = {
            "messages": [],
            "application_id": app_id,
            "current_agent": "supervisor",
            "autonomy_level": autonomy_level,
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
            "last_error": None,
            "retry_count": 0,
        }
        config = {
            "configurable": {"thread_id": app_id},
            "metadata": {"application_id": app_id},
            "tags": ["mortgage"],
        }

        yield f"data: {json.dumps({'type': 'started', 'application_id': app_id, 'autonomy_level': autonomy_level})}\n\n"

        try:
            async for event in graph.astream_events(initial_state, config=config, version="v2"):
                kind = event.get("event", "")
                name = event.get("name", "")

                if kind == "on_chain_start" and name in ("supervisor", "loan_app", "underwriter", "hitl_gate", "complete"):
                    yield f"data: {json.dumps({'type': 'node_start', 'agent': name})}\n\n"

                elif kind == "on_chain_end" and name in ("loan_app", "underwriter", "supervisor", "hitl_gate", "complete"):
                    output = event.get("data", {}).get("output", {})
                    # Serialize output (remove non-JSON-serializable fields)
                    safe_output = {}
                    for k, v in (output or {}).items():
                        if k == "messages":
                            continue  # Skip messages (large)
                        if isinstance(v, (str, int, float, bool, list)) or v is None:
                            safe_output[k] = v
                    yield f"data: {json.dumps({'type': 'node_complete', 'agent': name, 'output': safe_output})}\n\n"

                    # Check for HITL interrupt
                    if name == "hitl_gate" and output and output.get("decision") is None:
                        yield f"data: {json.dumps({'type': 'hitl_waiting', 'application_id': app_id})}\n\n"
                        break  # Stream ends; client reconnects after officer decision

            yield f"data: {json.dumps({'type': 'complete', 'application_id': app_id})}\n\n"

        except Exception as e:
            logger.error(f"Stream error for {app_id}: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)[:500]})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
