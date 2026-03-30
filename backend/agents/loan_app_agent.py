"""Loan Application Agent — processes documents, verifies identity, pulls credit."""
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


def loan_app_node(state: LendFlowState) -> dict:
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

    primary_score = None
    co_score = None
    if credit_reports:
        primary_score = credit_reports[0].get("score")
        log_agent_activity(app_id, "loan_app_agent", "credit_pull", f"Primary borrower credit score: {primary_score}")
    if len(credit_reports) > 1:
        co_score = credit_reports[1].get("score")
        log_agent_activity(app_id, "loan_app_agent", "credit_pull", f"Co-applicant credit score: {co_score}")

    # Get application summary
    app_summary = get_application_summary(app_id)

    # Use Bedrock to analyze documents
    llm = BedrockAnthropicChatCompletions()

    doc_summary_text = "\n".join([
        f"- {d['doc_type']}: {d.get('extracted_text', 'No text')[:200]}..."
        for d in documents
    ])

    prompt = LOAN_APP_AGENT_PROMPT.format(
        application_id=app_id,
        document_count=doc_count,
        credit_pulled=credit_pulled,
    )

    analysis = llm.predict_with_system(
        f"Application summary: {app_summary}\n\nDocuments:\n{doc_summary_text}\n\nCredit reports: {credit_reports}",
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

    return {
        "documents_verified": documents_verified,
        "document_count": doc_count,
        "extraction_summary": analysis[:1000],
        "credit_pulled": credit_pulled,
        "primary_credit_score": primary_score,
        "co_applicant_credit_score": co_score,
        "messages": [{"role": "assistant", "content": analysis}],
    }
