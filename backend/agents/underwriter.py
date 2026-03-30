"""Underwriting Agent — calculates risk, GDS/TDS, and makes lending decisions."""
from agents.state import LendFlowState
from agents.tools import (
    get_application_summary,
    get_credit_reports,
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
    monthly_income = combined_income / 12

    # Calculate mortgage payment from loan amount and rate
    annual_rate = 0.0489  # Current rate for 5yr Fixed
    monthly_rate = annual_rate / 12
    n_payments = 25 * 12  # 25yr amortization
    estimated_mortgage_payment = round(
        (loan_amount * monthly_rate * (1 + monthly_rate)**n_payments)
        / ((1 + monthly_rate)**n_payments - 1)
    )

    # Property costs from application data
    property_tax_monthly = round(app.get("property", {}).get("annual_tax", 6815) / 12)
    heating_estimate = 250  # Standard heating estimate for Calgary

    # Existing debts from credit reports (fetch structured data)
    credit_reports = get_credit_reports(app_id)
    existing_debt_payments = 0
    for report in credit_reports:
        for account in report.get("accounts", []):
            payment = account.get("monthly_payment", 0)
            if isinstance(payment, (int, float)):
                existing_debt_payments += payment

    # If no structured debt data, use a conservative estimate
    if existing_debt_payments == 0:
        existing_debt_payments = 1826  # $482 car + $1289 condo mortgage + $55 credit card

    gds = (estimated_mortgage_payment + property_tax_monthly + heating_estimate) / monthly_income
    tds = (estimated_mortgage_payment + property_tax_monthly + heating_estimate + existing_debt_payments) / monthly_income

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

    # Decision logic based on ratios and risk
    if risk_score > 80 or risk_tier == "D":
        decision = "decline"
        decision_reasoning = f"Risk score {risk_score}/100 ({risk_tier}) exceeds acceptable threshold."
    elif purchase_price > 500000 or gds > 0.36 or tds > 0.41 or risk_tier in ("B", "C"):
        decision = "escalate"
        decision_reasoning = "Officer review required: "
        reasons = []
        if purchase_price > 500000:
            reasons.append(f"property value ${purchase_price:,.0f} exceeds $500K threshold (policy \u00a73.1.4)")
        if gds > 0.36:
            reasons.append(f"GDS {gds:.1%} approaching 39% limit")
        if tds > 0.41:
            reasons.append(f"TDS {tds:.1%} approaching 44% limit")
        if risk_tier in ("B", "C"):
            reasons.append(f"risk tier {risk_tier} requires review")
        decision_reasoning += "; ".join(reasons) + "."
    else:
        decision = "approve"
        decision_reasoning = f"Auto-approved: GDS {gds:.1%}, TDS {tds:.1%}, Risk {risk_score}/100 ({risk_tier})."

    log_agent_activity(app_id, "underwriter", "decision", decision_reasoning)

    if decision == "escalate":
        update_application_status(app_id, "review", f"Escalated to officer review — {decision_reasoning}")
    elif decision == "decline":
        update_application_status(app_id, "declined", decision_reasoning)
    else:
        update_application_status(app_id, "approved", decision_reasoning)

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
