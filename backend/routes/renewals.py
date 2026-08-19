"""Renewal Agent routes — scan due loans, generate offers, e-sign & auto-renew."""
import asyncio
import logging

from fastapi import APIRouter, HTTPException
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
