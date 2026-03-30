"""Tool definitions for LangGraph agent tool_use via Bedrock Converse API."""

from langchain_core.tools import tool


@tool
def search_underwriting_policies(query: str) -> list[dict]:
    """Search underwriting policies via Atlas Vector Search for the given topic."""
    from agents.tools import search_policies
    return search_policies(query)


@tool
def get_application_risk_data(application_id: str) -> dict:
    """Run the 7-stage MongoDB aggregation pipeline for risk scoring."""
    from agents.tools import run_risk_aggregation
    return run_risk_aggregation(application_id)


@tool
def get_borrower_credit(application_id: str) -> list[dict]:
    """Fetch credit reports for all borrowers on the application."""
    from agents.tools import get_credit_reports
    return get_credit_reports(application_id)


# Structured output tool — used to get structured JSON from the LLM
UNDERWRITING_ANALYSIS_TOOL = {
    "toolSpec": {
        "name": "submit_underwriting_analysis",
        "description": "Submit the structured underwriting analysis with risk factors, mitigating factors, recommended conditions, and policy citations",
        "inputSchema": {
            "json": {
                "type": "object",
                "properties": {
                    "risk_factors": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of risk factors identified in the application",
                    },
                    "mitigating_factors": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of factors that reduce risk",
                    },
                    "recommended_conditions": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Conditions to attach if approving the loan",
                    },
                    "policy_violations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "policy_id": {"type": "string"},
                                "description": {"type": "string"},
                            },
                        },
                        "description": "Any policy violations found",
                    },
                    "confidence": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1,
                        "description": "Confidence in the analysis (0-1)",
                    },
                    "narrative_summary": {
                        "type": "string",
                        "description": "Human-readable narrative summary of the underwriting analysis",
                    },
                },
                "required": ["risk_factors", "mitigating_factors", "confidence", "narrative_summary"],
            }
        },
    }
}
