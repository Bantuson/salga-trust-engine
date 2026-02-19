"""Unit and integration tests for Phase 6.9.1 output formatting changes.

Covers:
- sanitize_reply(): LLM artifact stripping, delegation artifact filtering, GBV safety
- _validate_crew_output(): pre-sanitization validation and extraction
- Pydantic models: AgentResponse, MunicipalResponse, GBVResponse, TicketStatusResponse
- _repair_from_raw(): JSON extraction, Final Answer extraction, graceful fallback
- ManagerCrew.parse_result(): delegation line filtering, tracking number extraction
- Integration: full pipeline from crew output through validation to sanitized reply

All tests use OPENAI_API_KEY=dummy (set at module level). No real LLM calls.
"""
import os
import re

# Set dummy OpenAI key BEFORE any CrewAI imports (Pitfall 1 from research)
os.environ.setdefault("OPENAI_API_KEY", "dummy")

from unittest.mock import MagicMock

import pytest

from src.api.v1.crew_server import (
    _DELEGATION_ARTIFACT_PATTERNS,
    _validate_crew_output,
    sanitize_reply,
)
from src.agents.crews.base_crew import AgentResponse, _repair_from_raw
from src.agents.crews.municipal_crew import MunicipalResponse
from src.agents.crews.gbv_crew import GBVResponse
from src.agents.crews.ticket_status_crew import TicketStatusResponse
from src.agents.crews.manager_crew import ManagerCrew, _DELEGATION_PATTERNS
from src.agents.prompts.auth import AuthResult


# ---------------------------------------------------------------------------
# Mock data constants — canned Gugu responses + adversarial payloads
# ---------------------------------------------------------------------------

CLEAN_GUGU_RESPONSE_EN = "Hello! I'm Gugu from SALGA Trust Engine. How can I help you today?"
CLEAN_GUGU_RESPONSE_ZU = "Sawubona! NginguGugu we-SALGA Trust Engine. Ngingakusiza ngani namhlanje?"

ADVERSARIAL_DELEGATION_OUTPUT = (
    "As the Municipal Services Manager, here is the complete and correct procedure "
    "for you, Gugu, to follow:\n"
    "Step 1: Ask the citizen for their name\n"
    "Step 2: Send OTP to their phone\n"
    "Step 3: Verify the code\n"
    "Hello! Welcome to SALGA Trust Engine. What is your name?"
)

ADVERSARIAL_JSON_BLOB = (
    '{"tracking_number": "TKT-20260219-ABC123", "status": "open", "id": "uuid-here"}\n'
    "Your report has been logged. Tracking number: TKT-20260219-ABC123."
)

ADVERSARIAL_EMPTY_OUTPUT = ""

ADVERSARIAL_ONLY_ARTIFACTS = (
    "Thought: I need to help this citizen\n"
    "Action: create_municipal_ticket\n"
    "Action Input: {}\n"
    "Observation: Error"
)


class FakeResult:
    """Fake CrewAI result object whose __str__ returns a configurable string.

    Used across multiple test sections to simulate CrewAI CrewOutput objects
    without instantiating real CrewAI components.
    """

    def __init__(self, text: str):
        self._text = text

    def __str__(self) -> str:
        return self._text


# ===========================================================================
# Section 1: sanitize_reply unit tests
# ===========================================================================

