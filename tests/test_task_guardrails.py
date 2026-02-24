"""Tests for CrewAI native task guardrails.

Tests cover:
- validate_structured_output: accepts valid JSON, Final Answer, long text; rejects short/empty
- validate_gbv_output: accepts with emergency numbers; rejects without
- Crew guardrail hook: GBVCrew returns validate_gbv_output, MunicipalCrew returns validate_structured_output
"""
import os

os.environ.setdefault("OPENAI_API_KEY", "dummy")

import pytest
from unittest.mock import MagicMock

from src.agents.crews.base_crew import validate_structured_output, validate_gbv_output


# ---------------------------------------------------------------------------
# validate_structured_output
# ---------------------------------------------------------------------------

class TestValidateStructuredOutput:
    """Tests for the default crew guardrail."""

    def test_accepts_json_with_message(self):
        """JSON containing "message" key with >= 10 chars accepted."""
        result = MagicMock()
        result.__str__ = lambda _: '{"message": "Hello citizen, your ticket has been logged."}'
        accepted, val = validate_structured_output(result)
        assert accepted is True

    def test_accepts_final_answer_with_text(self):
        """'Final Answer:' with meaningful text accepted."""
        result = MagicMock()
        result.__str__ = lambda _: "Final Answer: Hello, I am Gugu and I can help you."
        accepted, val = validate_structured_output(result)
        assert accepted is True

    def test_accepts_long_raw_text(self):
        """Raw text >= 20 chars accepted."""
        result = MagicMock()
        result.__str__ = lambda _: "I am here to help you with your municipal service request today."
        accepted, val = validate_structured_output(result)
        assert accepted is True

    def test_rejects_empty_output(self):
        """Empty output rejected."""
        result = MagicMock()
        result.__str__ = lambda _: ""
        accepted, val = validate_structured_output(result)
        assert accepted is False
        assert "too short" in val.lower()

    def test_rejects_short_output(self):
        """Output < 20 chars rejected."""
        result = MagicMock()
        result.__str__ = lambda _: "Hi"
        accepted, val = validate_structured_output(result)
        assert accepted is False

    def test_rejects_none_result(self):
        """None result rejected."""
        accepted, val = validate_structured_output(None)
        assert accepted is False

    def test_accepts_exactly_20_chars(self):
        """Exactly 20 chars accepted."""
        result = MagicMock()
        result.__str__ = lambda _: "12345678901234567890"
        accepted, val = validate_structured_output(result)
        assert accepted is True

    def test_rejects_19_chars(self):
        """19 chars rejected."""
        result = MagicMock()
        result.__str__ = lambda _: "1234567890123456789"
        accepted, val = validate_structured_output(result)
        assert accepted is False

    def test_accepts_json_with_short_surrounding_text(self):
        """JSON with message key >= 10 chars accepted even if surrounding text short."""
        result = MagicMock()
        result.__str__ = lambda _: '{"message": "Your report has been submitted successfully"}'
        accepted, val = validate_structured_output(result)
        assert accepted is True


# ---------------------------------------------------------------------------
# validate_gbv_output
# ---------------------------------------------------------------------------

class TestValidateGbvOutput:
    """Tests for the GBV-specific guardrail."""

    def test_accepts_with_saps_number(self):
        """Output containing 10111 accepted."""
        result = MagicMock()
        result.__str__ = lambda _: "Please call 10111 if in immediate danger."
        accepted, val = validate_gbv_output(result)
        assert accepted is True

    def test_accepts_with_gbv_helpline(self):
        """Output containing 0800 150 150 accepted."""
        result = MagicMock()
        result.__str__ = lambda _: "Contact the GBV Command Centre at 0800 150 150 for support."
        accepted, val = validate_gbv_output(result)
        assert accepted is True

    def test_accepts_with_both_numbers(self):
        """Output containing both numbers accepted."""
        result = MagicMock()
        result.__str__ = lambda _: "Call 10111 for emergency. GBV helpline: 0800 150 150."
        accepted, val = validate_gbv_output(result)
        assert accepted is True

    def test_rejects_without_emergency_numbers(self):
        """Output without emergency numbers rejected."""
        result = MagicMock()
        result.__str__ = lambda _: "I can help you with your report."
        accepted, val = validate_gbv_output(result)
        assert accepted is False
        assert "emergency contact numbers" in val.lower()

    def test_rejects_empty_output(self):
        """Empty GBV output rejected."""
        result = MagicMock()
        result.__str__ = lambda _: ""
        accepted, val = validate_gbv_output(result)
        assert accepted is False

    def test_rejects_none_result(self):
        """None result rejected."""
        accepted, val = validate_gbv_output(None)
        assert accepted is False


# ---------------------------------------------------------------------------
# Crew guardrail hook returns
# ---------------------------------------------------------------------------

class TestCrewGuardrailHook:
    """Verify each crew returns the correct guardrail function."""

    def test_gbv_crew_returns_gbv_guardrail(self):
        from src.agents.crews.gbv_crew import GBVCrew
        crew = GBVCrew(language="en", llm=None)
        guardrail = crew.get_task_guardrail({})
        assert guardrail is validate_gbv_output

    def test_municipal_crew_returns_structured_guardrail(self):
        from src.agents.crews.municipal_crew import MunicipalCrew
        crew = MunicipalCrew(language="en", llm=None)
        guardrail = crew.get_task_guardrail({})
        assert guardrail is validate_structured_output

    def test_base_crew_default_is_structured_guardrail(self):
        """BaseCrew.get_task_guardrail default returns validate_structured_output."""
        from src.agents.crews.municipal_crew import MunicipalCrew
        # MunicipalCrew doesn't override get_task_guardrail, so it inherits default
        crew = MunicipalCrew(language="en", llm=None)
        guardrail = crew.get_task_guardrail({"message": "test"})
        assert guardrail is validate_structured_output
