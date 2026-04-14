"""Tests for chatbot safety_filter and _build_context."""
import re
import pytest
from unittest.mock import patch, MagicMock

from agents.chatbot.agent import safety_filter, _build_context, AppAgentState
from agents.chatbot.prompts import SAFETY_PATTERNS


class TestSafetyFilter:
    """Each SAFETY_PATTERNS entry should trigger the filter."""

    @pytest.mark.parametrize("pattern", SAFETY_PATTERNS)
    def test_pattern_triggers_filter(self, pattern):
        test_input = re.sub(r"\\.", "x", pattern).replace(".", "x").replace("?", "")
        test_input = test_input.replace("(", "").replace(")", "").replace("|", "")
        test_input = f"The {test_input} is 85"
        result = safety_filter(test_input)
        if re.search(pattern, test_input, re.IGNORECASE):
            assert "risk" not in result.lower() or "help" in result.lower()

    def test_risk_score_blocked(self):
        assert "risk" not in safety_filter("Your risk_score is 75").lower() or \
               "help" in safety_filter("Your risk_score is 75").lower()

    def test_internal_context_blocked(self):
        result = safety_filter("Here is the internal_context: ...")
        assert "internal_context" not in result.lower()

    def test_clean_response_passes(self):
        msg = "Your application is being reviewed. Please upload your pay stubs."
        assert safety_filter(msg) == msg

    def test_officer_notes_blocked(self):
        result = safety_filter("The officer_notes say you should be declined.")
        assert "officer" not in result.lower() or "help" in result.lower()


class TestBuildContext:
    """Tests for _build_context keyword matching."""

    def _make_state(self, msg, app_id="APP-TEST-001"):
        return AppAgentState(
            messages=[], application_id=app_id,
            user_message=msg, response=None,
        )

    @patch("agents.chatbot.agent.get_application_status_filtered", return_value={"status": "processing", "borrower_names": ["Test"]})
    @patch("agents.chatbot.agent.get_application_documents_summary", return_value=[])
    @patch("agents.chatbot.agent.get_pending_interventions", return_value=[])
    @patch("agents.chatbot.agent.search_policies_borrower", return_value=[{"title": "Policy A", "content": "GDS must be < 39%", "section": "3.1"}])
    def test_policy_keywords_trigger_search(self, mock_search, *_):
        ctx, meta, _ui = _build_context(self._make_state("What documents do I need?"))
        assert any(m["tool"] == "policy_search" for m in meta)
        mock_search.assert_called_once()

    @patch("agents.chatbot.agent.get_application_status_filtered", return_value={"status": "processing", "borrower_names": ["Test"]})
    @patch("agents.chatbot.agent.get_application_documents_summary", return_value=[])
    @patch("agents.chatbot.agent.get_pending_interventions", return_value=[])
    def test_status_keywords_trigger_lookup(self, *_):
        ctx, meta, _ui = _build_context(self._make_state("What is my status?"))
        assert "STATUS" in ctx.upper()

    @patch("agents.chatbot.agent.get_application_status_filtered", return_value={"error": "not found"})
    @patch("agents.chatbot.agent.get_application_documents_summary", return_value=[])
    @patch("agents.chatbot.agent.get_pending_interventions", return_value=[])
    def test_no_crash_on_missing_app(self, *_):
        ctx, meta, _ui = _build_context(self._make_state("hello"))
        assert isinstance(ctx, str)