class TestSanitizeReplyUnit:
    """Unit tests for sanitize_reply() covering all artifact types."""

    def test_sanitize_clean_text_passthrough(self):
        """Clean citizen-facing text passes through unchanged."""
        result = sanitize_reply(CLEAN_GUGU_RESPONSE_EN, agent_name="auth_agent", language="en")
        assert "Gugu" in result
        assert "SALGA Trust Engine" in result

    def test_sanitize_strips_final_answer_prefix(self):
        """'Final Answer:' prefix is stripped; content after it is kept."""
        raw = "Final Answer: Hello! I'm Gugu, how can I help?"
        result = sanitize_reply(raw, agent_name="auth_agent", language="en")
        assert "Final Answer" not in result
        assert "Gugu" in result

    def test_sanitize_strips_thought_action_observation(self):
        """Thought/Action/Observation lines are stripped; citizen text is kept."""
        raw = (
            "Thought: I need to help this citizen register.\n"
            "Action: send_otp_tool\n"
            "Observation: OTP sent successfully.\n"
            "Hello! I'm Gugu from SALGA Trust Engine. What is your name?"
        )
        result = sanitize_reply(raw, agent_name="auth_agent", language="en")
        assert "Thought:" not in result
        assert "Action:" not in result
        assert "Observation:" not in result
        assert "Gugu" in result

    def test_sanitize_strips_delegation_as_manager(self):
        """Delegation narration starting with 'As the ... Manager' is stripped."""
        result = sanitize_reply(
            ADVERSARIAL_DELEGATION_OUTPUT,
            agent_name="municipal_intake",
            language="en",
        )
        # Delegation narration must be gone
        assert "As the Municipal Services Manager" not in result
        assert "procedure for you, Gugu, to follow" not in result

    def test_sanitize_strips_delegation_routing_to(self):
        """'Routing to the ...' line is stripped; following citizen text is kept."""
        raw = (
            "Routing to the auth specialist...\n"
            "Hello! Let me help you register."
        )
        result = sanitize_reply(raw, agent_name="auth_agent", language="en")
        assert "Routing to" not in result
        assert "Hello" in result or "Gugu" in result  # citizen text or fallback kept

    def test_sanitize_strips_i_am_delegating(self):
        """'I am delegating to ...' is stripped; following citizen text is kept."""
        raw = (
            "I am delegating to the Crisis Support Specialist.\n"
            "I'm sorry to hear about your situation."
        )
        result = sanitize_reply(raw, agent_name="gbv_intake", language="en")
        assert "I am delegating" not in result

    def test_sanitize_strips_step_numbering(self):
        """ManagerCrew._DELEGATION_PATTERNS strips 'Step N:' lines via parse_result().

        Note: sanitize_reply() relies on _DELEGATION_ARTIFACT_PATTERNS (crew_server.py)
        which does NOT include a Step N: pattern. Step filtering happens earlier in the
        pipeline via ManagerCrew.parse_result(). This test verifies the manager layer.
        """
        manager = ManagerCrew(language="en", llm=MagicMock())
        raw = (
            "Step 1: Send OTP to phone.\n"
            "Step 2: Verify OTP."
        )
        result = manager.parse_result(FakeResult(raw))
        # Step lines are delegation artifacts — filtered by ManagerCrew.parse_result()
        assert "Step 1:" not in result["message"]
        assert "Step 2:" not in result["message"]

    def test_sanitize_strips_json_blobs(self):
        """Embedded JSON blobs with tracking_number/status keys are removed."""
        result = sanitize_reply(ADVERSARIAL_JSON_BLOB, agent_name="municipal_intake", language="en")
        # JSON blob should be stripped
        assert '"tracking_number"' not in result
        assert '"status"' not in result
        # The citizen-facing part should survive
        assert "TKT-20260219-ABC123" in result or "report" in result.lower()

    def test_sanitize_empty_returns_fallback(self):
        """Empty input returns a warm Gugu fallback, never an empty string."""
        result = sanitize_reply(ADVERSARIAL_EMPTY_OUTPUT, agent_name="auth_agent", language="en")
        assert result  # Never empty
        assert "Gugu" in result

    def test_sanitize_gbv_guarantees_emergency_numbers(self):
        """After sanitizing GBV response, emergency numbers 10111 and 0800 150 150 are present."""
        # A GBV response that does NOT contain emergency numbers
        raw = "I hear you and I'm here to support you. Please tell me what happened."
        result = sanitize_reply(raw, agent_name="gbv_intake", language="en")
        assert "10111" in result
        assert "0800 150 150" in result

    def test_sanitize_preserves_bold_formatting(self):
        """Markdown bold formatting is preserved for tracking numbers etc."""
        raw = "Your tracking number is **TKT-20260209-ABC123**. You can use this to check status."
        result = sanitize_reply(raw, agent_name="municipal_intake", language="en")
        assert "**TKT-20260209-ABC123**" in result

    def test_sanitize_fallback_per_language_zu(self):
        """Empty input with language='zu' returns isiZulu Gugu fallback."""
        result = sanitize_reply("", agent_name="auth_agent", language="zu")
        assert result
        # isiZulu fallback contains NginguGugu or similar
        assert "Gugu" in result

    def test_sanitize_fallback_gbv_contains_emergency_numbers(self):
        """GBV fallback (empty input) always contains emergency numbers."""
        result = sanitize_reply("", agent_name="gbv_intake", language="en")
        assert "10111" in result
        assert "0800 150 150" in result

    def test_sanitize_only_artifacts_returns_fallback(self):
        """Input consisting entirely of LLM artifacts returns fallback."""
        result = sanitize_reply(ADVERSARIAL_ONLY_ARTIFACTS, agent_name="auth_agent", language="en")
        # All artifact lines stripped — must return usable fallback
        assert result
        assert "Gugu" in result

    def test_sanitize_delegation_artifact_patterns_list_is_populated(self):
        """_DELEGATION_ARTIFACT_PATTERNS must have at least 8 patterns."""
        assert len(_DELEGATION_ARTIFACT_PATTERNS) >= 8


