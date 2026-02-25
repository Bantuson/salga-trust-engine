"""Unit tests for MunicipalIntakeCrew.

Tests cover:
- Agent structure (instantiation, tools, process, memory, delegation)
- Trilingual Gugu prompts (all languages, Gugu identity, category coverage)
- Pydantic output model (MunicipalResponse validation, defaults, custom values)
- Task description builder (build_municipal_task_description)
- Tool importability (create_municipal_ticket)

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

class TestMunicipalCrewStructure:
    """Verify MunicipalIntakeCrew instantiates and creates a valid Crew."""

    def test_municipal_crew_instantiates(self):
        """MunicipalIntakeCrew() creates without error."""
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew
        crew_obj = MunicipalIntakeCrew(llm=MagicMock())
        assert crew_obj is not None

    def test_municipal_crew_instantiates_with_language(self):
        """MunicipalIntakeCrew(language='zu') stores language."""
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew
        crew_obj = MunicipalIntakeCrew(language="zu", llm=MagicMock())
        assert crew_obj.language == "zu"

    def test_municipal_crew_instantiates_with_afrikaans(self):
        """MunicipalIntakeCrew(language='af') stores language."""
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew
        crew_obj = MunicipalIntakeCrew(language="af", llm=MagicMock())
        assert crew_obj.language == "af"

    def test_municipal_crew_has_ticket_tool(self):
        """MunicipalIntakeCrew.tools contains create_municipal_ticket."""
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew
        from src.agents.tools.ticket_tool import create_municipal_ticket
        crew_obj = MunicipalIntakeCrew(llm=MagicMock())
        assert create_municipal_ticket in crew_obj.tools

    def test_municipal_crew_has_exactly_one_tool(self):
        """MunicipalIntakeCrew has exactly 1 tool (create_municipal_ticket)."""
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew
        crew_obj = MunicipalIntakeCrew(llm=MagicMock())
        assert len(crew_obj.tools) == 1

    def test_municipal_crew_create_crew_returns_crew(self, municipal_context):
        """create_crew(context) returns a Crew object."""
        from crewai import Crew
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew
        # FAKE_LLM needed: create_crew() calls Agent() which validates llm model string
        crew_obj = MunicipalIntakeCrew(llm=FAKE_LLM)
        crew = crew_obj.create_crew(municipal_context)
        assert isinstance(crew, Crew)

    def test_municipal_crew_sequential_process(self, municipal_context):
        """Crew uses Process.sequential (never hierarchical)."""
        from crewai import Process
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew
        crew_obj = MunicipalIntakeCrew(llm=FAKE_LLM)
        crew = crew_obj.create_crew(municipal_context)
        assert crew.process == Process.sequential

    def test_municipal_crew_memory_disabled(self, municipal_context):
        """Crew has memory=False — conversation history injected as string context."""
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew
        crew_obj = MunicipalIntakeCrew(llm=FAKE_LLM)
        crew = crew_obj.create_crew(municipal_context)
        assert crew.memory is False

    def test_municipal_crew_no_delegation(self, municipal_context):
        """Agent has allow_delegation=False — no sub-agent delegation."""
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew
        crew_obj = MunicipalIntakeCrew(llm=FAKE_LLM)
        crew = crew_obj.create_crew(municipal_context)
        agent = crew.agents[0]
        assert agent.allow_delegation is False

    def test_municipal_crew_agent_has_ticket_tool(self, municipal_context):
        """The agent within the Crew has create_municipal_ticket in its tools."""
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew
        crew_obj = MunicipalIntakeCrew(llm=FAKE_LLM)
        crew = crew_obj.create_crew(municipal_context)
        agent = crew.agents[0]
        tool_names = [t.name for t in agent.tools]
        assert "create_municipal_ticket" in tool_names

    def test_municipal_crew_memory_enabled_class_attribute(self):
        """BaseCrew.memory_enabled is False for MunicipalIntakeCrew."""
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew
        crew_obj = MunicipalIntakeCrew(llm=MagicMock())
        assert crew_obj.memory_enabled is False

    def test_municipal_crew_single_agent_single_task(self, municipal_context):
        """Crew has exactly 1 agent and 1 task (Phase 10.3 pattern)."""
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew
        crew_obj = MunicipalIntakeCrew(llm=FAKE_LLM)
        crew = crew_obj.create_crew(municipal_context)
        assert len(crew.agents) == 1
        assert len(crew.tasks) == 1

    def test_municipal_crew_agent_key(self):
        """MunicipalIntakeCrew.agent_key is 'municipal_intake_agent'."""
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew
        crew_obj = MunicipalIntakeCrew(llm=MagicMock())
        assert crew_obj.agent_key == "municipal_intake_agent"

    def test_municipal_crew_task_key(self):
        """MunicipalIntakeCrew.task_key is 'municipal_intake_task'."""
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew
        crew_obj = MunicipalIntakeCrew(llm=MagicMock())
        assert crew_obj.task_key == "municipal_intake_task"


# ---------------------------------------------------------------------------
# Section 2: Trilingual Gugu Prompt Tests
# ---------------------------------------------------------------------------

class TestMunicipalPrompts:
    """Verify MUNICIPAL_PROMPTS covers all languages and contains Gugu identity."""

    def test_municipal_prompts_all_languages(self):
        """MUNICIPAL_PROMPTS has 'en', 'zu', 'af' keys."""
        from src.agents.prompts.municipal import MUNICIPAL_PROMPTS
        assert "en" in MUNICIPAL_PROMPTS
        assert "zu" in MUNICIPAL_PROMPTS
        assert "af" in MUNICIPAL_PROMPTS

    def test_municipal_prompts_contain_gugu_en(self):
        """English prompt contains 'Gugu' identity."""
        from src.agents.prompts.municipal import MUNICIPAL_PROMPTS
        assert "Gugu" in MUNICIPAL_PROMPTS["en"]

    def test_municipal_prompts_contain_gugu_zu(self):
        """isiZulu prompt contains 'Gugu' identity."""
        from src.agents.prompts.municipal import MUNICIPAL_PROMPTS
        assert "Gugu" in MUNICIPAL_PROMPTS["zu"]

    def test_municipal_prompts_contain_gugu_af(self):
        """Afrikaans prompt contains 'Gugu' identity."""
        from src.agents.prompts.municipal import MUNICIPAL_PROMPTS
        assert "Gugu" in MUNICIPAL_PROMPTS["af"]

    def test_municipal_prompts_contain_critical_identity(self):
        """Each prompt starts with CRITICAL IDENTITY section (per Phase 06.8-04 decision)."""
        from src.agents.prompts.municipal import MUNICIPAL_PROMPTS
        assert "CRITICAL IDENTITY" in MUNICIPAL_PROMPTS["en"]
        assert "OKUBALULEKILE" in MUNICIPAL_PROMPTS["zu"]
        assert "KRITIEKE IDENTITEIT" in MUNICIPAL_PROMPTS["af"]

    def test_municipal_prompts_list_category_water(self):
        """English prompt mentions 'water' category."""
        from src.agents.prompts.municipal import MUNICIPAL_PROMPTS
        assert "water" in MUNICIPAL_PROMPTS["en"]

    def test_municipal_prompts_list_category_roads(self):
        """English prompt mentions 'roads' category."""
        from src.agents.prompts.municipal import MUNICIPAL_PROMPTS
        assert "roads" in MUNICIPAL_PROMPTS["en"]

    def test_municipal_prompts_list_category_electricity(self):
        """English prompt mentions 'electricity' category."""
        from src.agents.prompts.municipal import MUNICIPAL_PROMPTS
        assert "electricity" in MUNICIPAL_PROMPTS["en"]

    def test_municipal_prompts_list_category_waste(self):
        """English prompt mentions 'waste' category."""
        from src.agents.prompts.municipal import MUNICIPAL_PROMPTS
        assert "waste" in MUNICIPAL_PROMPTS["en"]

    def test_municipal_prompts_list_category_sanitation(self):
        """English prompt mentions 'sanitation' category."""
        from src.agents.prompts.municipal import MUNICIPAL_PROMPTS
        assert "sanitation" in MUNICIPAL_PROMPTS["en"]

    def test_municipal_prompts_mention_create_ticket_tool(self):
        """English prompt mentions create_municipal_ticket tool by name."""
        from src.agents.prompts.municipal import MUNICIPAL_PROMPTS
        assert "create_municipal_ticket" in MUNICIPAL_PROMPTS["en"]

    def test_municipal_prompts_are_non_empty_strings(self):
        """All prompts are non-empty strings of substantial length."""
        from src.agents.prompts.municipal import MUNICIPAL_PROMPTS
        for lang in ("en", "zu", "af"):
            assert isinstance(MUNICIPAL_PROMPTS[lang], str)
            assert len(MUNICIPAL_PROMPTS[lang]) > 100


# ---------------------------------------------------------------------------
# Section 3: Pydantic Output Model Tests
# ---------------------------------------------------------------------------

class TestMunicipalResponseModel:
    """Verify MunicipalResponse validates correctly with various inputs."""

    def test_municipal_response_model_defaults(self):
        """MunicipalResponse validates with only required field (message)."""
        from src.agents.prompts.municipal import MunicipalResponse
        model = MunicipalResponse(message="Hello!")
        assert model.message == "Hello!"
        assert model.action_taken == "none"
        assert model.tracking_number == ""
        assert model.language == "en"

    def test_municipal_response_custom_ticket_created(self):
        """MunicipalResponse with action_taken='ticket_created' and tracking_number."""
        from src.agents.prompts.municipal import MunicipalResponse
        model = MunicipalResponse(
            message="Your report has been logged. Tracking: TKT-20260225-ABC123",
            action_taken="ticket_created",
            tracking_number="TKT-20260225-ABC123",
            language="en",
        )
        assert model.action_taken == "ticket_created"
        assert model.tracking_number == "TKT-20260225-ABC123"

    def test_municipal_response_collecting_info(self):
        """MunicipalResponse with action_taken='collecting_info'."""
        from src.agents.prompts.municipal import MunicipalResponse
        model = MunicipalResponse(
            message="Could you tell me where the problem is located?",
            action_taken="collecting_info",
        )
        assert model.action_taken == "collecting_info"

    def test_municipal_response_strips_final_answer(self):
        """MunicipalResponse(message='Final Answer: Hello') strips the prefix."""
        from src.agents.prompts.municipal import MunicipalResponse
        model = MunicipalResponse(message="Final Answer: Hello!")
        assert model.message == "Hello!"
        assert not model.message.startswith("Final Answer:")

    def test_municipal_response_preserves_clean_message(self):
        """MunicipalResponse with clean message leaves it unchanged."""
        from src.agents.prompts.municipal import MunicipalResponse
        model = MunicipalResponse(message="Could you describe the problem?")
        assert model.message == "Could you describe the problem?"

    def test_municipal_response_zu_language(self):
        """MunicipalResponse accepts 'zu' language code."""
        from src.agents.prompts.municipal import MunicipalResponse
        model = MunicipalResponse(message="Sawubona!", language="zu")
        assert model.language == "zu"

    def test_municipal_response_af_language(self):
        """MunicipalResponse accepts 'af' language code."""
        from src.agents.prompts.municipal import MunicipalResponse
        model = MunicipalResponse(message="Goeie dag!", language="af")
        assert model.language == "af"

    def test_municipal_response_invalid_language_defaults_to_en(self):
        """MunicipalResponse with invalid language code defaults to 'en'."""
        from src.agents.prompts.municipal import MunicipalResponse
        model = MunicipalResponse(message="Hello!", language="xx")
        assert model.language == "en"

    def test_municipal_response_model_dump_has_all_fields(self):
        """MunicipalResponse.model_dump() returns dict with all 4 fields."""
        from src.agents.prompts.municipal import MunicipalResponse
        model = MunicipalResponse(message="Hello!")
        dump = model.model_dump()
        assert "message" in dump
        assert "action_taken" in dump
        assert "tracking_number" in dump
        assert "language" in dump


# ---------------------------------------------------------------------------
# Section 4: Task Description Builder Tests
# ---------------------------------------------------------------------------

class TestBuildMunicipalTaskDescription:
    """Verify build_municipal_task_description generates correct descriptions."""

    def test_build_municipal_task_description_returns_string(self, municipal_context):
        """build_municipal_task_description returns a non-empty string."""
        from src.agents.prompts.municipal import build_municipal_task_description
        result = build_municipal_task_description(municipal_context)
        assert isinstance(result, str)
        assert len(result) > 50

    def test_build_municipal_task_description_includes_phone(self, municipal_context):
        """Task description contains citizen's phone number."""
        from src.agents.prompts.municipal import build_municipal_task_description
        result = build_municipal_task_description(municipal_context)
        assert municipal_context["phone"] in result

    def test_build_municipal_task_description_includes_language(self, municipal_context):
        """Task description contains language code."""
        from src.agents.prompts.municipal import build_municipal_task_description
        result = build_municipal_task_description(municipal_context)
        assert municipal_context["language"] in result

    def test_build_municipal_task_description_includes_user_id(self, municipal_context):
        """Task description contains user_id for tool call context."""
        from src.agents.prompts.municipal import build_municipal_task_description
        result = build_municipal_task_description(municipal_context)
        assert municipal_context["user_id"] in result

    def test_build_municipal_task_description_includes_history(self, municipal_context):
        """Task description contains conversation history."""
        from src.agents.prompts.municipal import build_municipal_task_description
        result = build_municipal_task_description(municipal_context)
        assert "Gugu: Welcome!" in result

    def test_build_municipal_task_description_handles_missing_fields(self):
        """build_municipal_task_description handles minimal context gracefully."""
        from src.agents.prompts.municipal import build_municipal_task_description
        minimal_context = {"message": "There is a pothole"}
        result = build_municipal_task_description(minimal_context)
        assert isinstance(result, str)
        assert len(result) > 50

    def test_build_municipal_task_description_includes_create_ticket_tool(
        self, municipal_context
    ):
        """Task description mentions create_municipal_ticket tool."""
        from src.agents.prompts.municipal import build_municipal_task_description
        result = build_municipal_task_description(municipal_context)
        assert "create_municipal_ticket" in result


