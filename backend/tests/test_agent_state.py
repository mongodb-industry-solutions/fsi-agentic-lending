from agents.pipeline.supervisor import supervisor_node, route_from_supervisor
from unittest.mock import patch


def test_supervisor_routes_to_parallel_gather():
    state = {
        "application_id": "APP-TEST-0001",
        "autonomy_level": "bounded",
        "documents_verified": False,
        "credit_pulled": False,
        "risk_score": None,
        "decision": None,
        "last_error": None,
        "retry_count": 0,
    }
    with patch('agents.pipeline.supervisor.log_agent_activity'):
        result = supervisor_node(state)
    assert result["current_agent"] == "parallel_gather"


def test_supervisor_routes_to_underwriter():
    state = {
        "application_id": "APP-TEST-0001",
        "autonomy_level": "bounded",
        "documents_verified": True,
        "credit_pulled": True,
        "risk_score": None,
        "decision": None,
        "last_error": None,
        "retry_count": 0,
    }
    with patch('agents.pipeline.supervisor.log_agent_activity'):
        result = supervisor_node(state)
    assert result["current_agent"] == "underwriter"


def test_supervisor_observe_mode_gates():
    state = {
        "application_id": "APP-TEST-0001",
        "autonomy_level": "observe",
        "documents_verified": False,
        "credit_pulled": False,
        "risk_score": None,
        "decision": None,
        "last_error": None,
        "retry_count": 0,
    }
    with patch('agents.pipeline.supervisor.log_agent_activity'):
        result = supervisor_node(state)
    assert result["current_agent"] == "hitl_gate"


def test_supervisor_retries_on_error():
    state = {
        "application_id": "APP-TEST-0001",
        "autonomy_level": "bounded",
        "documents_verified": False,
        "credit_pulled": False,
        "risk_score": None,
        "decision": None,
        "last_error": "Bedrock timeout",
        "retry_count": 1,
        "current_agent": "loan_app",
    }
    with patch('agents.pipeline.supervisor.log_agent_activity'):
        result = supervisor_node(state)
    assert result["current_agent"] == "loan_app"
    assert result["retry_count"] == 2
    assert result["last_error"] is None


def test_supervisor_max_retries_completes():
    state = {
        "application_id": "APP-TEST-0001",
        "autonomy_level": "bounded",
        "documents_verified": False,
        "credit_pulled": False,
        "risk_score": None,
        "decision": None,
        "last_error": "Bedrock timeout",
        "retry_count": 3,
        "current_agent": "loan_app",
    }
    with patch('agents.pipeline.supervisor.log_agent_activity'):
        result = supervisor_node(state)
    assert result["current_agent"] == "complete"
    assert result["decision"] == "error"


def test_route_from_supervisor_parallel():
    """parallel_gather should produce two Send objects."""
    from langgraph.types import Send
    state = {"current_agent": "parallel_gather", "application_id": "APP-TEST"}
    result = route_from_supervisor(state)
    assert isinstance(result, list) and len(result) == 2
    assert all(isinstance(r, Send) for r in result)


def test_route_from_supervisor_single():
    state = {"current_agent": "underwriter"}
    result = route_from_supervisor(state)
    assert result == "underwriter"
