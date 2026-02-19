"""Authentication tools for CrewAI auth agent.

Synchronous CrewAI tools that wrap Supabase Admin SDK calls for citizen
authentication flows (OTP, user creation, user lookup).

SECURITY:
- memory=False reasoning: auth tools handle PII (phone, email, OTP codes).
  Keep tool implementations stateless — never store user secrets between calls.
- All tools return string messages for LLM consumption, never raw Supabase objects.
- Exceptions are caught and returned as error strings (never raised — prevents
  agent crash loops on transient auth failures).

Pattern: _impl() function + @tool wrapper (same as ticket_tool.py and saps_tool.py).
"""
import logging
import time
from collections import defaultdict

from crewai.tools import tool

from src.core.supabase import get_supabase_admin

logger = logging.getLogger("auth_tools")

# Track failures per tool for repeated failure detection (per locked decision)
_tool_failure_counts: dict[str, list[float]] = defaultdict(list)


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
# send_otp_tool
# ---------------------------------------------------------------------------

def _send_otp_impl(phone_or_email: str, channel: str = "sms", is_returning_user: bool = False) -> str:
    """Send OTP via SMS (phone) or email for passwordless sign-in.

    Wraps supabase.auth.sign_in_with_otp(). Use when a new or returning
    user needs to verify their identity before accessing the platform.

    Args:
        phone_or_email: E.164 phone number (e.g. +27831234567) or email address
        channel: Delivery channel — "sms" for phone or "email" for email OTP
        is_returning_user: If True, sets should_create_user=False (prevents duplicate account creation)

    Returns:
        Success or error message string for LLM consumption
    """
    client = get_supabase_admin()
    if client is None:
        return "Error: Supabase admin client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."

    try:
        if channel == "sms" or phone_or_email.startswith("+"):
            otp_options: dict = {"phone": phone_or_email}
            if is_returning_user:
                otp_options["options"] = {"should_create_user": False}
            client.auth.sign_in_with_otp(otp_options)
            return f"OTP sent via SMS to {phone_or_email}. Ask the user for the 6-digit code."
        else:
            otp_options = {"email": phone_or_email}
            if is_returning_user:
                otp_options["options"] = {"should_create_user": False}
            client.auth.sign_in_with_otp(otp_options)
            return f"OTP sent via email to {phone_or_email}. Ask the user for the 6-digit code."
    except Exception as e:
        _log_tool_failure("send_otp_tool", str(e), phone_or_email)
        return f"Error sending OTP: {str(e)}"


send_otp_tool = tool("send_otp_tool")(_send_otp_impl)


# ---------------------------------------------------------------------------
# verify_otp_tool
# ---------------------------------------------------------------------------

def _verify_otp_impl(phone_or_email: str, otp_code: str, otp_type: str = "sms") -> str:
    """Verify OTP code submitted by the user.

    Wraps supabase.auth.verify_otp(). Call after the user provides the OTP
    code. On success, returns the Supabase user UUID for downstream tools.

    Args:
        phone_or_email: E.164 phone or email address used in send_otp_tool
        otp_code: 6-digit code the user provided
        otp_type: OTP type — "sms" for phone, "email" for email OTP

    Returns:
        User UUID on success, or error message string on failure
    """
    client = get_supabase_admin()
    if client is None:
        return "Error: Supabase admin client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."

    try:
        if otp_type == "sms" or phone_or_email.startswith("+"):
            result = client.auth.verify_otp({
                "phone": phone_or_email,
                "token": otp_code,
                "type": "sms"
            })
        else:
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


verify_otp_tool = tool("verify_otp_tool")(_verify_otp_impl)


# ---------------------------------------------------------------------------
# create_supabase_user_tool
# ---------------------------------------------------------------------------

def _create_supabase_user_impl(
    phone_or_email: str,
    full_name: str,
    tenant_id: str,
    preferred_language: str = "en",
    residence_verified: bool = False,
) -> str:
    """Create a new Supabase Auth user with citizen role and metadata.

    Wraps supabase.auth.admin.create_user(). Sets app_metadata for RBAC
    (role=citizen, tenant_id) and user_metadata for profile (full_name,
    residence_verified, preferred_language).

    Args:
        phone_or_email: E.164 phone number or email address (used as identifier)
        full_name: Citizen's full name for their profile
        tenant_id: UUID of the municipality the citizen belongs to
        preferred_language: Language preference — "en", "zu", or "af" (default: "en")
        residence_verified: Whether proof of residence has been verified (default: False)

    Returns:
        New user UUID on success, or error message string on failure
    """
    client = get_supabase_admin()
    if client is None:
        return "Error: Supabase admin client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."

    try:
        user_data: dict = {
            "app_metadata": {
                "role": "citizen",
                "tenant_id": tenant_id,
            },
            "user_metadata": {
                "full_name": full_name,
                "residence_verified": residence_verified,
                "preferred_language": preferred_language,
            },
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


create_supabase_user_tool = tool("create_supabase_user_tool")(_create_supabase_user_impl)


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
                # Supabase stores phone numbers WITHOUT the leading "+" prefix
                # (e.g. "+27821001001" is stored as "27821001001").
                # Normalize both sides so the comparison always succeeds regardless
                # of which representation the caller passes in.
                stored_phone = getattr(user, "phone", None) or ""
                # Strip leading "+" from stored value (defensive — some providers keep it)
                stored_normalized = stored_phone.lstrip("+")
                # Strip leading "+" from the lookup value
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


lookup_user_tool = tool("lookup_user_tool")(_lookup_user_impl)
