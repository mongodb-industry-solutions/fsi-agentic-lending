"""Supervisor agent — routes work to specialized agents."""
from langgraph.types import Send

from agents.state import LendFlowState
from agents.pipeline.tools import log_agent_activity
from db.mdb import get_db as _get_db
from services.application_service import update_application_status

PARALLEL_GATHER_NODES = ("doc_verifier", "credit_puller")


def supervisor_node(state: LendFlowState, **kwargs) -> dict:
    """Decide which agent should handle the next step."""
    app_id = state["application_id"]
    autonomy = state.get("autonomy_level", "bounded")

    if state.get("last_error") and state.get("retry_count", 0) < 3:
        log_agent_activity(app_id, "supervisor", "retry",
            f"Retrying {state.get('current_agent')} (attempt {state.get('retry_count', 0) + 1})")
        return {
            "current_agent": state.get("current_agent", "loan_app"),
            "retry_count": state.get("retry_count", 0) + 1,
            "last_error": None,
        }

    if state.get("last_error"):
        log_agent_activity(app_id, "supervisor", "error", "Max retries exceeded")
        return {"current_agent": "complete", "decision": "error"}

    # Check for blocking interventions — pipeline must pause until borrower resolves them
    try:
        pending_blocking = _get_db()["interventions"].count_documents({
            "application_id": app_id,
            "internal_context.severity": "blocking",
            "status": {"$in": ["pending", "active"]},
        })
    except Exception:
        pending_blocking = 0  # DB unavailable — proceed without blocking

    if pending_blocking > 0:
        log_agent_activity(app_id, "supervisor", "blocked",
            f"{pending_blocking} blocking intervention(s) require borrower action — pausing pipeline")
        try:
            update_application_status(app_id, "action_required",
                f"Waiting for borrower to resolve {pending_blocking} issue(s)")
        except Exception as e:
            log_agent_activity(app_id, "supervisor", "error",
                f"Failed to set action_required status: {e}")
        return {"current_agent": "complete", "decision": "blocked"}

    gathered_once = state.get("gather_attempts", 0) >= 1
    if not gathered_once and (not state.get("documents_verified", False) or not state.get("credit_pulled", False)):
        natural_next = "parallel_gather"
    elif gathered_once and not state.get("documents_verified", False) and not state.get("credit_pulled", False):
        log_agent_activity(app_id, "supervisor", "data_gap",
            "Gather completed with no verified documents and no credit data — proceeding to underwriter with incomplete inputs")
        natural_next = "underwriter"
    elif state.get("risk_score") is None:
        natural_next = "underwriter"
    elif state.get("decision") in ("approve", "decline", "error"):
        natural_next = "complete"
    elif state.get("decision") == "escalate":
        natural_next = "hitl_gate"
    else:
        natural_next = "complete"

    if autonomy == "observe":
        approved_nodes = state.get("hitl_approved_nodes", [])
        if natural_next not in ("hitl_gate", "complete") and natural_next not in approved_nodes:
            log_agent_activity(app_id, "supervisor", "autonomy_gate",
                f"Observe mode: pausing before {natural_next} for officer review")
            return {"current_agent": "hitl_gate", "retry_count": 0, "pending_node": natural_next}
    elif autonomy == "suggest":
        if natural_next == "complete" and state.get("decision") not in ("error", "decline"):
            log_agent_activity(app_id, "supervisor", "autonomy_gate",
                "Suggest mode: pausing for officer to review decision")
            natural_next = "hitl_gate"

    log_agent_activity(app_id, "supervisor", "route",
        f"[{autonomy}] → {natural_next}")

    return {"current_agent": natural_next, "retry_count": 0}


def route_from_supervisor(state: LendFlowState, **kwargs) -> list[str] | str:
    """Conditional edge function — returns the next node(s).

    When the supervisor decides ``parallel_gather``, fan out to both
    ``doc_verifier`` and ``credit_puller`` via LangGraph ``Send``.
    """
    current = state.get("current_agent", "loan_app")
    if current == "parallel_gather":
        return [Send("doc_verifier", state), Send("credit_puller", state)]
    return current
