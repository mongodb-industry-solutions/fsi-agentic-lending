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
from db.mdb import get_db as _get_db
from db.collections_config import NAMES
from services import application_service
from services.pipeline_lock import acquire_pipeline_lock as _acquire_pipeline_lock, release_pipeline_lock as _release_pipeline_lock
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

    # Clean stale pending interventions from previous runs
    db = _get_db()
    db[NAMES.interventions].update_many(
        {"application_id": app_id, "status": "pending"},
        {"$set": {"status": "superseded"}},
    )

    def _run_graph(app_id, autonomy_level):
        timed_out = threading.Event()
        lock_released = threading.Event()

        def _on_timeout():
            timed_out.set()
            msg = f"Pipeline timed out after {PIPELINE_TIMEOUT_SECONDS}s"
            logger.error(f"{msg} for {app_id}")
            application_service.update_application_status(app_id, "error", msg)
            log_agent_activity(app_id, "supervisor", "pipeline_timeout", msg)
            if not lock_released.is_set():
                lock_released.set()
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
            if not lock_released.is_set():
                lock_released.set()
                _release_pipeline_lock(app_id)

    thread = threading.Thread(target=_run_graph, args=(app_id, autonomy_level), daemon=True)
    thread.start()

    return {
        "application_id": app_id,
        "status": "processing",
        "message": "Agent pipeline started. Connect to /api/agent/{app_id}/stream for real-time updates.",
    }


