"""Unit tests for TicketStatusCrew.

Tests cover:
- Agent structure (instantiation, tools, process, memory, delegation)
- Trilingual Gugu prompts (all languages, Gugu identity)
- Pydantic output model (TicketStatusResponse validation, defaults)
- Task description builder (build_ticket_status_task_description)
- Tool importability (lookup_ticket_tool)

Mock pattern (per Phase 06.9.1-04 locked decision):
- Tests that only check crew.language, crew.tools, crew.memory_enabled etc. use
  MagicMock() as llm= kwarg — these tests never call create_crew() so CrewAI
  validation is not triggered.
- Tests that call create_crew() use FAKE_LLM = crewai.LLM(model=...) so CrewAI
  Agent validation passes (MagicMock fails CrewAI's "model must be non-empty
  string" check).

No real LLM calls, no real Supabase calls in any test.
"""
import os
from unittest.mock import MagicMock

import pytest

# Fake API keys MUST be set before any CrewAI import (per conftest pattern)
os.environ.setdefault("OPENAI_API_KEY", "fake-key-for-tests")
os.environ.setdefault("DEEPSEEK_API_KEY", "fake-key-for-tests")

# FAKE_LLM — passes CrewAI Agent() model string validation without real API calls.
# MagicMock() fails CrewAI's "Model must be a non-empty string" check for create_crew().
from crewai import LLM
FAKE_LLM = LLM(model="openai/test-model", api_key="fake-key-for-tests")


# ---------------------------------------------------------------------------
# Section 1: Agent Structure Tests
# ---------------------------------------------------------------------------

