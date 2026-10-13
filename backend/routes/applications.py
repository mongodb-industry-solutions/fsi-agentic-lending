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
from db.mdb import coll
from db.storage_mapping import from_storage, storage_filter, storage_key
from services.application_service import read_loan


def _k(runtime_path: str) -> str:
    """Runtime field path -> storage path on the `loans` collection."""
    return storage_key("applications", runtime_path)


def _a(runtime_path: str) -> str:
    """Runtime field path -> storage path on `lendingAgentActivity`."""
    return storage_key("agent_activity", runtime_path)


def _read_app(stored):
    """None-safe read_loan, for the snapshot-then-stream paths."""
    return read_loan(stored) if stored else None

logger = logging.getLogger(__name__)

router = APIRouter(tags=["applications"])

APP_ID_PATTERN = re.compile(r'^APP-[A-Z0-9-]{4,20}$')


def _validate_app_id(app_id: str):
    if not APP_ID_PATTERN.match(app_id):
        raise HTTPException(status_code=400, detail=f"Invalid application ID format: {app_id}")


def _borrower_decline_reason(status_detail: str) -> str:
    """Map an internal decline detail to a borrower-safe, qualitative reason.

    Internal decline text can embed raw ratios/scores; the borrower only ever
    sees a plain-language explanation with no numbers. Classification is keyword
    based against the known pipeline/officer decline messages, with a neutral
    default for anything unrecognized.
    """
    detail = (status_detail or "").lower()
    if "income" in detail:
        return ("We were unable to verify sufficient income to support the "
                "requested loan amount. A loan officer can discuss options with you.")
    if "credit" in detail:
        return ("We were unable to complete a credit assessment for this "
                "application. A loan officer can help you resolve this.")
    if "stress" in detail or "gds" in detail or "tds" in detail or "affordab" in detail:
        return ("Based on our affordability assessment, this loan amount exceeds "
                "what we're able to approve at this time. A loan officer can review "
                "alternative options with you.")
    if "officer" in detail:
        return ("After review, a loan officer was unable to approve this "
                "application. They can walk you through the details and next steps.")
    return ("We're unable to approve this application at this time. A loan officer "
            "can discuss the details and any next steps with you.")


# Underwriting vocabulary that must never surface in the borrower activity feed.
# When an activity detail mentions any of these, the raw text (which typically
# embeds ratios/scores like "GDS 32%, Risk 25/100 (A)") is replaced with a
# qualitative, number-free summary. Doc-verification/credit-pull steps that don't
# mention these terms pass through unchanged.
_UW_KEYWORDS_RE = re.compile(
    r"\b(gds|tds|risk score|risk tier|stress|tier\s+[a-d]|ltv|credit score|debt service)\b",
    re.IGNORECASE,
)


def _borrower_safe_activity_detail(agent: str, action: str, detail: str) -> str:
    """Redact underwriting internals from a borrower-facing activity detail."""
    if not detail or not _UW_KEYWORDS_RE.search(detail):
        return detail
    a = (agent or "").lower()
    if "underwriter" in a:
        return "Affordability and risk assessment step completed."
    if "credit" in a:
        return "Credit and income data reviewed."
    return "Assessment step completed."


