"""Shared LLM singleton for all agents."""

from bedrock.anthropic_chat_completions import BedrockAnthropicChatCompletions

_llm = None


def get_llm():
    """Get or create the singleton Bedrock LLM client."""
    global _llm
    if _llm is None:
        _llm = BedrockAnthropicChatCompletions()
    return _llm
