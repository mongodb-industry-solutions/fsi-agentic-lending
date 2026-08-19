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


def generate_offer(renewal_id: str) -> dict | None:
    """Run the Renewal Agent for one loan: compute new terms + prepare the offer."""
    db = get_db()
    renewal = db["renewals"].find_one({"renewal_id": renewal_id})
    if not renewal:
        return None

    now = datetime.now(timezone.utc)
    amort = renewal.get("amortization_years", 25)
    loan_amount = renewal.get("loan_amount", 0)
    current_rate = renewal.get("current_rate", 0)

    steps = []

    # 1. Determine the renewal rate. Base = current market rate; loyal borrowers
    #    (existing customers, in good standing) get a small retention discount.
    market = _market_rate()
    retention_discount = 0.0010  # 10 bps loyalty adjustment
    new_rate = round(max(market - retention_discount, 0.0), 4)
    steps.append(
        f"Pulled current 5yr fixed market rate ({market * 100:.2f}%) and applied a "
        f"10 bps retention discount for an existing customer in good standing."
    )

    # 2. Recompute the payment on the remaining amortization.
    new_payment = _amortized_payment(loan_amount, new_rate, amort)
    current_payment = renewal.get("current_payment") or _amortized_payment(
        loan_amount, current_rate, amort
    )
    payment_delta = new_payment - current_payment
    steps.append(
        f"Recalculated the monthly payment on the ${loan_amount:,} balance over the "
        f"remaining {amort}-year amortization: ${new_payment:,}/mo "
        f"({'-' if payment_delta < 0 else '+'}${abs(payment_delta):,} vs current)."
    )

    # 3. Draft the rationale + prepare the offer for signature.
    rationale = _draft_rationale(renewal, new_rate, new_payment)
    steps.append("Prepared the personalized renewal offer for e-signature.")

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

    # Log the agent's reasoning trail (namespaced by renewal_id).
    log_agent_activity(renewal_id, "renewal_agent", "renewal_scan",
                       f"Loan {renewal_id} maturing — generating renewal offer.")
    for step in steps:
        log_agent_activity(renewal_id, "renewal_agent", "renewal_offer", step)

    updated = db["renewals"].find_one({"renewal_id": renewal_id})
    return _serialize(updated)


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
