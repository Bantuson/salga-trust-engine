"""MunicipalCrew — municipal service ticket intake."""
from typing import Any

from src.agents.crews.base_crew import AgentResponse, BaseCrew, _repair_from_raw
from src.agents.prompts.municipal import MUNICIPAL_INTAKE_PROMPTS
from src.agents.tools.ticket_tool import create_municipal_ticket


class MunicipalResponse(AgentResponse):
    """Structured output from MunicipalCrew."""
    action_taken: str = "intake"  # "intake_started" | "ticket_created" | "clarifying"


class MunicipalCrew(BaseCrew):
    """Municipal services intake crew. memory=False for consistency."""

    agent_key = "municipal_intake_agent"
    task_key = "handle_municipal_report"
    tools = [create_municipal_ticket]
    memory_enabled = False  # FIX: was unset (defaulted True), now explicit

    def get_language_prompt(self, language: str) -> str:
        return MUNICIPAL_INTAKE_PROMPTS.get(language, MUNICIPAL_INTAKE_PROMPTS["en"])

    def build_task_kwargs(self, context: dict) -> dict:
        return {"output_pydantic": MunicipalResponse}

    def parse_result(self, result) -> dict[str, Any]:
        if hasattr(result, "pydantic") and result.pydantic is not None:
            model_dict = result.pydantic.model_dump()
            model_dict["raw_output"] = str(result)
            return model_dict
        # Repair from raw output
        raw = str(result)
        fallback = "I'm Gugu from SALGA Trust Engine. Sorry, I didn't quite catch that -- could you describe your issue again?"
        return _repair_from_raw(raw, MunicipalResponse, fallback, language=self.language)

    def get_error_response(self, error):
        return {
            "error": str(error),
            "message": "I'm Gugu from SALGA Trust Engine. Sorry, something went wrong — could you describe your issue again?",
        }
