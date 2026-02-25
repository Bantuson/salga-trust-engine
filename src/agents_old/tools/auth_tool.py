"""Authentication tools for CrewAI auth agent.

OTP delivery:
- SMS: Twilio direct SMS (not Supabase, which was faulty)
- Email: Supabase auth sign_in_with_otp (uses SendGrid — template is tuned, do not change)

SECURITY:
- memory=False reasoning: auth tools handle PII (phone, email, OTP codes).
  Keep tool implementations stateless — never store user secrets between calls.
- All tools return string messages for LLM consumption, never raw Supabase objects.
- Exceptions are caught and returned as error strings (never raised — prevents
  agent crash loops on transient auth failures).

Pattern: _impl() function + BaseTool wrapper with Pydantic input schema.
"""
import logging
import random
import string
import time
from collections import defaultdict
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from src.core.config import settings
from src.core.supabase import get_supabase_admin

logger = logging.getLogger("auth_tools")

# Track failures per tool for repeated failure detection (per locked decision)
_tool_failure_counts: dict[str, list[float]] = defaultdict(list)

# ---------------------------------------------------------------------------
# In-memory OTP store for Twilio SMS path
# In production, use Redis with TTL. For testing, in-memory is fine.
# ---------------------------------------------------------------------------
_otp_store: dict[str, dict] = {}
OTP_TTL_SECONDS = 600  # 10 minutes


def _generate_otp() -> str:
    """Generate a 6-digit OTP code."""
    return ''.join(random.choices(string.digits, k=6))


def _store_otp(identifier: str, code: str) -> None:
    """Store OTP with TTL."""
    _otp_store[identifier] = {
        "code": code,
        "expires": time.time() + OTP_TTL_SECONDS,
    }


def _check_stored_otp(identifier: str, code: str) -> bool:
    """Verify OTP against stored code. One-time use."""
    stored = _otp_store.get(identifier)
    if not stored:
        return False
    if time.time() > stored["expires"]:
        _otp_store.pop(identifier, None)
        return False
    if stored["code"] == code:
        _otp_store.pop(identifier, None)
        return True
    return False


def _log_tool_failure(tool_name: str, error: str, user_identifier: str) -> None:
    """Log tool failure with context. Flag if 3+ failures in 5 minutes (locked decision).

    Args:
        tool_name: Name of the failed tool
        error: Error message string
        user_identifier: Partial user identifier (truncated for POPIA)
    """
    now = time.time()
    # Prune failures older than 5 minutes
    _tool_failure_counts[tool_name] = [
        t for t in _tool_failure_counts[tool_name] if now - t < 300
    ]
    _tool_failure_counts[tool_name].append(now)

    count = len(_tool_failure_counts[tool_name])
    log_data = {
        "tool": tool_name,
        "error": error,
        "user": user_identifier[:8] + "..." if len(user_identifier) > 8 else user_identifier,
        "failure_count_5min": count,
    }
    if count >= 3:
        logger.critical("URGENT: Repeated tool failures -- %s", log_data)
    else:
        logger.error("Tool failure -- %s", log_data)


# ---------------------------------------------------------------------------
# Twilio SMS client (lazy init)
# ---------------------------------------------------------------------------

_twilio_client = None


def _get_twilio_client():
    """Get or create Twilio client for SMS OTP."""
    global _twilio_client
    if _twilio_client is None:
        if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
            from twilio.rest import Client
            _twilio_client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        else:
            logger.warning("Twilio client not configured (missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN)")
    return _twilio_client


# ---------------------------------------------------------------------------
# send_otp_tool
# ---------------------------------------------------------------------------

def _send_otp_impl(phone_or_email: str, channel: str = "sms", is_returning_user: bool = False) -> str:
    """Send OTP via Twilio SMS (phone) or Supabase email for passwordless sign-in.

    SMS path: Twilio direct SMS — generates 6-digit code, sends via Twilio, stores locally.
    Email path: Supabase auth.sign_in_with_otp — uses configured SendGrid template.

    Args:
        phone_or_email: E.164 phone number (e.g. +27831234567) or email address
        channel: Delivery channel — "sms" for phone or "email" for email OTP
        is_returning_user: If True, sets should_create_user=False (prevents duplicate account creation)

    Returns:
        Success or error message string for LLM consumption
    """
    is_phone = phone_or_email.startswith("+") or channel == "sms"

    if is_phone:
        # === Twilio SMS path ===
        twilio = _get_twilio_client()
        if twilio is None:
            return "Error: Twilio SMS client not configured. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN."

        from_number = settings.TWILIO_PHONE_NUMBER
        if not from_number:
            return "Error: TWILIO_PHONE_NUMBER not configured for SMS OTP."

        try:
            code = _generate_otp()
            _store_otp(phone_or_email, code)

            twilio.messages.create(
                body=f"Your SALGA Trust Engine verification code is: {code}. It expires in 10 minutes.",
                from_=from_number,
                to=phone_or_email,
            )
            return f"OTP sent via SMS to {phone_or_email}. Ask the user for the 6-digit code."

        except Exception as e:
            _log_tool_failure("send_otp_tool", str(e), phone_or_email)
            return f"Error sending SMS OTP: {str(e)}"

    else:
        # === Supabase email path (SendGrid template — do not change) ===
        client = get_supabase_admin()
        if client is None:
            return "Error: Supabase admin client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."

        try:
            otp_options: dict = {"email": phone_or_email}
            if is_returning_user:
                otp_options["options"] = {"should_create_user": False}
            client.auth.sign_in_with_otp(otp_options)
            return f"OTP sent via email to {phone_or_email}. Ask the user for the 6-digit code."

        except Exception as e:
            _log_tool_failure("send_otp_tool", str(e), phone_or_email)
            return f"Error sending email OTP: {str(e)}"


