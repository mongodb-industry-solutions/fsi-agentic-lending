"""Tool definitions for Bedrock Converse API structured output."""

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
