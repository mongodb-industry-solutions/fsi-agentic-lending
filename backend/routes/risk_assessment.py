"""Business Loan Risk Assessor routes.

Stateless, one-shot LLM assessment of a business loan application that
requires physical real estate (bakery, restaurant, retail, etc.). The user
supplies a US business location (address and/or coordinates) plus a loan
purpose / business plan description; the assessor returns a structured
risk-assessment report. Nothing is persisted.
"""
import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from agents.llm import get_llm

logger = logging.getLogger(__name__)
router = APIRouter(tags=["risk-assessment"])

VALID_RATINGS = ("Low", "Moderate", "Elevated", "High")

RISK_ASSESSOR_SYSTEM_PROMPT = """You are a senior commercial credit risk analyst at Leafy Bank, specializing in business loans to small businesses that require physical real estate (bakery shops, restaurants, cafes, retail stores, salons, etc.).

You are given the business location in the USA (address and/or coordinates) and the applicant's loan purpose and business plan description. Using your knowledge of that locale and business category, produce a risk-assessment memo for the underwriting team.

Consider, using your own knowledge (no tools, no external data sources):
- The local market: area economics, foot traffic, demographics, competition saturation, commercial rents.
- Environmental and natural-hazard exposure: FEMA flood zone likelihood (coastal, riverine, low-lying areas), hurricane/tornado/wildfire/seismic exposure, drainage, and any implications for property insurance cost and availability.
- The business plan: realism of financials, owner experience signals, loan purpose (start-up vs expansion), collateral value of the real estate.

Your report MUST consist of these six sections:
1. Risk-Assessment Summary — a concise executive summary of the key risks.
2. Business Overview & Financial Snapshot — what the loan is for, apparent financial shape of the plan.
3. Local Market Context — the market dynamics around this specific location.
4. Environmental / Flood Risk Assessment — hazard exposure at this location and its lending implications.
5. Overall Risk Rating & Considerations — a rating plus the specific considerations that drove it.
6. Closing Note for Underwriting Team — recommended conditions, documentation to request, and monitoring suggestions.

Respond with ONLY a valid JSON object (no markdown fences, no commentary) with exactly these keys:
{
  "summary": string,              // section 1, 3-5 sentences
  "business_overview": string,    // section 2, 3-5 sentences
  "local_market": string,        // section 3, 3-5 sentences
  "environmental_flood": string,  // section 4, 3-5 sentences
  "overall_rating": string,       // one of "Low", "Moderate", "Elevated", "High"
  "rating_rationale": string,     // 2-3 sentences justifying the rating
  "considerations": [string],     // 3-6 bullet points for the underwriting team
  "closing_note": string          // section 6, 3-5 sentences
}

Write in a professional, factual underwriting tone. Where your knowledge of a specific site is uncertain, say so and recommend verification (e.g. official FEMA flood map lookup, appraisal) rather than inventing specifics. Never invent precise flood-zone designations or dollar figures you are not confident in."""


class RiskAssessmentRequest(BaseModel):
    address: Optional[str] = Field(None, max_length=500)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    business_description: str = Field(..., min_length=1, max_length=4000)


class RiskAssessmentResponse(BaseModel):
    summary: str
    business_overview: str
    local_market: str
    environmental_flood: str
    overall_rating: str
    rating_rationale: str
    considerations: List[str]
    closing_note: str
    # Fallback: raw model text when structured JSON could not be extracted
    markdown: Optional[str] = None
    generated_at: str


def _build_user_prompt(req: RiskAssessmentRequest) -> str:
    parts = ["Please assess the following business loan application."]
    location_bits = []
    if req.address:
        location_bits.append(f"Address: {req.address}")
    if req.latitude is not None and req.longitude is not None:
        location_bits.append(
            f"Coordinates: {req.latitude:.5f}, {req.longitude:.5f}"
        )
    parts.append("Business location (USA): " + "; ".join(location_bits))
    parts.append(
        "Loan purpose and business plan described by the applicant:\n"
        f"{req.business_description}"
    )
    parts.append(
        "Produce the risk-assessment report as the specified JSON object."
    )
    return "\n\n".join(parts)


def _extract_json(text: str) -> Optional[dict]:
    """Parse the model's reply as JSON, tolerating markdown fences."""
    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*(.+?)\s*```", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1).strip()
    # Fall back to the outermost braces if the model prefixed any prose
    if not cleaned.startswith("{"):
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end <= start:
            return None
        cleaned = cleaned[start : end + 1]
    try:
        data = json.loads(cleaned)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def _validate_report(data: dict) -> Optional[RiskAssessmentResponse]:
    """Coerce the parsed JSON into the response model, or None if unusable."""
    rating = str(data.get("overall_rating", "")).strip().capitalize()
    if rating not in VALID_RATINGS:
        return None
    considerations = data.get("considerations") or []
    if isinstance(considerations, str):
        considerations = [considerations]
    considerations = [str(c) for c in considerations if str(c).strip()]
    if not considerations:
        return None
    fields = {}
    for key in ("summary", "business_overview", "local_market",
                "environmental_flood", "rating_rationale", "closing_note"):
        val = str(data.get(key, "")).strip()
        if not val:
            return None
        fields[key] = val
    return RiskAssessmentResponse(
        **fields,
        overall_rating=rating,
        considerations=considerations,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


def _run_assessment(req: RiskAssessmentRequest) -> RiskAssessmentResponse:
    """Synchronous LLM call (run in a worker thread from the route)."""
    llm = get_llm()
    user_prompt = _build_user_prompt(req)
    raw = llm.predict_with_system(user_prompt, RISK_ASSESSOR_SYSTEM_PROMPT)

    data = _extract_json(raw)
    report = _validate_report(data) if data else None
    if report is None:
        # One retry — ask the model to fix its formatting
        retry_prompt = (
            f"{user_prompt}\n\nYour previous reply was not valid JSON "
            "matching the required schema. Respond again with ONLY the "
            "valid JSON object, no markdown fences, no extra text."
        )
        raw = llm.predict_with_system(retry_prompt, RISK_ASSESSOR_SYSTEM_PROMPT)
        data = _extract_json(raw)
        report = _validate_report(data) if data else None
    if report is None:
        # Last resort: hand the raw text to the frontend to render as-is
        logger.warning("Risk assessment JSON extraction failed; returning raw text")
        return RiskAssessmentResponse(
            summary="",
            business_overview="",
            local_market="",
            environmental_flood="",
            overall_rating="Moderate",
            rating_rationale="",
            considerations=[],
            closing_note="",
            markdown=raw,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
    return report


@router.post("/risk-assessment/assess", response_model=RiskAssessmentResponse)
async def assess_business_loan(req: RiskAssessmentRequest):
    """Assess a business loan application (location + plan) and return the
    six-section risk-assessment report. Stateless — nothing is persisted."""
    if not req.address and (req.latitude is None or req.longitude is None):
        raise HTTPException(
            status_code=422,
            detail="Provide an address, or latitude and longitude.",
        )

    try:
        return await asyncio.to_thread(_run_assessment, req)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Risk assessment failed: {e}")
        raise HTTPException(
            status_code=502,
            detail=(
                "The risk assessor is unavailable right now. "
                "Please try again in a moment."
            ),
        )
