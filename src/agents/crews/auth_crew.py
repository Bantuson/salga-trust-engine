"""AuthCrew — citizen authentication (registration + re-auth)."""
from typing import Any

from src.agents.crews.base_crew import BaseCrew, _repair_from_raw
from src.agents.prompts.auth import AUTH_PROMPTS, AuthResult, build_auth_task_description
from src.agents.tools.auth_tool import (
    create_supabase_user_tool,
    lookup_user_tool,
    send_otp_tool,
    verify_otp_tool,
)


class AuthCrew(BaseCrew):
    """Citizen authentication crew. memory=False (PII protection)."""

    agent_key = "auth_agent"
    task_key = "authenticate_citizen"
    tools = [send_otp_tool, verify_otp_tool, create_supabase_user_tool, lookup_user_tool]
    memory_enabled = False

    def get_language_prompt(self, language: str) -> str:
        return AUTH_PROMPTS.get(language, AUTH_PROMPTS["en"])

    def build_task_description(self, context: dict) -> str:
        """Auth uses build_auth_task_description() instead of YAML template."""
        return build_auth_task_description(context)

    def build_task_kwargs(self, context: dict) -> dict:
        return {"output_pydantic": AuthResult}

    def build_kickoff_inputs(self, context: dict) -> dict:
        return {
            "phone": context.get("phone", "unknown"),
            "language": context.get("language", self.language),
            "user_exists": str(context.get("user_exists", False)),
            "session_status": context.get("session_status", "new"),
            "user_id": context.get("user_id", "none"),
            "conversation_history": context.get("conversation_history", "(none)"),
        }

    def parse_result(self, result) -> dict[str, Any]:
        """Extract AuthResult Pydantic model if available, else repair fallback."""
        if hasattr(result, "pydantic") and result.pydantic:
            auth_result: AuthResult = result.pydantic
            result_dict = auth_result.model_dump()
            msg = result_dict.get("message", "")
            if msg and "Final Answer:" in msg:
                msg = msg.split("Final Answer:", 1)[-1].strip()
                result_dict["message"] = msg
            return result_dict

        # Repair from raw output
        raw = str(result)
        repaired = _repair_from_raw(
            raw,
            AuthResult,
            "Authentication failed due to an unexpected error. Please try again.",
            language=self.language,
        )
        # Merge auth-specific defaults for missing fields
        repaired.setdefault("authenticated", False)
        repaired.setdefault("session_status", "failed")
        repaired.setdefault("error", None)
        return repaired

    def get_error_response(self, error: Exception) -> dict[str, Any]:
        return {
            "authenticated": False,
            "session_status": "failed",
            "message": "Authentication failed due to an unexpected error. Please try again.",
            "error": str(error),
        }
