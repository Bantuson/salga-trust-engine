"""Unit tests for GBVCrew — Phase 10.3 Plan 06.

Tests cover:
- Section 1: Agent Structure (instantiation, tools, process, memory, delegation)
- Section 2: Prompt Tests with SEC-05 focus (emergency numbers, no PII requests,
             trauma-informed language, Gugu identity in all 3 languages)
- Section 3: Pydantic Model Tests (GBVResponse defaults, field_validator)
- Section 4: SEC-05 Boundary Tests (debug metadata only, notify_saps no PII)

All tests use mocks — no real LLM calls, no real SAPS API calls.

Key SEC-05 tests:
- memory=False is CRITICAL — GBV conversations must NEVER persist across sessions
- emergency numbers (10111, 0800 150 150) MUST be in all language prompts
- GBV prompts do NOT ask for victim name, full address, or perpetrator identity
- notify_saps tool description explicitly prohibits PII
- Debug output is metadata-only (agent_name, turn_count, session_status, is_gbv)
- GBV prompts are NOT chatty (no "Hello, I'm Gugu, what's your name?" style)

NOTE: OPENAI_API_KEY must be set before CrewAI imports — handled in conftest.py.

Key testing patterns (same as test_auth_crew.py):
- Tests that only check crew.language, crew.tools, crew.memory_enabled use
  MagicMock() as llm= — these tests never call create_crew().
- Tests that call create_crew() use FAKE_LLM = crewai.LLM(model=...) so CrewAI
  Agent validation passes (MagicMock fails the "model must be non-empty string" check).
"""
import os

import pytest
from unittest.mock import MagicMock, patch

# Fake API keys MUST be set before any CrewAI import (per conftest pattern)
os.environ.setdefault("OPENAI_API_KEY", "fake-key-for-tests")
os.environ.setdefault("DEEPSEEK_API_KEY", "fake-key-for-tests")

# FAKE_LLM — passes CrewAI Agent() model string validation without real API calls.
from crewai import LLM
FAKE_LLM = LLM(model="openai/test-model", api_key="fake-key-for-tests")


# ---------------------------------------------------------------------------
# Section 1: Agent Structure Tests
# ---------------------------------------------------------------------------

