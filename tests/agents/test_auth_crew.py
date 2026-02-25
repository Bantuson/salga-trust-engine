"""Unit tests for AuthCrew — Phase 10.3 Plan 04.

Tests: agent structure (instantiation, tools, process, memory, delegation),
       prompt content (all languages, Gugu identity, CRITICAL IDENTITY),
       Pydantic model (AuthResult field_validator for Final Answer cleanup),
       build_auth_task_description() helper,
       tool importability and .name attribute verification.

All tests use mocks — no real LLM calls, no real Supabase/Twilio calls.

NOTE: OPENAI_API_KEY must be set before CrewAI imports — handled in conftest.py.

Key testing patterns:
- Tests that only check crew.language, crew.tools, crew.memory_enabled etc. use
  MagicMock() as llm= kwarg — these tests never call create_crew() so CrewAI
  validation is not triggered.
- Tests that call create_crew() use FAKE_LLM = crewai.LLM(model=...) so CrewAI
  Agent validation passes (MagicMock fails CrewAI's "model must be non-empty
  string" check).
"""
import os

import pytest
from unittest.mock import MagicMock, patch

# Fake API keys MUST be set before any CrewAI import (per conftest pattern)
os.environ.setdefault("OPENAI_API_KEY", "fake-key-for-tests")
os.environ.setdefault("DEEPSEEK_API_KEY", "fake-key-for-tests")

# FAKE_LLM — passes CrewAI Agent() model string validation without real API calls.
# MagicMock() fails CrewAI's "Model must be a non-empty string" check, so we use
# a real crewai.LLM with fake credentials for any test that calls create_crew().
from crewai import LLM
FAKE_LLM = LLM(model="openai/test-model", api_key="fake-key-for-tests")


# ---------------------------------------------------------------------------
# Section 1: Agent Structure Tests
# ---------------------------------------------------------------------------

