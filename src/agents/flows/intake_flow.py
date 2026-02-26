"""IntakeFlow — deterministic @router dispatch to specialist crews.

Architecture: Phase 10.3 rebuild capstone.

IntakeFlow replaces the broken Process.hierarchical ManagerCrew with a
deterministic @router Flow. The Flow:
1. Detects language (lingua-py)
2. Classifies intent via a direct LLM call (gpt-4o-mini, NOT a full Crew)
3. Routes to the correct specialist Crew via @router + @listen branches

This replaces the unreliable LLM-based Process.hierarchical routing that
caused delegation text leakage and unpredictable specialist dispatching.

Routing rules (deterministic Python, no LLM):
- routing_phase != "manager" -> short-circuit (active specialist session)
- session_status in ("none", "expired", "otp_pending") -> auth (unauthenticated)
- Else: LLM intent classification -> specialist

Key decisions:
- Intent classification: direct get_routing_llm().call() — NOT a full Crew.
  gpt-4o-mini is reliable for this simple classification task.
- routing_phase short-circuit: if an active specialist session exists (e.g.
  citizen is mid-registration), skip classification and continue with that agent.
- Auth gate: unauthenticated users ALWAYS go to auth first. Original intent
  saved in pending_intent for post-auth replay.
- Each @listen handler imports its crew lazily (avoids circular imports).
- Each @listen handler adds agent_name to result dict for crew_server.
- GBV confirmation gate lives in crew_server.py (two-turn safety gate before
  routing to GBVCrew) — NOT in IntakeFlow itself.

See:
- src/agents/flows/state.py — IntakeState model
- src/agents/llm.py — get_routing_llm(), get_deepseek_llm()
- src/core/language.py — language_detector singleton
"""
from crewai.flow.flow import Flow, listen, router, start

from src.agents.flows.state import IntakeState
from src.core.language import language_detector


