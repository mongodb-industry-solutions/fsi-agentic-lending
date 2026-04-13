"""Tests for make_initial_state factory."""
from agents.state import make_initial_state, LendFlowState


def test_factory_produces_all_keys():
    state = make_initial_state("APP-TEST-001", "bounded")
    type_hints = LendFlowState.__annotations__
    for key in type_hints:
        assert key in state, f"Missing key in initial state: {key}"


def test_factory_sets_application_id():
    state = make_initial_state("APP-XYZ", "auto")
    assert state["application_id"] == "APP-XYZ"
    assert state["autonomy_level"] == "auto"


def test_factory_defaults():
    state = make_initial_state("APP-TEST-001")
    assert state["documents_verified"] is False
    assert state["credit_pulled"] is False
    assert state["retry_count"] == 0
    assert state["current_agent"] == "supervisor"
    assert state["structured_analysis"] is None
    assert isinstance(state["policy_citations"], list)
    assert state["started_at"] is not None
