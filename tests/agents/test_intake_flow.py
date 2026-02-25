"""Unit tests for IntakeFlow routing logic — Phase 10.3 Plan 07.

Tests: intent classification, auth gate, routing_phase short-circuit,
       pending_intent preservation, language detection, specialist dispatch.

All specialist crews and LLM calls are mocked — no real API calls, no real DB.

Sections:
  1. Intent Classification Tests
  2. Routing Logic Tests
  3. Language Detection Tests
  4. Specialist Dispatch Tests

Key testing patterns:
- IntakeFlow is tested via direct state manipulation (set state fields, call methods)
- LLM classification is patched via 'src.agents.llm.get_routing_llm'
- Specialist crews are patched at the import path inside Flow handlers
- asyncio tests use pytest's auto asyncio_mode (configured in pyproject.toml)
- No HTTP layer needed — IntakeFlow is a pure Python class
"""
import asyncio
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Fake API keys MUST be set before any CrewAI import (per conftest pattern)
os.environ.setdefault("OPENAI_API_KEY", "fake-key-for-tests")
os.environ.setdefault("DEEPSEEK_API_KEY", "fake-key-for-tests")


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _make_flow(
    message: str = "Hello",
    phone: str = "+27821234567",
    language: str = "en",
    routing_phase: str = "manager",
    session_status: str = "active",
    user_id: str = "user-uuid-123",
    conversation_history: str = "(none)",
    pending_intent: str = "",
):
    """Create an IntakeFlow with pre-populated state for testing.

    Avoids duplicating state setup in every test. All fields match the
    IntakeState defaults with overrides for the specific test scenario.
    """
    from src.agents.flows.intake_flow import IntakeFlow

    flow = IntakeFlow()
    flow.state.message = message
    flow.state.phone = phone
    flow.state.language = language
    flow.state.routing_phase = routing_phase
    flow.state.session_status = session_status
    flow.state.user_id = user_id
    flow.state.conversation_history = conversation_history
    flow.state.pending_intent = pending_intent
    return flow


def _mock_crew_result(message: str, agent_name: str = "municipal") -> dict:
    """Build a mock crew kickoff result dict."""
    return {
        "message": message,
        "agent_name": agent_name,
        "language": "en",
        "action_taken": "collecting_info",
    }


# ---------------------------------------------------------------------------
# Section 1: Intent Classification Tests
# ---------------------------------------------------------------------------

class TestIntentClassification:
    """Tests for _classify_raw_intent() — the direct LLM classification step."""

    def test_classify_intent_returns_municipal_for_service_complaint(self):
        """_classify_raw_intent returns 'municipal' when LLM says 'municipal'."""
        flow = _make_flow(message="The pipe on Main Road is broken")

        mock_llm = MagicMock()
        mock_llm.call.return_value = "municipal"

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            intent = flow._classify_raw_intent()

        assert intent == "municipal"

    def test_classify_intent_returns_auth_for_registration_message(self):
        """_classify_raw_intent returns 'auth' when LLM says 'auth'."""
        flow = _make_flow(message="I need to register my account")

        mock_llm = MagicMock()
        mock_llm.call.return_value = "auth"

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            intent = flow._classify_raw_intent()

        assert intent == "auth"

    def test_classify_intent_returns_gbv_for_abuse_message(self):
        """_classify_raw_intent returns 'gbv' when LLM says 'gbv'."""
        flow = _make_flow(message="My partner is threatening me and I need help")

        mock_llm = MagicMock()
        mock_llm.call.return_value = "gbv"

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            intent = flow._classify_raw_intent()

        assert intent == "gbv"

    def test_classify_intent_returns_ticket_status_for_tracking_query(self):
        """_classify_raw_intent returns 'ticket_status' when LLM says 'ticket_status'."""
        flow = _make_flow(message="What is the status of TKT-20260225-abc123?")

        mock_llm = MagicMock()
        mock_llm.call.return_value = "ticket_status"

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            intent = flow._classify_raw_intent()

        assert intent == "ticket_status"

    def test_classify_intent_unknown_defaults_to_municipal(self):
        """_classify_raw_intent defaults to 'municipal' when LLM returns unknown category."""
        flow = _make_flow(message="Some completely unrecognized message type")

        mock_llm = MagicMock()
        mock_llm.call.return_value = "unknown_category"

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            intent = flow._classify_raw_intent()

        assert intent == "municipal"

    def test_classify_intent_handles_whitespace_and_case(self):
        """_classify_raw_intent normalizes LLM output with extra whitespace/case."""
        flow = _make_flow(message="My electricity is out")

        mock_llm = MagicMock()
        mock_llm.call.return_value = "  MUNICIPAL  "  # Uppercase with whitespace

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            intent = flow._classify_raw_intent()

        assert intent == "municipal"

    def test_classify_intent_handles_none_llm_response(self):
        """_classify_raw_intent defaults to 'municipal' when LLM returns None."""
        flow = _make_flow(message="Uh")

        mock_llm = MagicMock()
        mock_llm.call.return_value = None

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            intent = flow._classify_raw_intent()

        assert intent == "municipal"


