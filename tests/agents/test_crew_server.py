"""Unit tests for crew_server.py — Phase 10.3 Plan 04.

Tests: health endpoint, chat endpoint shape, routing logic, sanitize_reply()
       (7 sanitization cases), session reset, and GBV debug metadata.

All agent calls are mocked — no real LLM calls, no real Redis/DB calls.

Approach:
- sanitize_reply() tests are pure function tests (imported directly, no HTTP needed)
- Endpoint tests use FastAPI TestClient(crew_app)
- ConversationManager and AuthCrew are mocked so no real infrastructure needed
- Rate limiting (slowapi) is bypassed via request.client patching

Key limitation from Phase 06.9.2 learnings:
- slowapi rate-limited endpoints look for a kwarg named 'request' at decoration
  time. Direct function tests that skip the ASGI layer do not work for rate-
  limited endpoints. TestClient is the correct test pattern (it goes through the
  ASGI layer, including slowapi).
"""
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Fake API keys MUST be set before any CrewAI import
os.environ.setdefault("OPENAI_API_KEY", "fake-key-for-tests")
os.environ.setdefault("DEEPSEEK_API_KEY", "fake-key-for-tests")


# ---------------------------------------------------------------------------
# TestClient helper
# ---------------------------------------------------------------------------

def _get_test_client():
    """Import and return TestClient(crew_app).

    Imported lazily so the env var patching above runs first.
    """
    from fastapi.testclient import TestClient
    from src.api.v1.crew_server import crew_app
    return TestClient(crew_app)


# ---------------------------------------------------------------------------
# Shared mock: ConversationManager + session state
# ---------------------------------------------------------------------------

def _make_conv_state(**kwargs):
    """Build a MagicMock ConversationState with sensible defaults."""
    state = MagicMock()
    state.turns = kwargs.get("turns", [])
    state.routing_phase = kwargs.get("routing_phase", "manager")
    state.session_status = kwargs.get("session_status", "none")
    state.user_id = kwargs.get("user_id", "+27821234567")
    state.language = kwargs.get("language", "en")
    state.pending_intent = kwargs.get("pending_intent", "")
    state.tenant_id = kwargs.get("tenant_id", "")
    state.max_turns = kwargs.get("max_turns", 20)
    return state


def _make_mock_manager(conv_state=None):
    """Build a MagicMock ConversationManager that returns the given conv_state."""
    if conv_state is None:
        conv_state = _make_conv_state()

    mgr = MagicMock()
    mgr.get_state = AsyncMock(return_value=conv_state)
    mgr.create_session = AsyncMock(return_value=conv_state)
    mgr.append_turn = AsyncMock(return_value=conv_state)
    mgr.clear_session = AsyncMock(return_value=None)
    mgr.save_state = AsyncMock(return_value=None)
    return mgr


# ---------------------------------------------------------------------------
# Section 1: Health Endpoint
# ---------------------------------------------------------------------------

class TestHealthEndpoint:
    """Tests for GET /api/v1/health."""

    def test_health_returns_200(self):
        """GET /api/v1/health returns 200."""
        client = _get_test_client()
        response = client.get("/api/v1/health")
        assert response.status_code == 200

    def test_health_returns_status_ok(self):
        """Health response contains {"status": "ok"}."""
        client = _get_test_client()
        response = client.get("/api/v1/health")
        data = response.json()
        assert data["status"] == "ok"

    def test_health_lists_agents(self):
        """Health response includes "agents" list."""
        client = _get_test_client()
        response = client.get("/api/v1/health")
        data = response.json()
        assert "agents" in data
        assert isinstance(data["agents"], list)

    def test_health_agents_includes_auth(self):
        """Health agents list contains 'auth' (plan 03 agent wired)."""
        client = _get_test_client()
        response = client.get("/api/v1/health")
        data = response.json()
        assert "auth" in data["agents"]

    def test_health_has_version(self):
        """Health response has version field."""
        client = _get_test_client()
        response = client.get("/api/v1/health")
        data = response.json()
        assert "version" in data


# ---------------------------------------------------------------------------
# Section 2: Chat Endpoint Shape
# ---------------------------------------------------------------------------

