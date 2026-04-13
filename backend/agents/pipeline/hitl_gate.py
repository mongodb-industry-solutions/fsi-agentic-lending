"""HITL gate — pauses execution for officer review via LangGraph interrupt()."""
import logging
from langgraph.types import interrupt

from agents.state import LendFlowState
from agents.pipeline.tools import log_agent_activity, update_application_status

logger = logging.getLogger(__name__)


def hitl_gate(state: LendFlowState, **kwargs) -> dict:
    """HITL gate — pauses execution for officer review via LangGraph interrupt()."""
    app_id = state["application_id"]

    review_package = {
        "application_id": app_id,
        "risk_score": state.get("risk_score"),
        "risk_tier": state.get("risk_tier"),
        "gds_ratio": state.get("gds_ratio"),
        "tds_ratio": state.get("tds_ratio"),
        "decision_reasoning": state.get("decision_reasoning", ""),
        "policy_citations": state.get("policy_citations", []),
    }

    log_agent_activity(app_id, "hitl_gate", "interrupt", f"Execution paused — awaiting officer decision. Risk: {state.get('risk_score')}/100 ({state.get('risk_tier')})")

    decision = interrupt(review_package)

    if not isinstance(decision, dict):
        decision = {}
    action = decision.get("action")
    if action not in ("approve", "decline", "modify_and_continue"):
        log_agent_activity(app_id, "hitl_gate", "invalid_action", f"Received: {action}")
        decision = interrupt({**review_package, "error": f"Invalid action: {action}"})
        action = decision.get("action", "decline")

    notes = decision.get("notes", "")
    overrides = decision.get("overrides", {})

    state_updates = {
        "decision": action if action != "modify_and_continue" else None,
        "officer_notes": notes,
    }

    pending = state.get("pending_node")
    if pending:
        approved = list(state.get("hitl_approved_nodes", []))
        approved.append(pending)
        state_updates["hitl_approved_nodes"] = approved
        state_updates["pending_node"] = None

    if action == "modify_and_continue":
        state_updates["risk_score"] = None
        state_updates["decision"] = None
        state_updates["hitl_approved_nodes"] = []

    if overrides.get("risk_tier"):
        state_updates["risk_tier"] = overrides["risk_tier"]
    if overrides.get("loan_amount"):
        state_updates["risk_score"] = None
        state_updates["decision"] = None
        state_updates["decision_reasoning"] = f"Re-underwriting: officer adjusted loan to ${overrides['loan_amount']:,.0f}"
        from db.mdb import get_db as _get_db
        db = _get_db()
        db["applications"].update_one(
            {"application_id": app_id},
            {"$set": {"loan_amount": overrides["loan_amount"]}}
        )

    officer_id = decision.get("officer_id", "unknown")
    new_status = "approved" if action == "approve" else ("processing" if action == "modify_and_continue" else "declined")
    log_agent_activity(app_id, "hitl_gate", "resume", f"Officer {officer_id}: {action}. {notes}")
    _status_detail = {
        "approve": "Officer approved the application.",
        "decline": "Officer declined the application.",
        "modify_and_continue": "Officer requested changes; application returned to processing.",
    }.get(action, f"Officer action: {action}.")
    update_application_status(app_id, new_status, f"{_status_detail} {notes}".strip())

    return state_updates