# ---------------------------------------------------------------------------
# Section 5: Tool Importability Tests
# ---------------------------------------------------------------------------

class TestMunicipalToolImportability:
    """Verify create_municipal_ticket is a proper CrewAI Tool instance."""

    def test_create_municipal_ticket_importable(self):
        """create_municipal_ticket imports without error."""
        from src.agents.tools.ticket_tool import create_municipal_ticket
        assert create_municipal_ticket is not None

    def test_create_municipal_ticket_has_name(self):
        """create_municipal_ticket has a .name attribute (CrewAI Tool instance)."""
        from src.agents.tools.ticket_tool import create_municipal_ticket
        assert hasattr(create_municipal_ticket, "name")
        assert create_municipal_ticket.name == "create_municipal_ticket"

    def test_create_municipal_ticket_has_run_attribute(self):
        """create_municipal_ticket has a .run attribute (CrewAI Tool instance)."""
        from src.agents.tools.ticket_tool import create_municipal_ticket
        assert hasattr(create_municipal_ticket, "run")

    def test_create_municipal_ticket_has_description(self):
        """create_municipal_ticket has a non-empty description."""
        from src.agents.tools.ticket_tool import create_municipal_ticket
        assert hasattr(create_municipal_ticket, "description")
        assert len(create_municipal_ticket.description) > 10

    def test_create_municipal_ticket_is_basetool_instance(self):
        """create_municipal_ticket is a BaseTool subclass instance."""
        from crewai.tools import BaseTool
        from src.agents.tools.ticket_tool import create_municipal_ticket
        assert isinstance(create_municipal_ticket, BaseTool)