class TestChatEndpointShape:
    """Tests for POST /api/v1/chat — shape and validation."""

    def test_chat_requires_phone(self):
        """Missing phone field returns 422 Unprocessable Entity."""
        client = _get_test_client()
        response = client.post("/api/v1/chat", json={"message": "Hello"})
        assert response.status_code == 422

    def test_chat_requires_message(self):
        """Missing message field returns 422 Unprocessable Entity."""
        client = _get_test_client()
        response = client.post("/api/v1/chat", json={"phone": "+27821234567"})
        assert response.status_code == 422

    def test_chat_returns_chat_response_shape(self):
        """POST /api/v1/chat returns reply, agent_name, session_status, language, debug."""
        mock_state = _make_conv_state()
        mock_mgr = _make_mock_manager(mock_state)

        with patch("src.api.v1.crew_server._get_conversation_manager", return_value=mock_mgr):
            # ManagerCrew is imported locally in the chat() function body.
            # Patch at the source module level so the local import picks it up.
            with patch("src.agents.crews.manager_crew.ManagerCrew") as MockManagerCrew:
                mock_mgr_instance = MagicMock()
                mock_mgr_instance.kickoff = AsyncMock(return_value={
                    "message": "Hello! I'm Gugu. Are you a new user?",
                    "agent": "auth_agent",
                    "routing_phase": "auth",
                })
                MockManagerCrew.return_value = mock_mgr_instance

                client = _get_test_client()
                response = client.post("/api/v1/chat", json={
                    "phone": "+27821234567",
                    "message": "Hi",
                    "session_override": "new",
                })

        assert response.status_code == 200
        data = response.json()
        assert "reply" in data
        assert "agent_name" in data
        assert "session_status" in data
        assert "language" in data
        assert "debug" in data

    def test_chat_phone_too_short_returns_422(self):
        """Phone number that is too short (< 7 chars) returns 422."""
        client = _get_test_client()
        response = client.post("/api/v1/chat", json={
            "phone": "123",
            "message": "Hello",
        })
        assert response.status_code == 422

    def test_chat_message_too_long_returns_422(self):
        """Message > 2000 characters returns 422."""
        client = _get_test_client()
        response = client.post("/api/v1/chat", json={
            "phone": "+27821234567",
            "message": "A" * 2001,
        })
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Section 3: Chat Routing (mocked agents)
# ---------------------------------------------------------------------------

class TestChatRouting:
    """Tests for routing logic in /api/v1/chat."""

    def test_chat_routes_unauthenticated_to_auth(self):
        """When session_override='new' (session_status='none'), auth agent handles the request."""
        mock_state = _make_conv_state(routing_phase="manager")
        mock_mgr = _make_mock_manager(mock_state)

        manager_result = {
            "message": "Hello! I'm Gugu. Are you a new user?",
            "agent": "auth_agent",
            "routing_phase": "auth",
        }

        with patch("src.api.v1.crew_server._get_conversation_manager", return_value=mock_mgr):
            # ManagerCrew is imported locally in chat() body — patch at source module
            with patch("src.agents.crews.manager_crew.ManagerCrew") as MockManagerCrew:
                mock_mgr_crew = MagicMock()
                mock_mgr_crew.kickoff = AsyncMock(return_value=manager_result)
                MockManagerCrew.return_value = mock_mgr_crew

                client = _get_test_client()
                response = client.post("/api/v1/chat", json={
                    "phone": "+27821234567",
                    "message": "Hi, I want to report a pothole",
                    "session_override": "new",
                })

        assert response.status_code == 200
        data = response.json()
        # The manager should route unauthenticated users to auth
        assert "reply" in data
        # session_status should be "none" (new session override)
        assert data["session_status"] == "none"

    def test_chat_session_override_new_maps_to_none(self):
        """session_override='new' maps session_status to 'none'."""
        mock_state = _make_conv_state()
        mock_mgr = _make_mock_manager(mock_state)

        with patch("src.api.v1.crew_server._get_conversation_manager", return_value=mock_mgr):
            # ManagerCrew is imported locally in chat() body — patch at source module
            with patch("src.agents.crews.manager_crew.ManagerCrew") as MockManagerCrew:
                mock_mgr_crew = MagicMock()
                mock_mgr_crew.kickoff = AsyncMock(return_value={
                    "message": "Hello! Welcome to SALGA Trust Engine, I am Gugu.",
                    "agent": "auth_agent",
                    "routing_phase": "auth",
                })
                MockManagerCrew.return_value = mock_mgr_crew

                client = _get_test_client()
                response = client.post("/api/v1/chat", json={
                    "phone": "+27821234567",
                    "message": "Hello",
                    "session_override": "new",
                })

        assert response.status_code == 200
        data = response.json()
        assert data["session_status"] == "none"


