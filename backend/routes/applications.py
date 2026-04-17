"""Application API routes."""
import asyncio
import json
import logging
import os
import re
import time
from fastapi import APIRouter, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from models.schemas import ApplicationCreateRequest
from services import application_service
from db.mdb import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["applications"])

APP_ID_PATTERN = re.compile(r'^APP-[A-Z0-9-]{4,20}$')


def _validate_app_id(app_id: str):
    if not APP_ID_PATTERN.match(app_id):
        raise HTTPException(status_code=400, detail=f"Invalid application ID format: {app_id}")


@router.post("/applications")
async def create_application(req: ApplicationCreateRequest):
    """Create a new loan application, or reset an existing session-isolated demo app."""
    if req.profile_id and req.demo_session_id:
        result = application_service.upsert_demo_application(
            profile_id=req.profile_id,
            demo_session_id=req.demo_session_id,
            data=req.model_dump(),
        )
        return result

    app = application_service.create_application(req.model_dump())
    return {"application_id": app["application_id"], "status": "submitted"}


@router.post("/demo/reset")
async def reset_demo(x_demo_reset: str = Header(default=None)):
    """Wipe all demo-created applications and related data. Preserves seeded data.

    Requires header X-Demo-Reset: confirm to prevent accidental invocation.
    """
    if x_demo_reset != "confirm":
        raise HTTPException(status_code=400, detail="Missing required header: X-Demo-Reset: confirm")
    result = application_service.reset_all_demo_data()
    return result


@router.get("/applications")
async def list_applications(skip: int = 0, limit: int = 50):
    """List all applications."""
    limit = min(max(limit, 1), 200)
    skip = max(skip, 0)
    return application_service.list_applications(skip=skip, limit=limit)


@router.get("/portfolio/stats")
async def portfolio_stats():
    from services.dashboard_service import get_portfolio_stats
    result = await asyncio.to_thread(get_portfolio_stats)
    return result


@router.get("/portfolio/ews")
async def portfolio_ews(loan_id: str = None):
    """Early Warning System signals from payment time-series analysis."""
    from services.dashboard_service import get_ews_signals
    if not loan_id:
        db = get_db()
        sample = db["payments"].find_one({}, {"loan_id": 1})
        if not sample:
            return []
        loan_id = sample["loan_id"]
    result = await asyncio.to_thread(get_ews_signals, loan_id)
    return result


@router.get("/portfolio/events")
async def portfolio_events(limit: int = 20):
    """Recent loan events (payments, agent actions)."""
    from services.dashboard_service import get_recent_events
    limit = min(max(limit, 1), 100)
    result = await asyncio.to_thread(get_recent_events, limit)
    return result


@router.get("/portfolio/payments")
async def portfolio_payments(loan_id: str = None):
    from services.dashboard_service import get_payment_trends
    results = await asyncio.to_thread(get_payment_trends, loan_id)
    # Serialize timestamps
    for r in results:
        if hasattr(r.get("timestamp"), "isoformat"):
            r["timestamp"] = r["timestamp"].isoformat()
    return results


@router.get("/applications/{app_id}")
async def get_application(app_id: str):
    """Get full application with documents and credit reports."""
    _validate_app_id(app_id)
    app = application_service.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail=f"Application {app_id} not found")
    return app


