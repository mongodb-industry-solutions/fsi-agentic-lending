"""Credit pull sub-task — runs in parallel with doc_verifier."""
import logging

from agents.state import LendFlowState
from agents.pipeline.tools import get_credit_reports, log_agent_activity
from agents.helpers.interventions import create_intervention

logger = logging.getLogger(__name__)


def credit_puller_node(state: LendFlowState, **kwargs) -> dict:
    """Pull credit reports for all borrowers on the application."""
    app_id = state["application_id"]
    log_agent_activity(app_id, "credit_puller", "start", "Pulling credit reports")

    credit_reports = get_credit_reports(app_id)
    credit_pulled = len(credit_reports) > 0

    primary_score = credit_reports[0].get("score") if len(credit_reports) > 0 else None
    co_score = credit_reports[1].get("score") if len(credit_reports) > 1 else None

    if primary_score is not None:
        log_agent_activity(app_id, "credit_puller", "credit_pull", f"Primary borrower credit score: {primary_score}")
    if co_score is not None:
        log_agent_activity(app_id, "credit_puller", "credit_pull", f"Co-applicant credit score: {co_score}")

    if not credit_pulled:
        log_agent_activity(app_id, "credit_puller", "credit_gap", "No credit reports found — creating intervention")
        if create_intervention(
            app_id,
            intervention_type="credit_data_unavailable",
            source_node="credit_puller",
            risk_flag="no_credit_data",
            severity="advisory",
            borrower_summary="We were unable to retrieve credit bureau data for your application.",
            action_required="This may delay processing. Please ensure your SIN and personal details are accurate.",
            doc_types=["credit_report"],
        ):
            log_agent_activity(app_id, "credit_puller", "intervention", "Created credit_data_unavailable intervention")

    return {
        "credit_pulled": credit_pulled,
        "primary_credit_score": primary_score,
        "co_applicant_credit_score": co_score,
        "gather_attempts": state.get("gather_attempts", 0) + 1,
    }