@router.get("/agent/{app_id}/stream")
async def stream_agent(app_id: str, after: str | None = None):
    """SSE endpoint — streams agent reasoning and actions in real time.

    Query params:
    - after: Client-supplied lastEventId from a prior connection. When present,
      the 50-event backlog is skipped so reconnects don't duplicate events the
      client has already seen. NOTE: this only suppresses backlog replay — the
      live change-stream/polling path opens at the current position, so events
      that landed between the client's disconnect and reconnect may be missed.
      Gap-free resume would require parsing `after` back into a resume token
      and passing it to `.watch(resume_after=...)`, which is not implemented.
    """
    _validate_app_id(app_id)

    async def event_generator():
        db = _get_db()

        # Check application exists
        app = await asyncio.to_thread(db[NAMES.applications].find_one, {"application_id": app_id})
        if not app:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Application not found'})}\n\n"
            return

        yield f"data: {json.dumps({'type': 'connected', 'application_id': app_id})}\n\n"

        heartbeat_counter = 0

        # Send recent activity as backlog so fresh clients don't miss events.
        # Skipped when `after` is provided — the client is reconnecting and
        # already has these events; re-sending would just duplicate in the UI.
        last_timestamp = None
        seen_ids: set = set()
        backlog: list = []
        if not after:
            # Keep _id so we can seed seen_ids for the polling fallback (avoids
            # re-emitting backlog docs that share the same millisecond timestamp
            # as newer docs when using $gte).
            backlog = await asyncio.to_thread(
                lambda: list(
                    db[NAMES.agent_activity]
                    .find({"application_id": app_id})
                    .sort("timestamp", -1)
                    .limit(50)
                )
            )
            for doc in reversed(backlog):
                event = {
                    "type": "agent_step",
                    "agent": doc.get("agent", ""),
                    "action": doc.get("action", ""),
                    "detail": doc.get("detail", ""),
                    "checkpoint_id": doc.get("checkpoint_id"),
                    "timestamp": doc.get("timestamp", "").isoformat()
                    if hasattr(doc.get("timestamp", ""), "isoformat") else "",
                    "backlog": True,
                }
                yield f"data: {json.dumps(event)}\n\n"

            # Track the latest timestamp we've emitted so the polling fallback
            # can resume without dupes. seen_ids holds the _ids of docs that share
            # `last_timestamp` — needed because two log writes can land inside the
            # same millisecond, and `$gt` would silently drop the second one.
            if backlog:
                last_ts = backlog[0].get("timestamp")  # `backlog` is desc-sorted
                if last_ts:
                    last_timestamp = last_ts
                    for d in backlog:
                        if d.get("timestamp") == last_timestamp and d.get("_id") is not None:
                            seen_ids.add(d["_id"])

        # Try MongoDB Change Stream first; fall back to polling if unavailable
        # (e.g. standalone Mongo without replica set → OperationFailure).
        pipeline = [{"$match": {"fullDocument.application_id": app_id}}]
        stream = None
        try:
            stream = await asyncio.to_thread(
                lambda: db[NAMES.agent_activity].watch(pipeline, full_document="updateLookup")
            )
        except Exception:
            stream = None  # Fall through to polling

        event_counter = 0
        try:
            if stream is not None:
                # Change Stream path — survives transient cursor failures (primary
                # stepdown, network blip, 10-min idle-cursor timeout) by reopening
                # the watch with resume_after=last_token. We track `last_resume_token`
                # as the raw Mongo _id dict; the SSE event id remains the string
                # `_data` field for EventSource compatibility.
                last_resume_token = None
                resume_retries = 0
                MAX_RESUME_RETRIES = 3
                terminated = False
                while not terminated:
                    if stream is None:
                        # Reopen after a transient error
                        if resume_retries >= MAX_RESUME_RETRIES:
                            logger.error(f"Agent stream for {app_id} exceeded resume retries — giving up")
                            break
                        try:
                            stream = await asyncio.to_thread(
                                lambda: db[NAMES.agent_activity].watch(
                                    pipeline,
                                    full_document="updateLookup",
                                    resume_after=last_resume_token,
                                )
                            )
                            resume_retries = 0
                        except Exception as reopen_err:
                            resume_retries += 1
                            logger.warning(
                                f"Agent stream reopen failed for {app_id} "
                                f"(retry {resume_retries}/{MAX_RESUME_RETRIES}): {reopen_err}"
                            )
                            await asyncio.sleep(min(0.5 * resume_retries, 5.0))
                            continue

                    try:
                        change = await asyncio.to_thread(stream.try_next)
                    except asyncio.CancelledError:
                        raise
                    except Exception as cursor_err:
                        resume_retries += 1
                        logger.warning(
                            f"Agent stream change-cursor error for {app_id} "
                            f"(retry {resume_retries}/{MAX_RESUME_RETRIES}): {cursor_err}"
                        )
                        try:
                            stream.close()
                        except Exception:
                            pass
                        stream = None
                        await asyncio.sleep(min(0.5 * resume_retries, 5.0))
                        continue

                    if change:
                        resume_retries = 0
                        last_resume_token = change.get("_id")
                        doc = change.get("fullDocument", {})
                        event_counter += 1
                        resume_token = str(change.get("_id", {}).get("_data", event_counter))
                        ts = doc.get("timestamp", "")
                        event = {
                            "type": "agent_step",
                            "agent": doc.get("agent", ""),
                            "action": doc.get("action", ""),
                            "detail": doc.get("detail", ""),
                            "checkpoint_id": doc.get("checkpoint_id"),
                            "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else "",
                        }
                        yield f"id: {resume_token}\ndata: {json.dumps(event)}\n\n"

                        if doc.get("action") == "pipeline_complete":
                            yield f"id: {resume_token}\ndata: {json.dumps({'type': 'complete', 'application_id': app_id})}\n\n"
                            terminated = True
                    else:
                        await asyncio.sleep(0.5)
                        heartbeat_counter += 1
                        # Emit heartbeat every 1s (2 ticks) to defeat Envoy/Istio
                        # SSE frame buffering on K8s staging.
                        if heartbeat_counter % 2 == 0:
                            yield ": heartbeat\n\n"
            else:
                # Polling fallback — query for docs with timestamp >= last_timestamp
                # every 750ms, deduping by _id via seen_ids. Uses $gte (not $gt) so
                # ties-at-millisecond are picked up; seen_ids prevents re-emission
                # of rows already yielded from backlog or a prior poll tick.
                while True:
                    query = {"application_id": app_id}
                    if last_timestamp is not None:
                        query["timestamp"] = {"$gte": last_timestamp}
                    new_docs = await asyncio.to_thread(
                        lambda q=query: list(
                            db[NAMES.agent_activity]
                            .find(q)
                            .sort("timestamp", 1)
                            .limit(100)
                        )
                    )

                    terminated = False
                    for doc in new_docs:
                        doc_id = doc.get("_id")
                        if doc_id is not None and doc_id in seen_ids:
                            continue
                        event_counter += 1
                        ts = doc.get("timestamp", "")
                        if ts:
                            if last_timestamp is None or ts > last_timestamp:
                                # New-tick timestamp — reset seen_ids
                                last_timestamp = ts
                                seen_ids = set()
                            if doc_id is not None:
                                seen_ids.add(doc_id)
                        event = {
                            "type": "agent_step",
                            "agent": doc.get("agent", ""),
                            "action": doc.get("action", ""),
                            "detail": doc.get("detail", ""),
                            "checkpoint_id": doc.get("checkpoint_id"),
                            "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else "",
                        }
                        yield f"id: {event_counter}\ndata: {json.dumps(event)}\n\n"
                        if doc.get("action") == "pipeline_complete":
                            yield f"id: {event_counter}\ndata: {json.dumps({'type': 'complete', 'application_id': app_id})}\n\n"
                            terminated = True
                            break

                    if terminated:
                        break

                    await asyncio.sleep(0.75)
                    heartbeat_counter += 1
                    # Emit heartbeat ~every 1.5s to defeat Envoy/Istio buffering.
                    if heartbeat_counter % 2 == 0:
                        yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            pass
        except Exception as e:
            # Intentionally do NOT yield {type: 'error'} here. The frontend's
            # apiSSE auto-closes the stream when it receives a 'error' event —
            # which would turn any transient backend hiccup into a permanent UI
            # disconnect. Log and let the generator exit normally; EventSource
            # will then reconnect via onerror and resume from lastEventId.
            logger.error(f"Unhandled error in agent stream for {app_id}: {e}")
        finally:
            if stream is not None:
                try:
                    stream.close()
                except Exception:
                    pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "identity",
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

    # Clean stale pending interventions from previous runs
    db = _get_db()
    db[NAMES.interventions].update_many(
        {"application_id": app_id, "status": "pending"},
        {"$set": {"status": "superseded"}},
    )

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

        # Producer/consumer pattern: the graph iterator runs in its own task
        # and pushes events onto a queue. We use `asyncio.wait_for` on the
        # QUEUE (not on the iterator), so timeouts don't cancel the graph
        # generator. On queue timeout we emit a heartbeat comment to defeat
        # Envoy/Istio SSE frame buffering on K8s.
        # Sentinels on the queue:
        #   _DONE  -> producer finished cleanly
        #   _ERROR -> producer raised; payload is the exception instance
        _DONE = object()
        _ERROR = object()
        queue: asyncio.Queue = asyncio.Queue()

        async def _producer():
            try:
                async for ev in graph.astream_events(initial_state, config=config, version="v2"):
                    await queue.put(ev)
            except BaseException as exc:  # noqa: BLE001 — need to forward GraphInterrupt
                await queue.put((_ERROR, exc))
                return
            await queue.put(_DONE)

        producer_task = asyncio.create_task(_producer())

        try:
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
                    continue

                if item is _DONE:
                    break
                if isinstance(item, tuple) and len(item) == 2 and item[0] is _ERROR:
                    raise item[1]

                event = item
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
            # Ensure producer is cleaned up before releasing the pipeline lock.
            if not producer_task.done():
                producer_task.cancel()
                try:
                    await producer_task
                except (asyncio.CancelledError, Exception):
                    pass
            _release_pipeline_lock(app_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "identity",
        },
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
        db[NAMES.interventions].count_documents,
        {"application_id": app_id, "internal_context.severity": "blocking", "status": {"$in": ["pending", "active"]}},
    )
    if pending_blocking > 0:
        raise HTTPException(
            status_code=409,
            detail=f"{pending_blocking} blocking intervention(s) still unresolved",
        )

    log_agent_activity(app_id, "supervisor", "re_evaluate", "Pipeline restarted after intervention resolution")
    return await run_agent(app_id, autonomy_level=autonomy_level)