class TestTicketStatusCrewStructure:
    """Verify TicketStatusCrew instantiates and creates a valid Crew."""

    def test_ticket_status_crew_instantiates(self):
        """TicketStatusCrew() creates without error."""
        from src.agents.crews.ticket_status_crew import TicketStatusCrew
        crew_obj = TicketStatusCrew(llm=MagicMock())
        assert crew_obj is not None

    def test_ticket_status_crew_instantiates_with_language(self):
        """TicketStatusCrew(language='zu') stores language."""
        from src.agents.crews.ticket_status_crew import TicketStatusCrew
        crew_obj = TicketStatusCrew(language="zu", llm=MagicMock())
        assert crew_obj.language == "zu"

    def test_ticket_status_crew_instantiates_with_afrikaans(self):
        """TicketStatusCrew(language='af') stores language."""
        from src.agents.crews.ticket_status_crew import TicketStatusCrew
        crew_obj = TicketStatusCrew(language="af", llm=MagicMock())
        assert crew_obj.language == "af"

    def test_ticket_status_crew_has_lookup_tool(self):
        """TicketStatusCrew.tools contains lookup_ticket_tool."""
        from src.agents.crews.ticket_status_crew import TicketStatusCrew
        from src.agents.tools.ticket_lookup_tool import lookup_ticket_tool
        crew_obj = TicketStatusCrew(llm=MagicMock())
        assert lookup_ticket_tool in crew_obj.tools

    def test_ticket_status_crew_has_exactly_one_tool(self):
        """TicketStatusCrew has exactly 1 tool (lookup_ticket_tool)."""
        from src.agents.crews.ticket_status_crew import TicketStatusCrew
        crew_obj = TicketStatusCrew(llm=MagicMock())
        assert len(crew_obj.tools) == 1

    def test_ticket_status_crew_create_crew_returns_crew(self, ticket_status_context):
        """create_crew(context) returns a Crew object."""
        from crewai import Crew
        from src.agents.crews.ticket_status_crew import TicketStatusCrew
        # FAKE_LLM needed: create_crew() calls Agent() which validates llm model string
        crew_obj = TicketStatusCrew(llm=FAKE_LLM)
        crew = crew_obj.create_crew(ticket_status_context)
        assert isinstance(crew, Crew)

    def test_ticket_status_crew_sequential_process(self, ticket_status_context):
        """Crew uses Process.sequential (never hierarchical)."""
        from crewai import Process
        from src.agents.crews.ticket_status_crew import TicketStatusCrew
        crew_obj = TicketStatusCrew(llm=FAKE_LLM)
        crew = crew_obj.create_crew(ticket_status_context)
        assert crew.process == Process.sequential

    def test_ticket_status_crew_memory_disabled(self, ticket_status_context):
        """Crew has memory=False — conversation history injected as string context."""
        from src.agents.crews.ticket_status_crew import TicketStatusCrew
        crew_obj = TicketStatusCrew(llm=FAKE_LLM)
        crew = crew_obj.create_crew(ticket_status_context)
        assert crew.memory is False

    def test_ticket_status_crew_no_delegation(self, ticket_status_context):
        """Agent has allow_delegation=False — no sub-agent delegation."""
        from src.agents.crews.ticket_status_crew import TicketStatusCrew
        crew_obj = TicketStatusCrew(llm=FAKE_LLM)
        crew = crew_obj.create_crew(ticket_status_context)
        agent = crew.agents[0]
        assert agent.allow_delegation is False

    def test_ticket_status_crew_agent_has_lookup_tool(self, ticket_status_context):
        """The agent within the Crew has lookup_ticket_tool in its tools."""
        from src.agents.crews.ticket_status_crew import TicketStatusCrew
        crew_obj = TicketStatusCrew(llm=FAKE_LLM)
        crew = crew_obj.create_crew(ticket_status_context)
        agent = crew.agents[0]
        tool_names = [t.name for t in agent.tools]
        assert "lookup_ticket" in tool_names

    def test_ticket_status_crew_memory_enabled_class_attribute(self):
        """BaseCrew.memory_enabled is False for TicketStatusCrew."""
        from src.agents.crews.ticket_status_crew import TicketStatusCrew
        crew_obj = TicketStatusCrew(llm=MagicMock())
        assert crew_obj.memory_enabled is False

    def test_ticket_status_crew_single_agent_single_task(self, ticket_status_context):
        """Crew has exactly 1 agent and 1 task (Phase 10.3 pattern)."""
        from src.agents.crews.ticket_status_crew import TicketStatusCrew
        crew_obj = TicketStatusCrew(llm=FAKE_LLM)
        crew = crew_obj.create_crew(ticket_status_context)
        assert len(crew.agents) == 1
        assert len(crew.tasks) == 1

    def test_ticket_status_crew_agent_key(self):
        """TicketStatusCrew.agent_key is 'ticket_status_agent'."""
        from src.agents.crews.ticket_status_crew import TicketStatusCrew
        crew_obj = TicketStatusCrew(llm=MagicMock())
        assert crew_obj.agent_key == "ticket_status_agent"

    def test_ticket_status_crew_task_key(self):
        """TicketStatusCrew.task_key is 'ticket_status_task'."""
        from src.agents.crews.ticket_status_crew import TicketStatusCrew
        crew_obj = TicketStatusCrew(llm=MagicMock())
        assert crew_obj.task_key == "ticket_status_task"


# ---------------------------------------------------------------------------
# Section 2: Trilingual Gugu Prompt Tests
# ---------------------------------------------------------------------------

