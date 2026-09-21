"""Renewal Agent tests — storage-shape handling + rationale fallback resilience."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from db.storage_mapping import to_storage


def _storage_doc():
    """A renewal exactly as the seed writes it: BIAN camelCase, via to_storage."""
    return to_storage("renewals", {
        "renewal_id": "RNW-2026-0003",
        "borrower_name": "Sarah Williams",
        "loan_amount": 298000,
        "current_rate": 0.0544,
        "current_payment": 1400,
        "amortization_years": 25,
        "term": "5yr Fixed",
        "maturity_date": datetime.now(timezone.utc) + timedelta(days=30),
    })


def test_generate_offer_events_reads_bian_storage_shape(monkeypatch):
    """Offer generation must convert the stored camelCase doc through from_storage.

    Regression: generate_offer_events passed the raw storage doc straight to
    _draft_rationale (which reads snake_case), so loan_amount was None and the
    rationale formatting crashed with "unsupported format string passed to
    NoneType.__format__" (→ fallback with $0/0% everywhere).
    """
    import services.renewal_service as svc

    class FakeColl:
        """Mimics real persistence: update_one's $set is merged back into find_one."""

        def __init__(self, base):
            self.base = base
            self.patch = None

        def find_one(self, *args, **kwargs):
            return {**self.base, **(self.patch or {})}

        def update_one(self, query, update, *args, **kwargs):
            self.patch = update["$set"]
            return MagicMock()

    class _FailingLLM:
        def predict_with_system(self, *args, **kwargs):
            raise RuntimeError("bedrock unavailable")

    fake = FakeColl(_storage_doc())
    monkeypatch.setattr(svc, "coll", lambda logical: fake)
    monkeypatch.setattr(svc, "log_agent_activity", lambda *a, **k: None)
    monkeypatch.setattr("agents.llm.get_llm", lambda: _FailingLLM())

    events = list(svc.generate_offer_events("RNW-2026-0003"))
    done = next(e for e in events if e.get("type") == "done")
    renewal = done["renewal"]

    # Real values survive the storage→runtime round-trip (not 0/None).
    assert renewal["loan_amount"] == 298000
    assert renewal["current_rate"] == 0.0544
    assert renewal["amortization_years"] == 25
    # Rationale falls back to deterministic text and formats numbers (no crash).
    assert isinstance(renewal["offer"]["rationale"], str)
    assert "5.44" in renewal["offer"]["rationale"]
    # Payment is recomputed from the real balance, not $0.
    assert renewal["offer"]["new_payment"] > 1000


def test_draft_rationale_fallback_survives_missing_fields(monkeypatch):
    """A genuinely missing numeric field must not crash the fallback formatter."""
    from services.renewal_service import _draft_rationale

    class _FakeLLM:
        def predict_with_system(self, *args, **kwargs):
            raise RuntimeError("bedrock unavailable")

    monkeypatch.setattr("agents.llm.get_llm", lambda: _FakeLLM())

    renewal = {"borrower_name": "Sarah Williams", "loan_amount": None,
               "current_rate": None, "current_payment": None, "amortization_years": None}
    text = _draft_rationale(renewal, 0.0489, 1440)
    assert isinstance(text, str)
    assert "4.89%" in text
