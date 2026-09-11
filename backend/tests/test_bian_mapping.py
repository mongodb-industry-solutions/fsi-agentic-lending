"""Pins the BIAN storage boundary against the migrated data.

Three mirrors can silently drift and each would corrupt data rather than fail
loudly, so each gets a test:

1. `db/bian_field_maps.py` vs the umbrella repo's `transform.py` field mapping.
2. `services/customer_service.mint_customer_id` vs `transform.customer_id`.
3. Pydantic / projection enums vs the canonical spec's `$jsonSchema` enums.

`tests/fixtures/migrated_bian_samples.json` is cut from the actual migration
output (`bian-data-model/migration/lending/data/`). If a mapping change makes
one of these fail, the migrated data and the running code have diverged —
fix the mapping or re-run the migration, don't relax the test.
"""

import json
from pathlib import Path

import pytest

from db.storage_mapping import from_storage, storage_filter, storage_key, to_storage
from models.schemas import ApplicationStatus, to_bian_status
from services.customer_service import build_customer, mint_customer_id

FIXTURES = json.loads(
    (Path(__file__).parent / "fixtures" / "migrated_bian_samples.json").read_text()
)


# --------------------------------------------------------------------------
# 1. customerId formula parity
# --------------------------------------------------------------------------

@pytest.mark.parametrize("full_name,expected", sorted(FIXTURES["customerIds"].items()))
def test_mint_customer_id_matches_migrated_crosswalk(full_name, expected):
    assert mint_customer_id(full_name) == expected


@pytest.mark.parametrize("variant,expected", sorted(FIXTURES["customerIdSourceNames"].items()))
def test_name_variants_resolve_to_one_customer(variant, expected):
    """'Marcus Delgado' and 'Marcus Alejandro Delgado' are one person."""
    assert mint_customer_id(variant) == expected


def test_built_customer_is_spec_shaped():
    from datetime import datetime, timezone

    doc = build_customer("Ada Lovelace", datetime(2026, 9, 1, tzinfo=timezone.utc))
    for required in ("customerId", "status", "type", "segment", "since",
                     "identification", "contact", "kyc", "consents",
                     "createdAt", "updatedAt", "createdBy", "version", "sourceSystem"):
        assert required in doc, f"missing required field {required}"
    assert doc["identification"]["legalName"] == "Ada Lovelace"
    # Nothing invented where the spec permits emptiness.
    assert doc["kyc"]["documents"] == []
    assert doc["consents"] == []
    assert doc["contact"]["addresses"] == []


# --------------------------------------------------------------------------
# 2. round-trip: from_storage(to_storage(x)) == x
# --------------------------------------------------------------------------

ROUND_TRIP_CASES = {
    "applications": {
        "application_id": "APP-733F7A69",
        "borrower_ids": ["CUST-0D3F9BB599", "CUST-D024F09585"],
        "borrower_names": ["Sofia Renata Delgado", "Marcus Alejandro Delgado"],
        "loan_amount": 340000.0,
        "purchase_price": 425000.0,
        "down_payment": 85000.0,
        "product": "5yr Fixed (25yr Amort)",
        "property": {"address": "1438 Garden Terrace", "type": "Townhouse",
                     "purchase_price": 425000.0, "annual_tax": 3950.0},
        "income_summary": {"combined_gross": 165000.0, "primary": 95000.0,
                           "co_applicant": 70000.0},
        "existing_monthly_debt": 650.0,
        "status_history": [{"status": "submitted", "detail": "Application received"}],
        "gds_ratio": 0.1851, "tds_ratio": 0.2324, "stress_gds": 0.2151,
        "stress_tds": 0.2624, "ltv": 80.0, "risk_score": 25.0, "risk_tier": "A",
        "primary_credit_score": 798, "decision_reasoning": "Auto-approved.",
        "status_detail": "Agent pipeline started",
        "profile_id": "jane-doe", "demo_session_id": "89dae813",
    },
    "credit_reports": {
        "borrower_id": "CUST-BD56963B88", "bureau": "EQUIFAX", "score": 784,
        "total_outstanding": 251844.0, "payment_history": "100% on-time",
        "accounts": [{"creditor": "TD Visa", "balance": 1842.0,
                      "monthly_payment": None, "status": "Open"}],
        "inquiries": [{"creditor": "Royal LePage", "date": "2025-01-15",
                       "type": "Soft Inquiry"}],
        "derogatory_items": [{"type": "collection", "amount": 2400,
                              "creditor": "Bell Canada", "date": "2025-06-01"}],
    },
    "payments": {
        "loan_id": "L-00001", "payment_number": 1, "amount": 4047.39,
        "principal": 1194.89, "interest": 2852.5,
        "outstanding_balance": 698805.11, "days_late": 0, "status": "on_time",
    },
    "documents": {
        "application_id": "APP-1", "doc_type": "paystubs", "filename": "x.pdf",
        "extracted_text": "hello", "content_hash": "abc",
        # Opaque: must survive untouched, snake_case intact.
        "structured_data": {"chequing_saving": {"amount": 1}, "total_assets": 2},
    },
    "interventions": {
        "application_id": "APP-1", "type": "missing_document", "status": "pending",
        "internal_context": {"source_node": "doc_verifier", "risk_flag": "x"},
        "borrower_context": {"summary": "s", "action_required": "a",
                             "document_types_accepted": ["paystubs"]},
        "resolution": None,
    },
}


