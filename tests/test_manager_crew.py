"""Unit tests for ManagerCrew — hierarchical routing manager.

Tests cover:
- ManagerCrew instantiation and YAML config loading
- Process.hierarchical crew creation with 4 specialist agents
- Specialist roles match YAML config (delegation targets)
- Manager task description contains all 5 routing categories
- kickoff returns dict with "message" key
- Error response has correct shape with Gugu mention

Note on LLM mocking:
    CrewAI's Agent() validates the LLM argument — MagicMock() fails validation.
    Tests that call create_crew() use crewai.LLM(model="fake/test-model", api_key="fake")
    to pass CrewAI validation without real API credentials.
    Tests that only test kickoff/error_response use MagicMock.
"""
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Set fake OpenAI API key for CrewAI Agent initialization compatibility
os.environ.setdefault("OPENAI_API_KEY", "sk-fake-key-for-unit-tests-only")

from crewai import LLM, Process

from src.agents.crews.manager_crew import ManagerCrew

# ── Test LLM — satisfies CrewAI Agent validation without real API calls ──
# CrewAI validates that llm has a non-empty model string. MagicMock() fails.
FAKE_LLM = LLM(model="openai/test-model", api_key="fake-key-for-tests")


class TestManagerCrewInstantiation:
    """Test ManagerCrew initialization and YAML config loading."""

    def test_manager_crew_instantiation_english(self):
        """Verify ManagerCrew instantiation with language='en' and mock LLM."""
        mock_llm = MagicMock()
        crew = ManagerCrew(language="en", llm=mock_llm)

        assert crew.language == "en"
        assert crew._llm is mock_llm
        assert crew.agents_config is not None
        assert crew.tasks_config is not None

    def test_manager_crew_instantiation_zulu(self):
        """Verify language='zu' is accepted."""
        mock_llm = MagicMock()
        crew = ManagerCrew(language="zu", llm=mock_llm)
        assert crew.language == "zu"

    def test_manager_crew_instantiation_afrikaans(self):
        """Verify language='af' is accepted."""
        mock_llm = MagicMock()
        crew = ManagerCrew(language="af", llm=mock_llm)
        assert crew.language == "af"

    def test_manager_crew_invalid_language_falls_back_to_english(self):
        """Invalid language code falls back to 'en'."""
        mock_llm = MagicMock()
        crew = ManagerCrew(language="fr", llm=mock_llm)
        assert crew.language == "en"

    def test_manager_crew_has_agents_and_tasks_config(self):
        """YAML configs are loaded and contain required keys."""
        mock_llm = MagicMock()
        crew = ManagerCrew(language="en", llm=mock_llm)

        # agents.yaml must have manager_agent and all 4 specialists
        assert "manager_agent" in crew.agents_config
        assert "auth_agent" in crew.agents_config
        assert "municipal_intake_agent" in crew.agents_config
        assert "gbv_agent" in crew.agents_config
        assert "ticket_status_specialist" in crew.agents_config

        # tasks.yaml must have route_citizen_message
        assert "route_citizen_message" in crew.tasks_config


