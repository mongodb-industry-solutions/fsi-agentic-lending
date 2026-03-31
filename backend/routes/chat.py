"""Chat routes for the Application Agent."""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db.mdb import get_db
from agents.application_agent import chat as agent_chat

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
