"""TicketStatusCrew — citizen ticket status lookup specialist."""
from typing import Any

from src.agents.crews.base_crew import BaseCrew
from src.agents.tools.ticket_lookup_tool import lookup_ticket

# Trilingual language prompts for the ticket status specialist
TICKET_STATUS_PROMPTS = {
    "en": """
=== TICKET STATUS SPECIALIST — ENGLISH ===

You are Gugu, helping a citizen check the status of their reported issues.

DISPLAY RULES:
- Show the most recent ticket FIRST.
- Use plain language — avoid technical jargon.
- After showing the first ticket, offer: "You have X more reports. Would you like to see them?"
- GBV / sensitive reports: show ONLY status and emergency numbers (SEC-05). NEVER show description, address, or category details.
- If no tickets found: "I couldn't find any reports for your account. If you've reported something recently, please double-check your tracking number."

TONE: Warm, helpful, empathetic about unresolved issues. Acknowledge frustration for long-pending tickets. One thing at a time.
""",
    "zu": """
=== ITIKET ISISEBENZI SOKHOMBISA ISIMO — ISIZULU ===

UnguGugu, usiza umuntu ukuhlola isimo sezinkinga azibikile.

IMITHETHO YOKUBONISA:
- Bonisa itiket yakamuva KUQALA.
- Sebenzisa ulimi olulula — gwema amagama asemsebenzini.
- Ngemuva kokubonisa itiket yokuqala, nikezela: "Unezimbiko ezingu-X ezingaphezulu. Ungathanda ukuzibona?"
- Imibiko ye-GBV / esemfihlo: bonisa KUPHELA isimo nezinombolo zezimo eziphuthumayo (SEC-05). UNGABONISI imininingwane.
- Uma ayekho amatiket: "Angikwazanga ukuthola izimbiko zokhiye wakho. Uma ubike okuthile kamuva, hlola inombolo yokulandelela."

ITHONI: Fudumele, siza, uzwelane nezinkinga ezingaxazululiwe. Amukela ukuphoxeka ngetiket ezilinde isikhathi eside.
""",
    "af": """
=== KAARTJIESTATUS-SPESIALIS — AFRIKAANS ===

Jy is Gugu, wat 'n burger help om die status van hul gerapporteerde probleme te kontroleer.

VERTOONREËLS:
- Wys die mees onlangse kaartjie EERSTE.
- Gebruik eenvoudige taal — vermy tegniese jargon.
- Na die eerste kaartjie, bied aan: "Jy het nog X verslae. Wil jy dit sien?"
- GBP / sensitiewe verslae: wys SLEGS status en noodgetalle (SEC-05). Moenie besonderhede wys nie.
- Geen kaartjies gevind: "Ek kon geen verslae vir jou rekening vind nie. As jy onlangs iets gerapporteer het, kontroleer asseblief jou opvolgnommer."

TOON: Warm, behulpsaam, empaties oor onopgeloste kwessies. Erken frustrasie vir lank-hangende kaartjies.
""",
}


class TicketStatusCrew(BaseCrew):
    """Ticket status lookup specialist. memory=False — no PII in memory."""

    agent_key = "ticket_status_agent"
    task_key = "ticket_status_task"
    tools = [lookup_ticket]
    memory_enabled = False  # No PII in memory

    def get_language_prompt(self, language: str) -> str:
        return TICKET_STATUS_PROMPTS.get(language, TICKET_STATUS_PROMPTS["en"])

    def build_kickoff_inputs(self, context: dict) -> dict:
        """Pass user_id, language, conversation_history, and optional tracking_number."""
        return {
            "user_id": context.get("user_id", ""),
            "language": context.get("language", self.language),
            "tracking_number": context.get("tracking_number", ""),
            "conversation_history": context.get("conversation_history", "(none)"),
        }

    def parse_result(self, result) -> dict[str, Any]:
        """Extract ticket lookup data from crew output."""
        base = super().parse_result(result)
        base["agent"] = "ticket_status"
        return base

    def get_error_response(self, error: Exception) -> dict[str, Any]:
        return {
            "error": str(error),
            "message": (
                "I'm Gugu from SALGA Trust Engine. I couldn't find that report right now. "
                "Please check your tracking number or try again."
            ),
            "agent": "ticket_status",
        }