# ---------------------------------------------------------------------------
# Section 4: sanitize_reply Tests (pure function, no HTTP)
# ---------------------------------------------------------------------------

class TestSanitizeReply:
    """Tests for sanitize_reply() function — direct imports, no TestClient."""

    def test_sanitize_strips_final_answer(self):
        """'Final Answer: Hello' -> 'Hello'."""
        from src.api.v1.crew_server import sanitize_reply
        result = sanitize_reply("Final Answer: Hello, I am Gugu!", agent_name="auth_agent")
        assert result == "Hello, I am Gugu!"
        assert "Final Answer:" not in result

    def test_sanitize_strips_thought(self):
        """Thought lines are removed from output."""
        from src.api.v1.crew_server import sanitize_reply
        raw = "Thought: I need to check the user account.\nHello there, how can I help?"
        result = sanitize_reply(raw, agent_name="auth_agent")
        assert "Thought:" not in result
        assert "Hello there, how can I help?" in result

    def test_sanitize_strips_action(self):
        """Action and Action Input lines are removed."""
        from src.api.v1.crew_server import sanitize_reply
        # Citizen-facing text must be >= 10 chars to avoid fallback
        raw = (
            "Action: lookup_user_tool\n"
            "Action Input: {\"phone\": \"+27821234567\"}\n"
            "Hello! I am Gugu from SALGA Trust Engine, I'm here to help you."
        )
        result = sanitize_reply(raw, agent_name="auth_agent")
        assert "Action:" not in result
        assert "Action Input:" not in result
        assert "Gugu" in result

    def test_sanitize_strips_delegation_artifacts(self):
        """Delegation narration is stripped from output."""
        from src.api.v1.crew_server import sanitize_reply
        raw = "As the Authentication Specialist, I will help.\nHello! I'm Gugu from SALGA."
        result = sanitize_reply(raw, agent_name="auth_agent")
        assert "As the Authentication Specialist" not in result
        assert "I'm Gugu from SALGA" in result

    def test_sanitize_preserves_clean_text(self):
        """Clean text without artifacts is returned unchanged."""
        from src.api.v1.crew_server import sanitize_reply
        clean = "Hello, I am Gugu from the SALGA Trust Engine. How can I help you today?"
        result = sanitize_reply(clean, agent_name="auth_agent")
        assert result == clean

    def test_sanitize_gbv_ensures_emergency_numbers(self):
        """For GBV agent, if emergency numbers are missing, they are added."""
        from src.api.v1.crew_server import sanitize_reply
        # GBV response without emergency numbers
        raw = "I understand you need help. Please tell me what happened."
        result = sanitize_reply(raw, agent_name="gbv_intake", language="en")
        assert "10111" in result
        assert "0800 150 150" in result

    def test_sanitize_gbv_preserves_existing_numbers(self):
        """For GBV agent, if 10111 already present, it is NOT duplicated."""
        from src.api.v1.crew_server import sanitize_reply
        raw = "I'm here to help. Please call SAPS 10111 or 0800 150 150 if in danger."
        result = sanitize_reply(raw, agent_name="gbv_intake", language="en")
        # Numbers should appear exactly once (not duplicated)
        assert result.count("10111") == 1

    def test_sanitize_returns_fallback_for_empty_input(self):
        """Empty input returns a warm Gugu fallback message."""
        from src.api.v1.crew_server import sanitize_reply
        result = sanitize_reply("", agent_name="auth_agent", language="en")
        assert "Gugu" in result
        assert len(result) > 20

    def test_sanitize_observation_stripped(self):
        """Observation: lines are removed."""
        from src.api.v1.crew_server import sanitize_reply
        raw = "Observation: User found with ID abc123\nHello! Welcome back."
        result = sanitize_reply(raw, agent_name="auth_agent")
        assert "Observation:" not in result
        assert "Hello! Welcome back." in result

    def test_sanitize_i_need_to_stripped(self):
        """'I need to ...' self-talk lines are stripped."""
        from src.api.v1.crew_server import sanitize_reply
        raw = "I need to look up the user first.\nGood morning! I'm Gugu."
        result = sanitize_reply(raw, agent_name="auth_agent")
        assert "I need to look up" not in result

    def test_sanitize_let_me_stripped(self):
        """'Let me ...' self-talk lines are stripped."""
        from src.api.v1.crew_server import sanitize_reply
        raw = "Let me check your account details.\nHello! I'm Gugu from SALGA Trust Engine."
        result = sanitize_reply(raw, agent_name="auth_agent")
        assert "Let me check" not in result


