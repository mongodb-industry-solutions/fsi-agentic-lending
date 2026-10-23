"""Business Loan Risk Assessor routes.

Stateless, one-shot LLM assessment of a business loan application that
requires physical real estate (bakery, restaurant, retail, etc.). The user
supplies a US business location (address and/or coordinates) plus a loan
purpose / business plan description; the assessor returns a structured
risk-assessment report. Nothing is persisted.

Three endpoints:
- POST /risk-assessment/assess            — one-shot JSON report (fallback path)
- GET  /risk-assessment/assess-stream     — SSE: step/token/section events,
                                            then a `done` event with the report
- POST /risk-assessment/followup          — follow-up Q&A answered with the
                                            report as context
"""
import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agents.llm import get_llm

logger = logging.getLogger(__name__)
router = APIRouter(tags=["risk-assessment"])

VALID_RATINGS = ("Low", "Moderate", "Elevated", "High")

# Report keys that carry a plain string (streamed as `section` events)
SECTION_TEXT_KEYS = (
    "summary", "business_overview", "local_market", "environmental_flood",
    "rating_rationale", "closing_note",
)
# Report keys that carry a Low–High dimension rating
DIMENSION_RATING_KEYS = (
    "market_risk", "environmental_risk", "business_plan_risk",
)

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
  "summary": string,               // section 1, 3-5 sentences
  "business_overview": string,    // section 2, 3-5 sentences
  "local_market": string,         // section 3, 3-5 sentences
  "environmental_flood": string,  // section 4, 3-5 sentences
  "market_risk": string,          // "Low" | "Moderate" | "Elevated" | "High" — local market dimension
  "environmental_risk": string,   // same scale — environmental / flood hazard dimension
  "business_plan_risk": string,   // same scale — business plan / financial dimension
  "overall_rating": string,       // same scale — the composite rating
  "rating_rationale": string,     // 2-3 sentences justifying the composite rating
  "considerations": [string],     // 3-6 bullet points for the underwriting team
  "closing_note": string          // section 6, 3-5 sentences
}

Rate each dimension honestly — the composite need not equal any single dimension. Write in a professional, factual underwriting tone. Where your knowledge of a specific site is uncertain, say so and recommend verification (e.g. official FEMA flood map lookup, appraisal) rather than inventing specifics. Never invent precise flood-zone designations or dollar figures you are not confident in."""

FOLLOWUP_SYSTEM_PROMPT = """You are a senior commercial credit risk analyst at Leafy Bank. You have just produced the risk-assessment report shown below for a business loan application. The underwriting team (or the applicant) is now asking you follow-up questions about it.

Answer concisely (3-6 sentences) and stay consistent with your report: you may expand on any section, quantify reasoning, or discuss how changes to the assumptions (loan size, down payment, location, lease terms) would shift the risk. If a question needs facts you cannot know, say what to verify rather than inventing specifics. Never contradict the report's rating unless the question changes a material assumption — if it does, explain how the rating would move."""

# Matches a *complete* JSON string value for a key (closing quote must have
# arrived), tolerating escaped quotes inside the value. Used to emit section
# events while the tokens are still streaming.
_KEY_STRING_RE = {
    key: re.compile(r'"' + key + r'"\s*:\s*"((?:[^"\\]|\\.)*)"')
    for key in SECTION_TEXT_KEYS + DIMENSION_RATING_KEYS + ("overall_rating",)
}


class RiskAssessmentRequest(BaseModel):
    address: Optional[str] = Field(None, max_length=500)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    business_description: str = Field(..., min_length=1, max_length=4000)


class FollowupRequest(BaseModel):
    report: Dict[str, Any] = Field(..., description="The assessment report returned to the client")
    address: Optional[str] = Field(None, max_length=500)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    business_description: str = Field(None, max_length=4000)
    question: str = Field(..., min_length=1, max_length=2000)
    history: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Prior follow-up exchanges [{role: user|assistant, content}]",
    )


class RiskAssessmentResponse(BaseModel):
    summary: str
    business_overview: str
    local_market: str
    environmental_flood: str
    overall_rating: str
    rating_rationale: str
    considerations: List[str]
    closing_note: str
    # Per-dimension Low–High ratings (None if the model omitted them)
    market_risk: Optional[str] = None
    environmental_risk: Optional[str] = None
    business_plan_risk: Optional[str] = None
    # Fallback: raw model text when structured JSON could not be extracted
    markdown: Optional[str] = None
    generated_at: str


class FollowupResponse(BaseModel):
    answer: str


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


def _normalize_rating(value: Any) -> Optional[str]:
    rating = str(value or "").strip().capitalize()
    return rating if rating in VALID_RATINGS else None


