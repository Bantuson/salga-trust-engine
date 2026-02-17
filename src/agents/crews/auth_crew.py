"""AuthCrew — conversational citizen authentication crew.

Handles citizen registration (new users) and OTP re-authentication (returning
users with expired sessions). Guards all report submission access — no citizen
can submit a ticket without completing authentication first.

Security controls:
- memory=False: prevents PII (phone, email, OTP codes) leaking across sessions
- max_iter=15: accommodates the full 6-step registration flow
- allow_delegation=False: single agent, no delegation attack surface
- Stateless tools (send_otp_tool, verify_otp_tool, etc.) per auth_tool.py pattern

Mirrors MunicipalCrew / GBVCrew structure exactly:
- __init__(language, llm) constructor
- create_crew(context) -> Crew
- async kickoff(context) -> dict
"""
import asyncio
import re
from typing import Any

from crewai import Agent, Crew, Process, Task

from src.agents.prompts.auth import AUTH_PROMPTS, AuthResult, build_auth_task_description
from src.agents.tools.auth_tool import (
    create_supabase_user_tool,
    lookup_user_tool,
    send_otp_tool,
    verify_otp_tool,
)


class AuthCrew:
    """Citizen authentication crew with trilingual support.

    Handles two flows:
    1. Full dual-path registration for new citizens (phone-first or email-first)
    2. OTP re-authentication for returning citizens with expired sessions

    Privacy design: memory=False prevents CrewAI from retaining PII (phone,
    email, OTP codes) between crew invocations. Each kickoff() call is
    completely isolated.
    """

    def __init__(self, language: str = "en", llm=None):
        """Initialize auth crew.

        Args:
            language: Language code — "en", "zu", or "af". Defaults to "en".
            llm: crewai.LLM instance or None. If None, get_deepseek_llm() is
                 called on first crew creation (lazy import avoids circular
                 imports during testing with fake API keys).
        """
        self.language = language if language in ["en", "zu", "af"] else "en"
        self.llm = llm  # Accept LLM object or None (resolved lazily in create_crew)

    def create_crew(self, context: dict) -> Crew:
        """Create auth crew for registration or re-authentication.

        Args:
            context: Dict with keys:
                - user_exists (bool): True if citizen already has an account
                - session_status (str): "active", "expired", or "new"
                - user_id (str | None): Supabase UUID for existing users
                - phone (str): Citizen's phone number (E.164 format)
                - language (str): Language override (falls back to self.language)
                - conversation_history (str): Prior turns in this session

        Returns:
            Configured Crew ready to kickoff()
        """
        # Resolve LLM (lazy import prevents circular imports)
        llm = self.llm
        if llm is None:
            from src.agents.llm import get_deepseek_llm
            llm = get_deepseek_llm()

        # Language can be overridden per-request (WhatsApp session may detect a
        # different language mid-conversation)
        language = context.get("language", self.language)
        if language not in ["en", "zu", "af"]:
            language = self.language

        # Agent backstory is the language-specific auth prompt
        backstory = AUTH_PROMPTS.get(language, AUTH_PROMPTS["en"])

        # Create the auth agent
        agent = Agent(
            role="Citizen Authentication Specialist",
            goal=f"Register or re-authenticate citizens in {language} before they can submit reports",
            backstory=backstory,
            tools=[
                send_otp_tool,
                verify_otp_tool,
                create_supabase_user_tool,
                lookup_user_tool,
            ],
            llm=llm,
            allow_delegation=False,
            max_iter=15,  # Full registration is 6+ steps; re-auth is 3 steps
            verbose=False,
        )

        # Build task description from context (fills AUTH_TASK_TEMPLATE)
        task_description = build_auth_task_description(context)

        # Create task with AuthResult as structured output
        task = Task(
            description=task_description,
            expected_output=(
                "Authenticated user with active session, or clear error message "
                "explaining what step failed and how to retry."
            ),
            agent=agent,
            output_pydantic=AuthResult,
        )

        # Create crew with memory DISABLED (PII in auth conversations — same as GBVCrew)
        crew = Crew(
            agents=[agent],
            tasks=[task],
            process=Process.sequential,
            memory=False,  # CRITICAL: Disable memory — auth handles PII
            verbose=False,
        )

        return crew

    async def kickoff(self, context: dict) -> dict[str, Any]:
        """Run the auth crew asynchronously.

        Wraps the synchronous crew.kickoff() in a thread pool executor so it
        does not block the FastAPI event loop. Same pattern as MunicipalCrew.

        Args:
            context: Dict with keys: user_exists, session_status, user_id,
                     phone, language, conversation_history

        Returns:
            AuthResult dict on success, or {"error": "..."} on unexpected failure
        """
        try:
            crew = self.create_crew(context)

            # Run synchronous crew.kickoff() in thread pool (non-blocking)
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: crew.kickoff(inputs={
                    "phone": context.get("phone", "unknown"),
                    "language": context.get("language", self.language),
                    "user_exists": str(context.get("user_exists", False)),
                    "session_status": context.get("session_status", "new"),
                    "user_id": context.get("user_id", "none"),
                    "conversation_history": context.get("conversation_history", "(none)"),
                })
            )

            # Extract Pydantic result if available
            if hasattr(result, "pydantic") and result.pydantic:
                auth_result: AuthResult = result.pydantic
                result_dict = auth_result.model_dump()
                # Strip "Final Answer:" prefix if LLM included it in the message field
                msg = result_dict.get("message", "")
                if msg and "Final Answer:" in msg:
                    msg = msg.split("Final Answer:", 1)[-1].strip()
                    result_dict["message"] = msg
                return result_dict

            # Fallback: return raw result string wrapped in a dict
            raw = str(result)
            # Try to extract just the final answer portion
            final = re.search(r"Final Answer:?\s*(.+)", raw, re.DOTALL | re.IGNORECASE)
            message = final.group(1).strip() if final else raw
            return {
                "authenticated": False,
                "session_status": "failed",
                "message": message,
                "raw_output": raw,  # Keep raw for debug
                "error": None,
            }

        except Exception as e:
            return {
                "authenticated": False,
                "session_status": "failed",
                "message": "Authentication failed due to an unexpected error. Please try again.",
                "error": str(e),
            }