@router.post("/applications")
async def create_application(req: ApplicationCreateRequest):
    """Create a new loan application, or reset an existing session-isolated demo app."""
    if req.profile_id and req.demo_session_id:
        result = application_service.upsert_demo_application(
            profile_id=req.profile_id,
            demo_session_id=req.demo_session_id,
            data=req.model_dump(),
        )
        # The borrower just saw these documents on the apply page — a submit that
        # cannot attach them is broken, not successful. Fail loudly instead of
        # shipping an empty application the tracking pane cannot display. A silent
        # zero-clone is how a wrong DATABASE_NAME / COLL_* mapping or an
        # unreachable Mongo manifests as "No documents found" with no error.
        if result.get("documents_attached", 0) == 0:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Application was created but 0 documents could be attached from "
                    f"seed profile '{req.profile_id}'. Verify DATABASE_NAME and the "
                    "COLL_* collection mapping (README: 'Collection overrides'), that "
                    "the seed application has documents, and that the backend can reach "
                    "MongoDB."
                ),
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
    """Early Warning System signals from rolling-window payment analysis."""
    from services.dashboard_service import get_ews_signals
    if not loan_id:
        sample = coll("payments").find_one({}, {storage_key("payments", "loan_id"): 1})
        if not sample:
            return []
        loan_id = from_storage("payments", sample)["loan_id"]
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

        pipeline = [{"$match": {f"fullDocument.{_a('application_id')}": app_id}}]
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
                lambda: coll("agent_activity").watch(pipeline, full_document="updateLookup")
            )
        except Exception:
            use_polling = True
            # Seed polling high-water mark so we don't replay history every reconnect
            latest = await asyncio.to_thread(
                lambda: list(
                    coll("agent_activity")
                    .find(storage_filter("agent_activity", {"application_id": app_id}))
                    .sort(_a("timestamp"), -1)
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
                    query = storage_filter("agent_activity", {"application_id": app_id})
                    if last_poll_ts is not None:
                        query[_a("timestamp")] = {"$gte": last_poll_ts}
                    new_docs = await asyncio.to_thread(
                        lambda q=query: list(
                            coll("agent_activity").find(q).sort(_a("timestamp"), 1).limit(100)
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
                            # Borrower never sees backend agent identity/actions —
                            # everything is attributed to the single assistant.
                            "agent": "assistant",
                            "action": "",
                            "detail": _borrower_safe_activity_detail(
                                doc.get("agent", ""), doc.get("action", ""), doc.get("detail", "")
                            ),
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
                                coll("agent_activity")
                                .find(storage_filter("agent_activity", {"application_id": app_id}))
                                .sort(_a("timestamp"), -1)
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
                            lambda: coll("agent_activity").watch(
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
                    doc = from_storage("agent_activity", change.get("fullDocument")) or {}
                    event = {
                        "type": "activity",
                        # Borrower never sees backend agent identity/actions —
                        # everything is attributed to the single assistant.
                        "agent": "assistant",
                        "action": "",
                        "detail": _borrower_safe_activity_detail(
                            doc.get("agent", ""), doc.get("action", ""), doc.get("detail", "")
                        ),
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
            coll("applications").find_one, {_k("application_id"): app_id}
        )
        app = _read_app(app)
        if app:
            yield f"data: {json.dumps({'type': 'status', 'status': app.get('status', 'unknown'), 'status_detail': app.get('status_detail', '')})}\n\n"

        pipeline = [
            {
                "$match": {
                    f"fullDocument.{_k('application_id')}": app_id,
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
                lambda: coll("applications").watch(pipeline, full_document="updateLookup")
            )
        except Exception:
            use_polling = True

        try:
            while True:
                if use_polling:
                    current = _read_app(await asyncio.to_thread(
                        coll("applications").find_one, {_k("application_id"): app_id}
                    ))
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
                            lambda: coll("applications").watch(
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
                    # A change stream hands back a raw STORAGE document, so it
                    # has to cross the boundary like any other read. Without
                    # _read_app: `status` is the BIAN projection (four in-flight
                    # states collapse onto UNDER_REVIEW, so the UI sticks on
                    # "in review"), and `status_detail` / `updated_at` are
                    # stored as `assessment.statusDetail` / `updatedAt` and so
                    # always read empty.
                    doc = _read_app(change.get("fullDocument")) or {}
                    updated_at = doc.get("updated_at", "")
                    event = {
                        "type": "status",
                        "status": doc.get("status", ""),
                        "status_detail": doc.get("status_detail", ""),
                        "updated_at": updated_at.isoformat()
                        if hasattr(updated_at, "isoformat")
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
            coll("interventions")
            .find(
                storage_filter("interventions", {"application_id": app_id}),
                # _id is borrower-safe (the chat interventions endpoint already
                # exposes it) and lets the borrower portal resolve an
                # intervention after uploading the requested documents.
                {"_id": 1, "type": 1, "status": 1,
                 storage_key("interventions", "borrower_context"): 1,
                 storage_key("interventions", "created_at"): 1,
                 storage_key("interventions", "resolved_at"): 1},
            )
            .sort(storage_key("interventions", "created_at"), 1)
        )
    )

    # Activity summary counts
    activity_counts = await asyncio.to_thread(
        lambda: list(
            coll("agent_activity").aggregate([
                {"$match": storage_filter("agent_activity", {"application_id": app_id})},
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

    # Borrower-safe app fields only.
    # Underwriting internals (risk_score, risk_tier, gds_ratio, tds_ratio,
    # primary_credit_score, decision_reasoning) are intentionally EXCLUDED —
    # the borrower sees a high-level, Amazon-style status only. All quantitative
    # scoring detail stays on the loan officer side. Do not add them back here.
    safe_app = {
        "application_id": app.get("application_id"),
        "loan_amount": app.get("loan_amount"),
        "purchase_price": app.get("purchase_price"),
        "product": app.get("product"),
        "borrower_names": app.get("borrower_names", []),
        "status": app.get("status"),
        "doc_count": len(app.get("documents", [])),
    }

    # Declined applications get a plain-language, qualitative reason only.
    # The pipeline's status_detail / decision_reasoning can embed raw ratios and
    # scores (e.g. "Stress GDS 68% ... limit 39%"), so we classify the underlying
    # cause and emit a borrower-safe message with no numbers.
    if app.get("status") == "declined":
        safe_app["decline_reason"] = _borrower_decline_reason(app.get("status_detail", ""))

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

    # Status history for stage timing — project to status + timestamp only.
    # The per-entry `detail` can embed raw ratios/scores (e.g. the auto-approve
    # detail "Auto-approved: GDS 32%, ...") so it is intentionally dropped here.
    raw_history = app.get("status_history", [])
    status_history = []
    for entry in raw_history:
        ts = entry.get("timestamp")
        status_history.append({
            "status": entry.get("status"),
            "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else ts,
        })

    # Serialize intervention ids + timestamps
    for intv in interventions:
        intv["_id"] = str(intv["_id"])
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
                    lambda: coll("applications").watch(pipeline, full_document="updateLookup")
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
                            lambda: coll("applications").watch(
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
                    doc = _read_app(change.get("fullDocument"))
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