class SendOtpInput(BaseModel):
    """Input schema for send_otp_tool."""
    phone_or_email: str = Field(..., description="E.164 phone number (e.g. +27831234567) or email address")
    channel: str = Field("sms", description="Delivery channel — 'sms' for phone or 'email' for email OTP")
    is_returning_user: bool = Field(False, description="If True, sets should_create_user=False (prevents duplicate account creation)")


class SendOtpTool(BaseTool):
    name: str = "send_otp_tool"
    description: str = "Send OTP via Twilio SMS (phone) or Supabase email for passwordless sign-in."
    args_schema: Type[BaseModel] = SendOtpInput

    def _run(self, phone_or_email: str, channel: str = "sms", is_returning_user: bool = False) -> str:
        return _send_otp_impl(phone_or_email, channel, is_returning_user)


send_otp_tool = SendOtpTool()


# ---------------------------------------------------------------------------
# verify_otp_tool
# ---------------------------------------------------------------------------

def _verify_otp_impl(phone_or_email: str, otp_code: str, otp_type: str = "sms") -> str:
    """Verify OTP code submitted by the user.

    SMS path: Verifies against locally stored OTP (sent via Twilio).
    Email path: Verifies via Supabase auth.verify_otp (sent via SendGrid).

    Args:
        phone_or_email: E.164 phone or email address used in send_otp_tool
        otp_code: 6-digit code the user provided
        otp_type: OTP type — "sms" for phone, "email" for email OTP

    Returns:
        User UUID on success, or error message string on failure
    """
    is_phone = phone_or_email.startswith("+") or otp_type == "sms"

    if is_phone:
        # === Twilio SMS verification (local OTP store) ===
        if _check_stored_otp(phone_or_email, otp_code):
            # OTP verified — look up or note user for downstream create_supabase_user_tool
            return f"OTP verified successfully for {phone_or_email}. Proceed with account setup."
        return "OTP verification failed: invalid or expired code. Ask the user to try again."

    else:
        # === Supabase email verification ===
        client = get_supabase_admin()
        if client is None:
            return "Error: Supabase admin client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."

        try:
            result = client.auth.verify_otp({
                "email": phone_or_email,
                "token": otp_code,
                "type": "email"
            })

            if result.user:
                return f"OTP verified. User ID: {result.user.id}"
            return "OTP verification failed: invalid or expired code. Ask the user to try again."

        except Exception as e:
            _log_tool_failure("verify_otp_tool", str(e), phone_or_email)
            return f"Error verifying OTP: {str(e)}"


class VerifyOtpInput(BaseModel):
    """Input schema for verify_otp_tool."""
    phone_or_email: str = Field(..., description="E.164 phone or email address used in send_otp_tool")
    otp_code: str = Field(..., description="6-digit code the user provided")
    otp_type: str = Field("sms", description="OTP type — 'sms' for phone, 'email' for email OTP")


class VerifyOtpTool(BaseTool):
    name: str = "verify_otp_tool"
    description: str = "Verify OTP code submitted by the user."
    args_schema: Type[BaseModel] = VerifyOtpInput

    def _run(self, phone_or_email: str, otp_code: str, otp_type: str = "sms") -> str:
        return _verify_otp_impl(phone_or_email, otp_code, otp_type)


verify_otp_tool = VerifyOtpTool()


# ---------------------------------------------------------------------------
# create_supabase_user_tool
# ---------------------------------------------------------------------------

