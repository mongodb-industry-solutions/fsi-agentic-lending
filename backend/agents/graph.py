"""LangGraph workflow assembly with MongoDBSaver checkpointing."""
import os
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.mongodb import MongoDBSaver
from langgraph.types import interrupt, Command
from pymongo import MongoClient

from agents.state import LendFlowState
from agents.supervisor import supervisor_node, route_from_supervisor
from agents.loan_app_agent import loan_app_node
from agents.underwriter import underwriter_node
from agents.tools import log_agent_activity, update_application_status


def hitl_gate(state: LendFlowState) -> dict:
    """HITL gate — pauses execution for officer review via LangGraph interrupt()."""
    app_id = state["application_id"]

    review_package = {
        "application_id": app_id,
        "risk_score": state.get("risk_score"),
        "risk_tier": state.get("risk_tier"),
        "gds_ratio": state.get("gds_ratio"),
        "tds_ratio": state.get("tds_ratio"),
        "decision_reasoning": state.get("decision_reasoning", ""),
        "policy_citations": state.get("policy_citations", []),
    }

    log_agent_activity(app_id, "hitl_gate", "interrupt", f"Execution paused — awaiting officer decision. Risk: {state.get('risk_score')}/100 ({state.get('risk_tier')})")

    # This pauses the graph execution until resumed via API
    decision = interrupt(review_package)

    # Execution resumes here after officer submits decision
    if not isinstance(decision, dict):
        decision = {}
    action = decision.get("action", "decline")
    if action not in ("approve", "decline"):
        action = "decline"
    notes = decision.get("notes", "")

    new_status = "approved" if action == "approve" else "declined"
    log_agent_activity(app_id, "hitl_gate", "resume", f"Officer decision: {action}. Notes: {notes}")
    update_application_status(app_id, new_status, f"Officer {action}d the application. {notes}")

    return {
        "decision": action,
        "officer_notes": notes,
    }


def completion_node(state: LendFlowState) -> dict:
    """Final node — logs completion."""
    app_id = state["application_id"]
    decision = state.get("decision", "unknown")

    log_agent_activity(app_id, "supervisor", "pipeline_complete", f"Lending pipeline complete. Final decision: {decision}")

    return {"current_agent": "complete"}


def build_graph(mongodb_uri: str = None, database_name: str = None):
    """Build and compile the LendFlow agent graph with MongoDBSaver."""
    uri = mongodb_uri or os.getenv("MONGODB_URI")
    db_name = database_name or os.getenv("DATABASE_NAME", "lendflow")

    client = MongoClient(uri)
    checkpointer = MongoDBSaver(client, db_name=db_name)

    # Build the state graph
    graph = StateGraph(LendFlowState)

    # Add nodes
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("loan_app", loan_app_node)
    graph.add_node("underwriter", underwriter_node)
    graph.add_node("hitl_gate", hitl_gate)
    graph.add_node("complete", completion_node)

    # Add edges
    graph.add_edge(START, "supervisor")
    graph.add_conditional_edges("supervisor", route_from_supervisor)
    graph.add_edge("loan_app", "supervisor")
    graph.add_edge("underwriter", "supervisor")
    graph.add_edge("hitl_gate", "supervisor")
    graph.add_edge("complete", END)

    # Compile with checkpointer
    compiled = graph.compile(checkpointer=checkpointer)

    return compiled


# Singleton graph instance
_graph = None

def get_graph():
    """Get or create the singleton graph instance."""
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph
