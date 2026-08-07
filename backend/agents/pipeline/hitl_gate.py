"""HITL gate — pauses execution for officer review via LangGraph interrupt()."""
import logging
from langgraph.types import interrupt

from agents.state import LendFlowState
from agents.pipeline.tools import log_agent_activity, update_application_status
from services.officer_service import get_officer_display

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
        # Always reset gather flags so supervisor re-gathers fresh data
        state_updates["documents_verified"] = False
        state_updates["credit_pulled"] = False
        state_updates["gather_attempts"] = 0
        # Preserve hitl_approved_nodes to avoid re-gating already-approved nodes

    if overrides.get("risk_tier"):
        if overrides["risk_tier"] in ("A", "B+", "B", "C", "D"):
            state_updates["risk_tier"] = overrides["risk_tier"]
        else:
            log_agent_activity(app_id, "hitl_gate", "invalid_override", f"Invalid risk_tier override: {overrides['risk_tier']}")
    if overrides.get("loan_amount") is not None and isinstance(overrides["loan_amount"], (int, float)) and overrides["loan_amount"] > 0:
        state_updates["decision_reasoning"] = f"Re-underwriting: officer adjusted loan to ${overrides['loan_amount']:,.0f}"
        from db.mdb import get_db as _get_db
        db = _get_db()
        db["applications"].update_one(
            {"application_id": app_id},
            {"$set": {"loan_amount": overrides["loan_amount"]}}
        )

    officer_id = decision.get("officer_id", "unknown")
    officer_display = get_officer_display(officer_id)
    new_status = "approved" if action == "approve" else ("processing" if action == "modify_and_continue" else "declined")
    log_agent_activity(app_id, "hitl_gate", "resume", f"{officer_display}: {action}. {notes}")
    _status_detail = {
        "approve": f"Approved by {officer_display}.",
        "decline": f"Declined by {officer_display}.",
        "modify_and_continue": f"{officer_display} requested changes; application returned to processing.",
    }.get(action, f"Officer action ({officer_display}): {action}.")
    update_application_status(app_id, new_status, f"{_status_detail} {notes}".strip())

    return state_updates
