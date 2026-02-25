"""ManagerCrew stub — placeholder until Phase 10.3 Plan 07 (Manager Agent rebuild).

This file exists solely to satisfy import compatibility during the agent rebuild.
The ManagerCrew class here is a non-functional placeholder.

Real implementation: See src/agents_old/crews/manager_crew.py for the previous
implementation. Full rebuild in Plan 07 of Phase 10.3.
"""
import logging

logger = logging.getLogger(__name__)


class ManagerCrew:
    """Placeholder ManagerCrew — non-functional stub.

    Real implementation pending Phase 10.3 Plan 07 (Manager + Flow rebuild).
    """

    def __init__(self, language: str = "en", llm=None):
        self.language = language
        self._llm = llm
        logger.warning(
            "ManagerCrew stub in use — agent rebuild in progress (Phase 10.3). "
            "Chat/message endpoints will return errors until Plan 07 completes."
        )

    async def kickoff(self, context: dict) -> dict:
        """Stub kickoff — returns error indicating rebuild in progress."""
        return {
            "message": (
                "The agent system is being upgraded. Please try again shortly."
            ),
            "action_taken": "error",
            "error": "ManagerCrew stub — rebuild in progress (Phase 10.3)",
        }
