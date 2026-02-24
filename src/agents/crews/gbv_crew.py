"""GBVCrew — GBV crisis support with enhanced privacy."""
from typing import Any

from src.agents.crews.base_crew import AgentResponse, BaseCrew, _repair_from_raw, validate_gbv_output
from src.agents.tools.saps_tool import notify_saps
from src.agents.tools.ticket_tool import create_municipal_ticket


class GBVResponse(AgentResponse):
    """Structured output from GBVCrew. Emergency numbers always in error fallback."""
    action_taken: str = "safety_check"  # "safety_check" | "report_filed" | "escalated"
    requires_followup: bool = True  # GBV always requires followup


class GBVCrew(BaseCrew):
    """GBV crisis support crew. memory=False (privacy critical)."""

    agent_key = "gbv_agent"
    task_key = "handle_gbv_report"
    tools = [create_municipal_ticket, notify_saps]
    memory_enabled = False

    def get_task_guardrail(self, context: dict):
        return validate_gbv_output

    def build_task_kwargs(self, context: dict) -> dict:
        return {"output_pydantic": GBVResponse}

    def parse_result(self, result) -> dict[str, Any]:
        if hasattr(result, "pydantic") and result.pydantic is not None:
            model_dict = result.pydantic.model_dump()
            model_dict["raw_output"] = str(result)
            model_dict["category"] = "gbv"  # Safety: always force category
            return model_dict
        raw = str(result)
        fallback = "I'm here to help you. If you are in immediate danger, please call 10111 or the GBV Command Centre at 0800 150 150."
        repaired = _repair_from_raw(raw, GBVResponse, fallback, language=self.language)
        repaired["category"] = "gbv"  # Safety: always force category
        return repaired

    def get_error_response(self, error):
        return {
            "error": str(error),
            "message": "I'm here to help. If you are in immediate danger, call 10111 or the GBV Command Centre at 0800 150 150.",
        }