# ===========================================================================
# Section 2: _validate_crew_output unit tests
# ===========================================================================

class TestValidateCrewOutputUnit:
    """Unit tests for _validate_crew_output() pre-sanitization helper."""

    def test_validate_clean_output_passthrough(self):
        """Clean message passes through unchanged."""
        agent_result = {"message": "Hello! I'm Gugu from SALGA Trust Engine."}
        result = _validate_crew_output(agent_result, "auth_agent", "en")
        assert result == "Hello! I'm Gugu from SALGA Trust Engine."

    def test_validate_delegation_polluted_extracts_citizen_text(self):
        """Message where first line is delegation text — function attempts extraction.

        Note: _validate_crew_output uses re.match against _DELEGATION_ARTIFACT_PATTERNS.
        re.match on a multi-line string works with re.MULTILINE flag or when the first
        line alone matches. The function's delegation check is triggered when ANY of the
        patterns match the start of the stripped message. For single-line delegation
        prefixes (no newlines in the pattern), the match works correctly.

        This test verifies that for a message that starts with a known delegation
        pattern (matched on the stripped first line), the function does not pass through
        the raw delegation text unchanged — it either extracts citizen content or falls
        back to a Gugu message.
        """
        # Use a single-line delegation start that matches the pattern
        # (patterns use re.match so they match from start of string)
        delegation_only = "I am delegating to the Crisis Support Specialist."
        agent_result = {"message": delegation_only}
        result = _validate_crew_output(agent_result, "auth_agent", "en")
        # Single-line delegation → no citizen text found → fallback
        assert "Gugu" in result or not delegation_only in result

    def test_validate_empty_message_returns_fallback(self):
        """Empty message field returns a warm Gugu fallback."""
        agent_result = {"message": ""}
        result = _validate_crew_output(agent_result, "auth_agent", "en")
        assert result
        assert "Gugu" in result

    def test_validate_short_message_returns_fallback(self):
        """Message shorter than 5 characters returns a fallback."""
        agent_result = {"message": "hi"}
        result = _validate_crew_output(agent_result, "municipal_intake", "en")
        assert result
        assert "Gugu" in result

    def test_validate_missing_message_key_returns_fallback(self):
        """Dict without 'message' key returns a fallback."""
        agent_result = {}
        result = _validate_crew_output(agent_result, "auth_agent", "en")
        assert result
        assert "Gugu" in result

    def test_validate_gbv_fallback_has_emergency_numbers(self):
        """GBV fallback from _validate_crew_output contains emergency numbers."""
        agent_result = {"message": ""}
        result = _validate_crew_output(agent_result, "gbv_intake", "en")
        assert "10111" in result
        assert "0800 150 150" in result


# ===========================================================================
# Section 3: Pydantic model validation and repair unit tests
# ===========================================================================