@pytest.mark.parametrize("collection", sorted(ROUND_TRIP_CASES))
def test_round_trip(collection):
    doc = ROUND_TRIP_CASES[collection]
    assert from_storage(collection, to_storage(collection, doc)) == doc


def test_structured_data_is_left_opaque():
    stored = to_storage("documents", ROUND_TRIP_CASES["documents"])
    assert "structured_data" in stored, "structured_data must NOT be camelCased"
    assert stored["structured_data"]["chequing_saving"] == {"amount": 1}


# --------------------------------------------------------------------------
# 3. the migrated documents read back into runtime shape
# --------------------------------------------------------------------------

def test_migrated_loan_reads_back():
    app = from_storage("applications", FIXTURES["loan"])
    assert app["application_id"] == FIXTURES["loan"]["loansId"]
    assert app["borrower_ids"] == [b["customerId"] for b in FIXTURES["loan"]["borrowerIds"]]
    assert app["gds_ratio"] == FIXTURES["loan"]["assessment"]["grossDebtServiceRatio"]
    assert len(app["status_history"]) == len(FIXTURES["loan"]["maintenance"]["statusHistory"])


def test_read_loan_restores_native_states_in_history():
    """The officer timeline must show the 12-state values, not the collapse.

    Four in-flight states project onto UNDER_REVIEW, so reading `status` off a
    history entry would render the same word four times.
    """
    from services.application_service import read_loan

    app = read_loan(FIXTURES["loan"])
    stored_history = FIXTURES["loan"]["maintenance"]["statusHistory"]
    expected = [e.get("statusSource") or e["status"] for e in stored_history]
    assert [e["status"] for e in app["status_history"]] == expected
    assert not any("status_source" in e for e in app["status_history"])


def test_read_loan_does_not_mutate_the_stored_document():
    from services.application_service import read_loan

    import copy as _copy
    before = _copy.deepcopy(FIXTURES["loan"])
    read_loan(FIXTURES["loan"])
    assert FIXTURES["loan"] == before


def test_migrated_credit_reports_read_back():
    obj = from_storage("credit_reports", FIXTURES["creditReportObjectDerog"])
    assert obj["derogatory_items"]["derogatory_marks"] == "None"
    lst = from_storage("credit_reports", FIXTURES["creditReportListDerog"])
    assert isinstance(lst["derogatory_items"], list)
    assert lst["derogatory_items"][0]["creditor"]


def test_migrated_loan_repayment_reads_back():
    rep = from_storage("payments", FIXTURES["loanRepayment"])
    assert rep["loan_id"] == FIXTURES["loanRepayment"]["loanId"]
    assert rep["status"] == "on_time"  # ON_TIME in storage


# --------------------------------------------------------------------------
# 4. key translation (what the document mappers cannot reach)
# --------------------------------------------------------------------------

def test_storage_key_translations():
    assert storage_key("applications", "application_id") == "loansId"
    assert storage_key("applications", "property.annual_tax") == "property.annualTax"
    assert storage_key("applications", "risk_score") == "assessment.riskScore"
    assert storage_key("documents", "application_id") == "applicationId"
    assert storage_key("payments", "loan_id") == "loanId"


def test_storage_filter_preserves_operators():
    out = storage_filter("applications", {
        "application_id": {"$in": ["APP-1"]},
        "seed_complete": {"$ne": True},
    })
    assert out == {"loansId": {"$in": ["APP-1"]}, "seedComplete": {"$ne": True}}


def test_vector_filter_path_matches_index_definition():
    """The Atlas index filter path and the query filter key must agree.

    A mismatch returns zero results with no error, so nothing else catches it.
    """
    from services import vector_search

    assert vector_search._doc_k("application_id") == storage_key("documents", "application_id")


# --------------------------------------------------------------------------
# 5. status projection
# --------------------------------------------------------------------------

BIAN_LOAN_STATUS_ENUM = {
    "DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED",
    "REJECTED", "WITHDRAWN", "CLOSED",
}


@pytest.mark.parametrize("state", [s.value for s in ApplicationStatus])
def test_every_app_state_projects_into_the_spec_enum(state):
    assert to_bian_status(state) in BIAN_LOAN_STATUS_ENUM


def test_unknown_status_does_not_raise():
    assert to_bian_status("nonsense") == "DRAFT"
    assert to_bian_status(None) == "DRAFT"


