"""
Renewal Agent service.

A lightweight, standalone agent (no LangGraph pipeline) that:
  1. Scans existing loans approaching maturity (within 3 months).
  2. Generates a personalized renewal offer with a new rate + rationale.
  3. Auto-renews the loan once the borrower e-signs.

Kept deliberately simple for the demo: the `renewals` collection is
self-contained and independent of the origination `applications` flow.
"""
import logging
import os
import time
from datetime import datetime, timedelta, timezone

from db.mdb import get_db
from agents.pipeline.tools import log_agent_activity

logger = logging.getLogger(__name__)

RENEWAL_WINDOW_DAYS = 90  # "next 3 months"


# ── Helpers ──────────────────────────────────────────────────────────────────
def _market_rate() -> float:
    """Current 5yr fixed rate (shared with the underwriter / timeline context)."""
    try:
        return float(os.getenv("CURRENT_5YR_FIXED_RATE", "0.0489"))
    except (ValueError, TypeError):
        return 0.0489


def _amortized_payment(principal: float, annual_rate: float, years: int) -> int:
    """Monthly payment via standard amortization formula."""
    monthly_rate = annual_rate / 12
    n = years * 12
    if n <= 0:
        return 0
    if monthly_rate == 0:
        return round(principal / n)
    return round(
        (principal * monthly_rate * (1 + monthly_rate) ** n)
        / ((1 + monthly_rate) ** n - 1)
    )


def _serialize(doc: dict) -> dict:
    """Drop _id and convert datetimes to ISO strings for JSON responses."""
    if not doc:
        return doc
    out = {k: v for k, v in doc.items() if k != "_id"}
    for k, v in list(out.items()):
        if isinstance(v, datetime):
            out[k] = v.isoformat()
    if isinstance(out.get("offer"), dict):
        for k, v in list(out["offer"].items()):
            if isinstance(v, datetime):
                out["offer"][k] = v.isoformat()
    if isinstance(out.get("signature"), dict):
        for k, v in list(out["signature"].items()):
            if isinstance(v, datetime):
                out["signature"][k] = v.isoformat()
    return out


def _days_to_maturity(maturity: datetime, now: datetime) -> int:
    if not isinstance(maturity, datetime):
        return 0
    if maturity.tzinfo is None:
        maturity = maturity.replace(tzinfo=timezone.utc)
    return (maturity - now).days


# ── Scan ─────────────────────────────────────────────────────────────────────
def _restore_renewed_seeds(db, now: datetime) -> int:
    """Reset any already-renewed seed loans back to their pristine 'due' state.

    Signing pushes a loan's maturity +5 years, so it drops out of the scan window
    permanently — after a few demos the queue would deplete to zero. Restoring
    renewed seed loans on each scan keeps the demo infinitely repeatable: the
    "Re-scan portfolio" click brings the full set back. (The just-signed loan's
    "renewed" confirmation still shows until the user explicitly re-scans, since
    signing patches local UI state without refetching.)
    """
    from scripts.seed_renewals import _RENEWAL_SEEDS, _build_doc

    seed_by_id = {s["renewal_id"]: s for s in _RENEWAL_SEEDS}
    restored = 0
    for r in db["renewals"].find({"status": "renewed", "seed": True}, {"renewal_id": 1}):
        seed = seed_by_id.get(r["renewal_id"])
        if not seed:
            continue
        db["renewals"].replace_one({"renewal_id": r["renewal_id"]}, _build_doc(seed, now))
        db["agent_activity"].delete_many({"application_id": r["renewal_id"], "agent": "renewal_agent"})
        restored += 1
    return restored


