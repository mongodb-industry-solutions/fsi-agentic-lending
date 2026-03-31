"""Supervisor agent — routes work to specialized agents."""
from agents.state import LendFlowState
from agents.tools import log_agent_activity


def supervisor_node(state: LendFlowState, **kwargs) -> dict:
    """Decide which agent should handle the next step."""
    app_id = state["application_id"]
    autonomy = state.get("autonomy_level", "bounded")

    # Check for retry
    if state.get("last_error") and state.get("retry_count", 0) < 3:
        log_agent_activity(app_id, "supervisor", "retry",
            f"Retrying {state.get('current_agent')} (attempt {state.get('retry_count', 0) + 1})")
        return {
            "current_agent": state.get("current_agent", "loan_app"),
            "retry_count": state.get("retry_count", 0) + 1,
            "last_error": None,
        }

    # Max retries exceeded
    if state.get("last_error"):
        log_agent_activity(app_id, "supervisor", "error", "Max retries exceeded")
        return {"current_agent": "complete", "decision": "error"}

    # Determine natural next agent
    if not state.get("documents_verified", False) or not state.get("credit_pulled", False):
        natural_next = "loan_app"
    elif state.get("risk_score") is None:
        natural_next = "underwriter"
    elif state.get("decision") in ("approve", "decline", "error"):
        natural_next = "complete"
    elif state.get("decision") == "escalate":
        natural_next = "hitl_gate"
    else:
        natural_next = "complete"

    # Apply autonomy gates
    if autonomy == "observe":
        # Every transition requires officer approval
        approved_nodes = state.get("hitl_approved_nodes", [])
        if natural_next not in ("hitl_gate", "complete") and natural_next not in approved_nodes:
            log_agent_activity(app_id, "supervisor", "autonomy_gate",
                f"Observe mode: pausing before {natural_next} for officer review")
            return {"current_agent": "hitl_gate", "retry_count": 0, "pending_node": natural_next}
    elif autonomy == "suggest":
        # Pause before final decision only
        if natural_next == "complete" and state.get("decision") not in ("error", "decline"):
            log_agent_activity(app_id, "supervisor", "autonomy_gate",
                "Suggest mode: pausing for officer to review decision")
            natural_next = "hitl_gate"
    elif autonomy == "bounded":
        # Only escalate based on policy (default — if decision is "escalate", hitl_gate is already set)
        pass
    # "auto" — never pause, let natural_next flow

    log_agent_activity(app_id, "supervisor", "route",
        f"[{autonomy}] → {natural_next}")

    return {"current_agent": natural_next, "retry_count": 0}


def route_from_supervisor(state: LendFlowState, **kwargs) -> str:
    """Conditional edge function — returns the next node name."""
    return state.get("current_agent", "loan_app")
