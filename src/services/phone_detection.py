"""Deterministic phone session detection for intake routing.

NOT an agent — this is pure code-based lookup against WhatsAppSession table.
Triggers on session start only. Returns minimal context for auth agent routing.
"""
from sqlalchemy.orm import Session
from src.models.whatsapp_session import WhatsAppSession


def _normalize_phone(phone_number: str) -> str:
    """Normalize phone to E.164 format (South African).

    Converts 0XX to +27XX format. Preserves already-E.164 numbers.

    Args:
        phone_number: Raw phone number string (e.g. 0831234567 or +27831234567)

    Returns:
        E.164 formatted phone number (e.g. +27831234567)
    """
    phone = phone_number.strip()
    if phone.startswith("0") and len(phone) == 10:
        phone = "+27" + phone[1:]
    if not phone.startswith("+"):
        phone = "+" + phone
    return phone


def detect_phone_session(phone_number: str, db_session: Session) -> dict:
    """Deterministic phone detection — no LLM involved.

    Queries WhatsAppSession table for existing session linked to the phone number.
    Returns minimal context: user_exists, session_status, user_id.

    Per locked decision: detection triggers on session start only.
    Phone normalization handles both 0XX (local) and +27XX (E.164) formats.

    Args:
        phone_number: Raw or E.164 phone number
        db_session: SQLAlchemy synchronous session

    Returns:
        dict with keys:
            - user_exists (bool): Whether a WhatsApp session exists for this phone
            - session_status (str): "none" | "active" | "expired"
            - user_id (str | None): Supabase Auth user UUID if user exists, else None
    """
    normalized = _normalize_phone(phone_number)

    session = db_session.query(WhatsAppSession).filter(
        WhatsAppSession.phone_number == normalized
    ).first()

    if session is None:
        return {"user_exists": False, "session_status": "none", "user_id": None}

    if session.is_expired:
        return {"user_exists": True, "session_status": "expired", "user_id": str(session.user_id)}

    return {"user_exists": True, "session_status": "active", "user_id": str(session.user_id)}
