"""Tests for parse_tool_response."""
import pytest
from bedrock.anthropic_chat_completions import parse_tool_response, ToolResponseError


def test_valid_tool_use():
    response = {
        "stopReason": "tool_use",
        "output": {"message": {"content": [
            {"toolUse": {"name": "underwriting_analysis", "input": {"confidence": "high"}}}
        ]}},
    }
    result = parse_tool_response(response, "underwriting_analysis")
    assert result == {"confidence": "high"}


def test_text_fallback():
    response = {
        "stopReason": "end_turn",
        "output": {"message": {"content": [{"text": "Here is my analysis."}]}},
    }
    result = parse_tool_response(response)
    assert result is None


def test_max_tokens_raises():
    response = {
        "stopReason": "max_tokens",
        "output": {"message": {"content": []}},
    }
    with pytest.raises(ToolResponseError, match="truncated"):
        parse_tool_response(response)


def test_wrong_tool_name_raises():
    response = {
        "stopReason": "tool_use",
        "output": {"message": {"content": [
            {"toolUse": {"name": "wrong_tool", "input": {}}}
        ]}},
    }
    with pytest.raises(ToolResponseError, match="Expected tool"):
        parse_tool_response(response, "underwriting_analysis")


def test_missing_input_raises():
    response = {
        "stopReason": "tool_use",
        "output": {"message": {"content": [
            {"toolUse": {"name": "underwriting_analysis"}}
        ]}},
    }
    with pytest.raises(ToolResponseError, match="no input"):
        parse_tool_response(response, "underwriting_analysis")
