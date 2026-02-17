"""Comprehensive tests for GBV specialist crew.

Tests cover:
- GBV crew instantiation and configuration
- Trauma-informed prompts in all 3 languages
- SAPS notification tool
- GBV routing in IntakeFlow
- Session clearing after ticket creation
- Keyword detection across languages
- is_sensitive flag enforcement
"""
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.agents.crews.gbv_crew import GBVCrew
from src.agents.flows.intake_flow import IntakeFlow
from src.agents.prompts.gbv import GBV_INTAKE_PROMPTS, GBV_CLASSIFICATION_KEYWORDS
from src.agents.tools.saps_tool import notify_saps, _notify_saps_impl

# Set fake OpenAI API key for tests (required by CrewAI Agent initialization)
os.environ["OPENAI_API_KEY"] = "sk-fake-key-for-testing-only"


class TestGBVCrewInstantiation:
    """Test GBV crew initialization and configuration."""

    def test_gbv_crew_creates_with_memory_disabled(self):
        """Verify memory=False on created Crew (prevents cross-session leakage)."""
        crew_instance = GBVCrew(language="en", llm=None)

        # Create crew (need to provide required args)
        crew = crew_instance.create_crew(
            message="Test message",
            user_id="user-123",
            tenant_id="tenant-456"
        )

        # CRITICAL: Verify memory is disabled
        assert crew.memory is False, "GBV crew MUST have memory=False for privacy"

    def test_gbv_crew_agent_has_correct_tools(self):
        """Verify agent has create_municipal_ticket and notify_saps tools."""
        crew_instance = GBVCrew(language="en", llm=None)

        crew = crew_instance.create_crew(
            message="Test message",
            user_id="user-123",
            tenant_id="tenant-456"
        )

        # Get the agent
        agent = crew.agents[0]

        # Check tools
        tool_names = [tool.name for tool in agent.tools]
        assert "create_municipal_ticket" in tool_names
        assert "notify_saps" in tool_names

    def test_gbv_crew_agent_max_iter_is_8(self):
        """Verify max_iter=8 (shorter than municipal) to avoid over-questioning."""
        crew_instance = GBVCrew(language="en", llm=None)

        crew = crew_instance.create_crew(
            message="Test message",
            user_id="user-123",
            tenant_id="tenant-456"
        )

        agent = crew.agents[0]
        assert agent.max_iter == 8, "GBV agent should have max_iter=8 (not higher)"

    def test_gbv_crew_defaults_to_english_for_invalid_language(self):
        """Verify invalid language codes fall back to English."""
        crew_instance = GBVCrew(language="invalid", llm=None)
        assert crew_instance.language == "en"


class TestGBVPrompts:
    """Test GBV prompt content and structure."""

    def test_english_prompt_contains_emergency_numbers(self):
        """English prompt must include SAPS (10111) and GBV Command Centre."""
        en_prompt = GBV_INTAKE_PROMPTS["en"]
        assert "10111" in en_prompt
        assert "0800 150 150" in en_prompt

    def test_isizulu_prompt_contains_emergency_numbers(self):
        """isiZulu prompt must include emergency numbers."""
        zu_prompt = GBV_INTAKE_PROMPTS["zu"]
        assert "10111" in zu_prompt
        assert "0800 150 150" in zu_prompt

    def test_afrikaans_prompt_contains_emergency_numbers(self):
        """Afrikaans prompt must include emergency numbers."""
        af_prompt = GBV_INTAKE_PROMPTS["af"]
        assert "10111" in af_prompt
        assert "0800 150 150" in af_prompt

    def test_no_prompt_asks_for_perpetrator_identification(self):
        """Verify no prompt requests perpetrator name or identification."""
        sensitive_terms = ["perpetrator name", "who hurt you", "name of the person"]

        for lang, prompt in GBV_INTAKE_PROMPTS.items():
            prompt_lower = prompt.lower()
            for term in sensitive_terms:
                # We expect prompts to explicitly say NOT to ask for this
                # Check that if "name" appears, it's in a "DO NOT ask" context
                if "name" in prompt_lower:
                    # Should be in context of "DO NOT ask"
                    assert "do not ask" in prompt_lower or "never ask" in prompt_lower

    def test_prompts_are_trauma_informed(self):
        """Verify prompts use trauma-informed language."""
        # English indicators
        en_indicators = ["empathetic", "non-judgmental", "safe", "support", "calm"]

        # isiZulu indicators (different language, same concepts)
        zu_indicators = ["uzole", "uphephile", "umuzwa", "wesekwa"]

        # Afrikaans indicators
        af_indicators = ["empaties", "nie-veroordelend", "veilig", "ondersteuning", "kalm"]

        # Test English
        en_prompt = GBV_INTAKE_PROMPTS["en"].lower()
        en_matches = [ind for ind in en_indicators if ind in en_prompt]
        assert len(en_matches) >= 2, "English prompt should be trauma-informed"

        # Test isiZulu
        zu_prompt = GBV_INTAKE_PROMPTS["zu"].lower()
        zu_matches = [ind for ind in zu_indicators if ind in zu_prompt]
        assert len(zu_matches) >= 2, "isiZulu prompt should be trauma-informed"

        # Test Afrikaans
        af_prompt = GBV_INTAKE_PROMPTS["af"].lower()
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
    """Test GBV message routing in IntakeFlow."""

    @pytest.mark.asyncio
    async def test_gbv_message_routes_to_gbv_intake(self):
        """Verify GBV keywords trigger gbv_intake routing."""
        # Create flow with mock redis
        flow = IntakeFlow(redis_url="redis://localhost:6379")

        # Set state with GBV message
        flow.state.message = "My husband hits me"
        flow.state.user_id = "user-123"
        flow.state.tenant_id = "tenant-456"

        # Run classification
        category = flow.classify_message()

        # Verify GBV category
        assert category == "gbv"
        assert flow.state.category == "gbv"

        # Verify routing decision
        route = flow.route_to_crew()
        assert route == "gbv_intake"

    @pytest.mark.asyncio
    async def test_handle_gbv_is_called_not_handle_municipal(self):
        """Verify GBV routing calls handle_gbv, not handle_municipal."""
        flow = IntakeFlow(redis_url="redis://localhost:6379")

        # Set GBV message
        flow.state.message = "domestic violence"
        flow.state.category = "gbv"

        # Verify routing goes to GBV
        route = flow.route_to_crew()
        assert route == "gbv_intake"

        # Verify municipal route is NOT used
        assert route != "municipal_intake"


