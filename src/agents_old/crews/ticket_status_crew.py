"""TicketStatusCrew — citizen ticket status lookup specialist."""
from typing import Any

from src.agents.crews.base_crew import AgentResponse, BaseCrew, _repair_from_raw
from src.agents.tools.ticket_lookup_tool import lookup_ticket


class TicketStatusResponse(AgentResponse):
    """Structured output from TicketStatusCrew."""
    action_taken: str = "status_lookup"  # "status_lookup" | "no_tickets" | "details_shown"
    tickets_found: int = 0


class TicketStatusCrew(BaseCrew):
    """Ticket status lookup specialist. memory=False — no PII in memory."""

    agent_key = "ticket_status_specialist"
    task_key = "lookup_ticket_status"
    tools = [lookup_ticket]
    memory_enabled = False  # No PII in memory

    def build_task_description(self, context: dict) -> str:
        """Build task description with safe defaults for optional fields."""
        task_config = self.tasks_config[self.task_key]
        safe_context = {
            "user_id": context.get("user_id", ""),
            "language": context.get("language", self.language),
            "tracking_number": context.get("tracking_number", ""),
            "conversation_history": context.get("conversation_history", "(none)"),
        }
        return task_config["description"].format(**safe_context)

    def build_task_kwargs(self, context: dict) -> dict:
        return {"output_pydantic": TicketStatusResponse}

    def build_kickoff_inputs(self, context: dict) -> dict:
        """Pass user_id, language, conversation_history, and optional tracking_number."""
        return {
            "user_id": context.get("user_id", ""),
            "language": context.get("language", self.language),
            "tracking_number": context.get("tracking_number", ""),
            "conversation_history": context.get("conversation_history", "(none)"),
        }

    def parse_result(self, result) -> dict[str, Any]:
        if hasattr(result, "pydantic") and result.pydantic is not None:
            model_dict = result.pydantic.model_dump()
            model_dict["raw_output"] = str(result)
            model_dict["agent"] = "ticket_status"
            return model_dict
        raw = str(result)
        fallback = "I'm Gugu from SALGA Trust Engine. I couldn't find that report right now. Please check your tracking number or try again."
        repaired = _repair_from_raw(raw, TicketStatusResponse, fallback, language=self.language)
        repaired["agent"] = "ticket_status"
        return repaired

    def get_error_response(self, error: Exception) -> dict[str, Any]:
        return {
            "error": str(error),
            "message": (
                "I'm Gugu from SALGA Trust Engine. I couldn't find that report right now. "
                "Please check your tracking number or try again."
            ),
            "agent": "ticket_status",
        }
