"""Underwriting Agent — calculates risk, GDS/TDS, and makes lending decisions."""
import os
import logging

from agents.state import LendFlowState
from agents.pipeline.tools import (
    get_application_summary,
    get_credit_reports,
    run_risk_aggregation,
    search_policies,
    log_agent_activity,
    update_application_status,
)
from agents.pipeline.prompts import UNDERWRITER_PROMPT
from agents.pipeline.tool_schemas import UNDERWRITING_ANALYSIS_TOOL
from agents.llm import get_llm
from agents.helpers.interventions import create_intervention
from db.mdb import get_db as _get_db

logger = logging.getLogger(__name__)

try:
    from langsmith import traceable
except ImportError:
    def traceable(**kwargs):
        def decorator(fn): return fn
        return decorator

DECLINE_RISK_SCORE = int(os.getenv("DECLINE_RISK_SCORE", "80"))
ESCALATE_PURCHASE_PRICE = int(os.getenv("ESCALATE_PURCHASE_PRICE", "500000"))
ESCALATE_GDS = float(os.getenv("ESCALATE_GDS", "0.36"))
ESCALATE_TDS = float(os.getenv("ESCALATE_TDS", "0.41"))


def _calculate_mortgage_payment(loan_amount: float, annual_rate: float, years: int = 25) -> int:
    """Calculate monthly mortgage payment using standard amortization formula."""
    monthly_rate = annual_rate / 12
    n_payments = years * 12
    if monthly_rate == 0:
        return round(loan_amount / n_payments) if n_payments > 0 else 0
    return round(
        (loan_amount * monthly_rate * (1 + monthly_rate)**n_payments)
        / ((1 + monthly_rate)**n_payments - 1)
    )


def calculate_gds_tds(
    mortgage_payment: float,
    property_tax_monthly: float,
    heating: float,
    existing_debt_payments: float,
    monthly_income: float,
) -> tuple[float, float]:
    """Calculate GDS and TDS ratios.

    Returns (gds, tds) as decimals (e.g. 0.32, 0.40).
    """
    housing_costs = mortgage_payment + property_tax_monthly + heating
    gds = housing_costs / monthly_income
    tds = (housing_costs + existing_debt_payments) / monthly_income
    return gds, tds


def run_stress_test(
    loan_amount: float,
    annual_rate: float,
    monthly_income: float,
    property_tax_monthly: float,
    heating: float,
    existing_debt_payments: float,
) -> dict:
    """Run OSFI B-20 stress test. Returns stress metrics and pass/fail."""
    stress_rate = max(annual_rate + 0.02, 0.0525)
    stress_payment = _calculate_mortgage_payment(loan_amount, stress_rate)
    stress_gds, stress_tds = calculate_gds_tds(
        stress_payment, property_tax_monthly, heating,
        existing_debt_payments, monthly_income,
    )
    passed = stress_gds <= 0.39 and stress_tds <= 0.44
    return {
        "stress_rate": stress_rate,
        "stress_payment": stress_payment,
        "stress_gds": stress_gds,
        "stress_tds": stress_tds,
        "passed": passed,
    }


def compute_risk_score(
    base_risk: float | None,
    effective_gds: float,
    effective_tds: float,
) -> tuple[float, str]:
    """Compute final risk score and tier from base risk and ratio adjustments.

    Returns (risk_score, risk_tier).
    """
    score = base_risk if base_risk is not None else 100
    if effective_gds <= 0.32:
        score -= 15
    elif effective_gds <= 0.39:
        score -= 5
    if effective_tds <= 0.40:
        score -= 10
    score = max(0, min(100, score))

    if score <= 30:
        tier = "A"
    elif score <= 50:
        tier = "B+"
    elif score <= 65:
        tier = "B"
    elif score <= 80:
        tier = "C"
    else:
        tier = "D"

    return float(score), tier