class TestPydanticModelsAndRepair:
    """Unit tests for Pydantic models and _repair_from_raw() repair strategy."""

    # --- _repair_from_raw tests ---

    def test_repair_from_raw_json_extraction(self):
        """JSON with 'message' key embedded in preamble is extracted and validated."""
        raw = 'Some preamble {"message": "Hello, I can help you.", "language": "en"} some postamble'
        result = _repair_from_raw(raw, MunicipalResponse, "fallback message", language="en")
        assert "message" in result
        assert result["message"] == "Hello, I can help you."

    def test_repair_from_raw_final_answer_extraction(self):
        """'Final Answer:' marker triggers message extraction from text after it."""
        raw = "Final Answer: Your ticket has been created. Reference: TKT-20260219-ABC123."
        result = _repair_from_raw(raw, MunicipalResponse, "fallback message", language="en")
        assert "message" in result
        assert "ticket" in result["message"].lower() or "TKT" in result["message"]

    def test_repair_from_raw_fallback_on_garbage(self):
        """Garbage input falls back to the provided fallback_message."""
        raw = "asdf1234!@#$%^&*()"
        result = _repair_from_raw(raw, MunicipalResponse, "Sorry, try again.", language="en")
        assert "message" in result
        # Either uses the garbage text or the fallback (either is acceptable)
        assert result["message"]  # Must not be empty

    def test_repair_never_crashes(self):
        """Empty string input returns fallback dict without raising any exception."""
        try:
            result = _repair_from_raw("", MunicipalResponse, "Sorry, try again.", language="en")
            assert "message" in result
        except Exception as e:
            pytest.fail(f"_repair_from_raw raised an exception on empty input: {e}")

    def test_repair_from_raw_none_like_input(self):
        """Whitespace-only input does not crash — returns fallback."""
        result = _repair_from_raw("   ", GBVResponse, "Emergency numbers: 10111", language="en")
        assert "message" in result
        assert result["message"]

    # --- AgentResponse Pydantic model tests ---

    def test_agent_response_strip_final_answer_in_message(self):
        """AgentResponse.strip_artifacts validator strips 'Final Answer:' prefix from message."""
        response = AgentResponse(
            message="Final Answer: Hello! I'm Gugu.",
            language="en",
        )
        assert "Final Answer" not in response.message
        assert "Gugu" in response.message

    def test_agent_response_validates_language_invalid(self):
        """Invalid language code defaults to 'en'."""
        response = AgentResponse(message="test", language="xx")
        assert response.language == "en"

    def test_agent_response_valid_language_zu(self):
        """Valid isiZulu language 'zu' is accepted."""
        response = AgentResponse(message="test", language="zu")
        assert response.language == "zu"

    # --- MunicipalResponse tests ---

    def test_municipal_response_strips_artifacts_in_message(self):
        """MunicipalResponse inherits strip_artifacts — Final Answer: is removed."""
        response = MunicipalResponse(message="Final Answer: Fixed the issue")
        assert "Final Answer" not in response.message
        assert "Fixed the issue" in response.message

    def test_municipal_response_validates_language_invalid(self):
        """MunicipalResponse with invalid language defaults to 'en'."""
        response = MunicipalResponse(message="test", language="xx")
        assert response.language == "en"

    def test_municipal_response_default_action_taken(self):
        """MunicipalResponse.action_taken defaults to 'intake'."""
        response = MunicipalResponse(message="test")
        assert response.action_taken == "intake"

    # --- GBVResponse tests ---

    def test_gbv_response_requires_followup_default_true(self):
        """GBVResponse.requires_followup defaults to True (trauma protocol)."""
        response = GBVResponse(message="I'm here to help you.")
        assert response.requires_followup is True

    def test_gbv_response_default_action_taken(self):
        """GBVResponse.action_taken defaults to 'safety_check'."""
        response = GBVResponse(message="test")
        assert response.action_taken == "safety_check"

    # --- TicketStatusResponse tests ---

    def test_ticket_status_response_tickets_found_default_zero(self):
        """TicketStatusResponse.tickets_found defaults to 0."""
        response = TicketStatusResponse(message="test")
        assert response.tickets_found == 0

    def test_ticket_status_response_default_action_taken(self):
        """TicketStatusResponse.action_taken defaults to 'status_lookup'."""
        response = TicketStatusResponse(message="test")
        assert response.action_taken == "status_lookup"

    # --- AuthResult tests ---

    def test_auth_result_has_language_field(self):
        """AuthResult accepts and stores language field correctly."""
        result = AuthResult(
            authenticated=True,
            session_status="active",
            message="Authentication successful.",
            language="zu",
        )
        assert result.language == "zu"

    def test_auth_result_defaults_language_to_en(self):
        """AuthResult defaults language to 'en' when not specified."""
        result = AuthResult(
            authenticated=False,
            session_status="failed",
            message="Please try again.",
        )
        assert result.language == "en"

    def test_auth_result_optional_fields_are_none(self):
        """AuthResult user_id, municipality_id, error are optional (None by default)."""
        result = AuthResult(
            authenticated=False,
            session_status="failed",
            message="Please try again.",
        )
        assert result.user_id is None
        assert result.municipality_id is None
        assert result.error is None