class TestTicketStatusPrompts:
    """Verify TICKET_STATUS_PROMPTS covers all languages and contains Gugu identity."""

    def test_ticket_status_prompts_all_languages(self):
        """TICKET_STATUS_PROMPTS has 'en', 'zu', 'af' keys."""
        from src.agents.prompts.ticket_status import TICKET_STATUS_PROMPTS
        assert "en" in TICKET_STATUS_PROMPTS
        assert "zu" in TICKET_STATUS_PROMPTS
        assert "af" in TICKET_STATUS_PROMPTS

    def test_ticket_status_prompts_contain_gugu_en(self):
        """English prompt contains 'Gugu' identity."""
        from src.agents.prompts.ticket_status import TICKET_STATUS_PROMPTS
        assert "Gugu" in TICKET_STATUS_PROMPTS["en"]

    def test_ticket_status_prompts_contain_gugu_zu(self):
        """isiZulu prompt contains 'Gugu' identity."""
        from src.agents.prompts.ticket_status import TICKET_STATUS_PROMPTS
        assert "Gugu" in TICKET_STATUS_PROMPTS["zu"]

    def test_ticket_status_prompts_contain_gugu_af(self):
        """Afrikaans prompt contains 'Gugu' identity."""
        from src.agents.prompts.ticket_status import TICKET_STATUS_PROMPTS
        assert "Gugu" in TICKET_STATUS_PROMPTS["af"]

    def test_ticket_status_prompts_contain_critical_identity(self):
        """Each prompt starts with CRITICAL IDENTITY section."""
        from src.agents.prompts.ticket_status import TICKET_STATUS_PROMPTS
        assert "CRITICAL IDENTITY" in TICKET_STATUS_PROMPTS["en"]
        assert "OKUBALULEKILE" in TICKET_STATUS_PROMPTS["zu"]
        assert "KRITIEKE IDENTITEIT" in TICKET_STATUS_PROMPTS["af"]

    def test_ticket_status_prompts_mention_lookup_tool(self):
        """English prompt mentions lookup_ticket_tool by name."""
        from src.agents.prompts.ticket_status import TICKET_STATUS_PROMPTS
        assert "lookup_ticket_tool" in TICKET_STATUS_PROMPTS["en"]

    def test_ticket_status_prompts_are_non_empty_strings(self):
        """All prompts are non-empty strings of substantial length."""
        from src.agents.prompts.ticket_status import TICKET_STATUS_PROMPTS
        for lang in ("en", "zu", "af"):
            assert isinstance(TICKET_STATUS_PROMPTS[lang], str)
            assert len(TICKET_STATUS_PROMPTS[lang]) > 100

    def test_ticket_status_prompts_mention_tracking_number(self):
        """English prompt mentions tracking number concept."""
        from src.agents.prompts.ticket_status import TICKET_STATUS_PROMPTS
        assert "tracking" in TICKET_STATUS_PROMPTS["en"].lower()


# ---------------------------------------------------------------------------
# Section 3: Pydantic Output Model Tests
# ---------------------------------------------------------------------------

class TestTicketStatusResponseModel:
    """Verify TicketStatusResponse validates correctly with various inputs."""

    def test_ticket_status_response_model_defaults(self):
        """TicketStatusResponse validates with only required field (message)."""
        from src.agents.prompts.ticket_status import TicketStatusResponse
        model = TicketStatusResponse(message="Hello!")
        assert model.message == "Hello!"
        assert model.tickets_found == 0
        assert model.language == "en"

    def test_ticket_status_response_with_tickets_found(self):
        """TicketStatusResponse accepts tickets_found count."""
        from src.agents.prompts.ticket_status import TicketStatusResponse
        model = TicketStatusResponse(
            message="I found 2 tickets for you.",
            tickets_found=2,
            language="en",
        )
        assert model.tickets_found == 2

    def test_ticket_status_response_strips_final_answer(self):
        """TicketStatusResponse(message='Final Answer: ...') strips the prefix."""
        from src.agents.prompts.ticket_status import TicketStatusResponse
        model = TicketStatusResponse(message="Final Answer: Your ticket is open.")
        assert model.message == "Your ticket is open."
        assert not model.message.startswith("Final Answer:")

    def test_ticket_status_response_preserves_clean_message(self):
        """TicketStatusResponse with clean message leaves it unchanged."""
        from src.agents.prompts.ticket_status import TicketStatusResponse
        model = TicketStatusResponse(message="Your pothole report is in progress.")
        assert model.message == "Your pothole report is in progress."

    def test_ticket_status_response_zu_language(self):
        """TicketStatusResponse accepts 'zu' language code."""
        from src.agents.prompts.ticket_status import TicketStatusResponse
        model = TicketStatusResponse(message="Sawubona!", language="zu")
        assert model.language == "zu"

    def test_ticket_status_response_af_language(self):
        """TicketStatusResponse accepts 'af' language code."""
        from src.agents.prompts.ticket_status import TicketStatusResponse
        model = TicketStatusResponse(message="Goeie dag!", language="af")
        assert model.language == "af"

    def test_ticket_status_response_invalid_language_defaults_to_en(self):
        """TicketStatusResponse with invalid language defaults to 'en'."""
        from src.agents.prompts.ticket_status import TicketStatusResponse
        model = TicketStatusResponse(message="Hello!", language="xx")
        assert model.language == "en"

    def test_ticket_status_response_model_dump_has_all_fields(self):
        """TicketStatusResponse.model_dump() returns dict with all 3 fields."""
        from src.agents.prompts.ticket_status import TicketStatusResponse
        model = TicketStatusResponse(message="Hello!")
        dump = model.model_dump()
        assert "message" in dump
        assert "tickets_found" in dump
        assert "language" in dump


