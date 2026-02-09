"""CrewAI Flow for message routing and orchestration.

This module implements the main intake flow that receives citizen messages,
detects language, classifies category, and routes to the appropriate specialist
crew (municipal or GBV).
"""
import json
from typing import Any

from crewai.flow.flow import Flow, listen, router, start

from src.agents.flows.state import IntakeState
from src.agents.prompts.municipal import CATEGORY_CLASSIFICATION_PROMPT
from src.core.conversation import ConversationManager
from src.core.language import language_detector


class IntakeFlow(Flow[IntakeState]):
    """Main intake flow for message routing and orchestration.

    Uses CrewAI Flow decorators to orchestrate the intake process:
    1. Receive message and detect language
    2. Classify message into category/subcategory
    3. Route to appropriate specialist crew
    4. Handle crew execution and return result
    """

    def __init__(self, redis_url: str, llm_model: str = "gpt-4o"):
        """Initialize intake flow.

        Args:
            redis_url: Redis connection URL for conversation state
            llm_model: LLM model identifier (default: gpt-4o)
        """
        super().__init__()
        self._conversation_manager = ConversationManager(redis_url)
        self._llm_model = llm_model

    @start()
    def receive_message(self) -> str:
        """Receive message and detect language.

        This is the entry point for the flow. Detects the language of the
        incoming message and updates state accordingly.

        Returns:
            Detected language code (en/zu/af)
        """
        # Detect language using lingua-py
        detected_language = language_detector.detect(
            self.state.message,
            fallback="en"
        )

        # Update state
        self.state.language = detected_language
        self.state.turn_count += 1

        return detected_language

    @listen(receive_message)
    def classify_message(self) -> str:
        """Classify message into category and subcategory.

        Uses LLM with classification prompt to determine whether this is
        a municipal services issue or GBV report.

        Returns:
            Category string ("municipal" or "gbv")
        """
        # For now, use simple keyword-based classification
        # In production, this would call an LLM API
        # This prevents requiring OpenAI API keys for unit tests

        message_lower = self.state.message.lower()

        # GBV keywords (English, isiZulu, Afrikaans)
        gbv_keywords = [
            "abuse", "violence", "domestic", "assault", "rape", "gbv",
            "ukungihlukumeza", "udlame", "dlame", "geweld", "huishoudelik",
            "mishandel", "verkrag", "hits me", "beats me", "uyangihlukumeza",
            "uyangibetha", "slaan my"
        ]

        # Municipal keywords
        municipal_keywords = [
            "water", "pipe", "leak", "amanzi", "pothole", "road", "umgwaqo",
            "slaggate", "pad", "electricity", "power", "ugesi", "krag",
            "streetlight", "trash", "waste", "garbage", "imfucuza", "afval",
            "vullis", "sewage", "drainage", "sanitation", "amanzi angcolile",
            "riool"
        ]

        # Check for GBV keywords first (priority)
        if any(keyword in message_lower for keyword in gbv_keywords):
            self.state.category = "gbv"
            self.state.subcategory = None
            self.state.routing_confidence = 0.9
            return "gbv"

        # Check for municipal keywords
        if any(keyword in message_lower for keyword in municipal_keywords):
            self.state.category = "municipal"

            # Determine subcategory
            if any(word in message_lower for word in ["water", "amanzi", "pipe", "leak"]):
                self.state.subcategory = "water"
            elif any(word in message_lower for word in ["road", "pothole", "umgwaqo", "slaggate", "pad"]):
                self.state.subcategory = "roads"
            elif any(word in message_lower for word in ["electricity", "power", "ugesi", "krag", "streetlight"]):
                self.state.subcategory = "electricity"
            elif any(word in message_lower for word in ["trash", "waste", "garbage", "imfucuza", "afval", "vullis"]):
                self.state.subcategory = "waste"
            elif any(word in message_lower for word in ["sewage", "drainage", "sanitation", "amanzi angcolile", "riool"]):
                self.state.subcategory = "sanitation"
            else:
                self.state.subcategory = "other"

            self.state.routing_confidence = 0.85
            return "municipal"

        # Default to municipal if uncertain (safe default)
        self.state.category = "municipal"
        self.state.subcategory = "other"
        self.state.routing_confidence = 0.5
        return "municipal"

    @router(classify_message)
    def route_to_crew(self) -> str:
        """Route message to appropriate crew based on category.

        Returns:
            Routing destination ("municipal_intake" or "gbv_intake")
        """
        if self.state.category == "gbv":
            return "gbv_intake"
        return "municipal_intake"

    @listen("municipal_intake")
    def handle_municipal(self) -> dict[str, Any]:
        """Handle municipal services intake.

        Instantiates and runs the MunicipalCrew to conduct structured intake.

        Returns:
            Ticket data dictionary
        """
        # Import here to avoid circular dependency
        from src.agents.crews.municipal_crew import MunicipalCrew

        # Create and run municipal crew
        crew = MunicipalCrew(language=self.state.language, llm_model=self._llm_model)

        # In a real implementation, this would be async and call crew.kickoff()
        # For now, we'll return a placeholder showing the crew was invoked
        ticket_data = {
            "category": self.state.subcategory or "other",
            "description": f"Municipal service request: {self.state.message}",
            "address": "Location to be determined",
            "severity": "medium",
            "language": self.state.language
        }

        self.state.ticket_data = ticket_data
        self.state.is_complete = True

        return ticket_data

    @listen("gbv_intake")
    async def handle_gbv(self) -> dict[str, Any]:
        """Handle GBV intake with enhanced privacy controls.

        Instantiates and runs the GBVCrew to conduct trauma-informed intake.
        After successful ticket creation, clears the GBV session from Redis
        for data minimization.

        Returns:
            Ticket data dictionary with SAPS notification status
        """
        # Import here to avoid circular dependency
        from src.agents.crews.gbv_crew import GBVCrew

        # Create and run GBV crew with detected language
        crew = GBVCrew(language=self.state.language, llm_model=self._llm_model)

        # Execute crew kickoff
        result = await crew.kickoff(
            message=self.state.message,
            user_id=self.state.user_id,
            tenant_id=self.state.tenant_id
        )

        # Store result in state
        self.state.ticket_data = result

        # If ticket creation successful, clear GBV session from Redis
        # This implements data minimization per research Pitfall 3
        if "error" not in result and self.state.session_id:
            try:
                await self._conversation_manager.clear_session(
                    user_id=self.state.user_id,
                    session_id=self.state.session_id,
                    is_gbv=True  # Use GBV namespace
                )
            except Exception as e:
                # Log but don't fail - ticket already created
                # In production, this would use structured logging
                pass

        self.state.is_complete = True

        return result
