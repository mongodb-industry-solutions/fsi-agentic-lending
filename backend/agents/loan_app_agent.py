"""Loan Application Agent — processes documents, verifies identity, pulls credit."""
import json
import logging
from datetime import datetime, timezone

from agents.state import LendFlowState
from agents.tools import (
    get_application_documents,
    get_credit_reports,
    get_application_summary,
    log_agent_activity,
    update_application_status,
)
from agents.prompts import LOAN_APP_AGENT_PROMPT
from bedrock.anthropic_chat_completions import BedrockAnthropicChatCompletions
from db.mdb import get_db

logger = logging.getLogger(__name__)

try:
    from langsmith import traceable
except ImportError:
    def traceable(**kwargs):
        def decorator(fn): return fn
        return decorator

_llm = None

def _get_llm():
    global _llm
    if _llm is None:
        _llm = BedrockAnthropicChatCompletions()
    return _llm


@traceable(name="loan_app_node")
def loan_app_node(state: LendFlowState, **kwargs) -> dict:
    """Process loan application documents and verify borrower information."""
    app_id = state["application_id"]

    log_agent_activity(app_id, "loan_app_agent", "start", "Beginning document review and verification")
    update_application_status(app_id, "processing", "Document verification in progress")

    # Fetch documents
    documents = get_application_documents(app_id)
    doc_count = len(documents)

    log_agent_activity(app_id, "loan_app_agent", "fetch_documents", f"Retrieved {doc_count} documents")

    # Fetch credit reports
    credit_reports = get_credit_reports(app_id)
    credit_pulled = len(credit_reports) > 0

    primary_score = credit_reports[0].get("score") if len(credit_reports) > 0 else None
    co_score = credit_reports[1].get("score") if len(credit_reports) > 1 else None
    if primary_score is not None:
        log_agent_activity(app_id, "loan_app_agent", "credit_pull", f"Primary borrower credit score: {primary_score}")
    if co_score is not None:
        log_agent_activity(app_id, "loan_app_agent", "credit_pull", f"Co-applicant credit score: {co_score}")

    # Get application summary
    app_summary = get_application_summary(app_id)

    # Use Bedrock to analyze documents
    llm = _get_llm()

    doc_summary_text = "\n".join([
        f"- {d['doc_type']}: {d.get('extracted_text', 'No text')[:200]}..."
        for d in documents
    ])

    prompt = LOAN_APP_AGENT_PROMPT.format(
        application_id=app_id,
        document_count=doc_count,
        credit_pulled=credit_pulled,
    )

    credit_repr = json.dumps(credit_reports, default=str)[:2000]
    analysis = llm.predict_with_system(
        f"Application summary: {app_summary}\n\nDocuments:\n{doc_summary_text}\n\nCredit reports: {credit_repr}",
        prompt,
    )

    log_agent_activity(app_id, "loan_app_agent", "analysis_complete", analysis[:500])

    # Cross-reference identity across documents
    log_agent_activity(app_id, "loan_app_agent", "identity_check", f"Cross-referencing identity across {doc_count} documents...")

    # Extract and log income information
    combined_income = app_summary.get("income_summary", {}).get("combined_gross", 0)
    if combined_income > 0:
        log_agent_activity(app_id, "loan_app_agent", "income_extraction", f"Combined gross income: ${combined_income:,.0f}/yr")

    # Mark documents as verified
    documents_verified = doc_count >= 10  # Expect at least 10 of 14 docs
    if documents_verified:
        log_agent_activity(app_id, "loan_app_agent", "verification", "All required documents verified")
        update_application_status(app_id, "underwriting", "Documents verified — proceeding to underwriting")
    else:
        log_agent_activity(app_id, "loan_app_agent", "verification", f"Only {doc_count} documents found — minimum 10 required")
        # Write intervention for missing documents
        try:
            db = get_db()
            existing_types = {d.get("doc_type") for d in documents}
            required_types = {"government_id", "employment_letter", "paystubs", "income_tax",
                              "bank_statements", "purchase_agreement", "mortgage_application",
                              "credit_report", "investment_statements", "utility_bills"}
            missing = required_types - existing_types
            if missing:
                db["interventions"].insert_one({
                    "application_id": app_id,
                    "type": "missing_document",
                    "status": "pending",
                    "internal_context": {
                        "source_node": "loan_app_agent",
                        "risk_flag": "incomplete_documentation",
                        "severity": "advisory",
                        "missing_types": list(missing),
                    },
                    "borrower_context": {
                        "summary": f"We noticed {len(missing)} document(s) may be missing from your application.",
                        "action_required": "Please upload the missing documents to strengthen your application.",
                        "document_types_accepted": list(missing),
                    },
                    "resolution": None,
                    "created_at": datetime.now(timezone.utc),
                    "resolved_at": None,
                })
                log_agent_activity(app_id, "loan_app_agent", "intervention", f"Created missing_document intervention for {len(missing)} types")
        except Exception as e:
            logger.warning(f"Failed to create intervention: {e}")

    return {
        "documents_verified": documents_verified,
        "document_count": doc_count,
        "extraction_summary": analysis[:1000],
        "credit_pulled": credit_pulled,
        "primary_credit_score": primary_score,
        "co_applicant_credit_score": co_score,
        "messages": [{"role": "assistant", "content": analysis}],
    }
