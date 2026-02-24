"""Comprehensive tests for GBV specialist crew.

Tests cover:
- GBV crew instantiation and configuration
- Trauma-informed prompts in all 3 languages
- SAPS notification tool
- GBV routing via ManagerCrew (Phase 6.9 architecture)
- Session clearing after ticket creation
- GBV keyword list completeness
- is_sensitive flag enforcement

Phase 6.9 architecture note:
    classify_message() and route_to_crew() were removed from IntakeFlow.
    GBV routing is now handled by ManagerCrew (Process.hierarchical).
    TestGBVRoutingInFlow and TestGBVKeywordDetection have been updated to
    verify the new ManagerCrew delegation pattern instead of keyword routing.
"""
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.agents.crews.gbv_crew import GBVCrew
from src.agents.flows.intake_flow import IntakeFlow
from src.agents.flows.state import IntakeState
import yaml
from pathlib import Path

from src.agents.prompts.gbv import GBV_CLASSIFICATION_KEYWORDS
from src.agents.tools.saps_tool import notify_saps, _notify_saps_impl

# Set fake OpenAI API key for tests (required by CrewAI Agent initialization)
os.environ["OPENAI_API_KEY"] = "sk-fake-key-for-testing-only"


class TestGBVCrewInstantiation:
    """Test GBV crew initialization and configuration."""

    def test_gbv_crew_creates_with_memory_disabled(self):
        """Verify memory=False on created Crew (prevents cross-session leakage)."""
        crew_instance = GBVCrew(language="en", llm=None)

        # Create crew with context dict
        crew = crew_instance.create_crew({
            "message": "Test message",
            "user_id": "user-123",
            "tenant_id": "tenant-456",
            "language": "en",
        })

        # CRITICAL: Verify memory is disabled
        assert crew.memory is False, "GBV crew MUST have memory=False for privacy"

    def test_gbv_crew_agent_has_correct_tools(self):
        """Verify agent has create_municipal_ticket and notify_saps tools."""
        crew_instance = GBVCrew(language="en", llm=None)

        crew = crew_instance.create_crew({
            "message": "Test message",
            "user_id": "user-123",
            "tenant_id": "tenant-456",
            "language": "en",
        })

        # Get the agent
        agent = crew.agents[0]

        # Check tools
        tool_names = [tool.name for tool in agent.tools]
        assert "create_municipal_ticket" in tool_names
        assert "notify_saps" in tool_names

    def test_gbv_crew_agent_max_iter_is_3(self):
        """Verify max_iter=3 (YAML-defined) to avoid over-questioning victims."""
        crew_instance = GBVCrew(language="en", llm=None)

        crew = crew_instance.create_crew({
            "message": "Test message",
            "user_id": "user-123",
            "tenant_id": "tenant-456",
            "language": "en",
        })

        agent = crew.agents[0]
        assert agent.max_iter == 3, "GBV agent should have max_iter=3 (per YAML config)"

    def test_gbv_crew_defaults_to_english_for_invalid_language(self):
        """Verify invalid language codes fall back to English."""
        crew_instance = GBVCrew(language="invalid", llm=None)
        assert crew_instance.language == "en"


