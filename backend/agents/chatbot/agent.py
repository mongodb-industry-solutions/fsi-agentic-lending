"""User-facing Application Agent -- helps borrowers through the lending process.

This is a conversational agent (not a pipeline). It:
1. Receives a user message
2. Gathers context from tools (RAG, status, interventions)
3. Generates a response using Bedrock Claude
4. Passes through a safety filter
5. Returns the response
"""
import re
import json
import logging
from typing import TypedDict, Optional

from agents.llm import get_llm
from agents.chatbot.prompts import APPLICATION_AGENT_SYSTEM_PROMPT, SAFETY_PATTERNS
from agents.chatbot.tools import (
    search_policies_borrower,
    get_document_requirements,
    get_application_status_filtered,
    get_application_documents_summary,
    get_pending_interventions,
)

logger = logging.getLogger(__name__)


class AppAgentState(TypedDict):
    """State for a single application agent turn."""
    messages: list
    application_id: Optional[str]
    user_message: str
    response: Optional[str]


def _build_context(state: AppAgentState) -> tuple[str, list[dict]]:
    """Build context string from available tools based on user message.

    Returns:
        Tuple of (context_string, tool_metadata) where tool_metadata is a list
        of dicts describing which tools were called and what they found.
    """
    user_msg = state["user_message"].lower()
    app_id = state.get("application_id")
    context_parts = []
    tool_metadata = []

    if app_id:
        try:
            app_info = get_application_status_filtered(app_id)
            if "error" not in app_info:
                names = ", ".join(app_info.get("borrower_names", []))
                context_parts.append(
                    f"APPLICATION INFO:\n"
                    f"Borrower(s): {names}\n"
                    f"Product: {app_info.get('product', 'N/A')}\n"
                    f"Loan Amount: ${app_info.get('loan_amount', 0):,.0f}\n"
                    f"Status: {app_info.get('status', 'unknown')}"
                )
                tool_metadata.append({
                    "tool": "application_status",
                    "label": "Checking application status",
                    "found": 1,
                })
        except Exception as e:
            logger.warning(f"Application info lookup failed: {e}")

        try:
            doc_summary = get_application_documents_summary(app_id)
            if doc_summary:
                doc_list = "\n".join(f"- {d.get('doc_type', 'unknown')}: {d.get('status', 'unknown')}" for d in doc_summary)
                context_parts.append(f"SUBMITTED DOCUMENTS ({len(doc_summary)} total):\n{doc_list}")
                tool_metadata.append({
                    "tool": "document_inventory",
                    "label": "Reviewing submitted documents",
                    "found": len(doc_summary),
                })
        except Exception as e:
            logger.warning(f"Document summary lookup failed: {e}")

    if app_id:
        try:
            interventions = get_pending_interventions(app_id)
            if interventions:
                context_parts.append(
                    f"PENDING ACTION ITEMS:\n{json.dumps(interventions, default=str, indent=2)}"
                )
                tool_metadata.append({
                    "tool": "interventions",
                    "label": "Checking pending action items",
                    "found": len(interventions),
                })
        except Exception as e:
            logger.warning(f"Intervention lookup failed: {e}")

    policy_keywords = [
        "document", "require", "need", "policy", "qualify", "eligible",
        "accept", "alternative", "replace", "what if", "can i", "do i need",
        "how", "criteria", "rule", "minimum", "maximum", "limit",
    ]
    citations = []
    if any(kw in user_msg for kw in policy_keywords):
        try:
            policies = search_policies_borrower(state["user_message"], limit=3)
            if policies:
                policy_text = "\n".join(
                    [
                        f"- {p.get('title', 'Policy')}: {p.get('content', '')[:500]}"
                        for p in policies
                    ]
                )
                context_parts.append(f"RELEVANT POLICIES:\n{policy_text}")
                citations = [
                    {
                        "title": p.get("title", "Lending Policy"),
                        "section": p.get("section", ""),
                        "score": round(p.get("score", 0), 3),
                    }
                    for p in policies
                ]
                tool_metadata.append({
                    "tool": "policy_search",
                    "label": "Searching lending policies",
                    "found": len(policies),
                    "citations": citations,
                })
        except Exception as e:
            logger.warning(f"Policy search failed: {e}")

    doc_keywords = [
        "document", "upload", "file", "paper", "proof",
        "need to provide", "what do i need", "checklist",
    ]
    if any(kw in user_msg for kw in doc_keywords):
        reqs = get_document_requirements()
        req_text = "\n".join(
            [
                f"- {r['label']}: {r['description']} "
                f"({'Required' if r['required'] else 'May be required'})"
                for r in reqs
            ]
        )
        context_parts.append(f"DOCUMENT REQUIREMENTS:\n{req_text}")
        tool_metadata.append({
            "tool": "document_requirements",
            "label": "Loading document requirements",
            "found": len(reqs),
        })

    status_keywords = [
        "status", "where", "progress", "update", "stage",
        "how long", "when", "timeline", "waiting",
    ]
    if app_id and any(kw in user_msg for kw in status_keywords):
        try:
            status = get_application_status_filtered(app_id)
            if "error" not in status:
                context_parts.append(
                    f"APPLICATION STATUS:\n{json.dumps(status, default=str, indent=2)}"
                )
        except Exception as e:
            logger.warning(f"Status lookup failed: {e}")

    context_str = "\n\n".join(context_parts) if context_parts else ""
    return context_str, tool_metadata


