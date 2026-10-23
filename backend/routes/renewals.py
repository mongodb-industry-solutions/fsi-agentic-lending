"""Renewal Agent routes — scan due loans, generate offers, e-sign & auto-renew."""
import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services import renewal_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["renewals"])


class SignRequest(BaseModel):
    signer_name: str | None = None


@router.get("/renewals")
async def list_renewals():
    """Renewal Agent scan — loans maturing within the next 3 months."""
    return await asyncio.to_thread(renewal_service.scan_due_renewals)


@router.post("/renewals/{renewal_id}/offer")
async def generate_offer(renewal_id: str):
    """Run the Renewal Agent for one loan: compute new terms + prepare the offer."""
    result = await asyncio.to_thread(renewal_service.generate_offer, renewal_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Renewal {renewal_id} not found")
    return result


@router.get("/renewals/{renewal_id}/offer-stream")
async def generate_offer_stream(renewal_id: str):
    """SSE — stream the Renewal Agent's offer generation live.

    Emits one `step` event per phase (each tagged with the tech that did the work
    and its latency), a `pending` step around the Bedrock rationale call, then a
    final `done` event with the full offer. The non-streamed POST /offer remains
    as a fallback and shares the same underlying generator.
    """
    exists = await asyncio.to_thread(renewal_service.renewal_exists, renewal_id)
    if not exists:
        raise HTTPException(status_code=404, detail=f"Renewal {renewal_id} not found")

    def event_gen():
        for ev in renewal_service.generate_offer_events(renewal_id):
            yield f"data: {json.dumps(ev)}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # defeat proxy buffering so events arrive live
        },
    )


@router.post("/renewals/{renewal_id}/sign")
async def sign_renewal(renewal_id: str, body: SignRequest | None = None):
    """Record the (simulated) e-signature and auto-renew the loan."""
    signer = body.signer_name if body else None
    result = await asyncio.to_thread(renewal_service.sign_and_renew, renewal_id, signer)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Renewal {renewal_id} not found")
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(status_code=409, detail=result.get("message", "Cannot sign renewal"))
    return result
