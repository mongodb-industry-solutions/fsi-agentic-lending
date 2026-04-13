"""Tests for the safe_node wrapper in agents/graph.py."""
from unittest.mock import patch


def test_safe_node_catches_exceptions():
    from agents.graph import safe_node

    def failing_node(state, **kwargs):
        raise ValueError("Something broke")

    wrapped = safe_node(failing_node)
    state = {"application_id": "APP-TEST-001"}

    with patch("agents.graph.log_agent_activity"):
        result = wrapped(state)

    assert "Something broke" in result["last_error"]
    assert result["messages"][0]["content"].startswith("Error in")


def test_safe_node_passes_through_on_success():
    from agents.graph import safe_node

    def ok_node(state, **kwargs):
        return {"decision": "approve"}

    wrapped = safe_node(ok_node)
    state = {"application_id": "APP-TEST-001"}

    with patch("agents.graph.log_agent_activity"):
        result = wrapped(state)

    assert result["decision"] == "approve"