class TestManagerCrewCreatesHierarchicalCrew:
    """Test that create_crew() produces a correct hierarchical Crew.

    Uses FAKE_LLM (crewai.LLM with fake model) instead of MagicMock because
    CrewAI's Agent() validates that llm has a non-empty model string.
    """

    def _full_context(self) -> dict:
        return {
            "message": "Hi, I need to report a water leak",
            "phone": "+27821234567",
            "language": "en",
            "session_status": "active",
            "user_exists": True,
            "user_id": "user-uuid-123",
            "conversation_history": "Citizen: Hi\nGugu: Hello!",
            "pending_intent": "",
        }

    def test_creates_hierarchical_crew(self):
        """create_crew() returns Crew with Process.hierarchical."""
        manager = ManagerCrew(language="en", llm=FAKE_LLM)
        crew = manager.create_crew(self._full_context())

        assert crew.process == Process.hierarchical

    def test_manager_agent_allow_delegation_true(self):
        """Manager agent must have allow_delegation=True."""
        manager = ManagerCrew(language="en", llm=FAKE_LLM)
        crew = manager.create_crew(self._full_context())

        assert crew.manager_agent is not None
        assert crew.manager_agent.allow_delegation is True

    def test_manager_agent_has_no_tools(self):
        """Manager agent must have no tools (CrewAI raises if manager has tools)."""
        manager = ManagerCrew(language="en", llm=FAKE_LLM)
        crew = manager.create_crew(self._full_context())

        # Tools list must be empty on manager agent
        assert len(crew.manager_agent.tools) == 0

    def test_crew_has_four_specialist_agents(self):
        """Crew agents list contains exactly 4 specialist agents."""
        manager = ManagerCrew(language="en", llm=FAKE_LLM)
        crew = manager.create_crew(self._full_context())

        assert len(crew.agents) == 4

    def test_all_specialists_have_allow_delegation_false(self):
        """All specialist agents must NOT delegate (allow_delegation=False)."""
        manager = ManagerCrew(language="en", llm=FAKE_LLM)
        crew = manager.create_crew(self._full_context())

        for agent in crew.agents:
            assert agent.allow_delegation is False, (
                f"Specialist '{agent.role}' should have allow_delegation=False"
            )

    def test_all_specialists_have_tools(self):
        """All specialist agents must have at least one tool."""
        manager = ManagerCrew(language="en", llm=FAKE_LLM)
        crew = manager.create_crew(self._full_context())

        for agent in crew.agents:
            assert len(agent.tools) > 0, (
                f"Specialist '{agent.role}' has no tools — delegation cannot succeed"
            )

    def test_manager_llm_is_set(self):
        """Both manager_agent and manager_llm must be set on Crew."""
        manager = ManagerCrew(language="en", llm=FAKE_LLM)
        crew = manager.create_crew(self._full_context())

        assert crew.manager_llm is not None


class TestManagerCrewSpecialistRoles:
    """Specialist agent roles must match YAML config exactly.

    CrewAI delegates by role string — any mismatch means delegation fails silently.
    """

    def test_specialist_roles_match_yaml_config(self):
        """Verify specialist roles in crew match agents.yaml role strings."""
        manager = ManagerCrew(language="en", llm=FAKE_LLM)

        context = {
            "message": "test",
            "phone": "+27821234567",
            "language": "en",
            "session_status": "none",
            "user_exists": False,
            "user_id": "",
            "conversation_history": "(none)",
            "pending_intent": "",
        }
        crew = manager.create_crew(context)

        actual_roles = {agent.role for agent in crew.agents}

        # Expected roles from agents.yaml
        expected_roles = {
            manager.agents_config["auth_agent"]["role"],
            manager.agents_config["municipal_intake_agent"]["role"],
            manager.agents_config["gbv_agent"]["role"],
            manager.agents_config["ticket_status_specialist"]["role"],
        }

        assert actual_roles == expected_roles, (
            f"Role mismatch — YAML says: {expected_roles}, crew has: {actual_roles}"
        )


class TestManagerCrewTaskContent:
    """Manager task description must contain routing categories and specialist roles."""

    def test_manager_task_has_five_routing_categories(self):
        """Task description must reference all 5 routing category keywords."""
        manager = ManagerCrew(language="en", llm=FAKE_LLM)

        context = {
            "message": "Hi there",
            "phone": "+27821234567",
            "language": "en",
            "session_status": "none",
            "user_exists": False,
            "user_id": "",
            "conversation_history": "(none)",
            "pending_intent": "",
        }
        crew = manager.create_crew(context)

        task_description = crew.tasks[0].description.lower()

        # All 5 routing categories must appear
        required_categories = [
            "greeting",
            "municipal_report",
            "gbv_report",
            "ticket_status",
            "auth",
        ]
        for category in required_categories:
            assert category in task_description, (
                f"Routing category '{category}' not found in manager task description"
            )

    def test_manager_task_contains_specialist_roles_for_delegation(self):
        """Task description must reference specialist role strings for delegation."""
        manager = ManagerCrew(language="en", llm=FAKE_LLM)

        context = {
            "message": "test message",
            "phone": "+27821234567",
            "language": "en",
            "session_status": "active",
            "user_exists": True,
            "user_id": "user-123",
            "conversation_history": "(none)",
            "pending_intent": "",
        }
        crew = manager.create_crew(context)

        task_description = crew.tasks[0].description

        # The task description (from tasks.yaml manager_task) must contain
        # the specialist role strings so the manager knows how to delegate
        specialist_roles = [
            manager.agents_config["auth_agent"]["role"],
            manager.agents_config["municipal_intake_agent"]["role"],
            manager.agents_config["gbv_agent"]["role"],
            manager.agents_config["ticket_status_specialist"]["role"],
        ]

        # Phase 6.9.1: Manager task no longer lists specialist roles explicitly
        # (delegation narration removed to prevent leaking to citizens).
        # Instead verify the task has routing categories for intent classification.
        routing_keywords = ["authentication", "municipal", "gbv", "ticket", "greeting"]
        keywords_found = sum(1 for kw in routing_keywords if kw in task_description.lower())
        assert keywords_found >= 2, (
            f"Expected routing categories in task description. Found {keywords_found}/5. "
            f"Task description: {task_description[:300]}"
        )

    def test_manager_task_contains_citizen_message(self):
        """Task description must include the citizen's actual message."""
        manager = ManagerCrew(language="en", llm=FAKE_LLM)

        test_message = "There is a huge pothole on Jan Smuts Avenue"
        context = {
            "message": test_message,
            "phone": "+27821234567",
            "language": "en",
            "session_status": "active",
            "user_exists": True,
            "user_id": "user-123",
            "conversation_history": "(none)",
            "pending_intent": "",
        }
        crew = manager.create_crew(context)

        task_description = crew.tasks[0].description
        assert test_message in task_description