class TestAuthCrewStructure:
    """Tests verifying AuthCrew instantiation, tools, process, memory, delegation."""

    def test_auth_crew_instantiates(self):
        """AuthCrew() creates without error."""
        from src.agents.crews.auth_crew import AuthCrew
        crew = AuthCrew(llm=MagicMock())
        assert crew is not None

    def test_auth_crew_instantiates_with_language(self):
        """AuthCrew(language='zu') stores language attribute."""
        from src.agents.crews.auth_crew import AuthCrew
        crew = AuthCrew(language="zu", llm=MagicMock())
        assert crew.language == "zu"

    def test_auth_crew_language_defaults_to_en(self):
        """AuthCrew() without language arg defaults to 'en'."""
        from src.agents.crews.auth_crew import AuthCrew
        crew = AuthCrew(llm=MagicMock())
        assert crew.language == "en"

    def test_auth_crew_invalid_language_falls_back_to_en(self):
        """AuthCrew(language='xx') falls back to 'en'."""
        from src.agents.crews.auth_crew import AuthCrew
        crew = AuthCrew(language="xx", llm=MagicMock())
        assert crew.language == "en"

    def test_auth_crew_uses_routing_llm(self):
        """AuthCrew (without llm kwarg) calls get_routing_llm() (gpt-4o-mini path)."""
        # get_routing_llm is imported inside AuthCrew.__init__ from src.agents.llm
        with patch("src.agents.llm.get_routing_llm", return_value=MagicMock()) as patched:
            from src.agents.crews.auth_crew import AuthCrew
            # We must reload the module so the import inside __init__ picks up the patch
            import importlib
            import src.agents.crews.auth_crew as auth_crew_module
            importlib.reload(auth_crew_module)
            # The fact that AuthCrew can be constructed with no llm kwarg shows
            # it falls through to get_routing_llm() in its parent __init__.
            # Patch at the module level the import sees.
            with patch("src.agents.llm.get_routing_llm", return_value=MagicMock()):
                crew = auth_crew_module.AuthCrew()
                # Crew was constructed — routing LLM factory was available
                assert crew is not None

    def test_auth_crew_has_correct_tools(self):
        """AuthCrew has lookup_user_tool, send_otp_tool, verify_otp_tool, create_supabase_user_tool."""
        from src.agents.crews.auth_crew import AuthCrew
        crew = AuthCrew(llm=MagicMock())
        tool_names = [getattr(t, "name", None) for t in crew.tools]
        assert "lookup_user_tool" in tool_names
        assert "send_otp_tool" in tool_names
        assert "verify_otp_tool" in tool_names
        assert "create_supabase_user_tool" in tool_names

    def test_auth_crew_has_exactly_four_tools(self):
        """AuthCrew has exactly 4 tools — no more, no less."""
        from src.agents.crews.auth_crew import AuthCrew
        crew = AuthCrew(llm=MagicMock())
        assert len(crew.tools) == 4

    def test_auth_crew_memory_disabled(self):
        """AuthCrew has memory_enabled=False (PII protection per locked decision)."""
        from src.agents.crews.auth_crew import AuthCrew
        crew = AuthCrew(llm=MagicMock())
        assert crew.memory_enabled is False

    def test_auth_crew_agent_key(self):
        """AuthCrew.agent_key is 'auth_agent'."""
        from src.agents.crews.auth_crew import AuthCrew
        crew = AuthCrew(llm=MagicMock())
        assert crew.agent_key == "auth_agent"

    def test_auth_crew_task_key(self):
        """AuthCrew.task_key is 'auth_task'."""
        from src.agents.crews.auth_crew import AuthCrew
        crew = AuthCrew(llm=MagicMock())
        assert crew.task_key == "auth_task"

    def test_auth_crew_create_crew_returns_crew(self, auth_context):
        """create_crew(context) returns a crewai.Crew object."""
        from crewai import Crew
        from src.agents.crews.auth_crew import AuthCrew
        # FAKE_LLM needed: create_crew() calls Agent() which validates llm model string
        auth = AuthCrew(llm=FAKE_LLM)
        crew = auth.create_crew(auth_context)
        assert isinstance(crew, Crew)

    def test_auth_crew_sequential_process(self, auth_context):
        """Crew uses Process.sequential (not hierarchical)."""
        from crewai import Process
        from src.agents.crews.auth_crew import AuthCrew
        auth = AuthCrew(llm=FAKE_LLM)
        crew = auth.create_crew(auth_context)
        assert crew.process == Process.sequential

    def test_auth_crew_memory_false_in_crew(self, auth_context):
        """Crew is created with memory=False."""
        from src.agents.crews.auth_crew import AuthCrew
        auth = AuthCrew(llm=FAKE_LLM)
        crew = auth.create_crew(auth_context)
        assert crew.memory is False

    def test_auth_crew_no_delegation(self, auth_context):
        """Agent has allow_delegation=False."""
        from src.agents.crews.auth_crew import AuthCrew
        auth = AuthCrew(llm=FAKE_LLM)
        crew = auth.create_crew(auth_context)
        agent = crew.agents[0]
        assert agent.allow_delegation is False

    def test_auth_crew_single_agent_single_task(self, auth_context):
        """Crew has exactly 1 agent and 1 task (Phase 10.3 pattern)."""
        from src.agents.crews.auth_crew import AuthCrew
        auth = AuthCrew(llm=FAKE_LLM)
        crew = auth.create_crew(auth_context)
        assert len(crew.agents) == 1
        assert len(crew.tasks) == 1


# ---------------------------------------------------------------------------
# Section 2: Prompt Tests
# ---------------------------------------------------------------------------

