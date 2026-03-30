"""Supervisor agent — routes work to specialized agents."""
from agents.state import LendFlowState
from agents.tools import log_agent_activity


def supervisor_node(state: LendFlowState) -> dict:
    """Decide which agent should handle the next step."""
    app_id = state["application_id"]

    # Simple rule-based routing (can be enhanced with LLM routing)
    if not state.get("documents_verified", False):
        next_agent = "loan_app"
    elif not state.get("credit_pulled", False):
        next_agent = "loan_app"
    elif state.get("risk_score") is None:
        next_agent = "underwriter"
    elif state.get("decision") == "escalate":
        next_agent = "hitl_gate"
    elif state.get("decision") in ("approve", "decline"):
        next_agent = "complete"
    else:
        next_agent = "complete"

    log_agent_activity(
        app_id, "supervisor", "route",
        f"Routing to {next_agent} (docs_verified={state.get('documents_verified')}, credit={state.get('credit_pulled')}, risk={state.get('risk_score')}, decision={state.get('decision')})"
    )

    return {"current_agent": next_agent}


def route_from_supervisor(state: LendFlowState) -> str:
    """Conditional edge function — returns the next node name."""
    return state.get("current_agent", "loan_app")