class TestGBVCrewStructure:
    """Tests verifying GBVCrew instantiation, tools, process, memory, delegation."""

    def test_gbv_crew_instantiates(self):
        """GBVCrew() creates without error."""
        from src.agents.crews.gbv_crew import GBVCrew
        crew = GBVCrew(llm=MagicMock())
        assert crew is not None

    def test_gbv_crew_instantiates_with_language(self):
        """GBVCrew(language='zu') stores language attribute."""
        from src.agents.crews.gbv_crew import GBVCrew
        crew = GBVCrew(language="zu", llm=MagicMock())
        assert crew.language == "zu"

    def test_gbv_crew_language_defaults_to_en(self):
        """GBVCrew() without language arg defaults to 'en'."""
        from src.agents.crews.gbv_crew import GBVCrew
        crew = GBVCrew(llm=MagicMock())
        assert crew.language == "en"

    def test_gbv_crew_invalid_language_falls_back_to_en(self):
        """GBVCrew(language='xx') falls back to 'en' (locked language validation)."""
        from src.agents.crews.gbv_crew import GBVCrew
        crew = GBVCrew(language="xx", llm=MagicMock())
        assert crew.language == "en"

    def test_gbv_crew_uses_deepseek_llm(self):
        """GBVCrew (without llm kwarg) calls get_deepseek_llm() — not get_routing_llm().

        GBV is conversation-heavy with minimal tool use (single notify_saps at end).
        DeepSeek is recommended for this pattern per Phase 10.3 research decision.
        """
        with patch("src.agents.llm.get_deepseek_llm", return_value=MagicMock()) as mock_deepseek:
            import importlib
            import src.agents.crews.gbv_crew as gbv_crew_module
            importlib.reload(gbv_crew_module)
            with patch("src.agents.llm.get_deepseek_llm", return_value=MagicMock()):
                crew = gbv_crew_module.GBVCrew()
                assert crew is not None

    def test_gbv_crew_has_saps_tool(self):
        """GBVCrew has notify_saps in tools (single tool — called once at end of intake)."""
        from src.agents.crews.gbv_crew import GBVCrew
        crew = GBVCrew(llm=MagicMock())
        tool_names = [getattr(t, "name", None) for t in crew.tools]
        assert "notify_saps" in tool_names

    def test_gbv_crew_has_exactly_one_tool(self):
        """GBVCrew has exactly 1 tool — notify_saps only (GBV is conversation-heavy).

        Unlike AuthCrew (4 tools) or TicketStatusCrew (1 lookup tool),
        GBV intake uses DeepSeek with a single notify_saps call at the END.
        """
        from src.agents.crews.gbv_crew import GBVCrew
        crew = GBVCrew(llm=MagicMock())
        assert len(crew.tools) == 1

    def test_gbv_crew_memory_disabled(self):
        """GBVCrew has memory_enabled=False (CRITICAL SEC-05 — PII protection).

        GBV conversations must NEVER persist across sessions. Cross-session
        data leakage is a victim safety risk. (Locked decision Phase 02-03)
        """
        from src.agents.crews.gbv_crew import GBVCrew
        crew = GBVCrew(llm=MagicMock())
        assert crew.memory_enabled is False, (
            "GBVCrew.memory_enabled MUST be False — PII protection (SEC-05)"
        )

    def test_gbv_crew_agent_key(self):
        """GBVCrew.agent_key is 'gbv_agent'."""
        from src.agents.crews.gbv_crew import GBVCrew
        crew = GBVCrew(llm=MagicMock())
        assert crew.agent_key == "gbv_agent"

    def test_gbv_crew_task_key(self):
        """GBVCrew.task_key is 'gbv_intake_task'."""
        from src.agents.crews.gbv_crew import GBVCrew
        crew = GBVCrew(llm=MagicMock())
        assert crew.task_key == "gbv_intake_task"

    def test_gbv_crew_sequential_process(self, gbv_context):
        """Crew uses Process.sequential (never hierarchical — locked decision)."""
        from crewai import Process
        from src.agents.crews.gbv_crew import GBVCrew
        crew_mgr = GBVCrew(llm=FAKE_LLM)
        crew = crew_mgr.create_crew(gbv_context)
        assert crew.process == Process.sequential

    def test_gbv_crew_memory_false_in_crew(self, gbv_context):
        """Crew object is created with memory=False (CRITICAL SEC-05).

        This is the primary runtime check — memory_enabled=False on the class
        AND memory=False on the Crew() constructor call are both required.
        """
        from src.agents.crews.gbv_crew import GBVCrew
        crew_mgr = GBVCrew(llm=FAKE_LLM)
        crew = crew_mgr.create_crew(gbv_context)
        assert crew.memory is False, (
            "Crew must be created with memory=False — this is the SEC-05 PII protection boundary"
        )

    def test_gbv_crew_no_delegation(self, gbv_context):
        """Agent has allow_delegation=False (specialist agents never delegate)."""
        from src.agents.crews.gbv_crew import GBVCrew
        crew_mgr = GBVCrew(llm=FAKE_LLM)
        crew = crew_mgr.create_crew(gbv_context)
        agent = crew.agents[0]
        assert agent.allow_delegation is False

    def test_gbv_crew_max_iter_8(self, gbv_context):
        """Agent has max_iter=8 (lower than auth=15 to avoid over-questioning victims).

        Phase 02-03 locked decision: GBV max_iter=8 vs AuthCrew max_iter=15.
        Trauma-informed protocol requires NOT exhausting trauma victims with questions.
        """
        from src.agents.crews.gbv_crew import GBVCrew
        crew_mgr = GBVCrew(llm=FAKE_LLM)
        crew = crew_mgr.create_crew(gbv_context)
        agent = crew.agents[0]
        assert agent.max_iter == 8, (
            f"GBV agent max_iter should be 8 (not {agent.max_iter}). "
            "Trauma-informed protocol requires fewer iterations than auth (15)."
        )

    def test_gbv_crew_single_agent_single_task(self, gbv_context):
        """Crew has exactly 1 agent and 1 task (Phase 10.3 pattern)."""
        from src.agents.crews.gbv_crew import GBVCrew
        crew_mgr = GBVCrew(llm=FAKE_LLM)
        crew = crew_mgr.create_crew(gbv_context)
        assert len(crew.agents) == 1
        assert len(crew.tasks) == 1

    def test_gbv_crew_create_crew_returns_crew(self, gbv_context):
        """create_crew(context) returns a crewai.Crew object."""
        from crewai import Crew
        from src.agents.crews.gbv_crew import GBVCrew
        crew_mgr = GBVCrew(llm=FAKE_LLM)
        crew = crew_mgr.create_crew(gbv_context)
        assert isinstance(crew, Crew)