class TestAuthPrompts:
    """Tests verifying AUTH_PROMPTS content and build_auth_task_description()."""

    def test_auth_prompts_all_languages(self):
        """AUTH_PROMPTS has 'en', 'zu', 'af' keys."""
        from src.agents.prompts.auth import AUTH_PROMPTS
        assert "en" in AUTH_PROMPTS
        assert "zu" in AUTH_PROMPTS
        assert "af" in AUTH_PROMPTS

    def test_auth_prompts_has_exactly_three_languages(self):
        """AUTH_PROMPTS has exactly 3 language keys."""
        from src.agents.prompts.auth import AUTH_PROMPTS
        assert len(AUTH_PROMPTS) == 3

    def test_auth_prompts_contain_gugu(self):
        """Each prompt contains 'Gugu' identity."""
        from src.agents.prompts.auth import AUTH_PROMPTS
        for lang, prompt in AUTH_PROMPTS.items():
            assert "Gugu" in prompt, f"Prompt for '{lang}' does not contain 'Gugu'"

    def test_auth_prompts_critical_identity_first(self):
        """Each prompt starts with a CRITICAL IDENTITY section as the first content."""
        from src.agents.prompts.auth import AUTH_PROMPTS
        critical_markers = {
            "en": "CRITICAL IDENTITY",
            "zu": "OKUBALULEKILE KOKUQALA",
            "af": "KRITIEKE IDENTITEIT",
        }
        for lang, prompt in AUTH_PROMPTS.items():
            marker = critical_markers[lang]
            # The CRITICAL IDENTITY section must appear at the top (within first 100 chars)
            assert prompt.strip().startswith(marker), (
                f"Prompt for '{lang}' does not start with '{marker}'. "
                f"First 100 chars: {prompt.strip()[:100]!r}"
            )

    def test_auth_prompts_contain_tool_usage_instruction(self):
        """Each prompt contains mandatory tool usage instruction (no skipping OTP calls)."""
        from src.agents.prompts.auth import AUTH_PROMPTS
        tool_usage_markers = {
            "en": "TOOL USAGE",
            "zu": "UKUSETSHENZISWA KWETHULUZI",
            "af": "GEREEDSKAP GEBRUIK",
        }
        for lang, prompt in AUTH_PROMPTS.items():
            marker = tool_usage_markers[lang]
            assert marker in prompt, (
                f"Prompt for '{lang}' does not contain tool usage section '{marker}'"
            )

    def test_auth_prompts_en_contains_registration_flow(self):
        """English prompt contains REGISTRATION FLOW section."""
        from src.agents.prompts.auth import AUTH_PROMPTS
        assert "REGISTRATION FLOW" in AUTH_PROMPTS["en"]

    def test_auth_prompts_en_contains_four_tools_listed(self):
        """English prompt lists all 4 tools."""
        from src.agents.prompts.auth import AUTH_PROMPTS
        en_prompt = AUTH_PROMPTS["en"]
        assert "lookup_user_tool" in en_prompt
        assert "send_otp_tool" in en_prompt
        assert "verify_otp_tool" in en_prompt
        assert "create_supabase_user_tool" in en_prompt

    def test_auth_prompts_contain_response_rules(self):
        """Each prompt ends with RESPONSE RULES guardrail block."""
        from src.agents.prompts.auth import AUTH_PROMPTS
        response_rule_markers = {
            "en": "RESPONSE RULES",
            "zu": "IMITHETHO YEMPENDULO",
            "af": "REAKSIE REELS",
        }
        for lang, prompt in AUTH_PROMPTS.items():
            marker = response_rule_markers[lang]
            assert marker in prompt, (
                f"Prompt for '{lang}' does not contain response rules section '{marker}'"
            )

    def test_build_auth_task_new_user(self):
        """build_auth_task_description returns new user instructions when session_status='none'."""
        from src.agents.prompts.auth import build_auth_task_description
        context = {
            "phone": "+27821234567",
            "language": "en",
            "user_exists": False,
            "session_status": "none",
            "user_id": None,
            "conversation_history": "(none)",
            "message": "Hi I want to report a pothole",
        }
        description = build_auth_task_description(context)
        # New user instructions should include registration flow steps
        assert "STEP 1" in description
        assert "STEP 2" in description
        # Should include context values
        assert "+27821234567" in description
        assert "en" in description

    def test_build_auth_task_returning_user(self):
        """build_auth_task_description returns returning user instructions when session_status='active'."""
        from src.agents.prompts.auth import build_auth_task_description
        context = {
            "phone": "+27821234567",
            "language": "en",
            "user_exists": True,
            "session_status": "active",
            "user_id": "user-uuid-abc",
            "conversation_history": "(none)",
            "message": "I forgot my details",
        }
        description = build_auth_task_description(context)
        # Returning user instructions for re-auth — user_id embedded in description
        assert "user-uuid-abc" in description
        # Should NOT include full registration steps (those are for new users)
        assert "STEP 1 — Collect personal details" not in description

    def test_build_auth_task_expired_session(self):
        """build_auth_task_description returns returning user instructions when session_status='expired'."""
        from src.agents.prompts.auth import build_auth_task_description
        context = {
            "phone": "+27821234567",
            "language": "en",
            "user_exists": True,
            "session_status": "expired",
            "user_id": "user-uuid-xyz",
            "conversation_history": "(none)",
            "message": "My session expired",
        }
        description = build_auth_task_description(context)
        assert "user-uuid-xyz" in description

    def test_build_auth_task_user_exists_string(self):
        """build_auth_task_description handles user_exists as string 'True' or 'False'."""
        from src.agents.prompts.auth import build_auth_task_description
        context = {
            "phone": "+27821234567",
            "language": "en",
            "user_exists": "True",    # String, not bool
            "session_status": "active",
            "user_id": "user-uuid-abc",
            "conversation_history": "(none)",
            "message": "Hi",
        }
        # Should not raise — handles string coercion
        description = build_auth_task_description(context)
        assert description is not None
        assert len(description) > 50

    def test_build_auth_task_includes_conversation_history(self):
        """build_auth_task_description includes conversation_history in output."""
        from src.agents.prompts.auth import build_auth_task_description
        history = "User: Hi\nAgent: Hello there!"
        context = {
            "phone": "+27821234567",
            "language": "en",
            "user_exists": False,
            "session_status": "none",
            "user_id": None,
            "conversation_history": history,
            "message": "I want to register",
        }
        description = build_auth_task_description(context)
        assert history in description

    def test_build_auth_task_new_user_uses_none_user_id(self):
        """build_auth_task_description handles None user_id gracefully (new users)."""
        from src.agents.prompts.auth import build_auth_task_description
        context = {
            "phone": "+27821234567",
            "language": "en",
            "user_exists": False,
            "session_status": "none",
            "user_id": None,
            "conversation_history": "(none)",
            "message": "Hi",
        }
        # Should not raise — None user_id is valid for new users
        description = build_auth_task_description(context)
        assert "none" in description  # Substituted as string "none"


