"""AuthCrew — citizen authentication (registration + re-auth).

Architecture: Phase 10.3 rebuild — Flow-as-router + sequential specialist Crews.

AuthCrew handles the first point of contact for new citizens (full registration
flow: name, OTP, proof of residence, municipality assignment, Supabase account
creation) and returning citizens with expired sessions (OTP re-auth only).

Key decisions:
- Uses get_routing_llm() (GPT-4o-mini) — auth has 4 sequential tool calls
  (lookup_user, send_otp, verify_otp, create_supabase_user) requiring reliable
  structured tool use. DeepSeek is weaker at multi-step tool chaining.
- memory=False — auth tools handle PII (phone, email, OTP codes).
  memory=False prevents cross-session PII leakage. # SEC-01
- max_iter=15 — full registration is 6+ steps requiring more LLM turns than
  single-tool specialists (GBV max_iter=8, municipal max_iter=5).
- output_pydantic=AuthResult — structured output guarantees message field exists
  even if LLM produces freeform text.
- Backstory comes from AUTH_PROMPTS[language] dict (not agents.yaml) — the
  Gugu persona requires rich trilingual prompts that benefit from Python string
  management rather than YAML embedding.
"""
from typing import Any

from crewai import Agent, Crew, Process, Task

from src.agents.crews.base_crew import BaseCrew, _repair_from_raw
from src.agents.prompts.auth import AUTH_PROMPTS, AuthResult, build_auth_task_description
from src.agents.tools.auth_tool import (
    create_supabase_user_tool,
    lookup_user_tool,
    send_otp_tool,
    verify_otp_tool,
)


class AuthCrew(BaseCrew):
    """Citizen authentication crew.

    Handles new citizen registration and returning citizen OTP re-auth.
    Uses GPT-4o-mini for reliable multi-step tool chaining.
    memory=False to protect PII between sessions. # SEC-01
    """

    agent_key = "auth_agent"
    task_key = "auth_task"
    tools = [lookup_user_tool, send_otp_tool, verify_otp_tool, create_supabase_user_tool]
    memory_enabled = False  # SEC-01: auth tools handle PII

    def __init__(self, language: str = "en", llm=None):
        """Initialise AuthCrew.

        Args:
            language: Citizen language ("en", "zu", "af"). Used to select
                      Gugu persona from AUTH_PROMPTS.
            llm: Optional LLM override for testing. Defaults to get_routing_llm()
                 (GPT-4o-mini) per locked decision — auth needs reliable tool use.
        """
        # Import here to avoid circular imports at module level
        from src.agents.llm import get_routing_llm
        super().__init__(language=language, llm=llm or get_routing_llm())

    def create_crew(self, context: dict) -> Crew:
        """Build auth Agent + Task + Crew.

        Overrides BaseCrew.create_crew() to:
        1. Use AUTH_PROMPTS[language] for backstory (rich Gugu persona)
        2. Use build_auth_task_description() for per-request task description
        3. Set output_pydantic=AuthResult for structured output
        4. Set max_iter=15 (registration is 6+ steps)

        Args:
            context: Dict with phone, language, session_status, user_exists,
                     user_id, conversation_history, message.

        Returns:
            Configured Crew ready for kickoff().
        """
        language = context.get("language", self.language)
        if language not in ("en", "zu", "af"):
            language = self.language

        # Load agent config from YAML for role/goal (backstory from AUTH_PROMPTS)
        agent_config = self.agents_config.get(self.agent_key, {})
        role = agent_config.get("role", "Citizen Authentication Assistant")
        goal = agent_config.get(
            "goal",
            "Help citizens register or log in to SALGA Trust Engine",
        )

        # Backstory from AUTH_PROMPTS[language] — rich trilingual Gugu persona
        backstory = AUTH_PROMPTS.get(language, AUTH_PROMPTS["en"])

        agent = Agent(
            role=role,
            goal=goal,
            backstory=backstory,
            tools=self.tools,
            llm=self.llm,
            allow_delegation=False,
            max_iter=15,  # Registration is 6+ steps
            verbose=False,
        )

        task_description = build_auth_task_description(context)
        expected_output = self.tasks_config.get(self.task_key, {}).get(
            "expected_output",
            "A warm, helpful response guiding the citizen through authentication",
        )

        task = Task(
            description=task_description,
            expected_output=expected_output,
            agent=agent,
            output_pydantic=AuthResult,
        )

        return Crew(
            agents=[agent],
            tasks=[task],
            process=Process.sequential,
            memory=False,  # SEC-01: PII protection
            verbose=False,
        )

    def build_kickoff_inputs(self, context: dict) -> dict:
        """Map context fields to crew kickoff inputs.

        Returns only the fields referenced in AUTH_TASK_TEMPLATE to avoid
        KeyError on format() for unexpected keys.
        """
        return {
            "phone": context.get("phone", "unknown"),
            "language": context.get("language", self.language),
            "user_exists": str(context.get("user_exists", False)),
            "session_status": context.get("session_status", "none"),
            "user_id": context.get("user_id") or "none",
            "conversation_history": context.get("conversation_history", "(none)"),
            "message": context.get("message", ""),
        }

    def parse_result(self, result) -> dict[str, Any]:
        """Extract AuthResult Pydantic model if available, else repair fallback.

        Priority:
        1. result.pydantic if available and non-None
        2. _repair_from_raw() with AuthResult as target model
        3. Hardcoded safe fallback dict (never crashes)
        """
        if hasattr(result, "pydantic") and result.pydantic is not None:
            auth_result: AuthResult = result.pydantic
            result_dict = auth_result.model_dump()
            # Preserve raw output for Streamlit debug (never citizen-facing)
            result_dict["raw_output"] = str(result)
            return result_dict

        # Repair from raw output
        raw = str(result)
        repaired = _repair_from_raw(
            raw,
            AuthResult,
            "I'm here to help you access SALGA Trust Engine. Could you please tell me your name?",
            language=self.language,
        )
        # Ensure auth-specific defaults are present
        repaired.setdefault("requires_otp", False)
        repaired.setdefault("session_status", "none")
        return repaired

    def get_error_response(self, error: Exception) -> dict[str, Any]:
        """Return a safe error dict that always has a message field."""
        return {
            "message": (
                "I'm having a moment — please try again in a second. "
                "I'm here to help you access SALGA Trust Engine."
            ),
            "requires_otp": False,
            "session_status": "none",
            "language": self.language,
            "error": str(error),
        }
