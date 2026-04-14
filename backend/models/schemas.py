"""Pydantic request/response models for the LendFlow API."""
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime


class ApplicationStatus(str, Enum):
    submitted = "submitted"
    processing = "processing"
    underwriting = "underwriting"
    review = "review"
    approved = "approved"
    closing = "closing"
    declined = "declined"
    funded = "funded"
    active = "active"
    error = "error"
    hitl_error = "hitl_error"


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
    income_summary: dict
    created_at: datetime
    documents: list[dict] = []
    credit_reports: list[dict] = []

    model_config = ConfigDict(from_attributes=True)


class HITLOverrides(BaseModel):
    risk_tier: Optional[str] = Field(None, pattern=r"^(A|B\+|B|C|D)$")
    loan_amount: Optional[float] = Field(None, gt=0)


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
