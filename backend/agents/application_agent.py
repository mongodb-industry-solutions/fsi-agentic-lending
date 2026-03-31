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

from bedrock.anthropic_chat_completions import BedrockAnthropicChatCompletions
from agents.app_agent_prompts import APPLICATION_AGENT_SYSTEM_PROMPT, SAFETY_PATTERNS
from agents.app_agent_tools import (
    search_policies_borrower,
    get_document_requirements,
    get_application_status_filtered,
    get_pending_interventions,
)

logger = logging.getLogger(__name__)

_llm = None


def _get_llm():
    """Get or create the singleton Bedrock LLM client."""
    global _llm
    if _llm is None:
        _llm = BedrockAnthropicChatCompletions()
    return _llm


class AppAgentState(TypedDict):
    """State for a single application agent turn."""
    messages: list                          # conversation history [{role, content}]
    application_id: Optional[str]
    user_message: str                       # current user input
    response: Optional[str]                 # agent response


def _build_context(state: AppAgentState) -> str:
    """Build context string from available tools based on user message.

    Determines which tools to call based on keyword matching in the user
    message, then assembles the results into a structured context block
    that is appended to the LLM prompt (but never shown verbatim to the user).
    """
    user_msg = state["user_message"].lower()
    app_id = state.get("application_id")
    context_parts = []

    # Check for pending interventions first (highest priority)
    if app_id:
        try:
            interventions = get_pending_interventions(app_id)
            if interventions:
                context_parts.append(
                    f"PENDING ACTION ITEMS:\n{json.dumps(interventions, default=str, indent=2)}"
                )
        except Exception as e:
            logger.warning(f"Intervention lookup failed: {e}")

    # RAG: search policies for relevant questions
    policy_keywords = [
        "document", "require", "need", "policy", "qualify", "eligible",
        "accept", "alternative", "replace", "what if", "can i", "do i need",
        "how", "criteria", "rule", "minimum", "maximum", "limit",
    ]
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
        except Exception as e:
            logger.warning(f"Policy search failed: {e}")

    # Document requirements
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

    # Application status
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

    return "\n\n".join(context_parts) if context_parts else ""


def _safety_filter(response: str) -> str:
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


def chat(
    application_id: Optional[str],
    user_message: str,
    history: list[dict] = None,
) -> str:
    """Process a user message and return the agent response.

    This is the main entry point -- called by the chat route.

    Args:
        application_id: The application ID (None for pre-submission queries).
        user_message: The current user message.
        history: Previous conversation messages [{role, content}].

    Returns:
        The agent's response string, safety-filtered.
    """
    llm = _get_llm()

    state = AppAgentState(
        messages=history or [],
        application_id=application_id,
        user_message=user_message,
        response=None,
    )

    # Build context from tools
    context = _build_context(state)

    # Build the user prompt with context
    user_prompt = user_message
    if context:
        user_prompt = (
            f"{user_message}\n\n---\n"
            f"[CONTEXT FOR ASSISTANT -- do not repeat verbatim to user]\n{context}"
        )

    # Build conversation for LLM using the proper messages API
    # Keep last 10 turns for continuity (20 messages: 10 user + 10 assistant)
    recent_history = (history or [])[-20:]

    messages = []
    for msg in recent_history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        # Anthropic API requires alternating user/assistant messages
        # Skip if would create consecutive same-role messages
        if messages and messages[-1]["role"] == role:
            messages[-1]["content"] += f"\n\n{content}"
        else:
            messages.append({"role": role, "content": content})

    # Add current user message
    if messages and messages[-1]["role"] == "user":
        messages[-1]["content"] += f"\n\n{user_prompt}"
    else:
        messages.append({"role": "user", "content": user_prompt})

    # Call LLM
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

    # Safety filter
    response = _safety_filter(response)

    return response