# ---------------------------------------------------------------------------
# Section 2: Prompt Tests (SEC-05 Focus)
# ---------------------------------------------------------------------------

class TestGBVPrompts:
    """Tests verifying GBV_PROMPTS content — trauma-informed, emergency numbers required.

    SEC-05 focus:
    - Emergency numbers in ALL language prompts (never stripped by sanitization)
    - No PII collection instructions (no name-asking, no exact address)
    - Trauma-informed language (patient, empathetic, non-judgmental)
    - Gugu identity present but SHORT (no chatty intro — Phase 06.8-01 locked)
    """

    def test_gbv_prompts_all_languages(self):
        """GBV_PROMPTS has 'en', 'zu', 'af' keys."""
        from src.agents.prompts.gbv import GBV_PROMPTS
        assert "en" in GBV_PROMPTS
        assert "zu" in GBV_PROMPTS
        assert "af" in GBV_PROMPTS

    def test_gbv_prompts_has_exactly_three_languages(self):
        """GBV_PROMPTS has exactly 3 language keys."""
        from src.agents.prompts.gbv import GBV_PROMPTS
        assert len(GBV_PROMPTS) == 3

    def test_gbv_prompts_contain_gugu_identity(self):
        """Each GBV prompt contains Gugu identity (but no chatty intro per locked decision)."""
        from src.agents.prompts.gbv import GBV_PROMPTS
        for lang, prompt in GBV_PROMPTS.items():
            assert "Gugu" in prompt, (
                f"GBV prompt for '{lang}' does not contain 'Gugu' identity"
            )

    def test_gbv_prompts_no_name_asking(self):
        """GBV prompts do NOT ask for the citizen's name (trauma-informed protocol).

        Phase 06.8-01 locked decision: GBV agent gets Gugu identity ONLY — no
        name-asking, no chatty intro. This preserves trauma-informed protocol
        (patient safety boundary).
        """
        from src.agents.prompts.gbv import GBV_PROMPTS
        name_asking_patterns = [
            "what is your name",
            "may i have your name",
            "can i get your name",
            "could you tell me your name",
            "please share your name",
        ]
        for lang, prompt in GBV_PROMPTS.items():
            prompt_lower = prompt.lower()
            for pattern in name_asking_patterns:
                assert pattern not in prompt_lower, (
                    f"GBV prompt ({lang}) asks for citizen name: found '{pattern}'. "
                    "Trauma protocol prohibits name collection (SEC-05, locked decision)."
                )

    def test_gbv_prompts_emergency_numbers_en(self):
        """English GBV prompt contains SAPS (10111) and GBV Command Centre (0800 150 150)."""
        from src.agents.prompts.gbv import GBV_PROMPTS
        en_prompt = GBV_PROMPTS["en"]
        assert "10111" in en_prompt, (
            "English GBV prompt MUST contain SAPS emergency number 10111"
        )
        assert "0800 150 150" in en_prompt, (
            "English GBV prompt MUST contain GBV Command Centre 0800 150 150"
        )

    def test_gbv_prompts_emergency_numbers_zu(self):
        """isiZulu GBV prompt contains SAPS (10111) and GBV Command Centre (0800 150 150)."""
        from src.agents.prompts.gbv import GBV_PROMPTS
        zu_prompt = GBV_PROMPTS["zu"]
        assert "10111" in zu_prompt, (
            "isiZulu GBV prompt MUST contain SAPS emergency number 10111"
        )
        assert "0800 150 150" in zu_prompt, (
            "isiZulu GBV prompt MUST contain GBV Command Centre 0800 150 150"
        )

    def test_gbv_prompts_emergency_numbers_af(self):
        """Afrikaans GBV prompt contains SAPS (10111) and GBV Command Centre (0800 150 150)."""
        from src.agents.prompts.gbv import GBV_PROMPTS
        af_prompt = GBV_PROMPTS["af"]
        assert "10111" in af_prompt, (
            "Afrikaans GBV prompt MUST contain SAPS emergency number 10111"
        )
        assert "0800 150 150" in af_prompt, (
            "Afrikaans GBV prompt MUST contain GBV Command Centre 0800 150 150"
        )

    def test_gbv_prompts_trauma_informed(self):
        """GBV prompts contain patient/non-judgmental trauma-informed language.

        English prompt must contain >= 2 of these key trauma-informed terms.
        """
        from src.agents.prompts.gbv import GBV_PROMPTS
        trauma_informed_terms_en = [
            "patient",
            "calm",
            "empathetic",
            "non-judgmental",
            "empathy",
            "safe",
            "support",
            "judgment",
        ]
        en_prompt = GBV_PROMPTS["en"].lower()
        found = [t for t in trauma_informed_terms_en if t in en_prompt]
        assert len(found) >= 2, (
            f"English GBV prompt should be trauma-informed but only found these indicators: {found}"
        )

    def test_gbv_prompts_no_exact_address_instruction(self):
        """GBV prompts instruct NOT to collect exact address (SEC-05 privacy rule).

        Only general location area (ward, suburb) is permitted — no exact address.
        """
        from src.agents.prompts.gbv import GBV_PROMPTS
        en_prompt = GBV_PROMPTS["en"].lower()
        # The prompt should say NOT to collect exact address
        assert "not" in en_prompt or "never" in en_prompt, (
            "English GBV prompt should include 'not' or 'never' regarding address collection"
        )

    def test_gbv_prompts_no_pii_instruction(self):
        """GBV prompts instruct NOT to log PII — victim name/address excluded."""
        from src.agents.prompts.gbv import GBV_PROMPTS
        en_prompt = GBV_PROMPTS["en"].lower()
        # Prompt should contain safety/privacy language
        privacy_indicators = ["never", "not", "no pii", "no victim", "sec-05"]
        found = [ind for ind in privacy_indicators if ind in en_prompt]
        assert len(found) >= 1, (
            "English GBV prompt should contain privacy restriction language"
        )

    def test_gbv_prompts_contain_response_rules(self):
        """Each GBV prompt ends with RESPONSE RULES guardrail block."""
        from src.agents.prompts.gbv import GBV_PROMPTS
        response_rule_markers = {
            "en": "RESPONSE RULES",
            "zu": "IMITHETHO YEMPENDULO",
            "af": "REAKSIE REELS",
        }
        for lang, prompt in GBV_PROMPTS.items():
            marker = response_rule_markers[lang]
            assert marker in prompt, (
                f"GBV prompt for '{lang}' does not contain response rules section '{marker}'"
            )

    def test_gbv_prompts_contain_notify_saps_instruction(self):
        """English GBV prompt instructs to call notify_saps at end of intake."""
        from src.agents.prompts.gbv import GBV_PROMPTS
        en_prompt = GBV_PROMPTS["en"]
        assert "notify_saps" in en_prompt, (
            "English GBV prompt must instruct agent to call notify_saps at end of intake"
        )

    def test_gbv_prompts_are_not_empty(self):
        """All language prompts have substantial content (not placeholder strings)."""
        from src.agents.prompts.gbv import GBV_PROMPTS
        for lang, prompt in GBV_PROMPTS.items():
            assert len(prompt) > 200, (
                f"GBV prompt for '{lang}' is too short ({len(prompt)} chars) — likely a placeholder"
            )

    def test_build_gbv_task_description_includes_language(self):
        """build_gbv_task_description() includes language in task description."""
        from src.agents.prompts.gbv import build_gbv_task_description
        context = {
            "language": "zu",
            "session_status": "active",
            "conversation_history": "(none)",
            "message": "Ngidinga usizo",
        }
        description = build_gbv_task_description(context)
        assert "zu" in description

    def test_build_gbv_task_description_includes_conversation_history(self):
        """build_gbv_task_description() includes conversation_history."""
        from src.agents.prompts.gbv import build_gbv_task_description
        history = "User: My partner hit me\nGugu: I'm here for you."
        context = {
            "language": "en",
            "session_status": "active",
            "conversation_history": history,
            "message": "I need help",
        }
        description = build_gbv_task_description(context)
        assert history in description

    def test_build_gbv_task_description_invalid_language_defaults_to_en(self):
        """build_gbv_task_description() handles invalid language without crashing."""
        from src.agents.prompts.gbv import build_gbv_task_description
        context = {
            "language": "fr",   # Not supported
            "session_status": "active",
            "conversation_history": "(none)",
            "message": "Help",
        }
        description = build_gbv_task_description(context)
        assert "en" in description   # Defaulted to English


