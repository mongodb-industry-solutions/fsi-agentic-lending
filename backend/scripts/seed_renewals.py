#!/usr/bin/env python3
"""
Seed the `renewals` collection with a few existing loans approaching maturity.

These are existing customers (reusing the demo borrower personas) whose 5-year
term is coming up for renewal within the next ~3 months. They power the Renewal
Agent tab and are independent of the origination `applications` demo — nothing
here touches the new-application flow.

Usage:
    cd backend && uv run python -m scripts.seed_renewals          # seed if empty
    cd backend && uv run python -m scripts.seed_renewals --reset  # wipe + re-seed
"""
import sys
from datetime import datetime, timedelta, timezone

from db.mdb import coll
from db.storage_mapping import storage_filter, to_storage


# ── Seed definitions ─────────────────────────────────────────────────────────
# maturity_in_days is measured from "now" so the demo always shows loans inside
# the 3-month window regardless of when it's run. current_rate varies so the
# agent's new offer shows both savings and (realistically) a slight increase.
_RENEWAL_SEEDS = [
    {
        "renewal_id": "RNW-2026-0001",
        "profile_id": "jane-doe",
        "borrower_name": "Jane & John Doe",
        "property_address": "1450 Beach Ave, Vancouver, BC",
        "loan_amount": 415000,          # outstanding balance
        "current_rate": 0.0519,         # expiring rate (5.19%)
        "term": "5yr Fixed",
        "amortization_years": 22,       # remaining amortization
        "maturity_in_days": 28,
    },
    {
        "renewal_id": "RNW-2026-0002",
        "profile_id": "marcus-delgado",
        "borrower_name": "Marcus & Sofia Delgado",
        "property_address": "88 Riverstone Dr, Calgary, AB",
        "loan_amount": 720000,
        "current_rate": 0.0459,         # expiring rate (4.59%) — renews slightly higher
        "term": "5yr Fixed",
        "amortization_years": 21,
        "maturity_in_days": 61,
    },
    {
        "renewal_id": "RNW-2026-0003",
        "profile_id": "sarah-williams",
        "borrower_name": "Sarah Williams",
        "property_address": "215 Maple Grove Rd, Ottawa, ON",
        "loan_amount": 298000,
        "current_rate": 0.0544,         # expiring rate (5.44%)
        "term": "5yr Fixed",
        "amortization_years": 19,
        "maturity_in_days": 84,
    },
]


def _amortized_payment(principal: float, annual_rate: float, years: int) -> int:
    """Monthly payment via standard amortization (matches underwriter helper)."""
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


def _build_doc(seed: dict, now: datetime) -> dict:
    maturity = now + timedelta(days=seed["maturity_in_days"])
    origination = maturity - timedelta(days=365 * 5)  # 5yr term
    current_payment = _amortized_payment(
        seed["loan_amount"], seed["current_rate"], seed["amortization_years"]
    )
    return {
        "renewal_id": seed["renewal_id"],
        "profile_id": seed["profile_id"],
        "borrower_name": seed["borrower_name"],
        "property_address": seed["property_address"],
        "loan_amount": seed["loan_amount"],
        "current_rate": seed["current_rate"],
        "current_payment": current_payment,
        "term": seed["term"],
        "amortization_years": seed["amortization_years"],
        "origination_date": origination,
        "maturity_date": maturity,
        "status": "due",           # due -> offer_sent -> renewed
        "offer": None,             # populated by the Renewal Agent
        "signature": None,         # populated on e-signature
        "seed": True,
        "created_at": now,
        "updated_at": now,
    }


def seed_renewals(reset: bool = False) -> dict:
    """Seed the renewals collection. Idempotent unless reset=True (wipe + re-seed)."""
    renewals = coll("renewals")

    if reset:
        renewals.delete_many({"seed": True})

    now = datetime.now(timezone.utc)
    inserted = 0
    for seed in _RENEWAL_SEEDS:
        if not reset and renewals.find_one(
            storage_filter("renewals", {"renewal_id": seed["renewal_id"]})
        ):
            continue
        renewals.replace_one(
            storage_filter("renewals", {"renewal_id": seed["renewal_id"]}),
            to_storage("renewals", _build_doc(seed, now)),
            upsert=True,
        )
        inserted += 1

    return {"seeded": inserted, "total": renewals.count_documents({"seed": True})}


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    result = seed_renewals(reset=reset)
    print(f"Renewals seeded: {result['seeded']} (total seed docs: {result['total']})")
