"""Underwriting Agent — calculates risk, GDS/TDS, and makes lending decisions."""
import os

from agents.state import LendFlowState
from agents.tools import (
    get_application_summary,
    get_credit_reports,
    run_risk_aggregation,
    search_policies,
    log_agent_activity,
    update_application_status,
)
from agents.prompts import UNDERWRITER_PROMPT
from bedrock.anthropic_chat_completions import BedrockAnthropicChatCompletions

DECLINE_RISK_SCORE = int(os.getenv("DECLINE_RISK_SCORE", "80"))
ESCALATE_PURCHASE_PRICE = int(os.getenv("ESCALATE_PURCHASE_PRICE", "500000"))
ESCALATE_GDS = float(os.getenv("ESCALATE_GDS", "0.36"))
ESCALATE_TDS = float(os.getenv("ESCALATE_TDS", "0.41"))


def underwriter_node(state: LendFlowState) -> dict:
    """Assess risk and make underwriting decision."""
    app_id = state["application_id"]

    log_agent_activity(app_id, "underwriter", "start", "Beginning risk assessment")

    # Run 7-stage MongoDB aggregation pipeline
    agg_result = run_risk_aggregation(app_id)

    # Get application data
    app = get_application_summary(app_id)
    income = app.get("income_summary", {})
    combined_income = income.get("combined_gross", 0)
    loan_amount = agg_result["loan_amount"] if agg_result.get("loan_amount") is not None else app.get("loan_amount", 0)
    purchase_price = agg_result["purchase_price"] if agg_result.get("purchase_price") is not None else app.get("purchase_price", 0)

    # Search for relevant policies via Vector Search
    log_agent_activity(app_id, "underwriter", "policy_search", "Searching underwriting policies via Atlas Vector Search")
    policies = search_policies("GDS TDS ratio requirements for conventional mortgage over 500K")
    policy_context = "\n".join([f"[{p.get('policy_id')}] {p.get('title')}: {p.get('content', '')[:300]}" for p in policies])

    log_agent_activity(app_id, "underwriter", "policy_match", f"Found {len(policies)} relevant policies")

    # Calculate GDS/TDS ratios
    if combined_income <= 0:
        log_agent_activity(app_id, "underwriter", "error", "Combined gross income is zero or missing — cannot calculate ratios")
        return {
            "gds_ratio": None,
            "tds_ratio": None,
            "risk_score": 100.0,
            "risk_tier": "D",
            "policy_citations": [],
            "decision": "decline",
            "decision_reasoning": "Cannot underwrite: income data is zero or missing.",
            "messages": [{"role": "assistant", "content": "Income data missing — application cannot be underwritten."}],
        }

    monthly_income = combined_income / 12

    # Calculate mortgage payment from loan amount and rate
    _rate_str = os.getenv("CURRENT_5YR_FIXED_RATE", "0.0489")
    try:
        annual_rate = float(_rate_str)
    except (ValueError, TypeError):
        log_agent_activity(app_id, "underwriter", "config_warning",
            f"CURRENT_5YR_FIXED_RATE='{_rate_str}' invalid — using 0.0489")
        annual_rate = 0.0489
    log_agent_activity(app_id, "underwriter", "rate_lookup", f"Using rate: {annual_rate:.4f} (5yr Fixed)")
    monthly_rate = annual_rate / 12
    n_payments = 25 * 12  # 25yr amortization
    estimated_mortgage_payment = round(
        (loan_amount * monthly_rate * (1 + monthly_rate)**n_payments)
        / ((1 + monthly_rate)**n_payments - 1)
    )

    # Property costs from application data
    annual_tax = app.get("property", {}).get("annual_tax")
    if annual_tax is None:
        log_agent_activity(app_id, "underwriter", "data_gap",
            "annual_tax missing — using $6,815 regional fallback")
        annual_tax = 6815
    property_tax_monthly = round(annual_tax / 12)
    heating_estimate = 250  # Standard heating estimate for Calgary

    # Existing debts from credit reports (fetch structured data)
    credit_reports = get_credit_reports(app_id)
    existing_debt_payments = 0
    for report in credit_reports:
        for account in report.get("accounts", []):
            payment = account.get("monthly_payment", 0)
            if isinstance(payment, (int, float)):
                existing_debt_payments += payment

    if existing_debt_payments == 0:
        log_agent_activity(
            app_id, "underwriter", "data_gap",
            "No structured monthly debt payments found in credit reports — treating as $0. Manual review recommended."
        )

    gds = (estimated_mortgage_payment + property_tax_monthly + heating_estimate) / monthly_income
    tds = (estimated_mortgage_payment + property_tax_monthly + heating_estimate + existing_debt_payments) / monthly_income

    log_agent_activity(app_id, "underwriter", "ratio_calc", f"GDS: {gds:.1%}, TDS: {tds:.1%}")

    # OSFI B-20 Stress Test
    stress_rate = max(annual_rate + 0.02, 0.0525)
    stress_monthly_rate = stress_rate / 12
    stress_payment = round(
        (loan_amount * stress_monthly_rate * (1 + stress_monthly_rate)**n_payments)
        / ((1 + stress_monthly_rate)**n_payments - 1)
    )
    stress_gds = (stress_payment + property_tax_monthly + heating_estimate) / monthly_income
    stress_tds = (stress_payment + property_tax_monthly + heating_estimate + existing_debt_payments) / monthly_income

    log_agent_activity(app_id, "underwriter", "stress_test",
        f"Stress rate: {stress_rate:.2%}, Stress GDS: {stress_gds:.1%}, Stress TDS: {stress_tds:.1%}")

    # Use stress-test ratios for decision if they exceed limits
    effective_gds = max(gds, stress_gds)
    effective_tds = max(tds, stress_tds)

    # Risk scoring — use aggregation pipeline results as base
    primary_score = agg_result["primary_credit_score"] if agg_result.get("primary_credit_score") is not None else state.get("primary_credit_score", 0)
    co_score = agg_result["co_credit_score"] if agg_result.get("co_credit_score") is not None else state.get("co_applicant_credit_score", 0)
    ltv = agg_result["ltv"] if agg_result.get("ltv") is not None else ((loan_amount / purchase_price) * 100 if purchase_price > 0 else 100)
    doc_count = agg_result["doc_count"] if agg_result.get("doc_count") is not None else 0

    log_agent_activity(app_id, "underwriter", "ltv_calc", f"LTV: {ltv:.1f}% ({loan_amount:,.0f} / {purchase_price:,.0f})")
    log_agent_activity(app_id, "underwriter", "agg_data",
        f"Aggregation: primary_score={primary_score}, co_score={co_score}, doc_count={doc_count}, pipeline_ms={agg_result.get('pipeline_elapsed_ms', 'N/A')}")

    # Base risk score from aggregation pipeline (credit + LTV factors)
    risk_score_raw = agg_result.get("risk_score")
    base_risk = risk_score_raw if risk_score_raw is not None else 100
    # Adjust for GDS/TDS (calculated in Python with property tax + heating + debt)
    if effective_gds <= 0.32: base_risk -= 15
    elif effective_gds <= 0.39: base_risk -= 5
    if effective_tds <= 0.40: base_risk -= 10
    risk_score = max(0, min(100, base_risk))

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
    if risk_score > DECLINE_RISK_SCORE or risk_tier == "D":
        decision = "decline"
        decision_reasoning = f"Risk score {risk_score}/100 ({risk_tier}) exceeds acceptable threshold."
    elif purchase_price > ESCALATE_PURCHASE_PRICE or effective_gds > ESCALATE_GDS or effective_tds > ESCALATE_TDS or risk_tier in ("B", "C"):
        decision = "escalate"
        decision_reasoning = "Officer review required: "
        reasons = []
        if purchase_price > ESCALATE_PURCHASE_PRICE:
            reasons.append(f"property value ${purchase_price:,.0f} exceeds ${ESCALATE_PURCHASE_PRICE:,} threshold (policy \u00a73.1.4)")
        if effective_gds > ESCALATE_GDS:
            reasons.append(f"GDS {effective_gds:.1%} approaching 39% limit")
        if effective_tds > ESCALATE_TDS:
            reasons.append(f"TDS {effective_tds:.1%} approaching 44% limit")
        if risk_tier in ("B", "C"):
            reasons.append(f"risk tier {risk_tier} requires review")
        decision_reasoning += "; ".join(reasons) + "."
    else:
        decision = "approve"
        decision_reasoning = f"Auto-approved: GDS {effective_gds:.1%}, TDS {effective_tds:.1%}, Risk {risk_score}/100 ({risk_tier})."

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
