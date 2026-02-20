"""ManagerCrew — first-contact routing engine using CrewAI Process.hierarchical.

The manager agent (Gugu persona) receives all citizen messages, classifies intent
via LLM, and delegates to the appropriate specialist agent. This replaces the old
keyword-based IntakeFlow classification with full LLM-based routing.

Architecture:
    - Process.hierarchical with a custom manager_agent (NOT Process.sequential)
    - Manager agent has no tools and allow_delegation=True
    - Specialists are coworkers: allow_delegation=False, each with their tools
    - Both manager_agent and manager_llm set to DeepSeek to prevent OpenAI fallback

Routing categories:
    greeting, municipal_report, gbv_report, ticket_status, auth
"""
import asyncio
import re
from pathlib import Path
from typing import Any

import yaml
from crewai import Agent, Crew, Process, Task

from src.agents.prompts.auth import AUTH_PROMPTS
from src.agents.prompts.gbv import GBV_INTAKE_PROMPTS
from src.agents.prompts.municipal import MUNICIPAL_INTAKE_PROMPTS
from src.agents.tools.auth_tool import (
    create_supabase_user_tool,
    lookup_user_tool,
    send_otp_tool,
    verify_otp_tool,
)
from src.agents.tools.saps_tool import notify_saps
from src.agents.tools.ticket_lookup_tool import lookup_ticket
from src.agents.tools.ticket_tool import create_municipal_ticket


# Patterns that indicate internal delegation text (never citizen-facing)
_DELEGATION_PATTERNS = [
    re.compile(r"^As the .{0,50} Manager", re.IGNORECASE),
    re.compile(r"^As the .{0,50} Specialist", re.IGNORECASE),
    re.compile(r"^Here is the (?:complete|correct).*procedure", re.IGNORECASE),
    re.compile(r"^For you,? Gugu", re.IGNORECASE),
    re.compile(r"^Dear Gugu", re.IGNORECASE),
    re.compile(r"^I am (?:now )?delegating", re.IGNORECASE),
    re.compile(r"^(?:Routing|Delegating) to", re.IGNORECASE),
    re.compile(r"^The manager has", re.IGNORECASE),
    re.compile(r"^Step \d+[:\.]", re.IGNORECASE),
    re.compile(r"^Procedure for", re.IGNORECASE),
    re.compile(r"^I have been assigned", re.IGNORECASE),
    re.compile(r"^(?:My|The) task is to", re.IGNORECASE),
]