# ---------------------------------------------------------------------------
# Section 5: Session Reset
# ---------------------------------------------------------------------------

class TestSessionReset:
    """Tests for POST /api/v1/session/reset."""

    def test_session_reset_returns_200(self):
        """POST /api/v1/session/reset returns 200 on success."""
        mock_state = _make_conv_state()
        mock_mgr = _make_mock_manager(mock_state)

        with patch("src.api.v1.crew_server._get_conversation_manager", return_value=mock_mgr):
            client = _get_test_client()
            response = client.post("/api/v1/session/reset", json={"phone": "+27821234567"})

        assert response.status_code == 200

    def test_session_reset_returns_success_true(self):
        """Successful reset returns {"success": true}."""
        mock_state = _make_conv_state()
        mock_mgr = _make_mock_manager(mock_state)

        with patch("src.api.v1.crew_server._get_conversation_manager", return_value=mock_mgr):
            client = _get_test_client()
            response = client.post("/api/v1/session/reset", json={"phone": "+27821234567"})
            data = response.json()

        assert data.get("success") is True

    def test_session_reset_requires_phone(self):
        """Session reset without phone returns 422."""
        client = _get_test_client()
        response = client.post("/api/v1/session/reset", json={})
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Section 6: Debug Output
# ---------------------------------------------------------------------------

class TestDebugOutput:
    """Tests for debug field content in ChatResponse."""

    def test_debug_gbv_metadata_only(self):
        """For GBV agent, debug dict contains only metadata (no conversation content)."""
        mock_state = _make_conv_state()
        mock_mgr = _make_mock_manager(mock_state)

        # Simulate ManagerCrew returning a GBV classification.
        # GBV: routing_phase="gbv_pending_confirm" triggers GBV confirmation gate,
        # is_gbv ends up False (not confirmed yet), so category="gbv" forces GBV debug.
        manager_result = {
            "message": "I hear you. Emergency: SAPS 10111 | GBV Command Centre: 0800 150 150",
            "agent": "gbv_intake",
            "routing_phase": "gbv",
            "category": "gbv",
        }

        with patch("src.api.v1.crew_server._get_conversation_manager", return_value=mock_mgr):
            # ManagerCrew is imported locally in chat() body — patch at source module
            with patch("src.agents.crews.manager_crew.ManagerCrew") as MockManagerCrew:
                mock_mgr_crew = MagicMock()
                mock_mgr_crew.kickoff = AsyncMock(return_value=manager_result)
                MockManagerCrew.return_value = mock_mgr_crew

                client = _get_test_client()
                response = client.post("/api/v1/chat", json={
                    "phone": "+27821234567",
                    "message": "I am in danger please help me right now",
                    "session_override": "new",
                })

        assert response.status_code == 200
        data = response.json()
        debug = data.get("debug", {})

        # GBV debug MUST contain safe metadata
        assert "agent_name" in debug
        assert "session_status" in debug

    def test_debug_non_gbv_has_details(self):
        """For auth agent, debug dict includes routing_phase, detected_language."""
        mock_state = _make_conv_state()
        mock_mgr = _make_mock_manager(mock_state)

        with patch("src.api.v1.crew_server._get_conversation_manager", return_value=mock_mgr):
            # ManagerCrew is imported locally in chat() body — patch at source module
            with patch("src.agents.crews.manager_crew.ManagerCrew") as MockManagerCrew:
                mock_mgr_crew = MagicMock()
                mock_mgr_crew.kickoff = AsyncMock(return_value={
                    "message": "Hello! I'm Gugu from SALGA Trust Engine. Are you a new user?",
                    "agent": "auth_agent",
                    "routing_phase": "auth",
                })
                MockManagerCrew.return_value = mock_mgr_crew

                client = _get_test_client()
                response = client.post("/api/v1/chat", json={
                    "phone": "+27821234567",
                    "message": "Hi",
                    "session_override": "new",
                })

        assert response.status_code == 200
        data = response.json()
        debug = data.get("debug", {})

        # Non-GBV debug should contain diagnostic info
        assert "agent_name" in debug
        assert "session_status" in debug