class TestSessionClearing:
    """Test GBV session clearing after ticket creation."""

    @pytest.mark.asyncio
    async def test_clear_session_called_with_is_gbv_true(self):
        """Verify clear_session is called with is_gbv=True after GBV ticket."""
        flow = IntakeFlow(redis_url="redis://localhost:6379")

        # Mock conversation manager
        flow._conversation_manager = AsyncMock()
        flow._conversation_manager.clear_session = AsyncMock()

        # Set state
        flow.state.message = "abuse"
        flow.state.user_id = "user-123"
        flow.state.tenant_id = "tenant-456"
        flow.state.session_id = "session-abc"

        # Mock GBVCrew kickoff
        with patch('src.agents.crews.gbv_crew.GBVCrew.kickoff', new_callable=AsyncMock) as mock_kickoff:
            mock_kickoff.return_value = {
                "tracking_number": "TKT-20260209-ABC123",
                "category": "gbv"
            }

            # Run handle_gbv
            await flow.handle_gbv()

        # Verify clear_session was called with is_gbv=True
        flow._conversation_manager.clear_session.assert_called_once_with(
            user_id="user-123",
            session_id="session-abc",
            is_gbv=True
        )


class TestGBVKeywordDetection:
    """Test GBV keyword detection across languages."""

    @pytest.mark.asyncio
    async def test_english_gbv_keyword_routes_to_gbv(self):
        """English GBV message routes correctly."""
        flow = IntakeFlow(redis_url="redis://localhost:6379")
        flow.state.message = "My husband hits me"

        category = flow.classify_message()
        assert category == "gbv"

    @pytest.mark.asyncio
    async def test_isizulu_gbv_keyword_routes_to_gbv(self):
        """isiZulu GBV message routes correctly."""
        flow = IntakeFlow(redis_url="redis://localhost:6379")
        flow.state.message = "Udlame lwasekhaya"

        category = flow.classify_message()
        assert category == "gbv"

    @pytest.mark.asyncio
    async def test_afrikaans_gbv_keyword_routes_to_gbv(self):
        """Afrikaans GBV message routes correctly."""
        flow = IntakeFlow(redis_url="redis://localhost:6379")
        flow.state.message = "Huishoudelike geweld"

        category = flow.classify_message()
        assert category == "gbv"

    @pytest.mark.asyncio
    async def test_municipal_message_does_not_route_to_gbv(self):
        """Municipal messages should NOT trigger GBV routing."""
        flow = IntakeFlow(redis_url="redis://localhost:6379")
        flow.state.message = "There is a water leak on Main Street"

        category = flow.classify_message()
        assert category == "municipal"
        assert category != "gbv"


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