@router.get("/applications/{app_id}/activity")
async def stream_activity(app_id: str):
    """SSE endpoint — streams agent activity via MongoDB Change Stream.

    Resilience:
    - Change stream is reopened with `resume_after` on transient cursor failures.
    - Falls back to polling when change streams are unavailable (non-replica-set
      Mongo) or after repeated reopen failures.
    - Heartbeat every ~15s keeps the connection alive through proxy idle timeouts.
    - Never emits `{type: 'error'}` for transient issues — the frontend auto-closes
      on that, which would defeat EventSource's native retry.
    """
    _validate_app_id(app_id)

    async def event_generator():
        db = get_db()
        yield f"data: {json.dumps({'type': 'connected', 'application_id': app_id})}\n\n"

        pipeline = [{"$match": {"fullDocument.application_id": app_id}}]
        stream = None
        last_resume_token = None
        resume_retries = 0
        MAX_RESUME_RETRIES = 3
        heartbeat_counter = 0
        use_polling = False
        last_poll_ts = None
        seen_poll_ids: set = set()

        # Initial open; if the cluster can't serve change streams, degrade to polling
        try:
            stream = await asyncio.to_thread(
                lambda: db["agent_activity"].watch(pipeline, full_document="updateLookup")
            )
        except Exception:
            use_polling = True
            # Seed polling high-water mark so we don't replay history every reconnect
            latest = await asyncio.to_thread(
                lambda: list(
                    db["agent_activity"]
                    .find({"application_id": app_id})
                    .sort("timestamp", -1)
                    .limit(1)
                )
            )
            # Only seed HWM if the latest doc actually has a timestamp —
            # otherwise `last_poll_ts` stays None, the $gte filter is skipped,
            # and every untimestamped doc gets re-emitted every tick.
            if latest and latest[0].get("timestamp"):
                last_poll_ts = latest[0]["timestamp"]
                if latest[0].get("_id") is not None:
                    seen_poll_ids.add(latest[0]["_id"])

        try:
            while True:
                if use_polling:
                    query = {"application_id": app_id}
                    if last_poll_ts is not None:
                        query["timestamp"] = {"$gte": last_poll_ts}
                    new_docs = await asyncio.to_thread(
                        lambda q=query: list(
                            db["agent_activity"].find(q).sort("timestamp", 1).limit(100)
                        )
                    )
                    for doc in new_docs:
                        doc_id = doc.get("_id")
                        if doc_id is not None and doc_id in seen_poll_ids:
                            continue
                        ts = doc.get("timestamp")
                        if ts:
                            if last_poll_ts is None or ts > last_poll_ts:
                                # New tick — reset seen_ids for this new timestamp bucket
                                last_poll_ts = ts
                                seen_poll_ids = set()
                            if doc_id is not None:
                                seen_poll_ids.add(doc_id)
                        event = {
                            "type": "activity",
                            "agent": doc.get("agent", ""),
                            "action": doc.get("action", ""),
                            "detail": doc.get("detail", ""),
                            "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts or ""),
                        }
                        yield f"data: {json.dumps(event)}\n\n"
                    await asyncio.sleep(0.75)
                    heartbeat_counter += 1
                    # Emit heartbeat ~every 1.5s to defeat Envoy/Istio buffering.
                    if heartbeat_counter % 2 == 0:
                        yield ": heartbeat\n\n"
                    continue

                if stream is None:
                    if resume_retries >= MAX_RESUME_RETRIES:
                        logger.warning(
                            f"Activity stream for {app_id} exceeded resume retries; "
                            "falling back to polling"
                        )
                        use_polling = True
                        # Seed polling HWM so we don't replay history
                        latest = await asyncio.to_thread(
                            lambda: list(
                                db["agent_activity"]
                                .find({"application_id": app_id})
                                .sort("timestamp", -1)
                                .limit(1)
                            )
                        )
                        if latest:
                            last_poll_ts = latest[0].get("timestamp")
                            if latest[0].get("_id") is not None:
                                seen_poll_ids.add(latest[0]["_id"])
                        continue
                    try:
                        stream = await asyncio.to_thread(
                            lambda: db["agent_activity"].watch(
                                pipeline,
                                full_document="updateLookup",
                                resume_after=last_resume_token,
                            )
                        )
                        resume_retries = 0
                    except Exception as reopen_err:
                        resume_retries += 1
                        logger.warning(
                            f"Activity stream reopen failed for {app_id} "
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
                        f"Activity change-cursor error for {app_id} "
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
                    event = {
                        "type": "activity",
                        "agent": doc.get("agent", ""),
                        "action": doc.get("action", ""),
                        "detail": doc.get("detail", ""),
                        "timestamp": doc.get("timestamp", "").isoformat()
                        if hasattr(doc.get("timestamp", ""), "isoformat")
                        else str(doc.get("timestamp", "")),
                    }
                    yield f"data: {json.dumps(event)}\n\n"
                else:
                    await asyncio.sleep(0.5)
                    heartbeat_counter += 1
                    # Emit heartbeat every 1s to defeat Envoy/Istio SSE buffering.
                    if heartbeat_counter % 2 == 0:
                        yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            pass
        except Exception as e:
            # See note in agent.py /stream: don't emit {type: 'error'} — client
            # auto-closes on that, breaking EventSource's native retry loop.
            logger.error(f"Unhandled error in activity stream for {app_id}: {e}")
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


@router.get("/applications/{app_id}/status")
async def stream_status(app_id: str):
    """SSE endpoint — streams application status changes via Change Stream.

    Resilience:
    - Change stream reopened with `resume_after` on transient cursor failures.
    - Polling fallback (diff against last_status + last_updated_at) for clusters
      that can't serve change streams, and as a last resort after repeated reopen
      failures.
    - Heartbeat every ~15-20s keeps the connection alive.
    - No `{type: 'error'}` on transient failure — EventSource retries on its own.
    """
    _validate_app_id(app_id)

    async def event_generator():
        db = get_db()

        # Snapshot-on-connect: send current status first
        app = await asyncio.to_thread(
            db["applications"].find_one, {"application_id": app_id}
        )
        if app:
            yield f"data: {json.dumps({'type': 'status', 'status': app.get('status', 'unknown'), 'status_detail': app.get('status_detail', '')})}\n\n"

        pipeline = [
            {
                "$match": {
                    "fullDocument.application_id": app_id,
                    "operationType": {"$in": ["update", "replace"]},
                }
            }
        ]
        stream = None
        last_resume_token = None
        resume_retries = 0
        MAX_RESUME_RETRIES = 3
        heartbeat_counter = 0
        use_polling = False
        last_status = app.get("status") if app else None
        last_updated_at = app.get("updated_at") if app else None

        try:
            stream = await asyncio.to_thread(
                lambda: db["applications"].watch(pipeline, full_document="updateLookup")
            )
        except Exception:
            use_polling = True

        try:
            while True:
                if use_polling:
                    current = await asyncio.to_thread(
                        db["applications"].find_one, {"application_id": app_id}
                    )
                    if current:
                        cur_status = current.get("status")
                        cur_updated = current.get("updated_at")
                        if cur_status != last_status or cur_updated != last_updated_at:
                            last_status = cur_status
                            last_updated_at = cur_updated
                            event = {
                                "type": "status",
                                "status": cur_status or "",
                                "status_detail": current.get("status_detail", ""),
                                "updated_at": cur_updated.isoformat() if hasattr(cur_updated, "isoformat") else "",
                            }
                            yield f"data: {json.dumps(event)}\n\n"
                    await asyncio.sleep(1.0)
                    heartbeat_counter += 1
                    # Emit heartbeat every 2s to defeat Envoy/Istio buffering
                    # without generating excessive traffic on long-running polls.
                    if heartbeat_counter % 2 == 0:
                        yield ": heartbeat\n\n"
                    continue

                if stream is None:
                    if resume_retries >= MAX_RESUME_RETRIES:
                        logger.warning(
                            f"Status stream for {app_id} exceeded resume retries; "
                            "falling back to polling"
                        )
                        use_polling = True
                        continue
                    try:
                        stream = await asyncio.to_thread(
                            lambda: db["applications"].watch(
                                pipeline,
                                full_document="updateLookup",
                                resume_after=last_resume_token,
                            )
                        )
                        resume_retries = 0
                    except Exception as reopen_err:
                        resume_retries += 1
                        logger.warning(
                            f"Status stream reopen failed for {app_id} "
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
                        f"Status change-cursor error for {app_id} "
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
                    event = {
                        "type": "status",
                        "status": doc.get("status", ""),
                        "status_detail": doc.get("status_detail", ""),
                        "updated_at": doc.get("updated_at", "").isoformat()
                        if hasattr(doc.get("updated_at", ""), "isoformat")
                        else "",
                    }
                    yield f"data: {json.dumps(event)}\n\n"
                    last_status = doc.get("status")
                    last_updated_at = doc.get("updated_at")
                else:
                    await asyncio.sleep(0.5)
                    heartbeat_counter += 1
                    # Emit heartbeat every 1s to defeat Envoy/Istio buffering.
                    if heartbeat_counter % 2 == 0:
                        yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Unhandled error in status stream for {app_id}: {e}")
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


@router.get("/applications/{app_id}/timeline-context")
async def get_timeline_context(app_id: str):
    """Return borrower-safe context for the StatusTracker timeline."""
    _validate_app_id(app_id)
    app = await asyncio.to_thread(application_service.get_application, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    db = get_db()

    # Borrower-safe intervention data
    interventions = await asyncio.to_thread(
        lambda: list(
            db["interventions"]
            .find(
                {"application_id": app_id},
                {"_id": 0, "type": 1, "status": 1, "borrower_context": 1, "created_at": 1, "resolved_at": 1},
            )
            .sort("created_at", 1)
        )
    )

    # Activity summary counts
    activity_counts = await asyncio.to_thread(
        lambda: list(
            db["agent_activity"].aggregate([
                {"$match": {"application_id": app_id}},
                {"$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "by_action": {"$push": "$action"},
                }},
            ])
        )
    )

    summary = {
        "total_events": 0,
        "docs_verified": 0,
        "issues_detected": len([i for i in interventions if i.get("status") != "superseded"]),
        "issues_resolved": len([i for i in interventions if i.get("status") == "resolved"]),
    }
    if activity_counts:
        actions = activity_counts[0].get("by_action", [])
        summary["total_events"] = activity_counts[0].get("total", 0)
        summary["docs_verified"] = actions.count("verification")

    # Borrower-safe app fields only
    safe_app = {
        "application_id": app.get("application_id"),
        "loan_amount": app.get("loan_amount"),
        "purchase_price": app.get("purchase_price"),
        "product": app.get("product"),
        "risk_score": app.get("risk_score"),
        "risk_tier": app.get("risk_tier"),
        "gds_ratio": app.get("gds_ratio"),
        "tds_ratio": app.get("tds_ratio"),
        "primary_credit_score": app.get("primary_credit_score"),
        "decision_reasoning": app.get("decision_reasoning"),
        "borrower_names": app.get("borrower_names", []),
        "status": app.get("status"),
        "doc_count": len(app.get("documents", [])),
    }

    # Compute loan term details only for approved applications
    if app.get("status") in ("approved", "closing", "funded", "active"):
        loan_amount = app.get("loan_amount", 0)
        _rate_str = os.getenv("CURRENT_5YR_FIXED_RATE", "0.0489")
        try:
            approved_rate = float(_rate_str)
        except (ValueError, TypeError):
            approved_rate = 0.0489
        safe_app["approved_rate"] = approved_rate
        if loan_amount and loan_amount > 0:
            monthly_rate = approved_rate / 12
            n_payments = 25 * 12
            if monthly_rate > 0:
                safe_app["monthly_payment"] = round(
                    (loan_amount * monthly_rate * (1 + monthly_rate) ** n_payments)
                    / ((1 + monthly_rate) ** n_payments - 1)
                )
            else:
                safe_app["monthly_payment"] = round(loan_amount / n_payments) if n_payments > 0 else 0

    # Status history for stage timing
    status_history = app.get("status_history", [])
    for entry in status_history:
        if hasattr(entry.get("timestamp"), "isoformat"):
            entry["timestamp"] = entry["timestamp"].isoformat()

    # Serialize intervention timestamps
    for intv in interventions:
        for key in ("created_at", "resolved_at"):
            if hasattr(intv.get(key), "isoformat"):
                intv[key] = intv[key].isoformat()

    return {
        "application": safe_app,
        "interventions": interventions,
        "activity_summary": summary,
        "status_history": status_history,
    }


@router.get("/applications/{app_id}/risk-pipeline")
async def get_risk_pipeline(app_id: str):
    """Return the 7-stage aggregation pipeline stages and results."""
    _validate_app_id(app_id)
    from agents.pipeline.tools import run_risk_aggregation
    result = await asyncio.to_thread(run_risk_aggregation, app_id)
    if not result.get("application_id"):
        raise HTTPException(status_code=404, detail="Application not found or pipeline returned no results")

    # Include pipeline stage descriptions for frontend display
    result["pipeline_description"] = [
        {"stage": 1, "operator": "$match", "description": "Filter by application ID"},
        {"stage": 2, "operator": "$lookup", "description": "Join credit reports from credit_reports collection"},
        {"stage": 3, "operator": "$lookup", "description": "Join income verification documents"},
        {"stage": 4, "operator": "$addFields", "description": "Calculate monthly income, LTV, credit scores"},
        {"stage": 5, "operator": "$addFields", "description": "Score risk factors (credit + LTV points)"},
        {"stage": 6, "operator": "$addFields", "description": "Compute final risk score (0-100)"},
        {"stage": 7, "operator": "$project", "description": "Shape clean output for underwriting"},
    ]
    return result


@router.websocket("/applications/ws")
async def applications_ws(websocket: WebSocket):
    """WebSocket — real-time application queue via MongoDB Change Stream.

    Protocol:
    - On connect: server sends {"type": "snapshot", "applications": [...]}
    - On DB change: server sends {"type": "change", "operation": "insert"|"update", "application": {...}}
    - Client sends "ping" → server responds {"type": "pong"}
    - On error: server sends {"type": "error", "message": "..."} and closes with 1011
    - Server-side dead-client detection after 60s of no client messages
    """
    await websocket.accept()
    db = get_db()
    stream = None
    stop_event = asyncio.Event()
    # Single send-queue so only the sender task ever calls websocket.send_json.
    # Starlette WebSockets are NOT safe for concurrent sends from multiple tasks.
    send_queue: asyncio.Queue = asyncio.Queue(maxsize=500)

    async def enqueue(msg):
        # Non-blocking put: if the queue is full (slow client), drop the oldest
        # queued message to make room for the newest. Blocking with `await
        # send_queue.put` would stall the producer behind a slow/dead client and
        # delay disconnect detection until the queue drained. For a change-stream
        # feed, freshness matters more than completeness — a dropped stale event
        # is preferable to a wedged producer.
        try:
            send_queue.put_nowait(msg)
        except asyncio.QueueFull:
            try:
                dropped = send_queue.get_nowait()
                logger.warning(
                    f"Application queue WS send queue full; dropped oldest "
                    f"(type={dropped.get('type') if isinstance(dropped, dict) else '?'})"
                )
            except asyncio.QueueEmpty:
                pass
            try:
                send_queue.put_nowait(msg)
            except asyncio.QueueFull:
                # Should not happen (we just drained one), but stay defensive.
                logger.warning("Application queue WS send queue still full after drop")
        except Exception as e:
            logger.warning(f"Application queue WS enqueue error: {e}")

    async def client_reader():
        """Reads client messages concurrently so disconnects surface immediately."""
        try:
            while not stop_event.is_set():
                msg = await websocket.receive_text()
                if msg == "ping":
                    await enqueue({"type": "pong"})
        except WebSocketDisconnect:
            logger.info("Application queue WS client disconnected")
        except Exception as e:
            logger.warning(f"Application queue WS reader error: {e}")
        finally:
            stop_event.set()

    async def change_producer():
        """Enqueues DB changes via Change Stream, with resume_after recovery and polling fallback.

        Mirrors the resilience pattern used by the SSE endpoints: transient cursor
        failures (primary stepdown, idle timeout) trigger a reopen with
        `resume_after=last_token`. After MAX_RESUME_RETRIES the producer degrades
        to polling rather than killing the whole WebSocket.
        """
        nonlocal stream
        MAX_RESUME_RETRIES = 3
        pipeline = [
            {"$match": {"operationType": {"$in": ["insert", "update", "replace"]}}}
        ]
        last_resume_token = None
        resume_retries = 0
        use_polling = False

        try:
            # Initial open; degrade to polling if change streams are unavailable
            try:
                stream = await asyncio.to_thread(
                    lambda: db["applications"].watch(pipeline, full_document="updateLookup")
                )
            except Exception:
                stream = None
                use_polling = True

            # Change-stream loop with resume-on-error
            while not use_polling and not stop_event.is_set():
                if stream is None:
                    if resume_retries >= MAX_RESUME_RETRIES:
                        logger.warning(
                            "Application queue WS change stream exceeded resume "
                            "retries; falling back to polling"
                        )
                        use_polling = True
                        break
                    try:
                        stream = await asyncio.to_thread(
                            lambda: db["applications"].watch(
                                pipeline,
                                full_document="updateLookup",
                                resume_after=last_resume_token,
                            )
                        )
                        resume_retries = 0
                    except Exception as reopen_err:
                        resume_retries += 1
                        logger.warning(
                            f"Application queue WS change stream reopen failed "
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
                        f"Application queue WS change-cursor error "
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
                    doc = change.get("fullDocument")
                    if doc and not doc.get("seed_complete"):
                        serialized = application_service.serialize_doc(doc)
                        await enqueue({
                            "type": "change",
                            "operation": change.get("operationType", "unknown"),
                            "application": serialized,
                        })
                else:
                    await asyncio.sleep(0.5)

            # Polling fallback (initial unavailability or mid-stream degradation)
            if use_polling:
                seen: dict = {}
                while not stop_event.is_set():
                    apps = await asyncio.to_thread(application_service.list_applications)
                    for app in apps:
                        app_id = app.get("application_id")
                        updated = app.get("updated_at") or app.get("created_at")
                        if not app_id:
                            continue
                        prev = seen.get(app_id)
                        if prev != updated:
                            op = "insert" if prev is None else "update"
                            seen[app_id] = updated
                            await enqueue({
                                "type": "change",
                                "operation": op,
                                "application": app,
                            })
                    await asyncio.sleep(1.0)
        except Exception as e:
            logger.warning(f"Application queue WS producer error: {e}")
            await enqueue({"type": "error", "message": str(e)})
        finally:
            stop_event.set()

    async def sender():
        """Single task that owns websocket.send_json. Serializes all outbound frames."""
        try:
            while not stop_event.is_set():
                try:
                    msg = await asyncio.wait_for(send_queue.get(), timeout=0.5)
                except asyncio.TimeoutError:
                    continue
                try:
                    await websocket.send_json(msg)
                except WebSocketDisconnect:
                    break
                except Exception as e:
                    logger.warning(f"Application queue WS send error: {e}")
                    break
        finally:
            stop_event.set()

    try:
        # Initial snapshot BEFORE we start the tasks so clients see it
        # synchronously on connect.
        apps = await asyncio.to_thread(application_service.list_applications)
        await websocket.send_json({"type": "snapshot", "applications": apps})

        reader_task = asyncio.create_task(client_reader())
        producer_task = asyncio.create_task(change_producer())
        sender_task = asyncio.create_task(sender())

        # Wait for any task to end — whichever finishes first triggers shutdown
        done, pending = await asyncio.wait(
            {reader_task, producer_task, sender_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        stop_event.set()
        for t in pending:
            t.cancel()
            try:
                await t
            except (asyncio.CancelledError, Exception):
                pass

    except WebSocketDisconnect:
        logger.info("Application queue WS client disconnected")
    except Exception as e:
        logger.warning(f"Application queue WS error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
            await websocket.close(code=1011)
        except Exception:
            pass
    finally:
        if stream:
            try:
                stream.close()
            except Exception:
                pass
        try:
            await websocket.close()
        except Exception:
            pass