def scan_due_renewals() -> dict:
    """Return loans maturing within the renewal window, soonest first.

    Restores previously-renewed seed loans first so the demo queue never depletes.
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=RENEWAL_WINDOW_DAYS)

    _restore_renewed_seeds(db, now)

    docs = list(
        db["renewals"]
        .find({"maturity_date": {"$lte": horizon}})
        .sort("maturity_date", 1)
    )

    items = []
    for d in docs:
        item = _serialize(d)
        item["days_to_maturity"] = _days_to_maturity(d.get("maturity_date"), now)
        items.append(item)

    return {
        "scanned_at": now.isoformat(),
        "window_days": RENEWAL_WINDOW_DAYS,
        "due_count": len(items),
        "renewals": items,
    }


# ── Offer generation (the "agent") ───────────────────────────────────────────
def _draft_rationale(renewal: dict, new_rate: float, new_payment: int) -> str:
    """Ask Bedrock for a short renewal rationale; fall back to deterministic text."""
    current_rate = renewal.get("current_rate", 0)
    current_payment = renewal.get("current_payment", 0)
    delta = new_payment - current_payment
    direction = "lower" if delta < 0 else ("higher" if delta > 0 else "unchanged")

    fallback = (
        f"Your 5-year term is maturing. Based on today's market and your on-time "
        f"payment history, we're offering a renewal at {new_rate * 100:.2f}%, "
        f"moving your rate from {current_rate * 100:.2f}%. Your new monthly payment "
        f"of ${new_payment:,} is {direction} than your current ${current_payment:,}. "
        f"Sign to lock in these terms for another 5 years."
    )

    try:
        from agents.llm import get_llm
        system_prompt = (
            "You are a Canadian mortgage renewal specialist. Write a warm, concise "
            "renewal explanation (2-3 sentences, under 70 words) for the borrower. "
            "Reference their current vs new rate and payment plainly. Do not invent "
            "numbers or add disclaimers, greetings, or sign-offs."
        )
        user = (
            f"Borrower: {renewal.get('borrower_name')}\n"
            f"Outstanding balance: ${renewal.get('loan_amount'):,}\n"
            f"Current rate: {current_rate * 100:.2f}% | Current payment: ${current_payment:,}/mo\n"
            f"Offered rate: {new_rate * 100:.2f}% | New payment: ${new_payment:,}/mo\n"
            f"Remaining amortization: {renewal.get('amortization_years')} years"
        )
        text = get_llm().predict_with_system(user, system_prompt)
        return (text or "").strip() or fallback
    except Exception as e:  # noqa: BLE001 — demo resilience, never crash on LLM
        logger.warning(f"Renewal rationale LLM failed, using fallback: {e}")
        return fallback


def renewal_exists(renewal_id: str) -> bool:
    """Cheap existence check (used by the streaming route to 404 before opening SSE)."""
    return get_db()["renewals"].count_documents({"renewal_id": renewal_id}, limit=1) > 0


def generate_offer_events(renewal_id: str):
    """Run the Renewal Agent, yielding a live event per phase, then a final offer.

    Single source of truth for offer generation. Each `step` event carries the
    tech that did the work (MongoDB / Compute / AWS Bedrock) and its latency, so
    the frontend can surface the agent's background work in the foreground. The
    Bedrock rationale is bracketed by a `pending` step (shown while the model
    thinks) and its completing step. Ends with a `done` event containing the
    fully serialized renewal (offer attached).
    """
    db = get_db()
    renewal = db["renewals"].find_one({"renewal_id": renewal_id})
    if not renewal:
        yield {"type": "error", "message": f"Renewal {renewal_id} not found"}
        return

    now = datetime.now(timezone.utc)
    amort = renewal.get("amortization_years", 25)
    loan_amount = renewal.get("loan_amount", 0)
    current_rate = renewal.get("current_rate", 0)

    steps = []
    n = 0

    def _done_step(key, title, tech, t0):
        nonlocal n
        n += 1
        record = {"n": n, "title": title, "tech": tech,
                  "elapsed_ms": int((time.monotonic() - t0) * 1000)}
        steps.append(record)
        return {"type": "step", "key": key, **record}

    # 0. Scan — the record we just read from the renewals collection.
    t = time.monotonic()
    yield _done_step("scan", f"Loan {renewal_id} is maturing — retrieved from the portfolio.",
                     "MongoDB · renewals", t)

    # 1. Determine the renewal rate: market rate + retention discount for a loyal customer.
    t = time.monotonic()
    market = _market_rate()
    retention_discount = 0.0010  # 10 bps loyalty adjustment
    new_rate = round(max(market - retention_discount, 0.0), 4)
    yield _done_step(
        "rate",
        f"Pulled 5yr fixed market rate ({market * 100:.2f}%) and applied a 10 bps "
        f"retention discount → {new_rate * 100:.2f}%.",
        "Compute · market rate", t)

    # 2. Recompute the payment on the remaining amortization.
    t = time.monotonic()
    new_payment = _amortized_payment(loan_amount, new_rate, amort)
    current_payment = renewal.get("current_payment") or _amortized_payment(
        loan_amount, current_rate, amort)
    payment_delta = new_payment - current_payment
    yield _done_step(
        "payment",
        f"Recomputed payment on ${loan_amount:,} over the remaining {amort}-year "
        f"amortization: ${new_payment:,}/mo "
        f"({'-' if payment_delta < 0 else '+'}${abs(payment_delta):,} vs current).",
        "Compute · amortization", t)

    # 3. Draft the rationale via Bedrock — the one slow phase; show it live.
    yield {"type": "step", "key": "rationale", "n": n + 1,
           "title": "Drafting a personalized rationale with AWS Bedrock Claude…",
           "tech": "AWS Bedrock · Claude", "pending": True}
    t = time.monotonic()
    rationale = _draft_rationale(renewal, new_rate, new_payment)
    yield _done_step("rationale", "Drafted a personalized renewal rationale.",
                     "AWS Bedrock · Claude", t)

    # 4. Persist the offer + write the reasoning trail to the activity log.
    t = time.monotonic()
    offer = {
        "new_rate": new_rate,
        "new_payment": new_payment,
        "new_term": renewal.get("term", "5yr Fixed"),
        "amortization_years": amort,
        "current_rate": current_rate,
        "current_payment": current_payment,
        "rate_delta": round(new_rate - current_rate, 4),
        "payment_delta": payment_delta,
        "rationale": rationale,
        "steps": steps,
        "generated_at": now,
    }
    db["renewals"].update_one(
        {"renewal_id": renewal_id},
        {"$set": {"offer": offer, "status": "offer_sent", "updated_at": now}},
    )
    log_agent_activity(renewal_id, "renewal_agent", "renewal_scan",
                       f"Loan {renewal_id} maturing — generating renewal offer.")
    for s in steps:
        log_agent_activity(renewal_id, "renewal_agent", "renewal_offer", s["title"])
    yield _done_step("persist", "Saved the offer and wrote the reasoning trail.",
                     "MongoDB · renewals + agent_activity", t)

    updated = db["renewals"].find_one({"renewal_id": renewal_id})
    yield {"type": "done", "renewal": _serialize(updated)}


def generate_offer(renewal_id: str) -> dict | None:
    """Non-streamed path: run the agent to completion and return the updated renewal."""
    result = None
    for ev in generate_offer_events(renewal_id):
        if ev.get("type") == "done":
            result = ev.get("renewal")
        elif ev.get("type") == "error":
            return None
    return result


# ── Sign & auto-renew ────────────────────────────────────────────────────────
def sign_and_renew(renewal_id: str, signer_name: str | None = None) -> dict | None:
    """Record the (simulated) e-signature and auto-renew the loan onto new terms."""
    db = get_db()
    renewal = db["renewals"].find_one({"renewal_id": renewal_id})
    if not renewal:
        return None

    offer = renewal.get("offer")
    if not offer:
        # Can't sign what hasn't been offered — generate first.
        return {"error": "no_offer", "message": "Generate a renewal offer before signing."}

    now = datetime.now(timezone.utc)
    new_maturity = now + timedelta(days=365 * 5)
    signature = {
        "signer_name": signer_name or renewal.get("borrower_name"),
        "signed_at": now,
        "method": "e-signature (simulated)",
    }

    db["renewals"].update_one(
        {"renewal_id": renewal_id},
        {"$set": {
            "status": "renewed",
            "signature": signature,
            # Roll the offered terms onto the loan.
            "current_rate": offer["new_rate"],
            "current_payment": offer["new_payment"],
            "maturity_date": new_maturity,
            "renewed_at": now,
            "updated_at": now,
        }},
    )

    log_agent_activity(renewal_id, "renewal_agent", "renewal_signed",
                       f"Borrower e-signed. Loan auto-renewed at "
                       f"{offer['new_rate'] * 100:.2f}% through {new_maturity.date()}.")

    updated = db["renewals"].find_one({"renewal_id": renewal_id})
    return _serialize(updated)
