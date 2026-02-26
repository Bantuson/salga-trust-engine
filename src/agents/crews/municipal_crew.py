"""MunicipalIntakeCrew — citizen municipal service report intake.

Architecture: Phase 10.3 rebuild — Flow-as-router + sequential specialist Crews.

MunicipalIntakeCrew handles citizens reporting municipal service problems:
water, roads, electricity, waste, sanitation, and other categories.
It collects description, location, and category before calling
create_municipal_ticket to create the ticket in the database.

Key decisions:
- Uses get_deepseek_llm() (DeepSeek V3.2) — per-agent trajectory evals in Phase
  10.3 Plan 08 proved that gpt-4o-mini ignores backstory and tool instructions
  in long prompts (150-300 lines). DeepSeek follows the Gugu persona and
  create_municipal_ticket call correctly. Backstory compliance > raw tool-call speed.
  get_routing_llm() (gpt-4o-mini) is kept ONLY for IntakeFlow intent
  classification where prompts are short (< 50 tokens, no tools).
- memory=False — conversation history is injected as string context.
  Stateless per-request to avoid cross-session data leakage.
- max_iter=10 — municipal intake typically needs 3-5 turns to collect description,
  location, and category before the final tool call.
- output_pydantic=MunicipalResponse — structured output guarantees message field exists.
- Backstory comes from MUNICIPAL_PROMPTS[language] dict (not agents.yaml) — the
  trilingual Gugu persona requires rich prompts that benefit from Python string management.
"""
from typing import Any

from crewai import Agent, Crew, Process, Task

from src.agents.crews.base_crew import BaseCrew, _repair_from_raw
from src.agents.prompts.municipal import (
    MUNICIPAL_PROMPTS,
    MunicipalResponse,
    build_municipal_task_description,
)
from src.agents.tools.ticket_tool import create_municipal_ticket


class MunicipalIntakeCrew(BaseCrew):
    """Municipal service intake crew.

    Collects issue description, location, and category from citizen,
    then calls create_municipal_ticket to create the service ticket.
    Uses DeepSeek V3.2 for backstory compliance with long Gugu persona prompts.
    memory=False — conversation history injected as string context.
    """

    agent_key = "municipal_intake_agent"
    task_key = "municipal_intake_task"
    tools = [create_municipal_ticket]
    memory_enabled = False  # Conversation history injected as string context

    def __init__(self, language: str = "en", llm=None):
        """Initialise MunicipalIntakeCrew.

        Args:
            language: Citizen language ("en", "zu", "af"). Used to select
                      Gugu persona from MUNICIPAL_PROMPTS.
            llm: Optional LLM override for testing. Defaults to get_deepseek_llm()
                 — Phase 10.3 evals proved DeepSeek follows long backstory prompts
                 and tool call sequences correctly. gpt-4o-mini ignores instructions
                 in 150-300 line prompts (eval result: 0/3 tool calls correct).
        """
        from src.agents.llm import get_deepseek_llm
        super().__init__(language=language, llm=llm or get_deepseek_llm())

    def create_crew(self, context: dict) -> Crew:
        """Build municipal Agent + Task + Crew.

        Overrides BaseCrew.create_crew() to:
        1. Use MUNICIPAL_PROMPTS[language] for backstory (rich Gugu persona)
        2. Use build_municipal_task_description() for per-request task description
        3. Set output_pydantic=MunicipalResponse for structured output
        4. Set max_iter=10 (3-5 turns to collect info + tool call)

        Args:
            context: Dict with phone, language, user_id, tenant_id,
                     conversation_history, message, user_name (optional).

        Returns:
            Configured Crew ready for kickoff().
        """
        language = context.get("language", self.language)
        if language not in ("en", "zu", "af"):
            language = self.language

        # Load agent config from YAML for role/goal (backstory from MUNICIPAL_PROMPTS)
        agent_config = self.agents_config.get(self.agent_key, {})
        role = agent_config.get("role", "Municipal Service Intake Assistant")
        goal = agent_config.get(
            "goal",
            "Help citizens report municipal service problems and create service tickets",
        )

        # Backstory from MUNICIPAL_PROMPTS[language] — rich trilingual Gugu persona
        backstory = MUNICIPAL_PROMPTS.get(language, MUNICIPAL_PROMPTS["en"])

        agent = Agent(
            role=role,
            goal=goal,
            backstory=backstory,
            tools=self.tools,
            llm=self.llm,
            allow_delegation=False,
            max_iter=10,  # 3-5 turns to collect info + 1 tool call + confirmation
            verbose=False,
        )

        task_description = build_municipal_task_description(context)
        expected_output = self.tasks_config.get(self.task_key, {}).get(
            "expected_output",
            "A warm, helpful response collecting issue details or confirming ticket creation",
        )

        task = Task(
            description=task_description,
            expected_output=expected_output,
            agent=agent,
            output_pydantic=MunicipalResponse,
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
            "tenant_id": context.get("tenant_id") or "",
            "user_name": context.get("user_name") or "Citizen",
            "conversation_history": context.get("conversation_history", "(none)"),
            "message": context.get("message", ""),
        }

    def parse_result(self, result) -> dict[str, Any]:
        """Extract MunicipalResponse Pydantic model if available, else repair fallback.

        Priority:
        1. result.pydantic if available and non-None
        2. _repair_from_raw() with MunicipalResponse as target model
        3. Hardcoded safe fallback dict (never crashes)
        """
        if hasattr(result, "pydantic") and result.pydantic is not None:
            municipal_result: MunicipalResponse = result.pydantic
            result_dict = municipal_result.model_dump()
            result_dict["raw_output"] = str(result)
            return result_dict

        # Repair from raw output
        raw = str(result)
        repaired = _repair_from_raw(
            raw,
            MunicipalResponse,
            (
                "I'm here to help you report a municipal service issue. "
                "Could you describe the problem you're experiencing?"
            ),
            language=self.language,
        )
        repaired.setdefault("action_taken", "collecting_info")
        repaired.setdefault("tracking_number", "")
        return repaired

    def get_error_response(self, error: Exception) -> dict[str, Any]:
        """Return a safe error dict that always has a message field."""
        return {
            "message": (
                "I'm having a moment — please try again in a second. "
                "I'm here to help you report a municipal service issue."
            ),
            "action_taken": "none",
            "tracking_number": "",
            "language": self.language,
            "error": str(error),
        }