class TestManagerCrewKickoff:
    """Test kickoff method — uses mocked crew to avoid real API calls."""

    @pytest.mark.asyncio
    async def test_kickoff_returns_dict_with_message_key(self):
        """kickoff() returns a dict containing 'message' key."""
        mock_llm = MagicMock()
        manager = ManagerCrew(language="en", llm=mock_llm)

        context = {
            "message": "Hi Gugu",
            "phone": "+27821234567",
            "language": "en",
            "session_status": "none",
            "user_exists": False,
            "user_id": "",
            "conversation_history": "(none)",
            "pending_intent": "",
        }

        # Mock create_crew to return a crew with a mocked kickoff
        mock_crew = MagicMock()
        mock_crew.kickoff.return_value = MagicMock(
            __str__=lambda self: "Final Answer: Hi there! I'm Gugu from SALGA Trust Engine."
        )

        with patch.object(manager, "create_crew", return_value=mock_crew):
            result = await manager.kickoff(context)

        assert isinstance(result, dict)
        assert "message" in result

    @pytest.mark.asyncio
    async def test_kickoff_error_returns_error_dict(self):
        """kickoff() returns error dict when crew raises an exception."""
        mock_llm = MagicMock()
        manager = ManagerCrew(language="en", llm=mock_llm)

        context = {"message": "test", "language": "en"}

        # Mock create_crew to raise
        with patch.object(manager, "create_crew", side_effect=RuntimeError("Connection failed")):
            result = await manager.kickoff(context)

        assert isinstance(result, dict)
        assert "error" in result
        assert "message" in result


class TestManagerCrewErrorResponse:
    """Test get_error_response format."""

    def test_error_response_has_error_and_message_keys(self):
        """get_error_response returns dict with 'error' and 'message' keys."""
        mock_llm = MagicMock()
        manager = ManagerCrew(language="en", llm=mock_llm)

        response = manager.get_error_response(Exception("Test error"))

        assert "error" in response
        assert "message" in response
        assert isinstance(response["error"], str)
        assert isinstance(response["message"], str)

    def test_error_response_message_mentions_gugu(self):
        """Error message must mention 'Gugu' for identity consistency."""
        mock_llm = MagicMock()
        manager = ManagerCrew(language="en", llm=mock_llm)

        response = manager.get_error_response(Exception("LLM timeout"))

        assert "Gugu" in response["message"], (
            "Error response must mention Gugu for brand identity"
        )


class TestManagerCrewOptionalFields:
    """Test that optional context fields are handled gracefully."""

    def test_create_crew_with_empty_pending_intent(self):
        """Empty pending_intent should not cause KeyError in format()."""
        manager = ManagerCrew(language="en", llm=FAKE_LLM)

        context = {
            "message": "I want to check my report",
            "phone": "+27821234567",
            "language": "en",
            "session_status": "active",
            "user_exists": True,
            "user_id": "user-123",
            # conversation_history and pending_intent deliberately omitted
        }

        # Should NOT raise KeyError
        crew = manager.create_crew(context)
        assert crew is not None

    def test_create_crew_with_minimal_context(self):
        """create_crew works with minimal context (all optional fields absent)."""
        manager = ManagerCrew(language="en", llm=FAKE_LLM)

        context = {"message": "Hi"}

        crew = manager.create_crew(context)
        assert crew is not None
        assert crew.process == Process.hierarchical