def _validate_report(data: dict) -> Optional[RiskAssessmentResponse]:
    """Coerce the parsed JSON into the response model, or None if unusable."""
    rating = _normalize_rating(data.get("overall_rating"))
    if rating is None:
        return None
    considerations = data.get("considerations") or []
    if isinstance(considerations, str):
        considerations = [considerations]
    considerations = [str(c) for c in considerations if str(c).strip()]
    if not considerations:
        return None
    fields = {}
    for key in SECTION_TEXT_KEYS:
        val = str(data.get(key, "")).strip()
        if not val:
            return None
        fields[key] = val
    return RiskAssessmentResponse(
        **fields,
        overall_rating=rating,
        considerations=considerations,
        market_risk=_normalize_rating(data.get("market_risk")),
        environmental_risk=_normalize_rating(data.get("environmental_risk")),
        business_plan_risk=_normalize_rating(data.get("business_plan_risk")),
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


def _json_fallback_report(raw: str) -> RiskAssessmentResponse:
    """Hand raw model text to the frontend to render as-is."""
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
        return _json_fallback_report(raw)
    return report


def _stream_assessment_events(req: RiskAssessmentRequest):
    """Generator of SSE events for a live assessment.

    Emits:
      {"type":"step", ...}    — phase markers
      {"type":"token","text"} — raw model tokens (live drafting preview)
      {"type":"section",...}  — a completed report field, as soon as its
                                JSON string value is fully received
      {"type":"done","report"}— the validated full report
      {"type":"error",...}    — failure (the client falls back to POST)
    """
    llm = get_llm()
    user_prompt = _build_user_prompt(req)
    steps = [
        {"key": "plan", "n": 1, "title": "Analyzing business plan & financial signals"},
        {"key": "llm", "n": 2, "title": "Drafting assessment memo"},
        {"key": "validate", "n": 3, "title": "Validating report structure"},
    ]
    try:
        yield f'data: {json.dumps({"type": "step", **steps[0]})}\n\n'
        yield f'data: {json.dumps({"type": "step", **steps[1], "pending": True})}\n\n'

        accumulated: list[str] = []
        emitted: set[str] = set()
        for chunk in llm.stream_messages(
            messages=[{"role": "user", "content": user_prompt}],
            system_prompt=RISK_ASSESSOR_SYSTEM_PROMPT,
        ):
            accumulated.append(chunk)
            yield f'data: {json.dumps({"type": "token", "text": chunk})}\n\n'
            # Flush any report fields whose JSON string value just completed
            running = "".join(accumulated)
            for key, pattern in _KEY_STRING_RE.items():
                if key in emitted:
                    continue
                match = pattern.search(running)
                if match:
                    emitted.add(key)
                    try:
                        value = json.loads(f'"{match.group(1)}"')
                    except json.JSONDecodeError:
                        continue
                    yield f'data: {json.dumps({"type": "section", "key": key, "value": value})}\n\n'

        raw = "".join(accumulated)
        yield f'data: {json.dumps({"type": "step", **steps[2], "pending": True})}\n\n'
        data = _extract_json(raw)
        report = _validate_report(data) if data else None
        if report is None:
            # One retry, non-streamed, asking the model to fix its formatting
            retry_prompt = (
                f"{user_prompt}\n\nYour previous reply was not valid JSON "
                "matching the required schema. Respond again with ONLY the "
                "valid JSON object, no markdown fences, no extra text."
            )
            raw = llm.predict_with_system(retry_prompt, RISK_ASSESSOR_SYSTEM_PROMPT)
            data = _extract_json(raw)
            report = _validate_report(data) if data else None
        if report is None:
            logger.warning("Risk assessment stream JSON extraction failed; returning raw text")
            report = _json_fallback_report(raw)
        yield f'data: {json.dumps({"type": "done", "report": report.model_dump()})}\n\n'
    except Exception as e:  # noqa: BLE001 — one error event, then end the stream
        logger.error(f"Risk assessment stream failed: {e}")
        yield f'data: {json.dumps({"type": "error", "message": "The risk assessor is unavailable right now."})}\n\n'


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


@router.get("/risk-assessment/assess-stream")
async def assess_business_loan_stream(
    address: Optional[str] = Query(None, max_length=500),
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    description: str = Query(..., min_length=1, max_length=4000),
):
    """SSE — stream the assessment live: step markers, raw drafting tokens,
    completed report fields as they finish, then the validated report.

    The non-streamed POST /assess remains as a fallback (e.g. proxies that
    buffer SSE) and shares the same prompt and validation.
    """
    if not address and (latitude is None or longitude is None):
        raise HTTPException(
            status_code=422,
            detail="Provide an address, or latitude and longitude.",
        )
    req = RiskAssessmentRequest(
        address=address,
        latitude=latitude,
        longitude=longitude,
        business_description=description,
    )
    return StreamingResponse(
        _stream_assessment_events(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # defeat proxy buffering so events arrive live
        },
    )


@router.post("/risk-assessment/followup", response_model=FollowupResponse)
async def followup_question(req: FollowupRequest):
    """Answer a follow-up question about a produced assessment report.
    The client supplies the report (and optionally the prior Q&A) — the
    assessment itself stays stateless."""
    location_bits = []
    if req.address:
        location_bits.append(f"Address: {req.address}")
    if req.latitude is not None and req.longitude is not None:
        location_bits.append(f"Coordinates: {req.latitude:.5f}, {req.longitude:.5f}")

    context = ["Your risk-assessment report (JSON):"]
    context.append(json.dumps(req.report, indent=2))
    if location_bits:
        context.append("Business location (USA): " + "; ".join(location_bits))
    if req.business_description:
        context.append(
            "Original loan purpose / business plan:\n" + req.business_description
        )
    context.append("Answer the following question about the report.")

    messages = [{"role": "user", "content": "\n\n".join(context)}]
    # prior follow-up exchanges, oldest first
    for turn in (req.history or [])[:10]:
        role = turn.get("role")
        content = str(turn.get("content", ""))[:2000]
        if role in ("user", "assistant") and content.strip():
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": req.question})

    def _answer() -> str:
        llm = get_llm()
        return llm.predict_messages(
            messages=messages, system_prompt=FOLLOWUP_SYSTEM_PROMPT
        )

    try:
        answer = await asyncio.to_thread(_answer)
    except Exception as e:
        logger.error(f"Risk assessment follow-up failed: {e}")
        raise HTTPException(
            status_code=502,
            detail="The risk assessor is unavailable right now. Please try again.",
        )
    return FollowupResponse(answer=answer.strip())