def _create_supabase_user_impl(
    phone_or_email: str,
    full_name: str,
    tenant_id: str,
    preferred_language: str = "en",
    residence_verified: bool = False,
    secondary_contact: str = "",
    address: str = "",
) -> str:
    """Create a new Supabase Auth user with citizen role and metadata.

    Wraps supabase.auth.admin.create_user(). Sets app_metadata for RBAC
    (role=citizen, tenant_id) and user_metadata for profile (full_name,
    residence_verified, preferred_language, secondary_contact, address).

    Args:
        phone_or_email: E.164 phone number or email address (used as identifier)
        full_name: Citizen's full name for their profile
        tenant_id: UUID of the municipality the citizen belongs to
        preferred_language: Language preference — "en", "zu", or "af" (default: "en")
        residence_verified: Whether proof of residence has been verified (default: False)
        secondary_contact: Secondary email or phone number (default: "")
        address: Residential address from proof of residence (default: "")

    Returns:
        New user UUID on success, or error message string on failure
    """
    client = get_supabase_admin()
    if client is None:
        return "Error: Supabase admin client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."

    try:
        user_metadata: dict = {
            "full_name": full_name,
            "residence_verified": residence_verified,
            "preferred_language": preferred_language,
        }
        if secondary_contact:
            user_metadata["secondary_contact"] = secondary_contact
        if address:
            user_metadata["address"] = address

        user_data: dict = {
            "app_metadata": {
                "role": "citizen",
                "tenant_id": tenant_id,
            },
            "user_metadata": user_metadata,
            "email_confirm": True,
        }

        # Set phone or email identifier
        if phone_or_email.startswith("+"):
            user_data["phone"] = phone_or_email
            user_data["phone_confirm"] = True
        else:
            user_data["email"] = phone_or_email

        result = client.auth.admin.create_user(user_data)

        if result.user:
            return f"User created successfully. User ID: {result.user.id}"
        return "User creation failed: no user returned from Supabase."

    except Exception as e:
        _log_tool_failure("create_supabase_user_tool", str(e), phone_or_email)
        return f"Error creating user: {str(e)}"


class CreateUserInput(BaseModel):
    """Input schema for create_supabase_user_tool."""
    phone_or_email: str = Field(..., description="E.164 phone number or email address (used as identifier)")
    full_name: str = Field(..., description="Citizen's full name for their profile")
    tenant_id: str = Field(..., description="UUID of the municipality the citizen belongs to")
    preferred_language: str = Field("en", description="Language preference — 'en', 'zu', or 'af'")
    residence_verified: bool = Field(False, description="Whether proof of residence has been verified")
    secondary_contact: str = Field("", description="Secondary email or phone number")
    address: str = Field("", description="Residential address from proof of residence")


class CreateSupabaseUserTool(BaseTool):
    name: str = "create_supabase_user_tool"
    description: str = "Create a new Supabase Auth user with citizen role and metadata."
    args_schema: Type[BaseModel] = CreateUserInput

    def _run(
        self,
        phone_or_email: str,
        full_name: str,
        tenant_id: str,
        preferred_language: str = "en",
        residence_verified: bool = False,
        secondary_contact: str = "",
        address: str = "",
    ) -> str:
        return _create_supabase_user_impl(
            phone_or_email, full_name, tenant_id,
            preferred_language, residence_verified, secondary_contact, address,
        )


create_supabase_user_tool = CreateSupabaseUserTool()


# ---------------------------------------------------------------------------
# lookup_user_tool
# ---------------------------------------------------------------------------

def _lookup_user_impl(phone_or_email: str) -> str:
    """Look up an existing Supabase Auth user by phone number or email.

    Wraps supabase.auth.admin.list_users() with filter. Use to check whether
    a user already has an account before attempting to create one.

    Args:
        phone_or_email: E.164 phone number (e.g. +27831234567) or email address

    Returns:
        User ID and role on match, "not found" message if no user, or error string
    """
    client = get_supabase_admin()
    if client is None:
        return "Error: Supabase admin client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."

    try:
        # list_users returns (users, count) response
        response = client.auth.admin.list_users()
        users = response if isinstance(response, list) else []

        # Filter by phone or email
        is_phone = phone_or_email.startswith("+")
        matched = None
        for user in users:
            if is_phone:
                stored_phone = getattr(user, "phone", None) or ""
                stored_normalized = stored_phone.lstrip("+")
                lookup_normalized = phone_or_email.lstrip("+")
                if stored_normalized == lookup_normalized:
                    matched = user
                    break
            elif not is_phone and getattr(user, "email", None) == phone_or_email:
                matched = user
                break

        if matched is None:
            return f"No user found with {'phone' if is_phone else 'email'}: {phone_or_email}"

        role = (getattr(matched, "app_metadata", None) or {}).get("role", "unknown")
        return f"User found. User ID: {matched.id}, role: {role}"

    except Exception as e:
        _log_tool_failure("lookup_user_tool", str(e), phone_or_email)
        return f"Error looking up user: {str(e)}"


class LookupUserInput(BaseModel):
    """Input schema for lookup_user_tool."""
    phone_or_email: str = Field(..., description="E.164 phone number (e.g. +27831234567) or email address")


class LookupUserTool(BaseTool):
    name: str = "lookup_user_tool"
    description: str = "Look up an existing Supabase Auth user by phone number or email."
    args_schema: Type[BaseModel] = LookupUserInput

    def _run(self, phone_or_email: str) -> str:
        return _lookup_user_impl(phone_or_email)


lookup_user_tool = LookupUserTool()
