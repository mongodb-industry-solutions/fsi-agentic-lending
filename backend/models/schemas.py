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
    declined = "declined"
    funded = "funded"
    active = "active"
    error = "error"


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


class HITLDecisionRequest(BaseModel):
    action: str = Field(..., pattern="^(approve|decline)$")
    officer_notes: str = ""
    conditions: list[str] = []


class VectorSearchRequest(BaseModel):
    query: str
    limit: int = 5


class AgentActivityEvent(BaseModel):
    application_id: str
    agent: str
    action: str
    detail: str
    timestamp: datetime
