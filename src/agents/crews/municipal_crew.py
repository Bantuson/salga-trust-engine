"""Municipal services intake crew for structured ticket gathering.

This module implements the specialist crew that conducts conversational intake
for municipal service requests, gathering all required information before
creating a ticket.
"""
import os
from pathlib import Path
from typing import Any

import yaml
from crewai import Agent, Crew, Process, Task

from src.agents.llm import get_deepseek_llm
from src.agents.prompts.municipal import MUNICIPAL_INTAKE_PROMPTS
from src.agents.tools.ticket_tool import create_municipal_ticket


class MunicipalCrew:
    """Municipal services intake crew with trilingual support.

    This crew consists of a single intake agent that uses language-specific
    prompts to guide citizens through reporting municipal service issues.
    """

    def __init__(self, language: str = "en", llm=None):
        """Initialize municipal crew.

        Args:
            language: Language code (en/zu/af)
            llm: crewai.LLM object. Defaults to DeepSeek V3.2 via get_deepseek_llm().
        """
        self.language = language if language in ["en", "zu", "af"] else "en"
        self.llm = llm or get_deepseek_llm()

        # Load YAML configs
        config_dir = Path(__file__).parent.parent / "config"
        with open(config_dir / "agents.yaml", "r", encoding="utf-8") as f:
            self.agents_config = yaml.safe_load(f)
        with open(config_dir / "tasks.yaml", "r", encoding="utf-8") as f:
            self.tasks_config = yaml.safe_load(f)

    def create_crew(
        self,
        message: str,
        user_id: str,
        tenant_id: str
    ) -> Crew:
        """Create crew for municipal intake.

        Args:
            message: Citizen's initial message
            user_id: User UUID
            tenant_id: Municipality tenant UUID

        Returns:
            Configured Crew ready to run
        """
        # Get agent config and inject language
        agent_config = self.agents_config["municipal_intake_agent"]
        role = agent_config["role"]
        goal = agent_config["goal"].format(language=self.language)

        # Use language-specific prompt as backstory
        backstory = MUNICIPAL_INTAKE_PROMPTS.get(self.language, MUNICIPAL_INTAKE_PROMPTS["en"])

        # Create agent
        agent = Agent(
            role=role,
            goal=goal,
            backstory=backstory,
            tools=[create_municipal_ticket],
            llm=self.llm,
            allow_delegation=agent_config.get("allow_delegation", False),
            max_iter=agent_config.get("max_iter", 10),
            verbose=agent_config.get("verbose", False)
        )

        # Get task config and inject variables
        task_config = self.tasks_config["municipal_intake_task"]
        description = task_config["description"].format(
            message=message,
            language=self.language,
            tenant_id=tenant_id,
            user_id=user_id,
        )
        expected_output = task_config["expected_output"]

        # Create task — NO output_pydantic so the agent MUST call the tool
        # (output_pydantic=TicketData let the agent fill fields directly,
        # bypassing create_municipal_ticket and skipping DB persistence)
        task = Task(
            description=description,
            expected_output=expected_output,
            agent=agent,
        )

        # Create crew
        crew = Crew(
            agents=[agent],
            tasks=[task],
            process=Process.sequential,
            verbose=False
        )

        return crew

    async def kickoff(
        self,
        message: str,
        user_id: str,
        tenant_id: str
    ) -> dict[str, Any]:
        """Run the municipal intake crew.

        Wraps the synchronous crew.kickoff() in a thread pool executor
        so it does not block the FastAPI event loop. Same pattern as AuthCrew.

        Args:
            message: Citizen's message
            user_id: User UUID
            tenant_id: Municipality tenant UUID

        Returns:
            Dictionary with ticket data and message, or error
        """
        import asyncio
        import json
        import re

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
                    ticket_dict["message"] = raw
                    return ticket_dict
                except json.JSONDecodeError:
                    pass

            if tracking_match:
                return {
                    "tracking_number": tracking_match.group(),
                    "message": raw,
                }

            # Fallback: return raw result (agent may not have called tool)
            return {"message": raw}

        except Exception as e:
            return {"error": str(e)}
