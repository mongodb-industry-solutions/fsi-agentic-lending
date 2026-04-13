"""Loan Application Agent — synthesises results from doc_verifier and credit_puller."""
import json
import logging

from agents.state import LendFlowState
from agents.pipeline.tools import (
    get_application_documents,
    get_application_summary,
    log_agent_activity,
    update_application_status,
)
from agents.pipeline.prompts import LOAN_APP_AGENT_PROMPT
from agents.llm import get_llm

logger = logging.getLogger(__name__)

try:
    from langsmith import traceable
except ImportError:
    def traceable(**kwargs):
        def decorator(fn): return fn
        return decorator


@traceable(name="loan_app_node")
def loan_app_node(state: LendFlowState, **kwargs) -> dict:
    """Summarise documents and credit data, produce LLM analysis."""
    app_id = state["application_id"]
    doc_count = state.get("document_count", 0)
    credit_pulled = state.get("credit_pulled", False)
    documents_verified = state.get("documents_verified", False)

    log_agent_activity(app_id, "loan_app_agent", "start", "Synthesising verification results")

    documents = get_application_documents(app_id)
    app_summary = get_application_summary(app_id)

    llm = get_llm()
    doc_summary_text = "\n".join([
        f"- {d['doc_type']}: {d.get('extracted_text', 'No text')[:200]}..."
        for d in documents
    ])

    prompt = LOAN_APP_AGENT_PROMPT.format(
        application_id=app_id,
        document_count=doc_count,
        credit_pulled=credit_pulled,
    )

    from agents.pipeline.tools import get_credit_reports
    credit_reports = get_credit_reports(app_id)
    credit_repr = json.dumps(credit_reports, default=str)[:2000]

    analysis = llm.predict_with_system(
        f"Application summary: {app_summary}\n\nDocuments:\n{doc_summary_text}\n\nCredit reports: {credit_repr}",
        prompt,
    )

    log_agent_activity(app_id, "loan_app_agent", "analysis_complete", analysis[:500])

    combined_income = app_summary.get("income_summary", {}).get("combined_gross", 0)
    if combined_income > 0:
        log_agent_activity(app_id, "loan_app_agent", "income_extraction", f"Combined gross income: ${combined_income:,.0f}/yr")

    if documents_verified:
        update_application_status(app_id, "underwriting", "Documents verified — proceeding to underwriting")

    return {
        "extraction_summary": analysis[:1000],
        "messages": [{"role": "assistant", "content": analysis}],
    }
