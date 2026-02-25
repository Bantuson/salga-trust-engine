"""GBVCrew — GBV/abuse intake with trauma-informed prompts and SAPS notification.

Architecture: Phase 10.3 rebuild — Flow-as-router + sequential specialist Crews.

GBV is the most sensitive agent in the platform. It handles domestic violence,
abuse, and assault reports. Key safety and privacy properties:

Key decisions (locked):
- Uses get_deepseek_llm() — GBV is conversation-heavy with minimal tool use
  (single notify_saps call at end). DeepSeek is recommended for this pattern
  per Phase 10.3 research. (Phase 06.7-03 locked decision)
- memory=False — CRITICAL for PII protection. GBV conversations must NEVER
  persist across sessions. Cross-session data leakage is a victim safety risk.
  (Phase 02-03 + Phase 06.9.1 locked decisions) # SEC-05 # POPIA
- max_iter=8 — lower than AuthCrew (15) to avoid over-questioning trauma victims.
  (Phase 02-03 + Phase 06.8-01 locked decisions)
- tools=[notify_saps] — single tool call at end of intake
- output_pydantic=GBVResponse — requires_followup=True by default
- Gugu identity ONLY (no chatty intro, no name-asking) — trauma protocol
  (Phase 06.8-01 locked decision — patient safety boundary)
- GBV eval reports: metadata_only=True — no conversation content in debug output
  (Pitfall 6 compliance per crew_server.py)
"""
from typing import Any

from crewai import Agent, Crew, Process, Task

from src.agents.crews.base_crew import BaseCrew, _repair_from_raw, validate_gbv_output
from src.agents.prompts.gbv import GBV_PROMPTS, GBVResponse, build_gbv_task_description
from src.agents.tools.saps_tool import notify_saps