@traceable(name="underwriter_node")
def underwriter_node(state: LendFlowState, **kwargs) -> dict:
    """Assess risk and make underwriting decision."""
    app_id = state["application_id"]

    log_agent_activity(app_id, "underwriter", "start", "Beginning risk assessment")

    agg_result = run_risk_aggregation(app_id)

    app = get_application_summary(app_id)
    income = app.get("income_summary", {})
    combined_income = income.get("combined_gross", 0)
    loan_amount = agg_result.get("loan_amount") if agg_result.get("loan_amount") is not None else app.get("loan_amount", 0)
    purchase_price = agg_result.get("purchase_price") if agg_result.get("purchase_price") is not None else app.get("purchase_price", 0)

    # Search for relevant policies via Vector Search
    log_agent_activity(app_id, "underwriter", "policy_search", "Searching underwriting policies via Atlas Vector Search")
    policies = search_policies("GDS TDS ratio requirements for conventional mortgage over 500K")
    policy_context = "\n".join([f"[{p.get('policy_id')}] {p.get('title')}: {p.get('content', '')[:300]}" for p in policies])

    log_agent_activity(app_id, "underwriter", "policy_match", f"Found {len(policies)} relevant policies")

    # --- Zero-income early exit ---
    if combined_income <= 0:
        log_agent_activity(app_id, "underwriter", "error", "Combined gross income is zero or missing — cannot calculate ratios")
        if create_intervention(
            app_id,
            intervention_type="income_data_required",
            source_node="underwriter",
            risk_flag="zero_income",
            severity="blocking",
            borrower_summary="We could not verify your income information.",
            action_required="Please ensure your employment letter, pay stubs, and tax notices are uploaded and contain accurate income figures.",
            doc_types=["employment_letter", "paystubs", "income_tax"],
            internal_extras={"combined_income": combined_income},
        ):
            log_agent_activity(app_id, "underwriter", "intervention", "Created income_data_required intervention")
        update_application_status(app_id, "declined", "Declined: income data is zero or missing")
        return {
            "gds_ratio": None, "tds_ratio": None,
            "risk_score": 100.0, "risk_tier": "D",
            "policy_citations": [], "decision": "decline",
            "decision_reasoning": "Cannot underwrite: income data is zero or missing.",
            "messages": [{"role": "assistant", "content": "Income data missing — application cannot be underwritten."}],
        }

    monthly_income = combined_income / 12

    # --- Sanity check on income/loan values ---
    if loan_amount <= 0:
        log_agent_activity(app_id, "underwriter", "data_gap", f"Loan amount is ${loan_amount:,.0f} — using application value")
        loan_amount = app.get("loan_amount", 0)
    if purchase_price <= 0:
        log_agent_activity(app_id, "underwriter", "data_gap", f"Purchase price is ${purchase_price:,.0f} — using application value")
        purchase_price = app.get("purchase_price", 0)

    # --- Mortgage payment calculation ---
    _rate_str = os.getenv("CURRENT_5YR_FIXED_RATE", "0.0489")
    try:
        annual_rate = float(_rate_str)
    except (ValueError, TypeError):
        log_agent_activity(app_id, "underwriter", "config_warning",
            f"CURRENT_5YR_FIXED_RATE='{_rate_str}' invalid — using 0.0489")
        annual_rate = 0.0489
    log_agent_activity(app_id, "underwriter", "rate_lookup", f"Using rate: {annual_rate:.4f} (5yr Fixed)")

    estimated_mortgage_payment = _calculate_mortgage_payment(loan_amount, annual_rate)

    # Property costs
    annual_tax = app.get("property", {}).get("annual_tax")
    if annual_tax is None:
        log_agent_activity(app_id, "underwriter", "data_gap",
            "annual_tax missing — using $6,815 regional fallback")
        annual_tax = 6815
    property_tax_monthly = round(annual_tax / 12)
    heating_estimate = 250

    # Existing debts from credit reports
    credit_reports = get_credit_reports(app_id)
    existing_debt_payments = 0
    for report in credit_reports:
        for account in report.get("accounts", []):
            payment = account.get("monthly_payment", 0)
            if isinstance(payment, (int, float)):
                existing_debt_payments += payment

    if existing_debt_payments == 0:
        # Fall back to self-reported existing debt from application form
        form_debt = app.get("existing_monthly_debt", 0)
        if isinstance(form_debt, (int, float)) and form_debt > 0:
            existing_debt_payments = form_debt
            log_agent_activity(
                app_id, "underwriter", "data_gap",
                f"No credit report debt data — using self-reported ${form_debt:,.0f}/mo from application form."
            )
        else:
            log_agent_activity(
                app_id, "underwriter", "data_gap",
                "No structured monthly debt payments found in credit reports — treating as $0. Manual review recommended."
            )

    # --- GDS / TDS ---
    gds, tds = calculate_gds_tds(
        estimated_mortgage_payment, property_tax_monthly,
        heating_estimate, existing_debt_payments, monthly_income,
    )
    log_agent_activity(app_id, "underwriter", "ratio_calc", f"GDS: {gds:.1%}, TDS: {tds:.1%}")

    # --- OSFI B-20 Stress Test ---
    stress = run_stress_test(
        loan_amount, annual_rate, monthly_income,
        property_tax_monthly, heating_estimate, existing_debt_payments,
    )
    log_agent_activity(app_id, "underwriter", "stress_test",
        f"Stress rate: {stress['stress_rate']:.2%}, Stress GDS: {stress['stress_gds']:.1%}, Stress TDS: {stress['stress_tds']:.1%}")
    log_agent_activity(app_id, "underwriter", "stress_test_result",
        f"{'PASSED' if stress['passed'] else 'FAILED'}: Stress GDS {stress['stress_gds']:.1%}, Stress TDS {stress['stress_tds']:.1%}")

    effective_gds = max(gds, stress["stress_gds"])
    effective_tds = max(tds, stress["stress_tds"])

    # --- Risk scoring ---
    primary_score = agg_result.get("primary_credit_score") if agg_result.get("primary_credit_score") is not None else state.get("primary_credit_score")
    co_score = agg_result.get("co_credit_score") if agg_result.get("co_credit_score") is not None else state.get("co_applicant_credit_score")

    if primary_score is None:
        log_agent_activity(app_id, "underwriter", "error", "Primary credit score unavailable — cannot underwrite")
        if create_intervention(
            app_id,
            intervention_type="credit_score_required",
            source_node="underwriter",
            risk_flag="missing_primary_credit",
            severity="blocking",
            borrower_summary="We were unable to retrieve your credit score from the credit bureau.",
            action_required="Please verify that your credit bureau authorization is on file and that your personal information (name, SIN, address) matches your credit bureau records exactly.",
            doc_types=["credit_report"],
        ):
            log_agent_activity(app_id, "underwriter", "intervention", "Created credit_score_required intervention")
        update_application_status(app_id, "declined", "Declined: primary credit score unavailable")
        return {
            "risk_score": 100.0, "risk_tier": "D",
            "decision": "decline",
            "decision_reasoning": "Cannot underwrite: primary credit score unavailable. Manual review required.",
            "messages": [{"role": "assistant", "content": "Primary credit score unavailable — application declined."}],
        }

    ltv = agg_result.get("ltv") if agg_result.get("ltv") is not None else ((loan_amount / purchase_price) * 100 if purchase_price > 0 else 100)
    doc_count = agg_result.get("doc_count") if agg_result.get("doc_count") is not None else 0

    log_agent_activity(app_id, "underwriter", "ltv_calc", f"LTV: {ltv:.1f}% ({loan_amount:,.0f} / {purchase_price:,.0f})")
    log_agent_activity(app_id, "underwriter", "agg_data",
        f"Aggregation: primary_score={primary_score}, co_score={co_score}, doc_count={doc_count}, pipeline_ms={agg_result.get('pipeline_elapsed_ms', 'N/A')}")

    risk_score, risk_tier = compute_risk_score(
        agg_result.get("risk_score"), effective_gds, effective_tds,
    )
    log_agent_activity(app_id, "underwriter", "risk_score", f"Score: {risk_score}/100, Tier: {risk_tier}")

    # --- LLM analysis ---
    llm = get_llm()
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
Co-Applicant Credit Score: {co_score if co_score is not None else 'N/A'}
Risk Score: {risk_score}/100
Risk Tier: {risk_tier}
"""

    from bedrock.anthropic_chat_completions import parse_tool_response, ToolResponseError

    try:
        response = llm.converse_with_tools(
            messages=[{"role": "user", "content": [{"text": analysis_input}]}],
            system_prompt=prompt,
            tools=[UNDERWRITING_ANALYSIS_TOOL],
        )

        try:
            structured_analysis = parse_tool_response(response, expected_tool_name="underwriting_analysis")
        except ToolResponseError as te:
            log_agent_activity(app_id, "underwriter", "tool_parse_warning", str(te)[:300])
            structured_analysis = None

        if structured_analysis:
            analysis = structured_analysis.get("narrative_summary", "")
            log_agent_activity(app_id, "underwriter", "structured_analysis",
                f"Confidence: {structured_analysis.get('confidence', 'N/A')}, "
                f"Risk factors: {len(structured_analysis.get('risk_factors', []))}, "
                f"Mitigating: {len(structured_analysis.get('mitigating_factors', []))}")
        else:
            content = response.get("output", {}).get("message", {}).get("content", [])
            text_block = next((block for block in content if "text" in block), None)
            analysis = text_block.get("text", "") if text_block else ""

    except RuntimeError as e:
        log_agent_activity(app_id, "underwriter", "llm_error", str(e)[:500])
        analysis = f"LLM analysis unavailable: {str(e)[:200]}"
        structured_analysis = None

    # --- Stress test failure early exit ---
    if not stress["passed"]:
        decision = "decline"
        decision_reasoning = f"OSFI B-20 stress test failure: Stress GDS {stress['stress_gds']:.1%} (limit 39%), Stress TDS {stress['stress_tds']:.1%} (limit 44%)"
        log_agent_activity(app_id, "underwriter", "decision", decision_reasoning)
        if create_intervention(
            app_id,
            intervention_type="stress_test_failure",
            source_node="underwriter",
            risk_flag="osfi_b20_failure",
            severity="blocking",
            borrower_summary=f"Your application did not pass the OSFI B-20 mortgage stress test at the qualifying rate of {stress['stress_rate']:.2%}.",
            action_required="The stress test ensures you can afford payments if rates rise. You may improve your result by increasing your down payment, reducing existing debts, or choosing a less expensive property.",
            internal_extras={
                "stress_gds": round(stress["stress_gds"], 4),
                "stress_tds": round(stress["stress_tds"], 4),
                "stress_rate": round(stress["stress_rate"], 4),
                "gds_limit": 0.39,
                "tds_limit": 0.44,
            },
        ):
            log_agent_activity(app_id, "underwriter", "intervention", "Created stress_test_failure intervention")
        update_application_status(app_id, "declined", decision_reasoning)
        return {
            "gds_ratio": round(gds, 4), "tds_ratio": round(tds, 4),
            "stress_gds": round(stress["stress_gds"], 4),
            "stress_tds": round(stress["stress_tds"], 4),
            "stress_rate": round(stress["stress_rate"], 4),
            "risk_score": risk_score, "risk_tier": risk_tier,
            "policy_citations": [p.get("policy_id", "") for p in policies],
            "decision": decision, "decision_reasoning": decision_reasoning,
            "structured_analysis": structured_analysis,
            "messages": [{"role": "assistant", "content": analysis}],
        }

    # --- Decision logic ---
    if risk_score > DECLINE_RISK_SCORE or risk_tier == "D":
        decision = "decline"
        decision_reasoning = f"Risk score {risk_score}/100 ({risk_tier}) exceeds acceptable threshold."
    elif purchase_price > ESCALATE_PURCHASE_PRICE or effective_gds > ESCALATE_GDS or effective_tds > ESCALATE_TDS or risk_tier in ("B", "C"):
        decision = "escalate"
        decision_reasoning = "Officer review required: "
        reasons = []
        if purchase_price > ESCALATE_PURCHASE_PRICE:
            reasons.append(f"property value ${purchase_price:,.0f} exceeds ${ESCALATE_PURCHASE_PRICE:,} threshold (policy §3.1.4)")
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

    # Persist underwriting results to application document for HITL context
    _get_db()["applications"].update_one(
        {"application_id": app_id},
        {"$set": {
            "risk_score": risk_score,
            "risk_tier": risk_tier,
            "gds_ratio": round(gds, 4),
            "tds_ratio": round(tds, 4),
            "stress_gds": round(stress["stress_gds"], 4),
            "stress_tds": round(stress["stress_tds"], 4),
            "primary_credit_score": primary_score,
            "ltv": round(ltv, 2),
            "decision_reasoning": decision_reasoning,
        }}
    )

    if decision == "escalate":
        update_application_status(app_id, "review", f"Escalated to officer review — {decision_reasoning}")
        borrower_reasons = []
        if purchase_price > ESCALATE_PURCHASE_PRICE:
            borrower_reasons.append("your property value requires additional review")
        if effective_gds > ESCALATE_GDS or effective_tds > ESCALATE_TDS:
            borrower_reasons.append("your debt-to-income ratios are being reviewed for accuracy")
        if risk_tier in ("B", "C"):
            borrower_reasons.append("additional verification is needed for your application profile")
        if create_intervention(
            app_id,
            intervention_type="additional_info_required",
            source_node="underwriter",
            risk_flag="escalation_review",
            severity="advisory",
            borrower_summary="Your application has been escalated for a detailed review by a loan officer.",
            action_required="No immediate action needed. " + (
                "The review was triggered because " + " and ".join(borrower_reasons) + "."
                if borrower_reasons else
                "A loan officer will reach out if additional information is required."
            ),
            internal_extras={
                "decision_reasoning": decision_reasoning,
                "risk_score": risk_score,
                "risk_tier": risk_tier,
            },
        ):
            log_agent_activity(app_id, "underwriter", "intervention", "Created escalation advisory intervention")
    elif decision == "decline":
        update_application_status(app_id, "declined", decision_reasoning)
    else:
        update_application_status(app_id, "approved", decision_reasoning)

    return {
        "gds_ratio": round(gds, 4), "tds_ratio": round(tds, 4),
        "risk_score": risk_score, "risk_tier": risk_tier,
        "policy_citations": [p.get("policy_id", "") for p in policies],
        "decision": decision, "decision_reasoning": decision_reasoning,
        "stress_gds": round(stress["stress_gds"], 4),
        "stress_tds": round(stress["stress_tds"], 4),
        "stress_rate": round(stress["stress_rate"], 4),
        "structured_analysis": structured_analysis,
        "messages": [{"role": "assistant", "content": analysis}],
    }