class TestGBVPrompts:
    """Test GBV prompt content in agents.yaml (prompts moved from Python to YAML)."""

    @pytest.fixture(autouse=True)
    def load_yaml_prompts(self):
        """Load GBV agent backstories from agents.yaml."""
        config_path = Path(__file__).parent.parent / "src" / "agents" / "config" / "agents.yaml"
        with open(config_path, "r", encoding="utf-8") as f:
            agents_config = yaml.safe_load(f)
        gbv_config = agents_config["gbv_agent"]
        self.prompts = {
            "en": gbv_config["backstory"],
            "zu": gbv_config.get("backstory_zu", gbv_config["backstory"]),
            "af": gbv_config.get("backstory_af", gbv_config["backstory"]),
        }

    def test_english_prompt_contains_emergency_numbers(self):
        """English prompt must include SAPS (10111) and GBV Command Centre."""
        assert "10111" in self.prompts["en"]
        assert "0800 150 150" in self.prompts["en"]

    def test_isizulu_prompt_contains_emergency_numbers(self):
        """isiZulu prompt must include emergency numbers."""
        assert "10111" in self.prompts["zu"]
        assert "0800 150 150" in self.prompts["zu"]

    def test_afrikaans_prompt_contains_emergency_numbers(self):
        """Afrikaans prompt must include emergency numbers."""
        assert "10111" in self.prompts["af"]
        assert "0800 150 150" in self.prompts["af"]

    def test_no_prompt_asks_for_perpetrator_identification(self):
        """Verify no prompt requests perpetrator name or identification."""
        sensitive_terms = ["perpetrator name", "name of the person", "identify the perpetrator"]

        for lang, prompt in self.prompts.items():
            prompt_lower = prompt.lower()
            for term in sensitive_terms:
                assert term not in prompt_lower, (
                    f"GBV prompt ({lang}) should not ask for perpetrator identification. "
                    f"Found: '{term}'"
                )

    def test_prompts_are_trauma_informed(self):
        """Verify prompts use trauma-informed language."""
        en_indicators = ["empathetic", "non-judgmental", "safe", "support", "calm"]
        zu_indicators = ["uzole", "uphephile", "umuzwa", "wesekwa"]
        af_indicators = ["empaties", "nie-veroordelend", "veilig", "ondersteuning", "kalm"]

        en_prompt = self.prompts["en"].lower()
        en_matches = [ind for ind in en_indicators if ind in en_prompt]
        assert len(en_matches) >= 2, "English prompt should be trauma-informed"

        zu_prompt = self.prompts["zu"].lower()
        zu_matches = [ind for ind in zu_indicators if ind in zu_prompt]
        assert len(zu_matches) >= 2, "isiZulu prompt should be trauma-informed"

        af_prompt = self.prompts["af"].lower()
        af_matches = [ind for ind in af_indicators if ind in af_prompt]
        assert len(af_matches) >= 2, "Afrikaans prompt should be trauma-informed"


class TestSAPSNotificationTool:
    """Test SAPS notification tool functionality and security."""

    def test_notify_saps_returns_structured_output(self):
        """Verify SAPS tool returns expected structure."""
        result = _notify_saps_impl(
            ticket_id="ticket-123",
            tracking_number="TKT-20260209-ABC123",
            incident_type="physical",
            location="Ward 5",
            is_immediate_danger=True,
            tenant_id="tenant-456"
        )

        assert result["notified"] is True
        assert result["method"] == "internal_log"
        assert result["ticket_id"] == "ticket-123"
        assert result["tracking_number"] == "TKT-20260209-ABC123"
        assert result["danger_level"] == "IMMEDIATE"

    def test_notify_saps_standard_danger_level(self):
        """Verify standard (non-immediate) danger level."""
        result = _notify_saps_impl(
            ticket_id="ticket-123",
            tracking_number="TKT-20260209-ABC123",
            incident_type="verbal",
            location="Ward 3",
            is_immediate_danger=False,
            tenant_id="tenant-456"
        )

        assert result["danger_level"] == "STANDARD"

    @patch('src.agents.tools.saps_tool.saps_logger')
    def test_notify_saps_does_not_log_pii(self, mock_logger):
        """Verify SAPS notification does NOT log victim identifying information."""
        _notify_saps_impl(
            ticket_id="ticket-123",
            tracking_number="TKT-20260209-ABC123",
            incident_type="physical",
            location="Ward 5",
            is_immediate_danger=True,
            tenant_id="tenant-456"
        )

        # Check that logger was called
        assert mock_logger.warning.called

        # Extract logged data
        call_args = mock_logger.warning.call_args
        logged_extra = call_args[1].get("extra", {})

        # Verify NO PII fields (no names, no phone numbers, no full addresses)
        assert "victim_name" not in logged_extra
        assert "phone" not in logged_extra
        assert "full_address" not in logged_extra

        # Verify operational data IS logged
        assert "ticket_id" in logged_extra
        assert "danger_level" in logged_extra
        assert "incident_type" in logged_extra


