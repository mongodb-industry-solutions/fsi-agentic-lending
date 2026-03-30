"""Application API routes."""
import asyncio
import json
import logging
import re
import time
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
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
    """Create a new loan application."""
    app = application_service.create_application(req.model_dump())
    return {"application_id": app["application_id"], "status": "submitted"}


@router.get("/applications")
async def list_applications(skip: int = 0, limit: int = 50):
    """List all applications."""
    return application_service.list_applications(skip=skip, limit=limit)


@router.get("/portfolio/stats")
async def portfolio_stats():
    from agents.tools import get_portfolio_stats
    result = await asyncio.to_thread(get_portfolio_stats)
    return result


@router.get("/portfolio/payments")
async def portfolio_payments(loan_id: str = None):
    from agents.tools import get_payment_trends
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
    """SSE endpoint — streams agent activity via MongoDB Change Stream."""
    _validate_app_id(app_id)

    async def event_generator():
        db = get_db()
        yield f"data: {json.dumps({'type': 'connected', 'application_id': app_id})}\n\n"

        pipeline = [{"$match": {"fullDocument.application_id": app_id}}]
        stream = db["agent_activity"].watch(pipeline, full_document="updateLookup")

        try:
            while True:
                change = await asyncio.to_thread(stream.try_next)
                if change:
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


@router.get("/applications/{app_id}/status")
async def stream_status(app_id: str):
    """SSE endpoint — streams application status changes via Change Stream."""
    _validate_app_id(app_id)

    async def event_generator():
        db = get_db()

        # Send current status first
        app = await asyncio.to_thread(
            db["applications"].find_one, {"application_id": app_id}
        )
        if app:
            yield f"data: {json.dumps({'type': 'status', 'status': app.get('status', 'unknown')})}\n\n"

        pipeline = [
            {
                "$match": {
                    "fullDocument.application_id": app_id,
                    "operationType": {"$in": ["update", "replace"]},
                }
            }
        ]
        stream = db["applications"].watch(pipeline, full_document="updateLookup")

        try:
            while True:
                change = await asyncio.to_thread(stream.try_next)
                if change:
                    doc = change.get("fullDocument", {})
                    event = {
                        "type": "status",
                        "status": doc.get("status", ""),
                        "updated_at": doc.get("updated_at", "").isoformat()
                        if hasattr(doc.get("updated_at", ""), "isoformat")
                        else "",
                    }
                    yield f"data: {json.dumps(event)}\n\n"
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


@router.get("/applications/{app_id}/risk-pipeline")
async def get_risk_pipeline(app_id: str):
    """Return the 7-stage aggregation pipeline stages and results."""
    _validate_app_id(app_id)
    from agents.tools import run_risk_aggregation
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
    last_client_msg = time.monotonic()

    try:
        # Open Change Stream FIRST (before snapshot) to avoid missed-update window
        pipeline = [
            {"$match": {"operationType": {"$in": ["insert", "update", "replace"]}}}
        ]
        stream = db["applications"].watch(pipeline, full_document="updateLookup")

        # THEN send initial snapshot — any changes between stream open and snapshot
        # read will be captured by the stream and delivered after the snapshot
        apps = await asyncio.to_thread(application_service.list_applications)
        await websocket.send_json({"type": "snapshot", "applications": apps})

        while True:
            # Poll for MongoDB changes (non-blocking via thread)
            change = await asyncio.to_thread(stream.try_next)
            if change:
                doc = change.get("fullDocument")
                if doc:
                    serialized = application_service.serialize_doc(doc)
                    await websocket.send_json({
                        "type": "change",
                        "operation": change.get("operationType", "unknown"),
                        "application": serialized,
                    })

            # Check for client messages (keepalive ping/pong)
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                last_client_msg = time.monotonic()
                if msg == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                pass

            # Dead client detection — close if no message for 60s
            if time.monotonic() - last_client_msg > 60:
                logger.info("Application queue WS: client silent for 60s, closing")
                await websocket.close(code=1001)
                break

            if not change:
                await asyncio.sleep(0.5)

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
            stream.close()
