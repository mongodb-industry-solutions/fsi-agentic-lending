"""Runtime-shape <-> BIAN-storage-shape field maps.

The persistence layer speaks BIAN camelCase (spec ``v4_34``); everything above
it — services, agents, routes, the HTTP API and the frontend — keeps this
demo's native snake_case shape. This module holds the translation contract.
Playbook Option A: translate at the storage boundary.

⚠️ MIRROR. These maps duplicate the field mapping in the umbrella repo's
``bian-data-model/migration/lending/transform.py``, which produced the migrated
data. The two cannot import each other (separate repos), so they can drift —
same class of hazard as ``bian-alias-map.json`` and ``refs.py`` in the accounts
and transactions services. ``tests/test_bian_mapping.py`` pins both ends against
checked-in fixtures cut from the migration output. **Change one, change both.**

Most renames are mechanical snake_case -> camelCase. Only the exceptions are
listed here:

* fields whose BIAN name is not the camelCase of the source name
  (``application_id`` -> ``loansId``),
* fields that MOVE into a sub-record (``gds_ratio`` -> ``assessment.*``,
  ``status_history`` -> ``maintenance.statusHistory``),
* fields whose *value* shape changes, handled by hooks in ``storage_mapping``.
"""

import re

_SNAKE = re.compile(r"_([a-z0-9])")
_CAMEL = re.compile(r"([a-z0-9])([A-Z])")


def to_camel(name: str) -> str:
    return _SNAKE.sub(lambda m: m.group(1).upper(), name)


def to_snake(name: str) -> str:
    return _CAMEL.sub(lambda m: f"{m.group(1)}_{m.group(2).lower()}", name)


# --------------------------------------------------------------------------
# Explicit overrides: runtime dotted path -> storage dotted path.
# Anything not listed is translated mechanically, key by key.
# --------------------------------------------------------------------------

LOANS = {
    "application_id": "loansId",
    # Decision-engine output moves into the proposed `assessment` sub-record.
    "gds_ratio": "assessment.grossDebtServiceRatio",
    "tds_ratio": "assessment.totalDebtServiceRatio",
    "stress_gds": "assessment.stressGrossDebtService",
    "stress_tds": "assessment.stressTotalDebtService",
    "ltv": "assessment.loanToValue",
    "risk_score": "assessment.riskScore",
    "risk_tier": "assessment.riskTier",
    "primary_credit_score": "assessment.primaryCreditScore",
    "decision_reasoning": "assessment.decisionReasoning",
    "status_detail": "assessment.statusDetail",
    # Status history lives under the Maintenance behaviour qualifier.
    "status_history": "maintenance.statusHistory",
}

CREDIT_REPORTS = {
    "borrower_id": "borrowerId",
    # No identifier exists in the source; derived on write as CR-<oid>.
    "id": "id",
    "borrower_name": "borrowerNameSource",
    "cloned_at": "clonedAtSource",
    "pulled_at": "createdAt",
}

CUSTOMERS = {
    "customer_id": "customerId",
    "full_name": "identification.fullName",
    "date_of_birth": "identification.dateOfBirth",
}

LOAN_REPAYMENTS = {
    "loan_id": "loanId",
    # Derived on write as LRP-<loanId>-<paymentNumber>.
    "id": "loanRepaymentsId",
}

# Per-collection override maps, keyed by logical collection name.
OVERRIDES = {
    "applications": LOANS,
    "credit_reports": CREDIT_REPORTS,
    "customers": CUSTOMERS,
    "payments": LOAN_REPAYMENTS,
}

# Demo-harness fields. They carry no BIAN meaning but the demo-reset flow
# queries on them, so they persist alongside the BIAN contract. The spec sets
# no `additionalProperties: false`, so extras are legal.
PASSTHROUGH = {"profile_id": "profileId", "demo_session_id": "demoSessionId"}

# Sub-trees left in their source shape. `structured_data` is LLM extraction
# output: 417 distinct paths, no stable schema (it holds both `chequing_saving`
# and `chequing_savings`). Renaming inside it would freeze one sample's
# accidents into a contract.
OPAQUE = {"documents": {"structured_data"}}
