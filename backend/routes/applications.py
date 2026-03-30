"""Application API routes."""
import asyncio
import json
import logging
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from models.schemas import ApplicationCreateRequest
from services import application_service
from db.mdb import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["applications"])


@router.post("/applications")
async def create_application(req: ApplicationCreateRequest):
    """Create a new loan application."""
    app = application_service.create_application(req.model_dump())
    return {"application_id": app["application_id"], "status": "submitted"}


@router.get("/applications")
async def list_applications():
    """List all applications."""
    return application_service.list_applications()


@router.get("/applications/{app_id}")
async def get_application(app_id: str):
    """Get full application with documents and credit reports."""
    app = application_service.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail=f"Application {app_id} not found")
    return app


@router.get("/applications/{app_id}/activity")
async def stream_activity(app_id: str):
    """SSE endpoint — streams agent activity via MongoDB Change Stream."""

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


@router.websocket("/applications/ws")
async def applications_ws(websocket: WebSocket):
    """WebSocket — real-time application queue via MongoDB Change Stream.

    Protocol:
    - On connect: server sends {"type": "snapshot", "applications": [...]}
    - On DB change: server sends {"type": "change", "operation": "insert"|"update", "application": {...}}
    - Client sends "ping" → server responds {"type": "pong"}
    - On error: server sends {"type": "error", "message": "..."} and closes with 1011
    - Clean disconnect: server closes change stream
    """
    await websocket.accept()
    db = get_db()
    stream = None

    try:
        # Send initial snapshot of all applications
        apps = await asyncio.to_thread(application_service.list_applications)
        await websocket.send_json({"type": "snapshot", "applications": apps})

        # Open Change Stream on applications collection
        pipeline = [
            {"$match": {"operationType": {"$in": ["insert", "update", "replace"]}}}
        ]
        stream = db["applications"].watch(pipeline, full_document="updateLookup")

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
                if msg == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                pass

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
