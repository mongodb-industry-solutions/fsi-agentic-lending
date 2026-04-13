"""LangGraph workflow assembly with MongoDBSaver checkpointing."""
import functools
import threading
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.mongodb import MongoDBSaver

from db.mdb import get_db
from agents.state import LendFlowState
from agents.pipeline.supervisor import supervisor_node, route_from_supervisor
from agents.pipeline.loan_app import loan_app_node
from agents.pipeline.underwriter import underwriter_node
from agents.pipeline.hitl_gate import hitl_gate
from agents.pipeline.completion import completion_node
from agents.pipeline.tools import log_agent_activity


def safe_node(node_fn):
    """Catches errors and writes to state instead of crashing the graph."""
    @functools.wraps(node_fn)
    def wrapper(state: LendFlowState, **kwargs) -> dict:
        try:
            return node_fn(state, **kwargs)
        except Exception as e:
            app_id = state.get("application_id", "unknown")
            log_agent_activity(app_id, node_fn.__name__, "error", str(e)[:500])
            return {
                "last_error": str(e)[:500],
                "messages": [{"role": "assistant", "content": f"Error in {node_fn.__name__}: {str(e)[:200]}"}],
            }
    return wrapper


def build_graph():
    """Build and compile the LendFlow agent graph with MongoDBSaver."""
    db = get_db()
    client = db.client
    db_name = db.name
    checkpointer = MongoDBSaver(client, db_name=db_name)

    graph = StateGraph(LendFlowState)

    graph.add_node("supervisor", supervisor_node)
    graph.add_node("loan_app", safe_node(loan_app_node))
    graph.add_node("underwriter", safe_node(underwriter_node))
    graph.add_node("hitl_gate", hitl_gate)
    graph.add_node("complete", completion_node)

    graph.add_edge(START, "supervisor")
    graph.add_conditional_edges("supervisor", route_from_supervisor)
    graph.add_edge("loan_app", "supervisor")
    graph.add_edge("underwriter", "supervisor")
    graph.add_edge("hitl_gate", "supervisor")
    graph.add_edge("complete", END)

    compiled = graph.compile(checkpointer=checkpointer)

    return compiled


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
