"""Authentication prompts — task templates and structured output model.

Backstory/system prompts have been moved to agents.yaml (trilingual).
This module retains:
- AuthResult Pydantic output model
- AUTH_TASK_TEMPLATE and build_auth_task_description() for per-request task building
"""
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# AuthResult output model
# ---------------------------------------------------------------------------

class AuthResult(BaseModel):
    """Structured output from the AuthCrew.

    Fields:
        authenticated: True if the citizen successfully verified identity
        user_id: Supabase Auth UUID on success, None on failure
        session_status: "active" (re-auth OK), "created" (new account), "failed"
        municipality_id: UUID of assigned municipality after proof of residence
        message: Conversational response to send back to the citizen
        language: Language the citizen is communicating in ("en", "zu", "af")
        error: Error description if authentication failed, None on success
    """
    authenticated: bool
    user_id: str | None = None
    session_status: str  # "active", "created", "failed"
    municipality_id: str | None = None
    message: str  # Response message to citizen
    language: str = "en"  # Language tracking for downstream crews
    error: str | None = None


# ---------------------------------------------------------------------------
# AUTH_TASK_TEMPLATE
# ---------------------------------------------------------------------------

AUTH_TASK_TEMPLATE = """Authenticate a citizen for the SALGA municipal reporting platform.

CITIZEN CONTEXT:
- Phone: {phone}
- Language: {language}
- User exists in system: {user_exists}
- Session status: {session_status}
- User ID (if exists): {user_id}

CONVERSATION SO FAR (most recent message is LAST):
{conversation_history}

IMPORTANT: The LAST "User:" line above is what the citizen JUST said. You MUST respond
to that message directly. Do NOT repeat questions they have already answered.

YOUR TASK:
{task_instruction}

ALWAYS:
- Respond to the citizen's LATEST message (the last "User:" line in the conversation)
- Respond in {language}
- Be conversational, not like a form
- Use your tools (lookup_user_tool, send_otp_tool, etc.) when the conversation reaches the right step
- Return a structured AuthResult when authentication completes or fails definitively
"""

# Instruction fragment for new users (full registration)
_NEW_USER_INSTRUCTION = """The citizen does NOT have an account yet. Run the full registration flow:

RESUME CHECK (do this FIRST, before anything else):
- Read the "Conversation history" section above carefully.
- If it is "(none)" or empty: start at STEP 1 — this is a fresh conversation.
- If it is NOT empty: determine which step the citizen has already completed and
  CONTINUE from the NEXT step. Do NOT greet them again or re-ask questions they
  have already answered. For example:
    * History shows they gave their name → skip STEP 1, continue with remaining details or STEP 2
    * History shows they chose "phone" → skip STEP 2, go directly to STEP 3a
    * History shows they provided their phone → proceed to send OTP (STEP 3a cont.)
    * History shows OTP is verified → proceed to collect secondary contact
    * History shows all details collected → proceed to STEP 4 (proof of residence)

STEP 1 — Collect personal details: full name, email address, and residential address.
          Ask conversationally (not as a form). You may ask in one or two messages.
STEP 2 — Ask: "Would you like to verify with your phone number or email address?"
STEP 3a (phone path): Confirm their phone → send OTP via SMS → collect OTP → collect secondary contact (email if not yet given)
STEP 3b (email path): Confirm their email → send OTP via email → collect OTP → collect secondary contact (phone number)
STEP 4 — Request proof of residence upload (REQUIRED — do not skip or defer)
STEP 5 — Assign municipality based on the residential address on the proof
STEP 6 — Create the Supabase user account (pass full_name, secondary_contact, and address)

Proof of residence is MANDATORY before municipality assignment.
"""

# Instruction fragment for returning users with expired session (OTP re-auth only)
_RETURNING_USER_INSTRUCTION = """The citizen already has an account (User ID: {user_id}) but their session has expired.
Run OTP re-authentication ONLY — do NOT repeat full registration:

STEP 1 — Confirm their registered identity (phone or email) — use the one on file
STEP 2 — Send OTP to that contact
STEP 3 — Collect OTP and verify it
STEP 4 — Confirm session is active again

Do NOT ask for name, proof of residence, or municipality again.
"""


def build_auth_task_description(context: dict) -> str:
    """Build a filled AUTH_TASK_TEMPLATE from context dict.

    Args:
        context: Dict with keys user_exists (bool), session_status (str),
                 user_id (str|None), phone (str), language (str),
                 conversation_history (str)

    Returns:
        Formatted task description string for the AuthCrew Task
    """
    user_exists: bool = context.get("user_exists", False)
    session_status: str = context.get("session_status", "new")
    user_id: str | None = context.get("user_id", None)

    if user_exists and session_status == "expired":
        task_instruction = _RETURNING_USER_INSTRUCTION.format(
            user_id=user_id or "unknown"
        )
    else:
        task_instruction = _NEW_USER_INSTRUCTION

    return AUTH_TASK_TEMPLATE.format(
        phone=context.get("phone", "unknown"),
        language=context.get("language", "en"),
        user_exists=str(user_exists),
        session_status=session_status,
        user_id=user_id or "none",
        conversation_history=context.get("conversation_history", "(none)"),
        task_instruction=task_instruction,
    )
