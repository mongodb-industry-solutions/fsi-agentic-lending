"""LangGraph workflow assembly with MongoDBSaver checkpointing."""
import functools
import threading
from datetime import datetime, timezone
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.mongodb import MongoDBSaver
from langgraph.types import interrupt, Command

from db.mdb import get_db
from agents.state import LendFlowState
from agents.supervisor import supervisor_node, route_from_supervisor
from agents.loan_app_agent import loan_app_node
from agents.underwriter import underwriter_node
from agents.tools import log_agent_activity, update_application_status


def safe_node(node_fn):
    """Catches errors and writes to state instead of crashing the graph."""
    @functools.wraps(node_fn)
    def wrapper(state: LendFlowState) -> dict:
        try:
            return node_fn(state)
        except Exception as e:
            app_id = state.get("application_id", "unknown")
            log_agent_activity(app_id, node_fn.__name__, "error", str(e)[:500])
            return {
                "last_error": str(e)[:500],
                "messages": [{"role": "assistant", "content": f"Error in {node_fn.__name__}: {str(e)[:200]}"}],
            }
    return wrapper


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
    action = decision.get("action")
    if action not in ("approve", "decline", "modify_and_continue"):
        # Invalid action — re-interrupt
        log_agent_activity(app_id, "hitl_gate", "invalid_action", f"Received: {action}")
        decision = interrupt({**review_package, "error": f"Invalid action: {action}"})
        action = decision.get("action", "decline")

    notes = decision.get("notes", "")
    conditions = decision.get("conditions", [])
    overrides = decision.get("overrides", {})

    state_updates = {
        "decision": action if action != "modify_and_continue" else None,  # Clear to force re-underwriting
        "officer_notes": notes,
    }

    # Record approved node to prevent re-gating in observe mode
    pending = state.get("_pending_node")
    if pending:
        approved = list(state.get("hitl_approved_nodes", []))
        approved.append(pending)
        state_updates["hitl_approved_nodes"] = approved
        state_updates["_pending_node"] = None

    if action == "modify_and_continue":
        state_updates["risk_score"] = None

    # Apply officer overrides
    if overrides.get("risk_tier"):
        state_updates["risk_tier"] = overrides["risk_tier"]
    if overrides.get("loan_amount"):
        # Officer adjusted loan amount — force re-underwriting
        state_updates["risk_score"] = None
        state_updates["decision"] = None
        state_updates["decision_reasoning"] = f"Re-underwriting: officer adjusted loan to ${overrides['loan_amount']:,.0f}"
        # Persist loan_amount override to database
        from db.mdb import get_db as _get_db
        db = _get_db()
        db["applications"].update_one(
            {"application_id": app_id},
            {"$set": {"loan_amount": overrides["loan_amount"]}}
        )

    officer_id = decision.get("officer_id", "unknown")
    new_status = "approved" if action == "approve" else ("processing" if action == "modify_and_continue" else "declined")
    log_agent_activity(app_id, "hitl_gate", "resume", f"Officer {officer_id}: {action}. {notes}")
    update_application_status(app_id, new_status, f"Officer {action}d the application. {notes}")

    return state_updates


def completion_node(state: LendFlowState) -> dict:
    """Final node — logs completion."""
    app_id = state["application_id"]
    decision = state.get("decision", "unknown")

    log_agent_activity(app_id, "supervisor", "pipeline_complete", f"Lending pipeline complete. Final decision: {decision}")

    return {"current_agent": "complete", "completed_at": datetime.now(timezone.utc).isoformat()}


def build_graph():
    """Build and compile the LendFlow agent graph with MongoDBSaver."""
    db = get_db()
    client = db.client  # Reuse the singleton's MongoClient
    db_name = db.name
    checkpointer = MongoDBSaver(client, db_name=db_name)

    # Build the state graph
    graph = StateGraph(LendFlowState)

    # Add nodes
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("loan_app", safe_node(loan_app_node))
    graph.add_node("underwriter", safe_node(underwriter_node))
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
_graph_lock = threading.Lock()

def get_graph():
    """Get or create the singleton graph instance (thread-safe)."""
    global _graph
    if _graph is None:
        with _graph_lock:
            if _graph is None:
                _graph = build_graph()
    return _graph
