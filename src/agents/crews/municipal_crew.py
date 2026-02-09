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

from src.agents.prompts.municipal import MUNICIPAL_INTAKE_PROMPTS
from src.agents.tools.ticket_tool import create_municipal_ticket
from src.schemas.ticket import TicketData


class MunicipalCrew:
    """Municipal services intake crew with trilingual support.

    This crew consists of a single intake agent that uses language-specific
    prompts to guide citizens through reporting municipal service issues.
    """

    def __init__(self, language: str = "en", llm_model: str = "gpt-4o"):
        """Initialize municipal crew.

        Args:
            language: Language code (en/zu/af)
            llm_model: LLM model identifier
        """
        self.language = language if language in ["en", "zu", "af"] else "en"
        self.llm_model = llm_model

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
            llm=self.llm_model,
            allow_delegation=agent_config.get("allow_delegation", False),
            max_iter=agent_config.get("max_iter", 10),
            verbose=agent_config.get("verbose", False)
        )

        # Get task config and inject variables
        task_config = self.tasks_config["municipal_intake_task"]
        description = task_config["description"].format(
            message=message,
            language=self.language,
            tenant_id=tenant_id
        )
        expected_output = task_config["expected_output"]

        # Create task
        task = Task(
            description=description,
            expected_output=expected_output,
            agent=agent,
            output_pydantic=TicketData
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

        Args:
            message: Citizen's message
            user_id: User UUID
            tenant_id: Municipality tenant UUID

        Returns:
            Dictionary with ticket data or error
        """
        try:
            crew = self.create_crew(message, user_id, tenant_id)

            # In production, this would execute the crew
            # For now, return a placeholder showing crew configuration
            result = crew.kickoff(inputs={
                "message": message,
                "language": self.language,
                "tenant_id": tenant_id,
                "user_id": user_id
            })

            # Extract Pydantic result if available
            if hasattr(result, "pydantic") and result.pydantic:
                ticket_data = result.pydantic
                return ticket_data.model_dump()

            # Fallback: return raw result
            return {"result": str(result)}

        except Exception as e:
            return {"error": str(e)}