class ManagerCrew:
    """Manager crew that handles all first-contact citizen routing.

    Uses Process.hierarchical with a custom manager_agent (Gugu persona).
    The manager classifies intent via LLM and delegates to specialist agents:
    - Citizen Authentication Specialist (auth)
    - Municipal Services Intake Specialist (municipal reports)
    - Crisis Support Specialist (GBV)
    - Ticket Status Specialist (ticket lookup)

    IMPORTANT: This does NOT inherit from BaseCrew. BaseCrew is designed for
    specialist crews with a single agent + single task + Process.sequential.
    ManagerCrew uses Process.hierarchical and builds its own Crew from scratch.
    """

    def __init__(self, language: str = "en", llm=None):
        self.language = language if language in ("en", "zu", "af") else "en"
        self._llm = llm  # Lazy: resolved in create_crew() if None

        # Load YAML configs ONCE at construction time
        config_dir = Path(__file__).parent.parent / "config"
        with open(config_dir / "agents.yaml", "r", encoding="utf-8") as f:
            self.agents_config = yaml.safe_load(f)
        with open(config_dir / "tasks.yaml", "r", encoding="utf-8") as f:
            self.tasks_config = yaml.safe_load(f)

    @property
    def llm(self):
        """Lazy LLM resolution — avoids circular imports, supports test fakes."""
        if self._llm is None:
            from src.agents.llm import get_deepseek_llm
            self._llm = get_deepseek_llm()
        return self._llm

    def create_crew(self, context: dict) -> Crew:
        """Build manager agent, all 4 specialist agents, manager task, and Crew.

        Args:
            context: Dict with message, phone, language, session_status, user_id,
                     user_exists, conversation_history, pending_intent (optional).

        Returns:
            crewai.Crew configured with Process.hierarchical.
        """
        language = context.get("language", self.language)
        if language not in ("en", "zu", "af"):
            language = self.language

        # ── Manager agent (Gugu persona, no tools, allow_delegation=True) ──
        manager_config = self.agents_config["manager_agent"]
        manager_agent = Agent(
            role=manager_config["role"],
            goal=manager_config["goal"].format(language=language),
            backstory=manager_config["backstory"],
            tools=[],  # CRITICAL: manager MUST NOT have tools in hierarchical mode
            llm=self.llm,
            allow_delegation=True,  # CRITICAL: required for hierarchical delegation
            max_iter=manager_config.get("max_iter", 5),
            verbose=False,
        )

        # ── Auth specialist ──
        auth_config = self.agents_config["auth_agent"]
        auth_language_prompt = AUTH_PROMPTS.get(language, AUTH_PROMPTS["en"])
        auth_backstory = (
            auth_config["backstory"] + "\n\n" + auth_language_prompt
            if auth_language_prompt
            else auth_config["backstory"]
        )
        auth_agent = Agent(
            role=auth_config["role"],
            goal=auth_config["goal"].format(language=language),
            backstory=auth_backstory,
            tools=[send_otp_tool, verify_otp_tool, create_supabase_user_tool, lookup_user_tool],
            llm=self.llm,
            allow_delegation=False,  # Specialists MUST NOT delegate further
            max_iter=10,  # Override YAML default (3) — auth needs multiple tool calls (send_otp + verify_otp + create_user)
            verbose=False,
        )

        # ── Municipal intake specialist ──
        municipal_config = self.agents_config["municipal_intake_agent"]
        municipal_language_prompt = MUNICIPAL_INTAKE_PROMPTS.get(language, MUNICIPAL_INTAKE_PROMPTS["en"])
        municipal_backstory = (
            municipal_config["backstory"] + "\n\n" + municipal_language_prompt
            if municipal_language_prompt
            else municipal_config["backstory"]
        )
        municipal_agent = Agent(
            role=municipal_config["role"],
            goal=municipal_config["goal"].format(language=language),
            backstory=municipal_backstory,
            tools=[create_municipal_ticket],
            llm=self.llm,
            allow_delegation=False,
            max_iter=5,  # Override YAML default (3) — municipal needs info gathering + ticket creation
            verbose=False,
        )

        # ── GBV crisis support specialist ──
        gbv_config = self.agents_config["gbv_agent"]
        gbv_language_prompt = GBV_INTAKE_PROMPTS.get(language, GBV_INTAKE_PROMPTS["en"])
        gbv_backstory = (
            gbv_config["backstory"] + "\n\n" + gbv_language_prompt
            if gbv_language_prompt
            else gbv_config["backstory"]
        )
        gbv_agent = Agent(
            role=gbv_config["role"],
            goal=gbv_config["goal"].format(language=language),
            backstory=gbv_backstory,
            tools=[create_municipal_ticket, notify_saps],
            llm=self.llm,
            allow_delegation=False,
            max_iter=gbv_config.get("max_iter", 3),
            verbose=False,
        )

        # ── Ticket status specialist ──
        ticket_config = self.agents_config["ticket_status_specialist"]
        ticket_status_agent = Agent(
            role=ticket_config["role"],
            goal=ticket_config["goal"].format(language=language),
            backstory=ticket_config["backstory"],
            tools=[lookup_ticket],
            llm=self.llm,
            allow_delegation=False,
            max_iter=ticket_config.get("max_iter", 5),
            verbose=False,
        )

        # ── Manager task — routing logic ──
        manager_task_config = self.tasks_config["route_citizen_message"]
        # Build safe context for format(): use empty strings for missing optional fields
        task_context = {
            "message": context.get("message", ""),
            "phone": context.get("phone", "unknown"),
            "language": language,
            "session_status": context.get("session_status", "none"),
            "user_exists": str(context.get("user_exists", False)),
            "user_id": context.get("user_id", ""),
            "conversation_history": context.get("conversation_history", "(none)"),
            "pending_intent": context.get("pending_intent", ""),
        }
        manager_task = Task(
            description=manager_task_config["description"].format(**task_context),
            expected_output=manager_task_config["expected_output"],
            agent=manager_agent,
        )

        # ── Crew with Process.hierarchical ──
        # Specialists in agents=[] are coworkers the manager can delegate to.
        # The manager delegates via CrewAI's automatic delegate_work tool.
        crew = Crew(
            agents=[auth_agent, municipal_agent, gbv_agent, ticket_status_agent],
            tasks=[manager_task],  # ONE task — the manager's routing task
            manager_agent=manager_agent,
            manager_llm=self.llm,  # BOTH manager_agent and manager_llm — prevent OpenAI fallback
            process=Process.hierarchical,
            memory=False,
            verbose=False,  # Changed from True — production mode (was testing mode)
        )
        return crew

    async def kickoff(self, context: dict) -> dict[str, Any]:
        """Run the manager crew asynchronously via thread pool executor.

        Args:
            context: Citizen message context dict.

        Returns:
            Dict with "message" (citizen-facing), "raw_output", and routing metadata.
        """
        try:
            crew = self.create_crew(context)
            # Build inputs — same keys as task_context in create_crew()
            inputs = {
                "message": context.get("message", ""),
                "phone": context.get("phone", "unknown"),
                "language": context.get("language", self.language),
                "session_status": context.get("session_status", "none"),
                "user_exists": str(context.get("user_exists", False)),
                "user_id": context.get("user_id", ""),
                "conversation_history": context.get("conversation_history", "(none)"),
                "pending_intent": context.get("pending_intent", ""),
            }
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, lambda: crew.kickoff(inputs=inputs)
            )
            return self.parse_result(result)
        except Exception as e:
            return self.get_error_response(e)

    def parse_result(self, result) -> dict[str, Any]:
        """Extract clean citizen-facing message from CrewAI result.

        Strips "Final Answer:" prefix, delegation narration lines, and
        CrewAI artifacts. If delegation filtering removes everything,
        returns a warm Gugu fallback.

        Also detects which specialist was engaged from raw output content
        patterns and returns routing_phase + agent for crew_server.py to
        persist on ConversationState (enabling specialist short-circuit
        on subsequent turns).

        Args:
            result: CrewAI CrewOutput object.

        Returns:
            Dict with "message", "raw_output", "routing_phase", "agent",
            and optional "tracking_number".
        """
        raw = str(result)

        # Strip "Final Answer:" prefix
        final = re.search(r"Final Answer:?\s*(.+)", raw, re.DOTALL | re.IGNORECASE)
        text = final.group(1).strip() if final else raw

        # Filter out delegation lines
        lines = text.split("\n")
        clean_lines = []
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            is_delegation = any(p.match(stripped) for p in _DELEGATION_PATTERNS)
            if not is_delegation:
                clean_lines.append(line)

        clean_message = "\n".join(clean_lines).strip()

        # If filtering removed everything, use warm fallback
        if not clean_message or len(clean_message) < 10:
            clean_message = (
                "I'm Gugu from SALGA Trust Engine. Something went wrong on my side "
                "-- please try again in a moment."
            )

        result_dict: dict[str, Any] = {
            "message": clean_message,
            "raw_output": raw,
        }

        # Include tracking number if present
        tracking_match = re.search(r"TKT-\d{8}-[A-F0-9]{6}", raw)
        if tracking_match:
            result_dict["tracking_number"] = tracking_match.group()

        # --- Detect routing_phase and agent from raw output ---
        # CrewAI hierarchical mode delegates to specialists. We detect which
        # specialist was engaged by scanning the raw output for content patterns.
        # This allows crew_server.py to persist routing_phase on ConversationState
        # so subsequent turns short-circuit directly to the active specialist.
        routing_phase, agent = self._detect_routing(raw)
        result_dict["routing_phase"] = routing_phase
        result_dict["agent"] = agent

        return result_dict

    @staticmethod
    def _detect_routing(raw: str) -> tuple[str, str]:
        """Detect which specialist was engaged from raw CrewAI output.

        Scans for delegation markers and content patterns to determine
        which specialist handled (or should handle) the citizen's request.

        Args:
            raw: Raw string output from CrewAI crew.kickoff().

        Returns:
            Tuple of (routing_phase, agent_name). Both default to "manager"
            if no specialist engagement is detected (e.g. greeting handled
            by manager directly).
        """
        raw_lower = raw.lower()

        # --- Auth indicators ---
        _AUTH_SIGNALS = [
            "otp", "verify", "verification", "6-digit", "six-digit",
            "register", "authentication", "send_otp", "verify_otp",
            "confirm your phone", "confirm your email",
            "create_supabase_user", "lookup_user",
            "citizen authentication specialist",
        ]
        auth_score = sum(1 for s in _AUTH_SIGNALS if s in raw_lower)

        # --- Municipal indicators ---
        _MUNICIPAL_SIGNALS = [
            "tkt-", "tracking number", "ticket", "report logged",
            "create_municipal_ticket", "municipal services intake",
            "pothole", "water", "electricity", "sewage", "refuse",
            "municipal services intake specialist",
        ]
        municipal_score = sum(1 for s in _MUNICIPAL_SIGNALS if s in raw_lower)

        # --- GBV indicators ---
        _GBV_SIGNALS = [
            "10111", "0800 150 150", "gbv", "gender-based violence",
            "violence", "abuse", "crisis support specialist",
            "notify_saps", "safe right now",
        ]
        gbv_score = sum(1 for s in _GBV_SIGNALS if s in raw_lower)

        # --- Ticket status indicators ---
        _TICKET_STATUS_SIGNALS = [
            "ticket status", "report status", "lookup_ticket",
            "ticket status specialist", "check the status",
            "status of your", "status of the",
        ]
        ticket_score = sum(1 for s in _TICKET_STATUS_SIGNALS if s in raw_lower)

        # Pick highest score, minimum threshold of 2 to avoid false positives
        scores = {
            "auth": auth_score,
            "municipal": municipal_score,
            "gbv": gbv_score,
            "ticket_status": ticket_score,
        }
        best = max(scores, key=scores.get)
        best_score = scores[best]

        if best_score < 2:
            # Not enough signal to determine specialist — stay with manager
            return ("manager", "manager")

        _AGENT_NAMES = {
            "auth": "auth_agent",
            "municipal": "municipal_intake",
            "gbv": "gbv_intake",
            "ticket_status": "ticket_status",
        }
        return (best, _AGENT_NAMES[best])

    def get_error_response(self, error: Exception) -> dict[str, Any]:
        """Return a warm Gugu error message on any unhandled exception.

        Args:
            error: The caught exception.

        Returns:
            Dict with "error" and "message" keys.
        """
        return {
            "error": str(error),
            "message": (
                "I'm Gugu from SALGA Trust Engine. Something went wrong on my side "
                "— please try again in a moment."
            ),
        }