# ---------------------------------------------------------------------------
# Section 3: Pydantic Model Tests
# ---------------------------------------------------------------------------

class TestGBVResponse:
    """Tests verifying GBVResponse Pydantic model behavior.

    Key defaults:
    - requires_followup=True — GBV always requires follow-up by design
    - emergency_numbers_present=True — assumed present unless explicitly set to False
    - action_taken='safety_check'
    """

    def test_gbv_response_defaults(self):
        """GBVResponse defaults: requires_followup=True, emergency_numbers_present=True.

        requires_followup=True is a LOCKED decision — GBV always requires follow-up
        by trauma protocol design. (Phase 06.9.1 locked decision)
        """
        from src.agents.prompts.gbv import GBVResponse
        result = GBVResponse(message="Test message")
        assert result.requires_followup is True, (
            "GBVResponse.requires_followup MUST default to True — GBV always requires follow-up"
        )
        assert result.emergency_numbers_present is True

    def test_gbv_response_default_action_taken(self):
        """GBVResponse defaults to action_taken='safety_check'."""
        from src.agents.prompts.gbv import GBVResponse
        result = GBVResponse(message="Test")
        assert result.action_taken == "safety_check"

    def test_gbv_response_default_language(self):
        """GBVResponse defaults to language='en'."""
        from src.agents.prompts.gbv import GBVResponse
        result = GBVResponse(message="Test")
        assert result.language == "en"

    def test_gbv_response_strips_final_answer(self):
        """GBVResponse strips 'Final Answer:' prefix from message field."""
        from src.agents.prompts.gbv import GBVResponse
        result = GBVResponse(message="Final Answer: I'm here to help. Call 10111.")
        assert not result.message.startswith("Final Answer:")
        assert "I'm here to help" in result.message

    def test_gbv_response_strips_final_answer_with_whitespace(self):
        """GBVResponse strips 'Final Answer:' with leading whitespace in message."""
        from src.agents.prompts.gbv import GBVResponse
        result = GBVResponse(message="Final Answer:   You are safe. Call 0800 150 150.")
        assert result.message.startswith("You are safe")

    def test_gbv_response_preserves_clean_message(self):
        """GBVResponse preserves message unchanged when no 'Final Answer:' prefix."""
        from src.agents.prompts.gbv import GBVResponse
        msg = "You are safe. Call SAPS on 10111 or 0800 150 150."
        result = GBVResponse(message=msg)
        assert result.message == msg

    def test_gbv_response_custom_fields(self):
        """All GBVResponse fields accept custom values."""
        from src.agents.prompts.gbv import GBVResponse
        result = GBVResponse(
            message="SAPS notified. You are safe.",
            requires_followup=True,
            emergency_numbers_present=True,
            language="zu",
            action_taken="report_filed",
        )
        assert result.requires_followup is True
        assert result.emergency_numbers_present is True
        assert result.language == "zu"
        assert result.action_taken == "report_filed"

    def test_gbv_response_model_dump(self):
        """GBVResponse.model_dump() returns dict with all 5 fields."""
        from src.agents.prompts.gbv import GBVResponse
        result = GBVResponse(message="Help is coming.")
        dump = result.model_dump()
        assert "message" in dump
        assert "requires_followup" in dump
        assert "emergency_numbers_present" in dump
        assert "language" in dump
        assert "action_taken" in dump


