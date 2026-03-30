"""LendFlow agent state definition for LangGraph."""
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

    # Decision
    decision: Optional[str]  # approve / decline / escalate
    decision_reasoning: str

    # HITL
    officer_notes: Optional[str]

    # Autonomy
    autonomy_level: str  # "observe" | "suggest" | "bounded" | "auto"
    last_error: Optional[str]
    retry_count: int

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
