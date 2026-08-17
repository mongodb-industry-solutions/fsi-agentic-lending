"""
Renewal Agent service.

A lightweight, standalone agent (no LangGraph pipeline) that:
  1. Scans existing loans approaching maturity (within 3 months).
  2. Generates a personalized renewal offer with a new rate + drafts a
     renewal agreement PDF.
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
def scan_due_renewals() -> dict:
    """Return loans maturing within the renewal window, soonest first."""
    db = get_db()
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=RENEWAL_WINDOW_DAYS)

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
    """Run the Renewal Agent for one loan: compute new terms + draft the document."""
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

    # 3. Draft the rationale + renewal document.
    rationale = _draft_rationale(renewal, new_rate, new_payment)
    steps.append("Drafted the renewal agreement and prepared it for e-signature.")

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


# ── Renewal agreement PDF ────────────────────────────────────────────────────
def build_renewal_pdf(renewal_id: str) -> bytes | None:
    """Generate the renewal agreement PDF on the fly from stored offer terms."""
    db = get_db()
    renewal = db["renewals"].find_one({"renewal_id": renewal_id})
    if not renewal or not renewal.get("offer"):
        return None

    from fpdf import FPDF

    offer = renewal["offer"]
    DARK_BLUE = (27, 58, 92)
    GOLD = (201, 150, 59)
    GRAY = (80, 80, 80)

    def s(text: str) -> str:
        return (text or "").replace("—", "--").replace("–", "-") \
            .replace("’", "'").replace("‘", "'") \
            .replace("“", '"').replace("”", '"')

    pdf = FPDF(orientation="P", unit="mm", format="Letter")
    pdf.set_auto_page_break(auto=True, margin=25)
    pdf.add_page()

    # Header band
    pdf.set_fill_color(*DARK_BLUE)
    pdf.rect(0, 0, pdf.w, 28, "F")
    pdf.set_xy(10, 7)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 8, "LendFlow Mortgage Renewal", ln=True)
    pdf.set_xy(pdf.w - 90, 8)
    pdf.set_text_color(*GOLD)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(80, 7, "RENEWAL AGREEMENT", align="R")
    pdf.set_xy(pdf.w - 90, 15)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(80, 4, s(renewal["renewal_id"]), align="R")
    pdf.set_text_color(0, 0, 0)
    pdf.set_y(38)

    def row(label: str, value: str, bold_value: bool = False):
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*GRAY)
        pdf.cell(70, 8, s(label))
        pdf.set_font("Helvetica", "B" if bold_value else "", 10)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 8, s(value), ln=True)

    def section(title: str):
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(*DARK_BLUE)
        pdf.cell(0, 8, s(title), ln=True)
        pdf.set_draw_color(*GOLD)
        pdf.line(10, pdf.get_y(), pdf.w - 10, pdf.get_y())
        pdf.ln(2)
        pdf.set_text_color(0, 0, 0)

    section("Borrower & Property")
    row("Borrower", renewal.get("borrower_name", ""))
    row("Property", renewal.get("property_address", ""))
    row("Outstanding balance", f"${renewal.get('loan_amount', 0):,}")

    section("Current Term (Maturing)")
    row("Rate", f"{offer['current_rate'] * 100:.2f}%")
    row("Monthly payment", f"${offer['current_payment']:,}")

    section("Renewed Term (Offered)")
    row("Product", f"{offer['new_term']} ({offer['amortization_years']}yr Amort)")
    row("New rate", f"{offer['new_rate'] * 100:.2f}%", bold_value=True)
    row("New monthly payment", f"${offer['new_payment']:,}", bold_value=True)
    delta = offer["payment_delta"]
    row("Change vs current", f"{'-' if delta < 0 else '+'}${abs(delta):,} / month")

    section("Renewal Summary")
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, s(offer.get("rationale", "")))

    # Signature block
    pdf.ln(10)
    sig = renewal.get("signature")
    pdf.set_draw_color(0, 0, 0)
    pdf.line(10, pdf.get_y() + 12, 90, pdf.get_y() + 12)
    if sig:
        pdf.set_xy(10, pdf.get_y() + 4)
        pdf.set_font("Helvetica", "I", 11)
        pdf.set_text_color(*DARK_BLUE)
        pdf.cell(80, 6, s(sig.get("signer_name", "")), ln=False)
    pdf.set_xy(10, pdf.get_y() + 14)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*GRAY)
    status_line = (
        f"E-signed {sig['signed_at'].date()} (simulated)"
        if sig and isinstance(sig.get("signed_at"), datetime)
        else "Borrower signature"
    )
    pdf.cell(80, 5, s(status_line))

    # Footer — disable auto page-break so the full-width band can't spill a blank page
    pdf.set_auto_page_break(False)
    pdf.set_fill_color(*DARK_BLUE)
    pdf.rect(0, pdf.h - 18, pdf.w, 18, "F")
    pdf.set_xy(0, pdf.h - 13)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(0, 6, "SYNTHETIC DOCUMENT -- FOR DEMONSTRATION PURPOSES ONLY", align="C")

    out = pdf.output()
    return bytes(out)