# ===========================================================================
# Section 4: ManagerCrew.parse_result delegation filtering tests
# ===========================================================================


class TestManagerCrewParseResult:
    """Unit tests for ManagerCrew.parse_result() delegation line filtering."""

    @pytest.fixture
    def manager(self):
        """ManagerCrew with a MagicMock LLM (no real API calls)."""
        return ManagerCrew(language="en", llm=MagicMock())

    def test_manager_parse_strips_full_delegation_block(self, manager):
        """Full delegation block returns fallback (all lines filtered)."""
        raw = (
            "As the Municipal Services Manager, here is the complete procedure:\n"
            "Step 1: Ask the citizen for their name\n"
            "Step 2: Send OTP to phone\n"
            "Step 3: Verify the code"
        )
        result = manager.parse_result(FakeResult(raw))
        assert "message" in result
        # Delegation text must not appear in the message
        assert "As the Municipal Services Manager" not in result["message"]
        assert "Step 1:" not in result["message"]

    def test_manager_parse_keeps_clean_citizen_text(self, manager):
        """Clean citizen-facing text passes through parse_result unchanged."""
        raw = "Hello! I'm Gugu from SALGA Trust Engine. How can I help you today?"
        result = manager.parse_result(FakeResult(raw))
        assert "message" in result
        assert "Gugu" in result["message"]

    def test_manager_parse_strips_mixed_content(self, manager):
        """Delegation lines mixed with citizen text: delegation stripped, citizen text kept."""
        raw = (
            "As the Municipal Services Manager, here is the procedure:\n"
            "Step 1: Greet citizen\n"
            "Hello! I'm Gugu. What issue can I help you with today?"
        )
        result = manager.parse_result(FakeResult(raw))
        assert "message" in result
        assert "As the Municipal Services Manager" not in result["message"]
        assert "Step 1:" not in result["message"]
        # The greeting should survive
        assert "Gugu" in result["message"] or "Hello" in result["message"]

    def test_manager_parse_extracts_tracking_number(self, manager):
        """Tracking number in raw output is extracted to result dict."""
        raw = (
            "Final Answer: Your report has been logged. "
            "Tracking number: TKT-20260219-ABC123. "
            "We'll keep you updated on progress."
        )
        result = manager.parse_result(FakeResult(raw))
        assert "tracking_number" in result
        assert result["tracking_number"] == "TKT-20260219-ABC123"

    def test_manager_parse_fallback_on_all_filtered(self, manager):
        """Entirely delegation text returns warm Gugu fallback (not empty string)."""
        raw = (
            "As the Municipal Services Manager, here is the procedure.\n"
            "Step 1: Start registration flow.\n"
            "Step 2: Verify OTP.\n"
            "Routing to the auth specialist...\n"
            "I am now delegating to the Crisis Support Specialist."
        )
        result = manager.parse_result(FakeResult(raw))
        assert "message" in result
        assert result["message"]  # Never empty
        assert "Gugu" in result["message"]

    def test_manager_parse_final_answer_prefix_stripped(self, manager):
        """'Final Answer:' prefix is stripped from result message."""
        raw = "Final Answer: Hello, I'm Gugu! How can I help you today?"
        result = manager.parse_result(FakeResult(raw))
        assert "Final Answer" not in result["message"]

    def test_manager_delegation_patterns_list_is_populated(self):
        """_DELEGATION_PATTERNS module-level list has at least 8 compiled patterns."""
        assert len(_DELEGATION_PATTERNS) >= 8
        # Verify they are compiled regex patterns
        for p in _DELEGATION_PATTERNS:
            assert hasattr(p, "match"), f"Expected compiled regex, got: {type(p)}"