def safety_filter(response: str) -> str:
    """Check response against safety patterns. Returns filtered response.

    If any pattern matches, the entire response is replaced with a safe
    fallback. This is a defense-in-depth measure — the system prompt
    should prevent most leaks, but this catches edge cases.
    """
    for pattern in SAFETY_PATTERNS:
        if re.search(pattern, response, re.IGNORECASE):
            logger.warning(f"Safety filter triggered on pattern: {pattern}")
            return (
                "I can help you with information about your application process, "
                "document requirements, and general lending policies. "
                "What would you like to know?"
            )
    if "internal_context" in response.lower():
        logger.error("CRITICAL: internal_context leaked in response")
        return "I can help you with your application. What would you like to know?"
    return response


def _prepare_llm_messages(application_id, user_message, history):
    """Shared logic for building the LLM messages list (used by both chat and chat_stream).

    Returns:
        Tuple of (messages, tool_metadata) where tool_metadata describes
        which tools were consulted during context building.
    """
    state = AppAgentState(
        messages=history or [],
        application_id=application_id,
        user_message=user_message,
        response=None,
    )

    context, tool_metadata = _build_context(state)

    user_prompt = user_message
    if context:
        user_prompt = (
            f"{user_message}\n\n---\n"
            f"[CONTEXT FOR ASSISTANT -- do not repeat verbatim to user]\n{context}"
        )

    recent_history = (history or [])[-20:]
    messages = []
    for msg in recent_history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if messages and messages[-1]["role"] == role:
            messages[-1]["content"] += f"\n\n{content}"
        else:
            messages.append({"role": role, "content": content})

    if messages and messages[-1]["role"] == "user":
        messages[-1]["content"] += f"\n\n{user_prompt}"
    else:
        messages.append({"role": "user", "content": user_prompt})

    return messages, tool_metadata


def chat_stream(
    application_id: Optional[str],
    user_message: str,
    history: list[dict] = None,
):
    """Stream the agent response token-by-token.

    Yields dicts: first a list of tool_call events, then text chunks,
    then a final done event.
    """
    llm = get_llm()
    messages, tool_metadata = _prepare_llm_messages(application_id, user_message, history)

    if tool_metadata:
        yield {"type": "tool_calls", "tools": tool_metadata}

    try:
        for chunk in llm.stream_messages(
            messages=messages,
            system_prompt=APPLICATION_AGENT_SYSTEM_PROMPT,
        ):
            yield chunk
    except Exception as e:
        logger.error(f"LLM stream failed: {e}")
        yield "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment."


def chat(
    application_id: Optional[str],
    user_message: str,
    history: list[dict] = None,
) -> str:
    """Process a user message and return the agent response.

    Args:
        application_id: The application ID (None for pre-submission queries).
        user_message: The current user message.
        history: Previous conversation messages [{role, content}].

    Returns:
        The agent's response string, safety-filtered.
    """
    llm = get_llm()
    messages, _tool_metadata = _prepare_llm_messages(application_id, user_message, history)

    try:
        response = llm.predict_messages(
            messages=messages,
            system_prompt=APPLICATION_AGENT_SYSTEM_PROMPT,
        )
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        response = (
            "I'm sorry, I'm having trouble processing your request right now. "
            "Please try again in a moment."
        )

    response = safety_filter(response)
    return response
