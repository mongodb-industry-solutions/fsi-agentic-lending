"""Request adaptation for the BIAN API surface (FastAPI-free, unit-tested).

The wire speaks the `loans` / `creditReports` storage shape (camelCase), per
the payment-flow-full standard. Lending's service layer, however, speaks
snake_case (Option-A storage boundary in `db/storage_mapping.py`). Responses
need no shaping — the handler returns the raw stored camelCase document with
`_id` stripped (`routes/_bian_util.strip`). Requests need an adaptor because
`create_application` takes a flat snake_case `data` dict (`primary_name`,
`property_address`, …), not the nested camelCase storage shape.
"""
from __future__ import annotations

from api_models import ConsumerLoanInitiateRequest


def adapt_initiate(body: ConsumerLoanInitiateRequest) -> dict:
    """`ConsumerLoanInitiateRequest` (camelCase storage shape) -> `create_application`'s `data` dict.

    `borrowerNames` splits into primary + optional co-applicant (position implies
    role, exactly as the native `ApplicationCreateRequest` does). Nested
    `property` / `incomeSummary` flatten to the field names `create_application`
    reads.
    """
    names = body.borrowerNames
    return {
        "primary_name": names[0],
        "co_applicant_name": names[1] if len(names) > 1 else None,
        "loan_amount": body.loanAmount,
        "purchase_price": body.purchasePrice,
        "down_payment": body.downPayment,
        "product": body.product,
        "property_address": body.property.address,
        "property_type": body.property.type,
        "annual_property_tax": body.property.annualTax,
        "combined_income": body.incomeSummary.combinedGross,
        "primary_income": body.incomeSummary.primary,
        "co_applicant_income": body.incomeSummary.coApplicant,
        "existing_monthly_debt": body.existingMonthlyDebt,
    }
