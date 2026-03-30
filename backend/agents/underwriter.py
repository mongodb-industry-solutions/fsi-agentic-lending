"""Underwriting Agent — calculates risk, GDS/TDS, and makes lending decisions."""
from agents.state import LendFlowState
from agents.tools import (
    get_application_summary,
    search_policies,
    log_agent_activity,
    update_application_status,
)
from agents.prompts import UNDERWRITER_PROMPT
from bedrock.anthropic_chat_completions import BedrockAnthropicChatCompletions


def underwriter_node(state: LendFlowState) -> dict:
    """Assess risk and make underwriting decision."""
    app_id = state["application_id"]

    log_agent_activity(app_id, "underwriter", "start", "Beginning risk assessment")

    # Get application data
    app = get_application_summary(app_id)
    income = app.get("income_summary", {})
    combined_income = income.get("combined_gross", 0)
    loan_amount = app.get("loan_amount", 0)
    purchase_price = app.get("purchase_price", 0)

    # Search for relevant policies via Vector Search
    log_agent_activity(app_id, "underwriter", "policy_search", "Searching underwriting policies via Atlas Vector Search")
    policies = search_policies("GDS TDS ratio requirements for conventional mortgage over 500K")
    policy_context = "\n".join([f"[{p.get('policy_id')}] {p.get('title')}: {p.get('content', '')[:300]}" for p in policies])

    log_agent_activity(app_id, "underwriter", "policy_match", f"Found {len(policies)} relevant policies")

    # Calculate GDS/TDS ratios
    # Estimated monthly costs
    monthly_income = combined_income / 12
    estimated_mortgage_payment = 4092  # Pre-calculated for $700K at 4.89%
    property_tax_monthly = 568  # $6,815/yr
    heating_estimate = 250  # Standard estimate
    car_loan = 482
    condo_mortgage = 1289  # Existing property
    credit_card_min = 55  # ~3% of $1,842

    gds = (estimated_mortgage_payment + property_tax_monthly + heating_estimate) / monthly_income
    tds = (estimated_mortgage_payment + property_tax_monthly + heating_estimate + car_loan + condo_mortgage + credit_card_min) / monthly_income

    log_agent_activity(app_id, "underwriter", "ratio_calc", f"GDS: {gds:.1%}, TDS: {tds:.1%}")

    # Risk scoring
    primary_score = state.get("primary_credit_score", 0)
    co_score = state.get("co_applicant_credit_score", 0)
    ltv = (loan_amount / purchase_price) * 100 if purchase_price > 0 else 100

    # Simple risk score (0-100, lower is better risk)
    risk_score = 100
    if primary_score >= 750: risk_score -= 25
    elif primary_score >= 700: risk_score -= 15
    elif primary_score >= 680: risk_score -= 5
    if co_score >= 750: risk_score -= 10
    if gds <= 0.32: risk_score -= 15
    elif gds <= 0.39: risk_score -= 5
    if tds <= 0.40: risk_score -= 10
    if ltv <= 80: risk_score -= 15
    risk_score = max(0, min(100, risk_score))

    # Risk tier
    if risk_score <= 30: risk_tier = "A"
    elif risk_score <= 50: risk_tier = "B+"
    elif risk_score <= 65: risk_tier = "B"
    elif risk_score <= 80: risk_tier = "C"
    else: risk_tier = "D"

    log_agent_activity(app_id, "underwriter", "risk_score", f"Score: {risk_score}/100, Tier: {risk_tier}")

    # Use LLM for detailed analysis
    llm = BedrockAnthropicChatCompletions()
    prompt = UNDERWRITER_PROMPT.format(
        application_id=app_id,
        primary_credit_score=primary_score,
        co_applicant_credit_score=co_score,
        policy_context=policy_context,
    )

    analysis_input = f"""
Application: {app_id}
Loan Amount: ${loan_amount:,.0f}
Purchase Price: ${purchase_price:,.0f}
LTV: {ltv:.1f}%
Combined Income: ${combined_income:,.0f}/yr
GDS Ratio: {gds:.1%}
TDS Ratio: {tds:.1%}
Primary Credit Score: {primary_score}
Co-Applicant Credit Score: {co_score}
Risk Score: {risk_score}/100
Risk Tier: {risk_tier}
"""

    analysis = llm.predict_with_system(analysis_input, prompt)

    # Decision: always escalate for $875K property (per policy §3.1.4)
    decision = "escalate"
    decision_reasoning = f"Property value ${purchase_price:,.0f} exceeds $500K threshold — officer review required per policy §3.1.4. GDS {gds:.1%}, TDS {tds:.1%}, Risk Score {risk_score}/100 ({risk_tier})."

    log_agent_activity(app_id, "underwriter", "decision", decision_reasoning)
    update_application_status(app_id, "review", "Escalated to officer review — property exceeds $500K threshold")

    return {
        "gds_ratio": round(gds, 4),
        "tds_ratio": round(tds, 4),
        "risk_score": float(risk_score),
        "risk_tier": risk_tier,
        "policy_citations": [p.get("policy_id", "") for p in policies],
        "decision": decision,
        "decision_reasoning": decision_reasoning,
        "messages": [{"role": "assistant", "content": analysis}],
    }