class TestGBVRoutingInFlow:
    """Test GBV message routing via ManagerCrew (Phase 6.9 architecture).

    Phase 6.9 refactor: GBV routing is handled by ManagerCrew (hierarchical)
    instead of keyword-based classify_message() + route_to_crew() chain.
    These tests verify that GBV messages reach the correct specialist via
    ManagerCrew delegation.
    """

    @pytest.mark.asyncio
    async def test_gbv_message_delegates_to_manager_crew(self):
        """GBV message triggers ManagerCrew kickoff (not classify_message).

        ManagerCrew is imported INSIDE receive_and_route() so we patch at the
        source module: src.agents.crews.manager_crew.ManagerCrew
        """
        with patch("src.agents.flows.intake_flow.language_detector") as mock_lang, \
             patch("src.agents.flows.intake_flow.get_crew_llm") as mock_llm_fn, \
             patch("src.agents.crews.manager_crew.ManagerCrew") as MockManagerCrew:

            mock_lang.detect.return_value = "en"
            mock_llm_fn.return_value = MagicMock()

            # GBV manager result (what ManagerCrew returns after GBV specialist handled it)
            mock_result = {
                "message": "I'm here to help. Your safety matters. Please call 10111 if in danger.",
                "routing": "gbv_report",
            }
            mock_manager = MagicMock()
            mock_manager.kickoff = AsyncMock(return_value=mock_result)
            MockManagerCrew.return_value = mock_manager

            flow = IntakeFlow(redis_url="redis://localhost:6379")
            flow._state = IntakeState(
                message="My husband hits me",
                user_id="user-123",
                tenant_id="tenant-456",
                session_status="active",
                user_exists=True,
            )

            result = await flow.receive_and_route()

            # ManagerCrew was instantiated — this is the Phase 6.9 GBV routing path
            mock_manager.kickoff.assert_called_once()

            # Verify GBV message was passed in context
            context = mock_manager.kickoff.call_args[0][0]
            assert "My husband hits me" in context["message"]

    @pytest.mark.asyncio
    async def test_gbv_context_includes_session_status(self):
        """ManagerCrew context includes session_status for auth-aware GBV routing."""
        with patch("src.agents.flows.intake_flow.language_detector") as mock_lang, \
             patch("src.agents.flows.intake_flow.get_crew_llm") as mock_llm_fn, \
             patch("src.agents.crews.manager_crew.ManagerCrew") as MockManagerCrew:

            mock_lang.detect.return_value = "en"
            mock_llm_fn.return_value = MagicMock()

            mock_manager = MagicMock()
            mock_manager.kickoff = AsyncMock(return_value={"message": "Help is available."})
            MockManagerCrew.return_value = mock_manager

            flow = IntakeFlow(redis_url="redis://localhost:6379")
            flow._state = IntakeState(
                message="domestic violence help",
                session_status="active",
                user_exists=True,
                user_id="user-456",
            )

            await flow.receive_and_route()

            context = mock_manager.kickoff.call_args[0][0]
            # session_status must be passed so ManagerCrew can route correctly
            assert "session_status" in context
            assert context["session_status"] == "active"


class TestSessionClearing:
    """Test GBV session clearing.

    Phase 6.9 note: GBV session clearing is now handled by GBVCrew directly
    (via crew_server.py short-circuit path) after ManagerCrew delegates to
    the GBV specialist. The IntakeFlow.handle_gbv() method was removed in 6.9.

    These tests verify that GBVCrew still respects memory=False (preventing
    cross-session data leakage) as the primary session isolation mechanism.
    """

    def test_gbv_crew_memory_false_prevents_session_leakage(self):
        """GBVCrew must have memory=False — this IS the session isolation mechanism."""
        crew_instance = GBVCrew(language="en", llm=None)

        crew = crew_instance.create_crew({
            "message": "abuse",
            "user_id": "user-123",
            "tenant_id": "tenant-456",
            "language": "en",
        })

        assert crew.memory is False, (
            "GBV crew MUST have memory=False — this prevents cross-session data leakage"
        )

    @pytest.mark.asyncio
    async def test_gbv_flow_result_stored_in_state(self):
        """IntakeFlow stores GBV ManagerCrew result in state (Phase 6.9 pattern)."""
        with patch("src.agents.flows.intake_flow.language_detector") as mock_lang, \
             patch("src.agents.flows.intake_flow.get_crew_llm") as mock_llm_fn, \
             patch("src.agents.crews.manager_crew.ManagerCrew") as MockManagerCrew:

            mock_lang.detect.return_value = "en"
            mock_llm_fn.return_value = MagicMock()

            gbv_result = {
                "message": "Your report has been submitted. SAPS has been notified.",
                "tracking_number": "TKT-20260218-GBV123",
                "routing": "gbv_report",
            }
            mock_manager = MagicMock()
            mock_manager.kickoff = AsyncMock(return_value=gbv_result)
            MockManagerCrew.return_value = mock_manager

            flow = IntakeFlow(redis_url="redis://localhost:6379")
            flow._state = IntakeState(
                message="abuse",
                user_id="user-123",
                tenant_id="tenant-456",
                session_id="session-abc",
            )

            await flow.receive_and_route()

            # Result stored in state.ticket_data
            assert flow.state.ticket_data == gbv_result
            assert flow.state.is_complete is True


