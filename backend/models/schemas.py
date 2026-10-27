"""Pydantic request/response models for the LendFlow API."""
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime


class ApplicationStatus(str, Enum):
    submitted = "submitted"
    processing = "processing"
    action_required = "action_required"
    underwriting = "underwriting"
    review = "review"
    approved = "approved"
    closing = "closing"
    declined = "declined"
    funded = "funded"
    active = "active"
    error = "error"
    hitl_error = "hitl_error"


# BIAN `ConsumerLoanApexStatus` (spec v4_34) allows only these 7 values.
# The 12-state machine above is the operational source of truth and is stored
# unchanged in `loans.statusSource`; `loans.status` is a derived projection for
# BIAN reporting. **Application code reads statusSource, never status.**
#
# The mapping is lossy in one direction: 4 in-flight states collapse onto
# UNDER_REVIEW, and 4 states have no BIAN home at all —
#   funded / active     : ConsumerLoanApexStatus has no post-approval
#                         lifecycle state (disbursed / servicing).
#   error / hitl_error  : operational, not a business status.
# Those 4 fall back to the nearest defensible business meaning. Raised with
# Doina as a spec gap alongside the assessment / loanRepayments proposals.
_BIAN_STATUS = {
    "submitted": "SUBMITTED",
    "processing": "UNDER_REVIEW",
    "action_required": "UNDER_REVIEW",
    "underwriting": "UNDER_REVIEW",
    "review": "UNDER_REVIEW",
    "approved": "APPROVED",
    "closing": "APPROVED",
    "declined": "REJECTED",
    "funded": "APPROVED",
    "active": "APPROVED",
    "error": "UNDER_REVIEW",
    "hitl_error": "UNDER_REVIEW",
}

# States whose BIAN projection loses information. Kept explicit so the
# statusSource round-trip can be asserted in tests.
LOSSY_STATUSES = frozenset(
    s for s in _BIAN_STATUS
    if sum(1 for o in _BIAN_STATUS.values() if o == _BIAN_STATUS[s]) > 1
)


def to_bian_status(status: str) -> str:
    """Project an operational status onto ConsumerLoanApexStatus.

    Unknown values map to DRAFT rather than raising — a status this function
    does not know about must not break a write path.
    """
    return _BIAN_STATUS.get((status or "").strip().lower(), "DRAFT")


class ApplicationCreateRequest(BaseModel):
    primary_name: str
    co_applicant_name: Optional[str] = None
    loan_amount: float
    purchase_price: float
    down_payment: float
    product: str = "5yr Fixed (25yr Amort)"
    property_address: str
    property_type: str = "Detached Home"
    combined_income: float
    primary_income: float
    co_applicant_income: Optional[float] = None
    annual_property_tax: float = 0
    existing_monthly_debt: float = 0
    profile_id: Optional[str] = None
    demo_session_id: Optional[str] = None


class ApplicationResponse(BaseModel):
    application_id: str
    borrower_names: list[str]
    loan_amount: float
    purchase_price: float
    product: str
    status: str
    property: dict
    # income_summary keys: combined_gross, primary, co_applicant (stored on the
    # loan) plus primary_employment, co_applicant_gross, co_applicant_employment
    # (enriched from the shared `customers` directory in get_application()).
    income_summary: dict
    created_at: datetime
    documents: list[dict] = []
    credit_reports: list[dict] = []

    model_config = ConfigDict(from_attributes=True)


class HITLOverrides(BaseModel):
    risk_tier: Optional[str] = Field(None, pattern=r"^(A|B\+|B|C|D)$")
    loan_amount: Optional[float] = Field(None, gt=0)
    # Annual percentage rate the officer dialled in on the HITL card. Bounds
    # match the rate slider range in HITLReviewCard.
    rate: Optional[float] = Field(None, gt=0, le=100)


class HITLDecisionRequest(BaseModel):
    action: str = Field(..., pattern="^(approve|decline|modify_and_continue)$")
    officer_notes: str = ""
    conditions: list[str] = []
    overrides: HITLOverrides = HITLOverrides()
    officer_id: str = Field(..., min_length=1)


class VectorSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    limit: int = Field(default=5, ge=1, le=100)


class AgentRunRequest(BaseModel):
    autonomy_level: str = Field(default="bounded", pattern="^(observe|suggest|bounded|auto)$")


class AgentActivityEvent(BaseModel):
    application_id: str
    agent: str
    action: str
    detail: str
    timestamp: datetime
