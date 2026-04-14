"""LangGraph workflow assembly with MongoDBSaver checkpointing."""
import atexit
import functools
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.mongodb import MongoDBSaver

from db.mdb import get_db
from agents.state import LendFlowState
from agents.pipeline.supervisor import supervisor_node, route_from_supervisor
from agents.pipeline.doc_verifier import doc_verifier_node
from agents.pipeline.credit_puller import credit_puller_node
from agents.pipeline.loan_app import loan_app_node
from agents.pipeline.underwriter import underwriter_node
from agents.pipeline.hitl_gate import hitl_gate
from agents.pipeline.completion import completion_node
from agents.pipeline.tools import log_agent_activity

_logger = logging.getLogger(__name__)
NODE_TIMEOUT_SECONDS = int(os.getenv("NODE_TIMEOUT_SECONDS", "120"))
_node_executor = ThreadPoolExecutor(max_workers=4)


def safe_node(node_fn, timeout: int | None = None):
    """Catches errors, enforces a timeout, and records latency for each node."""
    node_timeout = timeout or NODE_TIMEOUT_SECONDS

    @functools.wraps(node_fn)
    def wrapper(state: LendFlowState, **kwargs) -> dict:
        app_id = state.get("application_id", "unknown")
        start = time.monotonic()
        try:
            future = _node_executor.submit(node_fn, state, **kwargs)
            result = future.result(timeout=node_timeout)
            elapsed_ms = int((time.monotonic() - start) * 1000)
            log_agent_activity(
                app_id, node_fn.__name__, "node_timing",
                f"completed in {elapsed_ms}ms",
            )
            return result
        except FuturesTimeoutError:
            msg = f"{node_fn.__name__} timed out after {node_timeout}s"
            _logger.error(f"{msg} for {app_id}")
            log_agent_activity(app_id, node_fn.__name__, "timeout", msg)
            return {
                "last_error": msg,
                "messages": [{"role": "assistant", "content": msg}],
            }
        except Exception as e:
            err_str = str(e)[:500]
            try:
                log_agent_activity(app_id, node_fn.__name__, "error", err_str)
            except Exception:
                pass
            return {
                "last_error": err_str,
                "messages": [{"role": "assistant", "content": f"Error in {node_fn.__name__}: {err_str[:200]}"}],
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
    graph.add_node("doc_verifier", safe_node(doc_verifier_node))
    graph.add_node("credit_puller", safe_node(credit_puller_node))
    graph.add_node("loan_app", safe_node(loan_app_node))
    graph.add_node("underwriter", safe_node(underwriter_node))
    # hitl_gate is NOT wrapped with safe_node — it calls interrupt() which raises
    # GraphInterrupt, and safe_node's try/except would suppress the interrupt mechanism.
    graph.add_node("hitl_gate", hitl_gate)
    graph.add_node("complete", completion_node)

    graph.add_edge(START, "supervisor")
    graph.add_conditional_edges("supervisor", route_from_supervisor)
    graph.add_edge("doc_verifier", "loan_app")
    graph.add_edge("credit_puller", "loan_app")
    graph.add_edge("loan_app", "supervisor")
    graph.add_edge("underwriter", "supervisor")
    graph.add_edge("hitl_gate", "supervisor")
    graph.add_edge("complete", END)

    compiled = graph.compile(checkpointer=checkpointer)

    return compiled


atexit.register(lambda: _node_executor.shutdown(wait=False))

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
