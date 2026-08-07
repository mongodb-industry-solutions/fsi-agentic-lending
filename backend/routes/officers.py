"""Loan officer routes."""
import logging
from fastapi import APIRouter

from services.officer_service import get_current_officer

logger = logging.getLogger(__name__)

router = APIRouter(tags=["officers"])


@router.get("/officers/current")
async def current_officer():
    """Return the current reviewing loan officer (seeded singleton)."""
    return get_current_officer()
