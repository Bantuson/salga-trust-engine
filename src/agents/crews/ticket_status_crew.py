"""TicketStatusCrew — citizen ticket status lookup.

Architecture: Phase 10.3 rebuild — Flow-as-router + sequential specialist Crews.

TicketStatusCrew handles citizens asking about the status of their service reports.
It asks for a tracking number if not provided, then calls lookup_ticket_tool to
look up the ticket and reports the status clearly.

Key decisions:
- Uses get_routing_llm() (GPT-4o-mini) — ticket status ends with a tool call
  (lookup_ticket_tool). Tool reliability is critical; gpt-4o-mini preferred per
  Phase 10.3 research for tool-heavy agents.
- memory=False — conversation history injected as string context. Stateless
  per-request to avoid cross-session data leakage.
- max_iter=8 — ticket status is simpler than municipal intake: ask for tracking
  number (1 turn if missing), look up, report (2-3 turns total).
- output_pydantic=TicketStatusResponse — structured output guarantees message field.
- Backstory comes from TICKET_STATUS_PROMPTS[language] dict (not agents.yaml) — the
  trilingual Gugu persona requires rich prompts that benefit from Python string management.

Security:
- user_id is passed as mandatory context to the task description.
- lookup_ticket_tool asserts user_id is truthy (defense-in-depth against RLS bypass).
  (Phase 06.9 locked decision)
"""
from typing import Any

from crewai import Agent, Crew, Process, Task

from src.agents.crews.base_crew import BaseCrew, _repair_from_raw
from src.agents.prompts.ticket_status import (
    TICKET_STATUS_PROMPTS,
    TicketStatusResponse,
    build_ticket_status_task_description,
)
from src.agents.tools.ticket_lookup_tool import lookup_ticket_tool


class TicketStatusCrew(BaseCrew):
    """Citizen ticket status lookup crew.

    Looks up the status of a citizen's service ticket by tracking number.
    Uses GPT-4o-mini for reliable lookup_ticket_tool use.
    memory=False — conversation history injected as string context.
    """

    agent_key = "ticket_status_agent"
    task_key = "ticket_status_task"
    tools = [lookup_ticket_tool]
    memory_enabled = False  # Conversation history injected as string context

    def __init__(self, language: str = "en", llm=None):
        """Initialise TicketStatusCrew.

        Args:
            language: Citizen language ("en", "zu", "af"). Used to select
                      Gugu persona from TICKET_STATUS_PROMPTS.
            llm: Optional LLM override for testing. Defaults to get_routing_llm()
                 (GPT-4o-mini) — ticket status ends with a tool call, requiring
                 reliable structured tool use (Phase 10.3 research decision).
        """
        from src.agents.llm import get_routing_llm
        super().__init__(language=language, llm=llm or get_routing_llm())

    def create_crew(self, context: dict) -> Crew:
        """Build ticket status Agent + Task + Crew.

        Overrides BaseCrew.create_crew() to:
        1. Use TICKET_STATUS_PROMPTS[language] for backstory (rich Gugu persona)
        2. Use build_ticket_status_task_description() for per-request task description
        3. Set output_pydantic=TicketStatusResponse for structured output
        4. Set max_iter=8 (ask for tracking number + look up + report)

        Args:
            context: Dict with phone, language, user_id, tracking_number (optional),
                     conversation_history, message.

        Returns:
            Configured Crew ready for kickoff().
        """
        language = context.get("language", self.language)
        if language not in ("en", "zu", "af"):
            language = self.language

        # Load agent config from YAML for role/goal (backstory from TICKET_STATUS_PROMPTS)
        agent_config = self.agents_config.get(self.agent_key, {})
        role = agent_config.get("role", "Ticket Status Specialist")
        goal = agent_config.get(
            "goal",
            "Help citizens check the status of their municipal service reports",
        )

        # Backstory from TICKET_STATUS_PROMPTS[language] — rich trilingual Gugu persona
        backstory = TICKET_STATUS_PROMPTS.get(language, TICKET_STATUS_PROMPTS["en"])

        agent = Agent(
            role=role,
            goal=goal,
            backstory=backstory,
            tools=self.tools,
            llm=self.llm,
            allow_delegation=False,
            max_iter=8,  # Ask for tracking number (if missing) + look up + report
            verbose=False,
        )

        task_description = build_ticket_status_task_description(context)
        expected_output = self.tasks_config.get(self.task_key, {}).get(
            "expected_output",
            "A clear status update for the citizen's service ticket",
        )

        task = Task(
            description=task_description,
            expected_output=expected_output,
            agent=agent,
            output_pydantic=TicketStatusResponse,
        )

        return Crew(
            agents=[agent],
            tasks=[task],
            process=Process.sequential,  # ALWAYS sequential
            memory=False,
            verbose=False,
        )

    def build_kickoff_inputs(self, context: dict) -> dict:
        """Map context fields to crew kickoff inputs."""
        return {
            "phone": context.get("phone", "unknown"),
            "language": context.get("language", self.language),
            "user_id": context.get("user_id") or "",
            "tracking_number": context.get("tracking_number") or "",
            "conversation_history": context.get("conversation_history", "(none)"),
            "message": context.get("message", ""),
        }

    def parse_result(self, result) -> dict[str, Any]:
        """Extract TicketStatusResponse Pydantic model if available, else repair fallback.

        Priority:
        1. result.pydantic if available and non-None
        2. _repair_from_raw() with TicketStatusResponse as target model
        3. Hardcoded safe fallback dict (never crashes)
        """
        if hasattr(result, "pydantic") and result.pydantic is not None:
            status_result: TicketStatusResponse = result.pydantic
            result_dict = status_result.model_dump()
            result_dict["raw_output"] = str(result)
            return result_dict

        # Repair from raw output
        raw = str(result)
        repaired = _repair_from_raw(
            raw,
            TicketStatusResponse,
            (
                "I can help you check on your report. "
                "Could you give me your tracking number? "
                "It looks like TKT- followed by the date and a code."
            ),
            language=self.language,
        )
        repaired.setdefault("tickets_found", 0)
        return repaired

    def get_error_response(self, error: Exception) -> dict[str, Any]:
        """Return a safe error dict that always has a message field."""
        return {
            "message": (
                "I'm having a moment — please try again in a second. "
                "I'm here to help you check on your service report."
            ),
            "tickets_found": 0,
            "language": self.language,
            "error": str(error),
        }