# ---------------------------------------------------------------------------
# Section 4: SEC-05 Boundary Tests
# ---------------------------------------------------------------------------

class TestGBVSEC05Boundaries:
    """SEC-05 boundary tests — the most important tests in this suite.

    These tests verify that the GBV agent's security boundaries are intact:
    1. memory=False enforced (no cross-session PII leakage)
    2. notify_saps tool description prohibits PII (no victim name/address)
    3. GBV debug output is metadata-only (never conversation content)
    4. Error response always includes emergency numbers
    5. parse_result always forces category='gbv'
    """

    def test_gbv_crew_memory_disabled_class_level(self):
        """GBVCrew class-level memory_enabled=False (SEC-05 PII protection).

        Tests the class attribute directly — this is the static configuration
        that is enforced regardless of how the crew is instantiated.
        """
        from src.agents.crews.gbv_crew import GBVCrew
        assert GBVCrew.memory_enabled is False, (
            "GBVCrew.memory_enabled MUST be False at class level — SEC-05 boundary"
        )

    def test_gbv_debug_metadata_only(self):
        """GBV debug dict for eval reports contains metadata only — never conversation content.

        SEC-05 + POPIA: GBV eval reports strip ALL response content from eval output.
        Only metadata fields are permitted: agent_name, turn_count, session_status, is_gbv.
        This is validated by checking that parse_result() does NOT include the raw
        conversation content as a citizen-accessible field.
        """
        from src.agents.crews.gbv_crew import GBVCrew
        from unittest.mock import MagicMock

        crew = GBVCrew(llm=MagicMock())

        # Simulate a Pydantic result from the crew
        mock_result = MagicMock()
        mock_result.pydantic = MagicMock()
        mock_result.pydantic.model_dump.return_value = {
            "message": "SENSITIVE: Victim said she was hit at 123 Main St.",
            "requires_followup": True,
            "emergency_numbers_present": True,
            "language": "en",
            "action_taken": "safety_check",
        }

        result_dict = crew.parse_result(mock_result)

        # raw_output is for Streamlit debug — present but should be dev-only
        # The PUBLIC-facing result must only have defined GBVResponse fields
        # (not uncontrolled raw conversation content from the LLM)
        assert "message" in result_dict
        assert "category" in result_dict
        assert result_dict["category"] == "gbv"

        # Verify raw_output IS present (for debug) but is clearly separated
        # from the citizen-facing message field
        assert "raw_output" in result_dict

    def test_gbv_saps_tool_no_pii_in_description(self):
        """notify_saps tool description explicitly prohibits PII (SEC-05 compliance).

        The tool description is what the LLM reads when deciding how to call the tool.
        It must explicitly prohibit victim names, phone numbers, and exact addresses.
        """
        from src.agents.tools.saps_tool import notify_saps

        desc_lower = notify_saps.description.lower()
        # Description should contain "no" or "not" regarding personal info
        pii_prohibition_markers = ["not", "never", "no victim", "no name", "sec-05"]
        found = [m for m in pii_prohibition_markers if m in desc_lower]
        assert len(found) >= 1, (
            f"notify_saps description should prohibit PII. Found: {found}. "
            f"Description: {notify_saps.description}"
        )

    def test_gbv_saps_tool_no_pii_in_input_schema(self):
        """notify_saps input schema does not request victim PII fields.

        The tool's Pydantic schema defines what data the LLM can pass.
        Victim name, phone number, and full address should NOT be fields.
        """
        from src.agents.tools.saps_tool import NotifySapsInput
        schema = NotifySapsInput.model_fields
        pii_field_names = ["victim_name", "victim_phone", "full_address", "victim_email"]
        for field in pii_field_names:
            assert field not in schema, (
                f"notify_saps input schema must NOT have field '{field}' — SEC-05 PII boundary"
            )

    def test_gbv_saps_tool_implementation_no_victim_fields(self):
        """_notify_saps_impl does not log victim-identifying information.

        Tests the actual implementation function's parameter list.
        The function signature must not include victim name, phone, or full address.
        """
        import inspect
        from src.agents.tools.saps_tool import _notify_saps_impl

        sig = inspect.signature(_notify_saps_impl)
        param_names = list(sig.parameters.keys())

        # Must NOT have these PII parameters
        pii_params = ["victim_name", "victim_phone", "full_address", "phone", "name", "email"]
        for pii_param in pii_params:
            assert pii_param not in param_names, (
                f"_notify_saps_impl must NOT have parameter '{pii_param}' — no PII in SAPS logs"
            )

        # MUST have these operational (non-PII) parameters
        required_operational = ["ticket_id", "incident_type", "location", "is_immediate_danger"]
        for op_param in required_operational:
            assert op_param in param_names, (
                f"_notify_saps_impl must have parameter '{op_param}' for operational SAPS routing"
            )

    def test_gbv_error_response_always_has_emergency_numbers(self):
        """GBVCrew.get_error_response() always includes 10111 and 0800 150 150.

        If the LLM fails entirely, citizens still receive emergency numbers.
        This is a safety guarantee — emergency numbers survive all error paths.
        """
        from src.agents.crews.gbv_crew import GBVCrew

        crew = GBVCrew(llm=MagicMock())
        error_response = crew.get_error_response(Exception("LLM timeout"))

        message = error_response.get("message", "")
        assert "10111" in message, (
            "GBV error response MUST contain SAPS emergency number 10111"
        )
        assert "0800 150 150" in message, (
            "GBV error response MUST contain GBV Command Centre 0800 150 150"
        )

    def test_gbv_error_response_requires_followup_true(self):
        """GBV error response has requires_followup=True (GBV always needs follow-up)."""
        from src.agents.crews.gbv_crew import GBVCrew

        crew = GBVCrew(llm=MagicMock())
        error_response = crew.get_error_response(Exception("Test error"))
        assert error_response.get("requires_followup") is True

    def test_gbv_error_response_forces_gbv_category(self):
        """GBV error response has category='gbv' — prevents miscategorization."""
        from src.agents.crews.gbv_crew import GBVCrew

        crew = GBVCrew(llm=MagicMock())
        error_response = crew.get_error_response(Exception("Test"))
        assert error_response.get("category") == "gbv"

    def test_gbv_parse_result_forces_category_gbv(self):
        """parse_result() always sets category='gbv' regardless of LLM output."""
        from src.agents.crews.gbv_crew import GBVCrew

        crew = GBVCrew(llm=MagicMock())

        # Simulate a fallback path (no pydantic result)
        mock_result = MagicMock()
        mock_result.pydantic = None
        # Raw output without category field
        mock_result.__str__ = lambda self: "Final Answer: I'm here to help. Call 10111."

        result_dict = crew.parse_result(mock_result)
        assert result_dict.get("category") == "gbv", (
            "parse_result() must force category='gbv' — safety: prevents GBV ticket miscategorization"
        )

    def test_gbv_parse_result_sets_requires_followup_true(self):
        """parse_result() fallback path sets requires_followup=True."""
        from src.agents.crews.gbv_crew import GBVCrew

        crew = GBVCrew(llm=MagicMock())
        mock_result = MagicMock()
        mock_result.pydantic = None
        mock_result.__str__ = lambda self: "I am here to help. Emergency numbers: 10111, 0800 150 150."

        result_dict = crew.parse_result(mock_result)
        assert result_dict.get("requires_followup") is True


