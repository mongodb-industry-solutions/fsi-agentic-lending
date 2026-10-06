"""Pydantic request models for the BIAN API surface.

Field names use **camelCase alias names matching Mongo storage** — the same
convention as the payment-flow-full accounts/transactions services. The
registry handles BIAN documentation mapping only; no wire translation is done
at request time. `extra="forbid"` rejects unknown fields so a stale caller
cannot silently drop a renamed field.

These model the `loans` / `creditReports` storage shapes (camelCase). The
handler adapts the validated model to the snake_case `data` dict the existing
service layer expects (`create_application`), since lending's runtime is
snake_case per the Option-A storage boundary — see `bian_api.adapt_initiate`.
"""
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CollateralRecord(BaseModel):
    """Nested `property` sub-record on the `loans` collection (storage shape)."""
    address: str
    type: str = "Detached Home"
    purchasePrice: float = Field(..., gt=0)
    annualTax: float = 0
    model_config = ConfigDict(extra="forbid")


class IncomeRecord(BaseModel):
    """Nested `incomeSummary` sub-record on the `loans` collection (storage shape)."""
    combinedGross: float = Field(..., gt=0)
    primary: float = Field(..., gt=0)
    coApplicant: Optional[float] = None
    model_config = ConfigDict(extra="forbid")


class ConsumerLoanInitiateRequest(BaseModel):
    """Body for `POST /ConsumerLoan/Initiate`, in `loans` storage camelCase.

    Borrowers are identified by name (`borrowerNames`); `create_application`
    mints the deterministic `borrowerIds` from each name via the shared party
    directory, so `borrowerIds` is not accepted on the request (server-minted,
    like `accountId` on `CurrentAccount/Initiate`).
    """
    borrowerNames: list[str] = Field(..., min_length=1, max_length=2)
    loanAmount: float = Field(..., gt=0)
    purchasePrice: float = Field(..., gt=0)
    downPayment: float = Field(..., ge=0)
    product: str = "5yr Fixed (25yr Amort)"
    property: CollateralRecord
    incomeSummary: IncomeRecord
    existingMonthlyDebt: float = 0
    model_config = ConfigDict(extra="forbid")