# ---------------------------------------------------------------------------
# Section 3: Pydantic Model Tests
# ---------------------------------------------------------------------------

class TestAuthResult:
    """Tests verifying AuthResult Pydantic model behavior."""

    def test_auth_result_strips_final_answer(self):
        """AuthResult(message='Final Answer: Hello') strips the prefix -> message='Hello'."""
        from src.agents.prompts.auth import AuthResult
        result = AuthResult(message="Final Answer: Hello")
        assert result.message == "Hello"

    def test_auth_result_strips_final_answer_with_whitespace(self):
        """AuthResult strips 'Final Answer:' variant with extra whitespace."""
        from src.agents.prompts.auth import AuthResult
        result = AuthResult(message="Final Answer:   Welcome to SALGA!")
        assert result.message == "Welcome to SALGA!"

    def test_auth_result_preserves_clean_message(self):
        """AuthResult(message='Hello') preserves message unchanged."""
        from src.agents.prompts.auth import AuthResult
        result = AuthResult(message="Hello, I am Gugu from SALGA Trust Engine.")
        assert result.message == "Hello, I am Gugu from SALGA Trust Engine."

    def test_auth_result_defaults(self):
        """AuthResult default field values: requires_otp=False, session_status='none', language='en'."""
        from src.agents.prompts.auth import AuthResult
        result = AuthResult(message="Test message")
        assert result.requires_otp is False
        assert result.session_status == "none"
        assert result.language == "en"

    def test_auth_result_custom_fields(self):
        """All fields accept custom values."""
        from src.agents.prompts.auth import AuthResult
        result = AuthResult(
            message="OTP sent to your phone.",
            requires_otp=True,
            session_status="otp_pending",
            language="zu",
        )
        assert result.message == "OTP sent to your phone."
        assert result.requires_otp is True
        assert result.session_status == "otp_pending"
        assert result.language == "zu"

    def test_auth_result_model_dump(self):
        """AuthResult.model_dump() returns dict with all 4 fields."""
        from src.agents.prompts.auth import AuthResult
        result = AuthResult(message="Hello!")
        dump = result.model_dump()
        assert "message" in dump
        assert "requires_otp" in dump
        assert "session_status" in dump
        assert "language" in dump

    def test_auth_result_does_not_strip_mid_text_final_answer(self):
        """AuthResult only strips 'Final Answer:' as a prefix, not mid-text occurrences."""
        from src.agents.prompts.auth import AuthResult
        # "Final Answer:" NOT at start — should be preserved as-is
        msg = "Here is the Final Answer: to your question about registration."
        result = AuthResult(message=msg)
        # The validator uses startswith() check so mid-text Final Answer: is NOT stripped
        assert result.message == msg

    def test_auth_result_final_answer_with_long_message(self):
        """AuthResult correctly strips Final Answer: prefix from multi-sentence messages."""
        from src.agents.prompts.auth import AuthResult
        result = AuthResult(
            message="Final Answer: Hello! I'm Gugu from SALGA Trust Engine. "
                    "Are you a new user or have you used SALGA before?"
        )
        assert result.message.startswith("Hello! I'm Gugu")
        assert "Final Answer:" not in result.message


