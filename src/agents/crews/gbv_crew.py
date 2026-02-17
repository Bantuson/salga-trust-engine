"""GBV specialist crew with enhanced privacy controls.

This module implements the GBV crisis support crew with:
- Trauma-informed prompts in 3 languages
- Memory disabled (prevents cross-session data leakage)
- Max 8 iterations (shorter than municipal - avoid over-questioning victims)
- Automatic SAPS notification on ticket creation
- Session clearing after ticket creation (data minimization)

Key security measures per research:
- memory=False on Crew prevents CrewAI from retaining conversation history
- Separate Redis namespace for GBV conversations (handled by ConversationManager)
- is_sensitive=True on all GBV tickets
- Emergency numbers always provided
"""
import asyncio
import json
import re
from typing import Any

from crewai import Agent, Crew, Process, Task

from src.agents.llm import get_deepseek_llm
from src.agents.prompts.gbv import GBV_INTAKE_PROMPTS
from src.agents.tools.saps_tool import notify_saps
from src.agents.tools.ticket_tool import create_municipal_ticket


class GBVCrew:
    """GBV crisis support crew with enhanced privacy and security.

    This crew handles sensitive GBV reports with trauma-informed approach,
    minimal questioning, and automatic SAPS notification.
    """

    def __init__(self, language: str = "en", llm=None):
        """Initialize GBV crew.

        Args:
            language: Language code (en/zu/af)
            llm: crewai.LLM object. Defaults to DeepSeek V3.2 via get_deepseek_llm().
        """
        self.language = language if language in ["en", "zu", "af"] else "en"
        self.llm = llm or get_deepseek_llm()

    def create_crew(
        self,
        message: str,
        user_id: str,
        tenant_id: str
    ) -> Crew:
        """Create GBV crew with enhanced privacy controls.

        Args:
            message: Citizen's initial message
            user_id: User UUID
            tenant_id: Municipality tenant UUID

        Returns:
            Configured Crew with memory disabled
        """
        # Create crisis support agent with trauma-informed prompt
        agent = Agent(
            role="Crisis Support Specialist",
            goal=f"Safely capture GBV report details in {self.language} and arrange help",
            backstory=GBV_INTAKE_PROMPTS[self.language],
            tools=[create_municipal_ticket, notify_saps],
            llm=self.llm,
            allow_delegation=False,
            max_iter=8,  # Shorter than municipal (10) - don't over-question victims
            verbose=False
        )

        # Create intake task — NO output_pydantic so agent MUST call tools
        task = Task(
            description=f"""Conduct trauma-informed GBV intake in {self.language}.

Initial message: {message}
User ID: {user_id}
Tenant ID (municipality): {tenant_id}

COLLECT MINIMUM REQUIRED INFORMATION:
1. Type of incident (physical/sexual/verbal/threat/other)
2. When it happened (approximate)
3. Location for help
4. Whether in immediate danger
5. Whether children are involved

After gathering information, you MUST do these steps IN ORDER:

STEP 1: Call create_municipal_ticket with these EXACT parameters:
  - category: "gbv"
  - description: detailed description (minimum 20 characters)
  - user_id: {user_id}
  - tenant_id: {tenant_id}
  - language: {self.language}
  - severity: "critical" (all GBV reports are critical)
  - address: the location for help (general area only)

STEP 2: After the ticket is created, call notify_saps with:
  - ticket_id: the id from Step 1 result
  - tracking_number: the tracking_number from Step 1 result
  - incident_type: the type of GBV incident
  - location: general area only (protect victim privacy)
  - is_immediate_danger: true/false
  - tenant_id: {tenant_id}

STEP 3: Return the tracking number and emergency contacts to the victim.

REMEMBER:
- Be empathetic and non-judgmental
- Do NOT ask for perpetrator identification
- Always provide emergency numbers (10111, 0800 150 150)
- Reassure victim that help is being arranged
""",
            expected_output=(
                "The JSON result from create_municipal_ticket (with tracking_number), "
                "followed by SAPS notification confirmation. Include the tracking number "
                "and emergency contacts (10111, 0800 150 150) in the response."
            ),
            agent=agent,
        )

        # Create crew with memory DISABLED (critical for privacy)
        crew = Crew(
            agents=[agent],
            tasks=[task],
            process=Process.sequential,
            memory=False,  # CRITICAL: Disable memory per research Pitfall 3
            verbose=False
        )

        return crew

    async def kickoff(
        self,
        message: str,
        user_id: str,
        tenant_id: str
    ) -> dict[str, Any]:
        """Run the GBV intake crew.

        Wraps the synchronous crew.kickoff() in a thread pool executor
        so it does not block the FastAPI event loop.

        Args:
            message: Citizen's message
            user_id: User UUID
            tenant_id: Municipality tenant UUID

        Returns:
            Dictionary with ticket data or error
        """
        try:
            crew = self.create_crew(message, user_id, tenant_id)

            # Run synchronous crew.kickoff() in thread pool (non-blocking)
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: crew.kickoff(inputs={
                    "message": message,
                    "language": self.language,
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                })
            )

            raw = str(result)

            # Try to extract tracking number from agent's final answer
            tracking_match = re.search(r"TKT-\d{8}-[A-F0-9]{6}", raw)

            # Try to parse JSON from the raw output (tool result embedded)
            json_match = re.search(r"\{[^{}]*\"tracking_number\"[^{}]*\}", raw)
            if json_match:
                try:
                    ticket_dict = json.loads(json_match.group())
                    # Force GBV category as safety check
                    ticket_dict["category"] = "gbv"
                    ticket_dict["message"] = raw
                    return ticket_dict
                except json.JSONDecodeError:
                    pass

            if tracking_match:
                return {
                    "tracking_number": tracking_match.group(),
                    "category": "gbv",
                    "message": raw,
                }

            # Fallback: return raw result
            return {"category": "gbv", "message": raw}

        except Exception as e:
            return {"error": str(e)}