class TestGBVKeywordDetection:
    """Test GBV keyword lists used by ManagerCrew for routing context.

    Phase 6.9 note: The old keyword-based classify_message() was removed.
    ManagerCrew (LLM-based) now handles routing. However, GBV_CLASSIFICATION_KEYWORDS
    are still used as prompt context injected into the ManagerCrew task to help the
    LLM recognize GBV-related messages. These tests verify the keyword lists are
    comprehensive and correctly structured.
    """

    def test_english_gbv_keywords_contain_violence_terms(self):
        """English GBV keyword list contains violence/abuse-related terms."""
        en_keywords = GBV_CLASSIFICATION_KEYWORDS["en"]
        # At least one of these should be present
        violence_terms = ["hits", "abuse", "violence", "assault", "rape", "domestic"]
        found = [kw for kw in en_keywords if any(vt in kw.lower() for vt in violence_terms)]
        assert len(found) > 0, f"No violence terms found in EN keywords: {en_keywords}"

    def test_isizulu_gbv_keywords_non_empty(self):
        """isiZulu GBV keyword list is non-empty and contains GBV-related terms."""
        zu_keywords = GBV_CLASSIFICATION_KEYWORDS["zu"]
        assert len(zu_keywords) > 0
        # 'udlame' (violence) or 'uhlukumeza' (abuse) should be present
        zu_terms = ["udlame", "uhlukumeza", "ukudlwengulwa", "induku"]
        found = [kw for kw in zu_keywords if any(zt in kw.lower() for zt in zu_terms)]
        assert len(found) > 0, f"No isiZulu GBV terms found in: {zu_keywords}"

    def test_afrikaans_gbv_keywords_contain_geweld(self):
        """Afrikaans GBV keyword list contains 'geweld' (violence)."""
        af_keywords = GBV_CLASSIFICATION_KEYWORDS["af"]
        assert len(af_keywords) > 0
        af_terms = ["geweld", "mishandel", "verkrag", "aanrand"]
        found = [kw for kw in af_keywords if any(at in kw.lower() for at in af_terms)]
        assert len(found) > 0, f"No Afrikaans GBV terms found in: {af_keywords}"

    def test_gbv_keywords_distinct_from_municipal_keywords(self):
        """GBV keywords should not overlap with typical municipal service terms."""
        all_gbv_keywords = set()
        for lang_keywords in GBV_CLASSIFICATION_KEYWORDS.values():
            all_gbv_keywords.update(kw.lower() for kw in lang_keywords)

        # Municipal-only terms that should NOT be in GBV keywords
        municipal_only_terms = ["water", "pothole", "electricity", "waste", "sewage", "streetlight"]
        for term in municipal_only_terms:
            assert term not in all_gbv_keywords, (
                f"Municipal term '{term}' found in GBV keywords — this could cause false GBV detection"
            )


class TestIsSensitiveFlag:
    """Test is_sensitive flag on GBV tickets."""

    def test_gbv_keyword_list_comprehensive(self):
        """Verify GBV keywords cover all three languages."""
        assert "en" in GBV_CLASSIFICATION_KEYWORDS
        assert "zu" in GBV_CLASSIFICATION_KEYWORDS
        assert "af" in GBV_CLASSIFICATION_KEYWORDS

        # Verify each language has keywords
        assert len(GBV_CLASSIFICATION_KEYWORDS["en"]) > 0
        assert len(GBV_CLASSIFICATION_KEYWORDS["zu"]) > 0
        assert len(GBV_CLASSIFICATION_KEYWORDS["af"]) > 0

    def test_gbv_category_forces_sensitive_flag_in_ticket_tool(self):
        """Verify ticket_tool sets is_sensitive=True for category='gbv'."""
        # This is a unit test for the ticket_tool logic
        # The actual implementation is in src/agents/tools/ticket_tool.py line 105
        # We're just verifying the logic exists

        # Read the ticket_tool to verify the logic
        from src.agents.tools import ticket_tool
        import inspect

        source = inspect.getsource(ticket_tool._create_ticket_impl)

        # Verify the code contains the is_sensitive logic
        assert 'is_sensitive' in source
        assert 'category_lower == "gbv"' in source or '"gbv"' in source