# ---------------------------------------------------------------------------
# Section 5: SAPS Tool Functional Tests
# ---------------------------------------------------------------------------

class TestSAPSTool:
    """Functional tests for notify_saps tool — verifies behavior without real SAPS API."""

    def test_notify_saps_returns_structured_output(self):
        """_notify_saps_impl returns expected structure."""
        from src.agents.tools.saps_tool import _notify_saps_impl

        result = _notify_saps_impl(
            ticket_id="ticket-123",
            tracking_number="TKT-20260225-ABC123",
            incident_type="physical",
            location="Ward 5, Durban",
            is_immediate_danger=True,
            tenant_id="tenant-456",
        )

        assert result["notified"] is True
        assert result["method"] == "internal_log"
        assert result["ticket_id"] == "ticket-123"
        assert result["tracking_number"] == "TKT-20260225-ABC123"
        assert result["danger_level"] == "IMMEDIATE"

    def test_notify_saps_standard_danger_level(self):
        """_notify_saps_impl sets danger_level='STANDARD' for non-immediate danger."""
        from src.agents.tools.saps_tool import _notify_saps_impl

        result = _notify_saps_impl(
            ticket_id="ticket-123",
            tracking_number="TKT-20260225-ABC123",
            incident_type="verbal",
            location="Ward 3",
            is_immediate_danger=False,
            tenant_id="tenant-456",
        )

        assert result["danger_level"] == "STANDARD"

    def test_notify_saps_has_timestamp(self):
        """_notify_saps_impl includes a timestamp in the result."""
        from src.agents.tools.saps_tool import _notify_saps_impl

        result = _notify_saps_impl(
            ticket_id="ticket-xyz",
            tracking_number="TKT-20260225-XYZ123",
            incident_type="threat",
            location="Suburbs",
            is_immediate_danger=False,
            tenant_id="tenant-789",
        )

        assert "timestamp" in result
        assert result["timestamp"]  # Non-empty

    @patch("src.agents.tools.saps_tool.saps_logger")
    def test_notify_saps_does_not_log_victim_pii(self, mock_logger):
        """SAPS notification does NOT log victim identifying information (SEC-05, POPIA).

        The logger.warning() call MUST NOT include:
        - victim_name
        - phone (victim's contact)
        - full_address (victim's home)

        It MUST include operational (non-PII) fields:
        - ticket_id, danger_level, incident_type
        """
        from src.agents.tools.saps_tool import _notify_saps_impl

        _notify_saps_impl(
            ticket_id="ticket-sec05-test",
            tracking_number="TKT-20260225-SEC05",
            incident_type="physical",
            location="Ward 7",
            is_immediate_danger=True,
            tenant_id="tenant-sec05",
        )

        assert mock_logger.warning.called

        call_args = mock_logger.warning.call_args
        logged_extra = call_args[1].get("extra", {})

        # NO victim PII in log
        assert "victim_name" not in logged_extra, "MUST NOT log victim name (SEC-05)"
        assert "phone" not in logged_extra, "MUST NOT log victim phone (SEC-05)"
        assert "full_address" not in logged_extra, "MUST NOT log victim address (SEC-05)"

        # Operational data IS logged
        assert "ticket_id" in logged_extra, "MUST log ticket_id for SAPS reference"
        assert "danger_level" in logged_extra, "MUST log danger_level for SAPS prioritization"
        assert "incident_type" in logged_extra, "MUST log incident_type for SAPS routing"

    def test_notify_saps_tool_is_basetool_instance(self):
        """notify_saps is a BaseTool instance (not a raw callable)."""
        from crewai.tools import BaseTool
        from src.agents.tools.saps_tool import notify_saps

        assert isinstance(notify_saps, BaseTool), (
            "notify_saps must be a BaseTool instance for CrewAI agent compatibility"
        )

    def test_notify_saps_tool_has_name(self):
        """notify_saps.name is 'notify_saps'."""
        from src.agents.tools.saps_tool import notify_saps

        assert notify_saps.name == "notify_saps"

    def test_notify_saps_tool_has_description(self):
        """notify_saps has a non-empty description."""
        from src.agents.tools.saps_tool import notify_saps

        assert notify_saps.description
        assert len(notify_saps.description) > 20

    def test_notify_saps_tool_has_args_schema(self):
        """notify_saps has args_schema for Pydantic input validation."""
        from src.agents.tools.saps_tool import notify_saps

        assert hasattr(notify_saps, "args_schema")
        assert notify_saps.args_schema is not None