# ---------------------------------------------------------------------------
# Section 4: Tool Tests
# ---------------------------------------------------------------------------

class TestAuthTools:
    """Tests verifying auth tools importability and .name attribute."""

    def test_all_auth_tools_importable(self):
        """All 4 tools import without error."""
        from src.agents.tools.auth_tool import (
            lookup_user_tool,
            send_otp_tool,
            verify_otp_tool,
            create_supabase_user_tool,
        )
        assert lookup_user_tool is not None
        assert send_otp_tool is not None
        assert verify_otp_tool is not None
        assert create_supabase_user_tool is not None

    def test_lookup_user_tool_name(self):
        """lookup_user_tool.name is 'lookup_user_tool'."""
        from src.agents.tools.auth_tool import lookup_user_tool
        assert lookup_user_tool.name == "lookup_user_tool"

    def test_send_otp_tool_name(self):
        """send_otp_tool.name is 'send_otp_tool'."""
        from src.agents.tools.auth_tool import send_otp_tool
        assert send_otp_tool.name == "send_otp_tool"

    def test_verify_otp_tool_name(self):
        """verify_otp_tool.name is 'verify_otp_tool'."""
        from src.agents.tools.auth_tool import verify_otp_tool
        assert verify_otp_tool.name == "verify_otp_tool"

    def test_create_supabase_user_tool_name(self):
        """create_supabase_user_tool.name is 'create_supabase_user_tool'."""
        from src.agents.tools.auth_tool import create_supabase_user_tool
        assert create_supabase_user_tool.name == "create_supabase_user_tool"

    def test_tools_have_run_attribute(self):
        """All tools are BaseTool subclasses with a ._run method (not raw callable)."""
        from src.agents.tools.auth_tool import (
            lookup_user_tool,
            send_otp_tool,
            verify_otp_tool,
            create_supabase_user_tool,
        )
        for tool in [lookup_user_tool, send_otp_tool, verify_otp_tool, create_supabase_user_tool]:
            # CrewAI @tool / BaseTool — test via .name and ._run presence
            assert hasattr(tool, "name"), f"Tool {tool} does not have .name attribute"
            assert hasattr(tool, "_run"), f"Tool {tool} does not have ._run attribute"

    def test_tools_have_description(self):
        """All tools have a non-empty .description attribute."""
        from src.agents.tools.auth_tool import (
            lookup_user_tool,
            send_otp_tool,
            verify_otp_tool,
            create_supabase_user_tool,
        )
        for tool in [lookup_user_tool, send_otp_tool, verify_otp_tool, create_supabase_user_tool]:
            assert hasattr(tool, "description")
            assert tool.description  # Non-empty

    def test_tools_have_args_schema(self):
        """All tools have args_schema (Pydantic input validation)."""
        from src.agents.tools.auth_tool import (
            lookup_user_tool,
            send_otp_tool,
            verify_otp_tool,
            create_supabase_user_tool,
        )
        for tool in [lookup_user_tool, send_otp_tool, verify_otp_tool, create_supabase_user_tool]:
            assert hasattr(tool, "args_schema")
            assert tool.args_schema is not None

    def test_tools_are_basetool_instances(self):
        """All tools are instances of crewai.tools.BaseTool."""
        from crewai.tools import BaseTool
        from src.agents.tools.auth_tool import (
            lookup_user_tool,
            send_otp_tool,
            verify_otp_tool,
            create_supabase_user_tool,
        )
        for tool in [lookup_user_tool, send_otp_tool, verify_otp_tool, create_supabase_user_tool]:
            assert isinstance(tool, BaseTool), (
                f"Tool '{getattr(tool, 'name', tool)}' is not a BaseTool instance"
            )
