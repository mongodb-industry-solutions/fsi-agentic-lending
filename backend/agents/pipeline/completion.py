"""Completion node — logs pipeline completion."""
from datetime import datetime, timezone

from agents.state import LendFlowState
from agents.pipeline.tools import log_agent_activity


def completion_node(state: LendFlowState, **kwargs) -> dict:
    """Final node — logs completion."""
    app_id = state["application_id"]
    decision = state.get("decision", "unknown")

    if decision == "blocked":
        log_agent_activity(app_id, "supervisor", "pipeline_paused",
            "Pipeline paused — awaiting borrower action to resolve blocking intervention(s)")
    else:
        log_agent_activity(app_id, "supervisor", "pipeline_complete",
            f"Lending pipeline complete. Final decision: {decision}")

    return {"current_agent": "complete", "completed_at": datetime.now(timezone.utc).isoformat()}