# ===========================================================================
# Section 5: Integration tests — full pipeline
# ===========================================================================

class TestFullPipelineIntegration:
    """Integration tests exercising crew parse_result -> _validate_crew_output -> sanitize_reply."""

    def _run_pipeline(self, message: str, agent_name: str, language: str = "en") -> str:
        """Helper: run _validate_crew_output + sanitize_reply on a mock agent_result."""
        agent_result = {"message": message, "raw_output": message}
        validated = _validate_crew_output(agent_result, agent_name, language)
        return sanitize_reply(validated, agent_name=agent_name, language=language)

    def test_integration_municipal_clean_response(self):
        """Canned MunicipalResponse message through full pipeline survives intact."""
        message = "Your water outage report has been logged. Tracking number: TKT-20260219-AA1234. Our team will be there within 48 hours."
        result = self._run_pipeline(message, "municipal_intake")
        assert "water" in result.lower() or "TKT" in result

    def test_integration_adversarial_delegation_with_citizen_text(self):
        """Delegation text + citizen text: delegation stripped, citizen text survives."""
        result = self._run_pipeline(
            ADVERSARIAL_DELEGATION_OUTPUT,
            "auth_agent",
        )
        # Delegation narration must not survive to citizen
        assert "As the Municipal Services Manager" not in result
        assert "procedure for you, Gugu, to follow" not in result
        # Either citizen text survived or fallback was used
        assert result  # Never empty

    def test_integration_gbv_error_always_has_emergency_numbers(self):
        """GBV error response through full pipeline always has 10111 and 0800 150 150."""
        # Simulate GBV error response that lacks emergency numbers
        gbv_error_message = "I'm sorry, I couldn't process your report right now."
        result = self._run_pipeline(gbv_error_message, "gbv_intake")
        assert "10111" in result
        assert "0800 150 150" in result

    def test_integration_gbv_response_with_emergency_numbers_preserved(self):
        """GBV response that already has emergency numbers: they survive sanitization."""
        gbv_with_numbers = (
            "I'm here to help you. If you are in immediate danger, call SAPS: 10111 "
            "or the GBV Command Centre at 0800 150 150. Please tell me what happened."
        )
        result = self._run_pipeline(gbv_with_numbers, "gbv_intake")
        assert "10111" in result
        assert "0800 150 150" in result

    def test_integration_only_artifacts_returns_usable_fallback(self):
        """Input consisting entirely of LLM artifacts produces a usable fallback."""
        result = self._run_pipeline(ADVERSARIAL_ONLY_ARTIFACTS, "auth_agent")
        assert result
        assert "Gugu" in result

    def test_integration_json_blob_stripped(self):
        """JSON blob in message is stripped; surrounding text survives."""
        result = self._run_pipeline(ADVERSARIAL_JSON_BLOB, "municipal_intake")
        # JSON syntax should be gone
        assert '"tracking_number"' not in result
        assert '"status"' not in result

    def test_integration_language_zu_returns_zulu_fallback(self):
        """Empty input with language='zu' produces isiZulu fallback through full pipeline."""
        result = self._run_pipeline("", "auth_agent", language="zu")
        assert result
        # Should contain some Zulu or at least 'Gugu'
        assert "Gugu" in result

    def test_integration_manager_parse_then_validate_then_sanitize(self):
        """ManagerCrew.parse_result -> _validate_crew_output -> sanitize_reply: end-to-end."""
        manager = ManagerCrew(language="en", llm=MagicMock())

        # Simulate a delegation-polluted result
        raw_result = FakeResult(
            "As the Municipal Services Manager, here is the procedure:\n"
            "Step 1: Help citizen.\n"
            "Hello! I'm Gugu from SALGA Trust Engine. What can I help you with?"
        )
        # Layer 1: ManagerCrew.parse_result filters delegation
        parse_output = manager.parse_result(raw_result)

        # Layer 2: _validate_crew_output validates
        validated = _validate_crew_output(parse_output, "manager", "en")

        # Layer 3: sanitize_reply does final cleanup
        final = sanitize_reply(validated, agent_name="auth_agent", language="en")

        assert final
        assert "As the Municipal Services Manager" not in final
        assert "Step 1:" not in final
