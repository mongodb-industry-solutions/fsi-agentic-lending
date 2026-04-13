from agents.pipeline.supervisor import supervisor_node
from unittest.mock import patch


def test_supervisor_routes_to_loan_app():
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
    assert result["current_agent"] == "loan_app"


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