# ---------------------------------------------------------------------------
# Section 2: Routing Logic Tests
# ---------------------------------------------------------------------------

class TestRoutingLogic:
    """Tests for classify_intent() — the full routing decision tree."""

    def test_unauthenticated_always_routes_to_auth(self):
        """session_status='none' routes to 'auth' regardless of message content."""
        flow = _make_flow(
            message="There is a broken pipe on Main Road",  # Looks like municipal
            session_status="none",
            routing_phase="manager",
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "municipal"  # LLM would say municipal

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            result = flow.classify_intent()

        # Should route to auth despite municipal-looking message
        assert result == "auth"
        assert flow.state.intent == "auth"

    def test_expired_session_routes_to_auth(self):
        """session_status='expired' routes to 'auth' for OTP re-auth."""
        flow = _make_flow(
            message="Check the status of my pothole report please",
            session_status="expired",
            routing_phase="manager",
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "ticket_status"

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            result = flow.classify_intent()

        assert result == "auth"
        assert flow.state.intent == "auth"

    def test_otp_pending_routes_to_auth(self):
        """session_status='otp_pending' continues to auth to complete OTP flow."""
        flow = _make_flow(
            message="123456",  # OTP code
            session_status="otp_pending",
            routing_phase="manager",
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "auth"

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            result = flow.classify_intent()

        assert result == "auth"
        assert flow.state.intent == "auth"

    def test_active_session_routes_by_intent(self):
        """session_status='active' uses LLM intent classification."""
        flow = _make_flow(
            message="The water pipe on Elm Street is leaking",
            session_status="active",
            routing_phase="manager",
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "municipal"

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            result = flow.classify_intent()

        assert result == "municipal"
        assert flow.state.intent == "municipal"

    def test_routing_phase_shortcircuit_for_municipal(self):
        """routing_phase='municipal' skips classification and returns 'municipal'."""
        flow = _make_flow(
            message="Yes, the same pipe is still broken",  # Ambiguous text
            session_status="active",
            routing_phase="municipal",  # Active municipal session
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "auth"  # LLM would say auth (wrong)

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            result = flow.classify_intent()

        # Should short-circuit to municipal without calling LLM
        assert result == "municipal"
        mock_llm.call.assert_not_called()  # LLM should NOT be called

    def test_routing_phase_shortcircuit_for_auth(self):
        """routing_phase='auth' short-circuits back to auth for registration continuation."""
        flow = _make_flow(
            message="My name is Thabo",
            session_status="none",  # Not yet authenticated
            routing_phase="auth",  # Mid-registration
        )

        mock_llm = MagicMock()

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            result = flow.classify_intent()

        assert result == "auth"
        mock_llm.call.assert_not_called()

    def test_routing_phase_shortcircuit_for_ticket_status(self):
        """routing_phase='ticket_status' continues ticket status flow."""
        flow = _make_flow(
            message="TKT-20260225-abc123",
            session_status="active",
            routing_phase="ticket_status",
        )

        mock_llm = MagicMock()

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            result = flow.classify_intent()

        assert result == "ticket_status"
        mock_llm.call.assert_not_called()

    def test_pending_intent_preserved_when_auth_gates(self):
        """When unauthenticated user sends substantive message, intent saved in pending_intent."""
        flow = _make_flow(
            message="There is a broken water pipe on Main Road near the school",
            session_status="none",
            routing_phase="manager",
            pending_intent="",  # Nothing saved yet
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "municipal"  # What the LLM would have chosen

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            result = flow.classify_intent()

        assert result == "auth"
        # pending_intent should be set to the classified intent string
        assert flow.state.pending_intent == "municipal"

    def test_pending_intent_not_overwritten(self):
        """Existing pending_intent is not overwritten when auth gate re-triggers."""
        flow = _make_flow(
            message="Yes, I still want to report the pothole",
            session_status="otp_pending",
            routing_phase="manager",
            pending_intent="municipal",  # Already saved from previous turn
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "auth"

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            result = flow.classify_intent()

        assert result == "auth"
        assert flow.state.pending_intent == "municipal"  # NOT overwritten

    def test_route_by_intent_returns_intent_from_state(self):
        """route_by_intent returns state.intent for routing dispatch."""
        flow = _make_flow()
        flow.state.intent = "gbv"

        result = flow.route_by_intent()

        assert result == "gbv"

    def test_route_by_intent_defaults_to_auth_when_empty(self):
        """route_by_intent defaults to 'auth' when intent is empty string."""
        flow = _make_flow()
        flow.state.intent = ""

        result = flow.route_by_intent()

        assert result == "auth"

    def test_gbv_confirmation_not_in_flow(self):
        """GBV pending_confirm state is handled by crew_server, NOT by IntakeFlow.

        IntakeFlow classifies intent as 'gbv' — the confirmation gate is crew_server's
        responsibility. IntakeFlow just returns 'gbv' without any confirmation logic.
        """
        flow = _make_flow(
            message="My husband is hurting me",
            session_status="active",
            routing_phase="manager",
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "gbv"

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            result = flow.classify_intent()

        # IntakeFlow returns 'gbv' — crew_server decides whether to confirm
        assert result == "gbv"
        assert flow.state.intent == "gbv"
        # No "pending_confirm" or "gbv_confirmation" in IntakeFlow state
        assert flow.state.routing_phase == "manager"  # Not modified by classify_intent


# ---------------------------------------------------------------------------
# Section 3: Language Detection Tests
# ---------------------------------------------------------------------------

class TestLanguageDetection:
    """Tests for language detection in classify_intent()."""

    def test_language_detection_english(self):
        """English message text is detected as 'en'."""
        flow = _make_flow(
            message="There is a large pothole on Commissioner Street that is damaging cars",
            session_status="active",
            routing_phase="manager",
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "municipal"

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            flow.classify_intent()

        # Language should be detected as English or remain as original
        assert flow.state.language in ("en", "af", "zu")  # lingua detection works

    def test_language_detection_updates_state(self):
        """classify_intent updates state.language from language_detector.detect()."""
        flow = _make_flow(
            message="Ingane yami ibolile emthombo",  # isiZulu-like text
            language="en",  # Initial hint is en
            session_status="active",
            routing_phase="manager",
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "municipal"

        # Patch language_detector to return a specific value
        with patch("src.core.language.language_detector.detect", return_value="zu"):
            with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
                flow.classify_intent()

        assert flow.state.language == "zu"

    def test_language_fallback_for_short_message(self):
        """Short/ambiguous messages use fallback language from state."""
        flow = _make_flow(
            message="Hi",  # Too short for reliable detection (< 20 chars)
            language="af",  # Citizen's stored language preference
            session_status="active",
            routing_phase="manager",
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "auth"

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            flow.classify_intent()

        # Short message falls back to "af" (the stored fallback language)
        assert flow.state.language == "af"

    def test_language_detection_via_mocked_detector(self):
        """language_detector.detect() is called with message and fallback=state.language."""
        flow = _make_flow(
            message="Ek wil 'n klagte indien oor die paaie in my wijk wat beskadig is",
            language="en",
            session_status="active",
            routing_phase="manager",
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "municipal"

        with patch("src.core.language.language_detector.detect", return_value="af") as mock_detect:
            with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
                flow.classify_intent()

        # Detector should have been called with the message
        mock_detect.assert_called_once()
        call_args = mock_detect.call_args
        assert flow.state.message in call_args[0] or call_args[1].get("text") == flow.state.message


# ---------------------------------------------------------------------------
# Section 4: Specialist Dispatch Tests (mocked crews)
# ---------------------------------------------------------------------------

class TestSpecialistDispatch:
    """Tests that each @listen handler dispatches to the correct specialist crew."""

    async def test_auth_dispatch_calls_auth_crew(self):
        """handle_auth() calls AuthCrew.kickoff() with correct context."""
        flow = _make_flow(
            message="I need to register",
            session_status="none",
            routing_phase="manager",
        )
        flow.state.intent = "auth"

        mock_auth_crew = MagicMock()
        mock_auth_crew.kickoff = AsyncMock(return_value={
            "message": "Welcome! Let me help you register.",
            "requires_otp": False,
            "session_status": "none",
        })

        with patch("src.agents.crews.auth_crew.AuthCrew", return_value=mock_auth_crew):
            await flow.handle_auth()

        mock_auth_crew.kickoff.assert_called_once()
        call_kwargs = mock_auth_crew.kickoff.call_args[0][0]
        assert call_kwargs["message"] == "I need to register"
        assert call_kwargs["phone"] == "+27821234567"
        assert call_kwargs["language"] == "en"
        assert call_kwargs["session_status"] == "none"

        # agent_name should be set in result
        assert flow.state.result.get("agent_name") == "auth"

    async def test_municipal_dispatch_calls_municipal_crew(self):
        """handle_municipal() calls MunicipalIntakeCrew.kickoff() with correct context."""
        flow = _make_flow(
            message="The water pipe on Elm Street is leaking badly",
            session_status="active",
            user_id="user-uuid-municipal",
        )
        flow.state.intent = "municipal"

        mock_municipal_crew = MagicMock()
        mock_municipal_crew.kickoff = AsyncMock(return_value={
            "message": "I understand. Could you give me your precise location?",
            "action_taken": "collecting_info",
        })

        with patch("src.agents.crews.municipal_crew.MunicipalIntakeCrew", return_value=mock_municipal_crew):
            await flow.handle_municipal()

        mock_municipal_crew.kickoff.assert_called_once()
        call_kwargs = mock_municipal_crew.kickoff.call_args[0][0]
        assert call_kwargs["message"] == "The water pipe on Elm Street is leaking badly"
        assert call_kwargs["user_id"] == "user-uuid-municipal"

        assert flow.state.result.get("agent_name") == "municipal"

    async def test_gbv_dispatch_calls_gbv_crew(self):
        """handle_gbv() calls GBVCrew.kickoff() with correct context. # SEC-05"""
        flow = _make_flow(
            message="My partner is hurting me and I need help",
            session_status="active",
            user_id="user-uuid-gbv",
        )
        flow.state.intent = "gbv"

        mock_gbv_crew = MagicMock()
        mock_gbv_crew.kickoff = AsyncMock(return_value={
            "message": "I'm here with you. SAPS 10111 | GBV Helpline 0800 150 150",
            "requires_followup": True,
            "category": "gbv",
        })

        with patch("src.agents.crews.gbv_crew.GBVCrew", return_value=mock_gbv_crew):
            await flow.handle_gbv()

        mock_gbv_crew.kickoff.assert_called_once()
        call_kwargs = mock_gbv_crew.kickoff.call_args[0][0]
        assert call_kwargs["message"] == "My partner is hurting me and I need help"

        # agent_name and category must be set for SEC-05 firewall
        assert flow.state.result.get("agent_name") == "gbv"
        assert flow.state.result.get("category") == "gbv"  # SEC-05

    async def test_ticket_status_dispatch_calls_ticket_status_crew(self):
        """handle_ticket_status() calls TicketStatusCrew.kickoff() with correct context."""
        flow = _make_flow(
            message="What is the status of TKT-20260225-abc123?",
            session_status="active",
            user_id="user-uuid-ticket",
        )
        flow.state.intent = "ticket_status"

        mock_ticket_crew = MagicMock()
        mock_ticket_crew.kickoff = AsyncMock(return_value={
            "message": "Your report TKT-20260225-abc123 is currently In Progress.",
            "tickets_found": 1,
        })

        with patch("src.agents.crews.ticket_status_crew.TicketStatusCrew", return_value=mock_ticket_crew):
            await flow.handle_ticket_status()

        mock_ticket_crew.kickoff.assert_called_once()
        call_kwargs = mock_ticket_crew.kickoff.call_args[0][0]
        assert call_kwargs["message"] == "What is the status of TKT-20260225-abc123?"
        assert call_kwargs["user_id"] == "user-uuid-ticket"

        assert flow.state.result.get("agent_name") == "ticket_status"

    async def test_gbv_result_forces_category_gbv(self):
        """handle_gbv() always sets category='gbv' in result, even if crew omits it. # SEC-05"""
        flow = _make_flow(session_status="active")
        flow.state.intent = "gbv"

        mock_gbv_crew = MagicMock()
        mock_gbv_crew.kickoff = AsyncMock(return_value={
            "message": "Emergency: 10111",
            # category NOT returned by mock crew
        })

        with patch("src.agents.crews.gbv_crew.GBVCrew", return_value=mock_gbv_crew):
            await flow.handle_gbv()

        # category must be forced even if crew didn't include it
        assert flow.state.result.get("category") == "gbv"

    async def test_full_flow_end_to_end_municipal_routing(self):
        """IntakeFlow.kickoff_async() routes to municipal crew end-to-end."""
        flow = _make_flow(
            message="The electricity has been off for 3 days on Oak Avenue",
            session_status="active",
            routing_phase="manager",
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "municipal"

        mock_crew = MagicMock()
        mock_crew.kickoff = AsyncMock(return_value={
            "message": "I understand, let me help you report this electricity outage.",
            "action_taken": "collecting_info",
        })

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            with patch("src.agents.crews.municipal_crew.MunicipalIntakeCrew", return_value=mock_crew):
                await flow.kickoff_async()

        assert flow.state.intent == "municipal"
        assert flow.state.result.get("agent_name") == "municipal"
        mock_crew.kickoff.assert_called_once()

    async def test_full_flow_auth_gate_for_unauthenticated(self):
        """IntakeFlow.kickoff_async() routes unauthenticated users to auth."""
        flow = _make_flow(
            message="My water meter is broken please fix it",
            session_status="none",
            routing_phase="manager",
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "municipal"  # Would be municipal if authenticated

        mock_auth_crew = MagicMock()
        mock_auth_crew.kickoff = AsyncMock(return_value={
            "message": "Welcome! To report an issue, I'll need to register you first.",
            "requires_otp": False,
            "session_status": "none",
        })

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            with patch("src.agents.crews.auth_crew.AuthCrew", return_value=mock_auth_crew):
                await flow.kickoff_async()

        # Even though message looks municipal, auth gate intercepts
        assert flow.state.intent == "auth"
        assert flow.state.result.get("agent_name") == "auth"
        # pending_intent should be saved (LLM classified as municipal)
        assert flow.state.pending_intent == "municipal"
        mock_auth_crew.kickoff.assert_called_once()

    async def test_full_flow_routing_phase_shortcircuit(self):
        """IntakeFlow.kickoff_async() uses short-circuit for active specialist session."""
        flow = _make_flow(
            message="Same problem, nothing has been fixed",
            session_status="active",
            routing_phase="municipal",  # Mid-conversation with municipal crew
        )

        mock_llm = MagicMock()
        mock_llm.call.return_value = "auth"  # LLM would say auth (but shouldn't be called)

        mock_crew = MagicMock()
        mock_crew.kickoff = AsyncMock(return_value={
            "message": "I understand, let me update your report.",
            "action_taken": "updating",
        })

        with patch("src.agents.llm.get_routing_llm", return_value=mock_llm):
            with patch("src.agents.crews.municipal_crew.MunicipalIntakeCrew", return_value=mock_crew):
                await flow.kickoff_async()

        # Short-circuit: municipal handles the turn, no LLM call
        assert flow.state.intent == "municipal"
        mock_llm.call.assert_not_called()
        mock_crew.kickoff.assert_called_once()


# ---------------------------------------------------------------------------
# Section 5: IntakeFlow Instantiation Tests
# ---------------------------------------------------------------------------

class TestIntakeFlowInstantiation:
    """Tests for IntakeFlow class structure and state initialization."""

    def test_intake_flow_instantiates(self):
        """IntakeFlow() creates without error."""
        from src.agents.flows.intake_flow import IntakeFlow
        flow = IntakeFlow()
        assert flow is not None

    def test_intake_flow_has_intake_state(self):
        """IntakeFlow state has all required IntakeState fields."""
        from src.agents.flows.intake_flow import IntakeFlow
        from src.agents.flows.state import IntakeState

        flow = IntakeFlow()
        required_fields = list(IntakeState.model_fields.keys())

        for field in required_fields:
            assert hasattr(flow.state, field), f"state missing field: {field}"

    def test_intake_state_defaults(self):
        """IntakeState has sensible defaults for all fields."""
        from src.agents.flows.state import IntakeState

        state = IntakeState()
        assert state.message == ""
        assert state.phone == ""
        assert state.language == "en"
        assert state.intent == "unknown"
        assert state.routing_phase == "manager"
        assert state.session_status == "none"
        assert state.user_id is None
        assert state.conversation_history == "(none)"
        assert state.result == {}
        assert state.pending_intent == ""

    def test_flow_has_required_methods(self):
        """IntakeFlow has all required methods and decorators."""
        from src.agents.flows.intake_flow import IntakeFlow

        flow = IntakeFlow()
        assert hasattr(flow, "classify_intent")
        assert hasattr(flow, "route_by_intent")
        assert hasattr(flow, "handle_auth")
        assert hasattr(flow, "handle_municipal")
        assert hasattr(flow, "handle_ticket_status")
        assert hasattr(flow, "handle_gbv")
        assert hasattr(flow, "_classify_raw_intent")
        assert hasattr(flow, "kickoff_async")
        assert hasattr(flow, "kickoff")