class IntakeFlow(Flow[IntakeState]):
    """Deterministic intake router — classifies intent, dispatches to specialist.

    State (IntakeState):
        message: Citizen message text
        phone: Citizen phone number (E.164)
        language: Detected language ("en" | "zu" | "af")
        intent: Classified routing intent ("auth" | "municipal" | "ticket_status" | "gbv")
        routing_phase: Active phase ("manager" | "auth" | "municipal" | "ticket_status" | "gbv")
        session_status: Auth state ("none" | "active" | "expired" | "otp_pending")
        user_id: Authenticated user UUID (None if unauthenticated)
        conversation_history: Formatted history string for crew injection
        result: Dict output from the most recently invoked specialist Crew
        pending_intent: Citizen's original intent, preserved through auth handoff

    Flow:
        classify_intent (@start) -> route_by_intent (@router) -> handle_* (@listen)
    """

    @start()
    def classify_intent(self) -> str:
        """Detect language and classify routing intent.

        Three routing paths:
        1. Short-circuit: routing_phase already set (active specialist session)
        2. Auth gate: unauthenticated users always route to auth first
        3. LLM classification: direct gpt-4o-mini call for intent

        Returns:
            Intent string: "auth" | "municipal" | "ticket_status" | "gbv"
        """
        # Step 1: Detect language from message text
        detected = language_detector.detect(
            self.state.message,
            fallback=self.state.language,
        )
        self.state.language = detected

        # Step 2: Short-circuit if routing_phase is already set (specialist session active)
        # This handles mid-conversation flows: citizen is mid-registration, mid-report, etc.
        if self.state.routing_phase not in ("manager", ""):
            self.state.intent = self.state.routing_phase
            return self.state.routing_phase  # "auth" | "municipal" | "ticket_status" | "gbv"

        # Step 3: Auth gate — unauthenticated users always go to auth first
        # Save original intent so it can be replayed after auth completes
        if self.state.session_status in ("none", "expired", "otp_pending"):
            # Classify raw intent first so we can save it as pending_intent
            raw_intent = self._classify_raw_intent()
            if not self.state.pending_intent:
                self.state.pending_intent = raw_intent
            self.state.intent = "auth"
            return "auth"

        # Step 4: Classify intent via direct LLM call (gpt-4o-mini)
        intent = self._classify_raw_intent()
        self.state.intent = intent
        return intent

    def _classify_raw_intent(self) -> str:
        """Direct LLM call for intent classification. NOT a full Crew.

        Uses get_routing_llm() (gpt-4o-mini) for reliable single-shot
        classification. Returns one of the 4 known intent categories.
        Defaults to "municipal" if LLM returns an unrecognized string.

        Returns:
            Intent string: "auth" | "municipal" | "ticket_status" | "gbv"
        """
        # SEC-05: Intercept adversarial GBV phrasing before LLM classification.
        # Citizens describing a GBV case using police/SAPS language lack the abuse keywords
        # the LLM checks for, causing misrouting to ticket_status.
        if self._is_saps_context(self.state.message):
            return "gbv"

        from src.agents.llm import get_routing_llm

        llm = get_routing_llm()
        prompt = (
            "Classify the following citizen message into exactly one category.\n"
            "Categories: auth, municipal, ticket_status, gbv\n"
            "- auth: account registration, login, OTP, verification\n"
            "- municipal: service complaints (water, roads, electricity, waste, sanitation)\n"
            "- ticket_status: checking status of existing report/ticket\n"
            "- gbv: domestic violence, abuse, assault, threats, gender-based violence\n\n"
            f"Message: {self.state.message}\n\n"
            "Return ONLY the category name (auth, municipal, ticket_status, or gbv). Nothing else."
        )

        result = llm.call(prompt)
        intent = result.strip().lower() if result else "municipal"

        # Validate — default to municipal if unrecognized
        if intent not in ("auth", "municipal", "ticket_status", "gbv"):
            intent = "municipal"

        return intent

    def _is_saps_context(self, message: str) -> bool:
        """Return True if message refs SAPS/police officers in citizen's own case.

        Requires BOTH a SAPS/officer term AND a personal-case ownership term.
        Generic SAPS mentions without case context return False.

        SEC-05: Ensures GBV safety net not bypassed by adversarial phrasing.
        """
        msg_lower = message.lower()
        saps_terms = [
            "saps officer", "police officer", "investigating officer",
            "detective", "constable", "sergeant", "lieutenant", "captain",
        ]
        case_terms = [
            "my case", "assigned to", "my report", "my complaint",
            "my matter", "handling my", "working on my", "officer on my",
        ]
        has_saps = any(term in msg_lower for term in saps_terms)
        has_case = any(term in msg_lower for term in case_terms)
        return has_saps and has_case

    @router(classify_intent)
    def route_by_intent(self) -> str:
        """Pure Python routing — returns route name from state.intent.

        No LLM call here. This is the deterministic dispatch step.
        The @router decorator reads this return value and triggers
        the matching @listen handler.

        Returns:
            Intent string that matches an @listen branch.
        """
        return self.state.intent or "auth"

    @listen("auth")
    async def handle_auth(self) -> None:
        """Dispatch to AuthCrew for citizen registration/re-auth.

        Lazy import avoids circular imports at module level.
        Adds agent_name="auth" to result dict for crew_server identification.
        """
        from src.agents.crews.auth_crew import AuthCrew

        crew = AuthCrew(language=self.state.language)
        result = await crew.kickoff({
            "message": self.state.message,
            "phone": self.state.phone,
            "language": self.state.language,
            "session_status": self.state.session_status,
            "conversation_history": self.state.conversation_history,
            "user_id": self.state.user_id or "",
        })
        result["agent_name"] = "auth"
        self.state.result = result

    @listen("municipal")
    async def handle_municipal(self) -> None:
        """Dispatch to MunicipalIntakeCrew for service complaint intake.

        Lazy import avoids circular imports at module level.
        Adds agent_name="municipal" to result dict for crew_server identification.
        """
        from src.agents.crews.municipal_crew import MunicipalIntakeCrew

        crew = MunicipalIntakeCrew(language=self.state.language)
        result = await crew.kickoff({
            "message": self.state.message,
            "phone": self.state.phone,
            "language": self.state.language,
            "conversation_history": self.state.conversation_history,
            "user_id": self.state.user_id or "",
        })
        result["agent_name"] = "municipal"
        self.state.result = result

    @listen("ticket_status")
    async def handle_ticket_status(self) -> None:
        """Dispatch to TicketStatusCrew for ticket lookup.

        Lazy import avoids circular imports at module level.
        Adds agent_name="ticket_status" to result dict for crew_server identification.
        """
        from src.agents.crews.ticket_status_crew import TicketStatusCrew

        crew = TicketStatusCrew(language=self.state.language)
        result = await crew.kickoff({
            "message": self.state.message,
            "phone": self.state.phone,
            "language": self.state.language,
            "conversation_history": self.state.conversation_history,
            "user_id": self.state.user_id or "",
        })
        result["agent_name"] = "ticket_status"
        self.state.result = result

    @listen("gbv")
    async def handle_gbv(self) -> None:
        """Dispatch to GBVCrew for GBV/abuse intake.

        Lazy import avoids circular imports at module level.
        Adds agent_name="gbv" to result dict for crew_server identification.

        Note: GBV confirmation gate is handled in crew_server.py BEFORE
        IntakeFlow is invoked. By the time handle_gbv is called, the citizen
        has already confirmed they want to proceed.
        """
        from src.agents.crews.gbv_crew import GBVCrew

        crew = GBVCrew(language=self.state.language)
        result = await crew.kickoff({
            "message": self.state.message,
            "phone": self.state.phone,
            "language": self.state.language,
            "conversation_history": self.state.conversation_history,
            "user_id": self.state.user_id or "",
        })
        result["agent_name"] = "gbv"
        result["category"] = "gbv"  # Safety: always force category # SEC-05
        self.state.result = result