# ---------------------------------------------------------------------------
# Section 4: Task Description Builder Tests
# ---------------------------------------------------------------------------

class TestBuildTicketStatusTaskDescription:
    """Verify build_ticket_status_task_description generates correct descriptions."""

    def test_build_ticket_status_task_description_returns_string(
        self, ticket_status_context
    ):
        """build_ticket_status_task_description returns a non-empty string."""
        from src.agents.prompts.ticket_status import build_ticket_status_task_description
        result = build_ticket_status_task_description(ticket_status_context)
        assert isinstance(result, str)
        assert len(result) > 50

    def test_build_ticket_status_task_description_includes_user_id(
        self, ticket_status_context
    ):
        """Task description contains user_id (required for security boundary)."""
        from src.agents.prompts.ticket_status import build_ticket_status_task_description
        result = build_ticket_status_task_description(ticket_status_context)
        assert ticket_status_context["user_id"] in result

    def test_build_ticket_status_task_description_includes_tracking_number(
        self, ticket_status_context
    ):
        """Task description contains tracking number when provided."""
        from src.agents.prompts.ticket_status import build_ticket_status_task_description
        result = build_ticket_status_task_description(ticket_status_context)
        assert ticket_status_context["tracking_number"] in result

    def test_build_ticket_status_task_description_includes_language(
        self, ticket_status_context
    ):
        """Task description contains language code."""
        from src.agents.prompts.ticket_status import build_ticket_status_task_description
        result = build_ticket_status_task_description(ticket_status_context)
        assert ticket_status_context["language"] in result

    def test_build_ticket_status_task_description_handles_missing_tracking_number(self):
        """build_ticket_status_task_description handles missing tracking_number gracefully."""
        from src.agents.prompts.ticket_status import build_ticket_status_task_description
        context = {
            "message": "What is my ticket status?",
            "user_id": "user-uuid-789",
            "language": "en",
            "conversation_history": "(none)",
        }
        result = build_ticket_status_task_description(context)
        assert isinstance(result, str)
        assert "(not provided)" in result

    def test_build_ticket_status_task_description_handles_minimal_context(self):
        """build_ticket_status_task_description handles minimal context gracefully."""
        from src.agents.prompts.ticket_status import build_ticket_status_task_description
        minimal_context = {"message": "What is the status of my report?"}
        result = build_ticket_status_task_description(minimal_context)
        assert isinstance(result, str)
        assert len(result) > 50


# ---------------------------------------------------------------------------
# Section 5: Tool Importability Tests
# ---------------------------------------------------------------------------

class TestLookupTicketToolImportability:
    """Verify lookup_ticket_tool is a proper CrewAI Tool instance."""

    def test_lookup_ticket_tool_importable(self):
        """lookup_ticket_tool imports without error."""
        from src.agents.tools.ticket_lookup_tool import lookup_ticket_tool
        assert lookup_ticket_tool is not None

    def test_lookup_ticket_tool_has_name(self):
        """lookup_ticket_tool has a .name attribute (CrewAI Tool instance)."""
        from src.agents.tools.ticket_lookup_tool import lookup_ticket_tool
        assert hasattr(lookup_ticket_tool, "name")
        assert lookup_ticket_tool.name == "lookup_ticket"

    def test_lookup_ticket_tool_has_run_attribute(self):
        """lookup_ticket_tool has a .run attribute (CrewAI Tool instance)."""
        from src.agents.tools.ticket_lookup_tool import lookup_ticket_tool
        assert hasattr(lookup_ticket_tool, "run")

    def test_lookup_ticket_tool_has_description(self):
        """lookup_ticket_tool has a non-empty description."""
        from src.agents.tools.ticket_lookup_tool import lookup_ticket_tool
        assert hasattr(lookup_ticket_tool, "description")
        assert len(lookup_ticket_tool.description) > 10

    def test_lookup_ticket_tool_is_basetool_instance(self):
        """lookup_ticket_tool is a BaseTool subclass instance."""
        from crewai.tools import BaseTool
        from src.agents.tools.ticket_lookup_tool import lookup_ticket_tool
        assert isinstance(lookup_ticket_tool, BaseTool)
