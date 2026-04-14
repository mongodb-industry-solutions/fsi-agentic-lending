"""LendFlow agent state definition for LangGraph."""
from datetime import datetime, timezone
from typing import TypedDict, Annotated, Literal, Optional
from langgraph.graph.message import add_messages


class LendFlowState(TypedDict):
    """State shared across all agents in the lending workflow."""
    messages: Annotated[list, add_messages]
    application_id: str
    current_agent: str

    # Document processing
    documents_verified: bool
    document_count: int
    extraction_summary: str

    # Credit
    credit_pulled: bool
    primary_credit_score: Optional[int]
    co_applicant_credit_score: Optional[int]

    # Underwriting
    gds_ratio: Optional[float]
    tds_ratio: Optional[float]
    risk_score: Optional[float]
    risk_tier: Optional[str]
    policy_citations: list[str]

    # Underwriting — LLM structured output
    structured_analysis: Optional[dict]

    # Decision
    decision: Optional[str]  # approve / decline / escalate
    decision_reasoning: str

    # HITL
    officer_notes: Optional[str]

    # Autonomy
    autonomy_level: str  # "observe" | "suggest" | "bounded" | "auto"
    last_error: Optional[str]
    retry_count: int
    gather_attempts: int

    # Timestamps
    started_at: Optional[str]
    completed_at: Optional[str]

    # Stress test
    stress_gds: Optional[float]
    stress_tds: Optional[float]
    stress_rate: Optional[float]

    # HITL observe mode tracking
    hitl_approved_nodes: list[str]
    pending_node: Optional[str]


_STATE_DEFAULTS: dict = {
    "messages": list,
    "application_id": str,
    "current_agent": lambda: "supervisor",
    "documents_verified": lambda: False,
    "document_count": lambda: 0,
    "extraction_summary": lambda: "",
    "credit_pulled": lambda: False,
    "primary_credit_score": lambda: None,
    "co_applicant_credit_score": lambda: None,
    "gds_ratio": lambda: None,
    "tds_ratio": lambda: None,
    "risk_score": lambda: None,
    "risk_tier": lambda: None,
    "policy_citations": list,
    "structured_analysis": lambda: None,
    "decision": lambda: None,
    "decision_reasoning": lambda: "",
    "officer_notes": lambda: None,
    "autonomy_level": lambda: "bounded",
    "last_error": lambda: None,
    "retry_count": lambda: 0,
    "gather_attempts": lambda: 0,
    "started_at": lambda: datetime.now(timezone.utc).isoformat(),
    "completed_at": lambda: None,
    "stress_gds": lambda: None,
    "stress_tds": lambda: None,
    "stress_rate": lambda: None,
    "hitl_approved_nodes": list,
    "pending_node": lambda: None,
}


def make_initial_state(application_id: str, autonomy_level: str = "bounded") -> dict:
    """Build a complete initial state dict for a new pipeline run.

    Derives keys from LendFlowState so new fields only need to be added in
    ``_STATE_DEFAULTS`` — callers never go out of sync.
    """
    state: dict = {}
    for key, factory in _STATE_DEFAULTS.items():
        state[key] = factory()
    state["application_id"] = application_id
    state["autonomy_level"] = autonomy_level
    return state
