"""Chat routes for the Application Agent."""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from db.mdb import get_db
from agents.chatbot.agent import chat as agent_chat, chat_stream as agent_chat_stream, safety_filter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])


class ChatMessageRequest(BaseModel):
    message: str = Field(..., max_length=4000)
    application_id: Optional[str] = None


class ChatMessageResponse(BaseModel):
    role: str = "assistant"
    content: str
    timestamp: str


@router.post("/chat/{application_id}/message", response_model=ChatMessageResponse)
async def send_message(application_id: str, req: ChatMessageRequest):
    """Send a message to the application agent and get a response."""
    db = get_db()

    # Get or create conversation (atomic upsert to avoid TOCTOU race)
    from pymongo import ReturnDocument
    conversation = await asyncio.to_thread(
        db["conversations"].find_one_and_update,
        {"application_id": application_id},
        {"$setOnInsert": {
            "application_id": application_id,
            "messages": [],
            "phase": "active",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    history = conversation.get("messages", [])

    # Call agent (run in thread to avoid blocking the event loop)
    response_text = await asyncio.to_thread(
        agent_chat,
        application_id,
        req.message,
        history,
    )

    now = datetime.now(timezone.utc)

    # Append both messages to conversation
    await asyncio.to_thread(
        db["conversations"].update_one,
        {"application_id": application_id},
        {
            "$push": {
                "messages": {
                    "$each": [
                        {
                            "role": "user",
                            "content": req.message,
                            "timestamp": now.isoformat(),
                        },
                        {
                            "role": "assistant",
                            "content": response_text,
                            "timestamp": now.isoformat(),
                        },
                    ]
                }
            },
            "$set": {"updated_at": now},
        },
    )

    return ChatMessageResponse(
        content=response_text,
        timestamp=now.isoformat(),
    )


@router.post("/chat/{application_id}/message/stream")
async def send_message_stream(application_id: str, req: ChatMessageRequest):
    """Stream a response from the application agent token by token via SSE."""
    db = get_db()

    from pymongo import ReturnDocument
    conversation = await asyncio.to_thread(
        db["conversations"].find_one_and_update,
        {"application_id": application_id},
        {"$setOnInsert": {
            "application_id": application_id,
            "messages": [],
            "phase": "active",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    history = conversation.get("messages", [])

    async def event_generator():
        accumulated = []
        citations = []
        safety_tripped = False
        queue = asyncio.Queue()
        sentinel = object()

        loop = asyncio.get_running_loop()

        def run_stream():
            try:
                for chunk in agent_chat_stream(application_id, req.message, history):
                    loop.call_soon_threadsafe(queue.put_nowait, chunk)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, sentinel)

        task = loop.run_in_executor(None, run_stream)

        while True:
            item = await queue.get()
            if item is sentinel:
                break
            if isinstance(item, dict) and item.get("type") == "tool_calls":
                for tool in item["tools"]:
                    yield f"data: {json.dumps({'type': 'tool_call', **tool})}\n\n"
                    if tool.get("citations"):
                        citations.extend(tool["citations"])
                continue
            if isinstance(item, str):
                accumulated.append(item)
                if not safety_tripped:
                    running_text = "".join(accumulated)
                    filtered_check = safety_filter(running_text)
                    if filtered_check != running_text:
                        safety_tripped = True
                        logger.warning(f"Safety filter tripped during stream for {application_id}")
                    else:
                        yield f"data: {json.dumps({'type': 'token', 'content': item})}\n\n"

        await task

        full_response = "".join(accumulated)
        if safety_tripped:
            filtered = safety_filter(full_response)
            yield f"data: {json.dumps({'type': 'replace', 'content': filtered})}\n\n"
        else:
            filtered = full_response

        now = datetime.now(timezone.utc)

        await asyncio.to_thread(
            db["conversations"].update_one,
            {"application_id": application_id},
            {
                "$push": {
                    "messages": {
                        "$each": [
                            {"role": "user", "content": req.message, "timestamp": now.isoformat()},
                            {"role": "assistant", "content": filtered, "timestamp": now.isoformat()},
                        ]
                    }
                },
                "$set": {"updated_at": now},
            },
        )

        done_payload = {"type": "done", "content": filtered, "timestamp": now.isoformat()}
        if citations:
            done_payload["citations"] = citations
        yield f"data: {json.dumps(done_payload)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/chat/{application_id}/history")
async def get_history(application_id: str):
    """Get conversation history for an application."""
    db = get_db()
    conversation = await asyncio.to_thread(
        db["conversations"].find_one,
        {"application_id": application_id},
        {"messages": 1, "_id": 0},
    )
    if not conversation:
        return {"messages": []}
    return {"messages": conversation.get("messages", [])}


@router.get("/chat/{application_id}/interventions")
async def get_interventions(application_id: str):
    """Get pending interventions for an application (borrower-safe fields only)."""
    from agents.chatbot.tools import get_pending_interventions
    interventions = await asyncio.to_thread(get_pending_interventions, application_id)
    return {"interventions": interventions}


@router.post("/chat/{application_id}/interventions/{intervention_id}/resolve")
async def resolve_intervention(application_id: str, intervention_id: str):
    """Resolve/acknowledge a pending intervention."""
    from agents.chatbot.tools import submit_intervention_response
    result = await asyncio.to_thread(
        submit_intervention_response,
        intervention_id,
        "Acknowledged by borrower via portal",
        application_id,
    )
    if result.get("error"):
        if "Invalid" in result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/chat/general/message", response_model=ChatMessageResponse)
async def send_general_message(req: ChatMessageRequest):
    """Send a message to the application agent without an application context.

    Used for pre-submission queries (e.g. "What documents do I need?").
    """
    response_text = await asyncio.to_thread(
        agent_chat,
        None,  # no application_id
        req.message,
        [],  # no history for general queries
    )

    return ChatMessageResponse(
        content=response_text,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
