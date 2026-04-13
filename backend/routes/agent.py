"""Agent execution routes — triggers LangGraph and streams results."""
import json
import os
import re
import asyncio
import logging
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pymongo.errors import DuplicateKeyError
from db.mdb import get_db as _get_db
from services import application_service
from agents.graph import get_graph
from agents.state import make_initial_state
from agents.pipeline.tools import log_agent_activity

logger = logging.getLogger(__name__)

PIPELINE_TIMEOUT_SECONDS = int(os.getenv("PIPELINE_TIMEOUT_SECONDS", "300"))
APP_ID_PATTERN = re.compile(r'^APP-[A-Z0-9-]{4,20}$')

def _validate_app_id(app_id: str):
    if not APP_ID_PATTERN.match(app_id):
        raise HTTPException(status_code=400, detail=f"Invalid application ID format: {app_id}")

try:
    from langgraph.errors import GraphInterrupt
except ImportError:
    GraphInterrupt = None

router = APIRouter(tags=["agent"])


def _acquire_pipeline_lock(app_id: str) -> bool:
    """Attempt to acquire a distributed pipeline lock via MongoDB.

    Uses insert with unique ``_id`` as an atomic compare-and-swap so only one
    process / pod can run the pipeline for a given application at a time.
    Release deletes the document; the TTL index on ``locked_at`` acts as a
    safety net for locks orphaned by crashes.
    """
    db = _get_db()
    try:
        db["pipeline_locks"].insert_one({
            "_id": app_id,
            "locked_at": datetime.now(timezone.utc),
        })
        return True
    except DuplicateKeyError:
        return False


def _release_pipeline_lock(app_id: str):
    db = _get_db()
    db["pipeline_locks"].delete_one({"_id": app_id})




@router.post("/agent/{app_id}/run")
async def run_agent(app_id: str, autonomy_level: str = "bounded"):
    """Trigger agent execution for an application."""
    _validate_app_id(app_id)
    app = application_service.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if not _acquire_pipeline_lock(app_id):
        raise HTTPException(status_code=409, detail="Pipeline already running for this application")

    # Update status to processing
    application_service.update_application_status(app_id, "processing", "Agent pipeline started")

    def _run_graph(app_id, autonomy_level):
        timed_out = threading.Event()

        def _on_timeout():
            timed_out.set()
            msg = f"Pipeline timed out after {PIPELINE_TIMEOUT_SECONDS}s"
            logger.error(f"{msg} for {app_id}")
            application_service.update_application_status(app_id, "error", msg)
            log_agent_activity(app_id, "supervisor", "pipeline_timeout", msg)
            _release_pipeline_lock(app_id)

        timer = threading.Timer(PIPELINE_TIMEOUT_SECONDS, _on_timeout)
        timer.daemon = True
        timer.start()

        try:
            graph = get_graph()
            initial_state = make_initial_state(app_id, autonomy_level)
            graph.invoke(initial_state, config={"configurable": {"thread_id": app_id}})
        except Exception as e:
            if GraphInterrupt is not None and isinstance(e, GraphInterrupt):
                logger.info(f"Agent pipeline paused for HITL review: {app_id}")
                log_agent_activity(app_id, "supervisor", "hitl_waiting", "Pipeline paused — awaiting officer decision")
            else:
                logger.error(f"Agent pipeline failed for {app_id}: {e}")
                application_service.update_application_status(app_id, "error", f"Pipeline failed: {str(e)[:200]}")
                log_agent_activity(app_id, "supervisor", "pipeline_complete", f"Pipeline error: {e}")
        finally:
            timer.cancel()
            if not timed_out.is_set():
                _release_pipeline_lock(app_id)

    thread = threading.Thread(target=_run_graph, args=(app_id, autonomy_level), daemon=True)
    thread.start()

    return {
        "application_id": app_id,
        "status": "processing",
        "message": "Agent pipeline started. Connect to /api/agent/{app_id}/stream for real-time updates.",
    }