class GBVCrew(BaseCrew):
    """GBV intake crew — trauma-informed, memory-free, emergency-number-guaranteed.

    Handles GBV and abuse reports with:
    - Trauma-informed Gugu persona (identity only, no chatty intro)
    - DeepSeek LLM (conversation-heavy, minimal tool use)
    - memory=False (PII protection — no cross-session data leakage) # SEC-05
    - max_iter=8 (avoids over-questioning trauma victims)
    - GBV-specific guardrail (validate_gbv_output — enforces emergency numbers)
    """

    agent_key = "gbv_agent"
    task_key = "gbv_intake_task"
    tools = [notify_saps]
    memory_enabled = False  # SEC-05: PII protection — NEVER enable for GBV

    def __init__(self, language: str = "en", llm=None):
        """Initialise GBVCrew.

        Args:
            language: Citizen language ("en", "zu", "af"). Selects trauma-informed
                      Gugu persona from GBV_PROMPTS.
            llm: Optional LLM override for testing. Defaults to get_deepseek_llm()
                 (DeepSeek V3.2) per research recommendation — GBV is conversation-heavy
                 with a single notify_saps tool call at end of intake.
        """
        from src.agents.llm import get_deepseek_llm
        super().__init__(language=language, llm=llm or get_deepseek_llm())

    def create_crew(self, context: dict) -> Crew:
        """Build GBV Agent + Task + Crew.

        Overrides BaseCrew.create_crew() to:
        1. Use GBV_PROMPTS[language] for backstory (trauma-informed Gugu identity)
        2. Use build_gbv_task_description() for per-request task description
        3. Set output_pydantic=GBVResponse for structured output
        4. Set max_iter=8 (lower to avoid over-questioning trauma victims)
        5. Set guardrail=validate_gbv_output (enforces emergency numbers in output)

        Args:
            context: Dict with language, session_status, conversation_history, message,
                     user_id, tenant_id.

        Returns:
            Configured Crew ready for kickoff().
        """
        language = context.get("language", self.language)
        if language not in ("en", "zu", "af"):
            language = self.language

        # Load agent config from YAML for role/goal (backstory from GBV_PROMPTS)
        agent_config = self.agents_config.get(self.agent_key, {})
        role = agent_config.get("role", "GBV Support Specialist")
        goal = agent_config.get(
            "goal",
            "Support citizens reporting GBV with empathy, safety information, and SAPS notification",
        )

        # Backstory from GBV_PROMPTS[language] — trauma-informed Gugu identity
        backstory = GBV_PROMPTS.get(language, GBV_PROMPTS["en"])

        agent = Agent(
            role=role,
            goal=goal,
            backstory=backstory,
            tools=self.tools,
            llm=self.llm,
            allow_delegation=False,
            max_iter=8,   # Avoid over-questioning trauma victims (locked decision)
            verbose=False,
        )

        task_description = build_gbv_task_description(context)
        expected_output = self.tasks_config.get(self.task_key, {}).get(
            "expected_output",
            (
                "A calm, empathetic response that includes emergency numbers 10111 and "
                "0800 150 150, acknowledges the citizen's situation without judgment, "
                "and confirms SAPS notification has been sent"
            ),
        )

        task = Task(
            description=task_description,
            expected_output=expected_output,
            agent=agent,
            output_pydantic=GBVResponse,
            guardrail=validate_gbv_output,   # Enforce emergency numbers in output
            guardrail_max_retries=2,
        )

        return Crew(
            agents=[agent],
            tasks=[task],
            process=Process.sequential,   # ALWAYS sequential — never hierarchical
            memory=False,                 # CRITICAL: PII protection # SEC-05 # POPIA
            verbose=False,
        )

    def build_kickoff_inputs(self, context: dict) -> dict:
        """Map context fields to crew kickoff inputs."""
        return {
            "language": context.get("language", self.language),
            "session_status": context.get("session_status", "active"),
            "conversation_history": context.get("conversation_history", "(none)"),
            "message": context.get("message", ""),
            "user_id": context.get("user_id", ""),
            "tenant_id": context.get("tenant_id", ""),
        }

    def parse_result(self, result) -> dict[str, Any]:
        """Extract GBVResponse Pydantic model if available, else repair fallback.

        Priority:
        1. result.pydantic if available and non-None
        2. _repair_from_raw() with GBVResponse as target model
        3. Hardcoded safe fallback with emergency numbers (never crashes)

        Security: raw_output is for Streamlit debug only — never citizen-facing.
        GBV debug output is metadata-only per crew_server.py Pitfall 6 compliance.
        """
        if hasattr(result, "pydantic") and result.pydantic is not None:
            gbv_result: GBVResponse = result.pydantic
            result_dict = gbv_result.model_dump()
            result_dict["raw_output"] = str(result)
            result_dict["category"] = "gbv"   # Safety: always force category
            return result_dict

        # Repair from raw output
        raw = str(result)
        fallback_msg = (
            "I'm here to help you. You are not alone. "
            "If you are in immediate danger, please call 10111 (SAPS) "
            "or the GBV Command Centre at 0800 150 150 — they are available 24/7."
        )
        repaired = _repair_from_raw(raw, GBVResponse, fallback_msg, language=self.language)
        repaired["category"] = "gbv"   # Safety: always force category
        repaired.setdefault("requires_followup", True)
        repaired.setdefault("emergency_numbers_present", True)
        return repaired

    def get_error_response(self, error: Exception) -> dict[str, Any]:
        """Return a safe error dict that always includes emergency numbers.

        Emergency numbers are re-injected on error as a safety guarantee —
        if the LLM fails entirely, citizens still receive 10111 and 0800 150 150.
        """
        return {
            "message": (
                "I'm here to help. You are safe and supported. "
                "If you are in immediate danger, please call SAPS on 10111 "
                "or the GBV Command Centre at 0800 150 150 (available 24/7)."
            ),
            "requires_followup": True,
            "emergency_numbers_present": True,
            "language": self.language,
            "action_taken": "error",
            "category": "gbv",
            "error": str(error),
        }