# --------------------------------------------------------------------------
# 6. write-path shape parity with the migrated data
# --------------------------------------------------------------------------

def _key_paths(doc, prefix=""):
    """Every dotted key path in a document, recursing into sub-documents.

    Recursive by design: a top-level-only diff misses sub-document drift
    (defect `sub-doc-shape-skipped`, 2026-05-04).
    """
    paths = set()
    for key, value in (doc or {}).items():
        if key == "_id":
            continue
        paths.add(prefix + key)
        if isinstance(value, dict):
            paths |= _key_paths(value, prefix + key + ".")
        elif isinstance(value, list) and value and isinstance(value[0], dict):
            paths |= _key_paths(value[0], prefix + key + "[].")
    return paths


RUNTIME_LOAN = {
    "application_id": "APP-X", "borrower_ids": ["CUST-A"], "borrower_names": ["A"],
    "loan_amount": 1.0, "purchase_price": 2.0, "down_payment": 3.0, "product": "p",
    "status": "submitted",
    "property": {"address": "a", "type": "t", "purchase_price": 2.0, "annual_tax": 1.0},
    "income_summary": {"combined_gross": 1.0, "primary": 1.0, "co_applicant": 0.0},
    "existing_monthly_debt": 0.0,
    "created_at": "c", "updated_at": "u",
    "gds_ratio": 0.1, "tds_ratio": 0.2, "stress_gds": 0.3, "stress_tds": 0.4,
    "ltv": 80.0, "risk_score": 1, "risk_tier": "A", "primary_credit_score": 700,
    "decision_reasoning": "r", "status_detail": "s",
}


def test_write_path_produces_the_migrated_loan_shape():
    """Every key in the migrated data must be reachable from the write path.

    Catches the class of bug where runtime keeps emitting the old shape while
    the migrated documents have the new one (defect `write-path-blindness`).
    """
    from services.application_service import history_entry

    stored = to_storage("applications", RUNTIME_LOAN)
    stored["status"] = "SUBMITTED"
    stored["statusSource"] = "submitted"
    stored["maintenance"] = {
        "statusHistory": [history_entry("submitted", "t", "Application received")],
        "updatedAt": "u",
    }
    missing = _key_paths(FIXTURES["loan"]) - _key_paths(stored)
    assert not missing, f"write path never produces: {sorted(missing)}"


def test_history_entry_carries_both_status_fields():
    from services.application_service import history_entry

    entry = history_entry("underwriting", "2026-01-01", "detail")
    assert entry["status"] == "UNDER_REVIEW"
    assert entry["statusSource"] == "underwriting"


# --------------------------------------------------------------------------
# 5. loanRepayments.timestamp must be a BSON Date, in BOTH seeders
# --------------------------------------------------------------------------
#
# `dashboard_service.get_payment_trends` sorts this field inside
# $setWindowFields with a day-unit range window. Mongo rejects the whole
# aggregate if the sortBy field is a string:
#
#   Invalid range: Expected the sortBy field to be a Date, but it was string
#
# `loanRepayments` is NOT one of the 22 spec'd collections, so — unlike every
# spec'd timestamp, which bsonType-checks as "string" — nothing forces a string
# here. Two seeders write this field and they must agree on the type:
#   * the migration, `bian-data-model/migration/lending/transform.py:bson_date`
#   * a demo re-seed, `scripts/ingest_pdfs.py:_generate_payment_records`
# Same "three places must agree" trap as LOAN_ID_MAP: if one writes strings,
# only the rows it touched break, and the endpoint fails again later.

def test_storage_mapper_does_not_stringify_a_datetime():
    """The mapper renames keys; it must never coerce a value's type."""
    from datetime import datetime, timezone

    ts = datetime(2023, 7, 1, tzinfo=timezone.utc)
    stored = to_storage("payments", {"loan_id": "APP-2026-00001", "timestamp": ts})
    # The mappers deep-copy, so compare by value and type, not identity.
    assert isinstance(stored["timestamp"], datetime), "to_storage stringified it"
    assert stored["timestamp"] == ts
    back = from_storage("payments", stored)["timestamp"]
    assert isinstance(back, datetime) and back == ts


def test_reseed_writes_repayment_timestamp_as_datetime():
    """The demo re-seed path must emit a datetime, not an ISO string."""
    from datetime import datetime

    ingest = pytest.importorskip(
        "scripts.ingest_pdfs",
        reason="ingest_pdfs imports Bedrock/embedding clients",
    )
    records = ingest._generate_payment_records("APP-2026-00001", 700000, 0.0489, 3, [])
    assert len(records) == 3
    for r in records:
        assert isinstance(r["timestamp"], datetime), (
            "ingest_pdfs must write loanRepayments.timestamp as a datetime — "
            "a string breaks $setWindowFields in get_payment_trends"
        )
        assert r["timestamp"].tzinfo is not None, "timestamp must be tz-aware UTC"