@router.get("/agent/{app_id}/stream")
async def stream_agent(app_id: str):
    """SSE endpoint — streams agent reasoning and actions in real time."""
    _validate_app_id(app_id)

    async def event_generator():
        db = _get_db()

        # Check application exists
        app = await asyncio.to_thread(db["applications"].find_one, {"application_id": app_id})
        if not app:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Application not found'})}\n\n"
            return

        yield f"data: {json.dumps({'type': 'connected', 'application_id': app_id})}\n\n"

        heartbeat_counter = 0

        # Stream from agent_activity Change Stream
        pipeline = [{"$match": {"fullDocument.application_id": app_id}}]
        stream = db["agent_activity"].watch(pipeline, full_document="updateLookup")

        try:
            event_counter = 0
            while True:
                change = await asyncio.to_thread(stream.try_next)
                if change:
                    doc = change.get("fullDocument", {})
                    event_counter += 1
                    resume_token = str(change.get("_id", {}).get("_data", event_counter))
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
                    yield f"id: {resume_token}\ndata: {json.dumps(event)}\n\n"

                    if doc.get("action") == "pipeline_complete":
                        yield f"id: {resume_token}\ndata: {json.dumps({'type': 'complete', 'application_id': app_id})}\n\n"
                        break
                else:
                    await asyncio.sleep(0.5)
                    heartbeat_counter += 1
                    if heartbeat_counter % 30 == 0:
                        yield ": heartbeat\n\n"
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

    if not _acquire_pipeline_lock(app_id):
        raise HTTPException(status_code=409, detail="Pipeline already running for this application")

    application_service.update_application_status(app_id, "processing", "Agent pipeline started")

    async def event_generator():
        graph = get_graph()
        initial_state = make_initial_state(app_id, autonomy_level)
        config = {
            "configurable": {"thread_id": app_id},
            "metadata": {"application_id": app_id},
            "tags": ["mortgage"],
        }

        yield f"data: {json.dumps({'type': 'started', 'application_id': app_id, 'autonomy_level': autonomy_level})}\n\n"

        _known_nodes = frozenset(("supervisor", "doc_verifier", "credit_puller", "loan_app", "underwriter", "hitl_gate", "complete"))
        try:
            async for event in graph.astream_events(initial_state, config=config, version="v2"):
                kind = event.get("event", "")
                name = event.get("name", "")

                if kind == "on_chain_start" and name in _known_nodes:
                    yield f"data: {json.dumps({'type': 'node_start', 'agent': name})}\n\n"

                elif kind == "on_chain_end" and name in _known_nodes:
                    output = event.get("data", {}).get("output", {})
                    # Serialize output (remove non-JSON-serializable fields)
                    safe_output = {}
                    for k, v in (output or {}).items():
                        if k == "messages":
                            continue  # Skip messages (large)
                        if isinstance(v, (str, int, float, bool, list, dict)) or v is None:
                            safe_output[k] = v
                    yield f"data: {json.dumps({'type': 'node_complete', 'agent': name, 'output': safe_output})}\n\n"

            yield f"data: {json.dumps({'type': 'complete', 'application_id': app_id})}\n\n"

        except Exception as e:
            # GraphInterrupt means HITL gate paused the pipeline
            if GraphInterrupt is not None and isinstance(e, GraphInterrupt):
                yield f"data: {json.dumps({'type': 'hitl_waiting', 'application_id': app_id})}\n\n"
            else:
                logger.error(f"Stream error for {app_id}: {e}")
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)[:500]})}\n\n"
        finally:
            _release_pipeline_lock(app_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.post("/agent/{app_id}/re-evaluate")
async def re_evaluate(app_id: str, autonomy_level: str = "bounded"):
    """Re-run the pipeline after blocking interventions are resolved.

    Checks that all blocking interventions are resolved before allowing a
    restart. This provides the feedback mechanism from borrower actions
    back into the pipeline.
    """
    _validate_app_id(app_id)
    app = application_service.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    db = _get_db()
    pending_blocking = await asyncio.to_thread(
        db["interventions"].count_documents,
        {"application_id": app_id, "severity": "blocking", "status": {"$in": ["pending", "active"]}},
    )
    if pending_blocking > 0:
        raise HTTPException(
            status_code=409,
            detail=f"{pending_blocking} blocking intervention(s) still unresolved",
        )

    log_agent_activity(app_id, "supervisor", "re_evaluate", "Pipeline restarted after intervention resolution")
    return await run_agent(app_id, autonomy_level=autonomy_level)
