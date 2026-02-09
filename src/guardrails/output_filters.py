"""Output sanitization and PII masking for AI safety.

This module implements rule-based output filtering to prevent:
- PII leakage (SA ID numbers, phone numbers, emails)
- System information disclosure (SQL, tracebacks, database details)
- Empty responses after sanitization

Emergency numbers (10111, 0800 150 150) are preserved as they're critical
for citizen safety in GBV scenarios.
"""
import re
from pydantic import BaseModel


class OutputSanitizationResult(BaseModel):
    """Result of output sanitization with redaction tracking.

    Attributes:
        original_response: The original unfiltered agent response
        sanitized_response: Response after PII masking and system info removal
        redactions: List of what was redacted (for audit/debugging)
    """

    original_response: str
    sanitized_response: str
    redactions: list[str] = []


def sanitize_output(response: str) -> OutputSanitizationResult:
    """Sanitize agent output to remove PII and system information.

    Applies filters in order:
    1. SA ID number masking (13-digit YYMMDD format)
    2. Phone number masking (SA formats, preserving emergency numbers)
    3. Email address masking
    4. System information removal (SQL, tracebacks, database details)
    5. Empty response fallback

    Args:
        response: Raw agent response

    Returns:
        OutputSanitizationResult with sanitized response and redaction log
    """
    redactions: list[str] = []
    sanitized = response

    # Filter 1: SA ID number masking
    # Pattern: 13 digits starting with YYMMDD (date of birth)
    # Example: 9501015800086
    sa_id_pattern = r'\b\d{2}[01]\d[0-3]\d\d{7}\b'
    if re.search(sa_id_pattern, sanitized):
        sanitized = re.sub(sa_id_pattern, "[ID REDACTED]", sanitized)
        redactions.append("sa_id_number")

    # Filter 2: Phone number masking (preserving emergency numbers)
    # Emergency numbers to preserve: 10111 (SAPS), 0800 150 150 (GBV Command Centre)

    # First, protect emergency numbers by temporarily replacing them
    emergency_placeholder = "___EMERGENCY_10111___"
    gbv_placeholder = "___EMERGENCY_GBV___"

    sanitized = sanitized.replace("10111", emergency_placeholder)
    sanitized = re.sub(r'0800\s*150\s*150', gbv_placeholder, sanitized, flags=re.IGNORECASE)

    # Now mask other SA phone numbers
    # Pattern 1: Mobile numbers (06X, 07X, 08X) in various formats
    mobile_pattern = r'\b0[6-8]\d[\s-]?\d{3}[\s-]?\d{4}\b'
    if re.search(mobile_pattern, sanitized):
        sanitized = re.sub(mobile_pattern, "[PHONE REDACTED]", sanitized)
        redactions.append("phone_number")

    # Pattern 2: International format (+27)
    intl_pattern = r'\+27\d{9}\b'
    if re.search(intl_pattern, sanitized):
        sanitized = re.sub(intl_pattern, "[PHONE REDACTED]", sanitized)
        if "phone_number" not in redactions:
            redactions.append("phone_number")

    # Restore emergency numbers
    sanitized = sanitized.replace(emergency_placeholder, "10111")
    sanitized = sanitized.replace(gbv_placeholder, "0800 150 150")

    # Filter 3: Email address masking
    # Standard email pattern
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    if re.search(email_pattern, sanitized):
        sanitized = re.sub(email_pattern, "[EMAIL REDACTED]", sanitized)
        redactions.append("email_address")

    # Filter 4: System information removal
    # Patterns: SQL keywords, database names, error tracebacks
    # Only mask when these appear as technical artifacts, not in natural language
    system_info_patterns = [
        (r'traceback[:\s].*?(?=\n|$)', 'TRACEBACK'),
        (r'sqlalchemy\.[a-z.]+', 'SQLALCHEMY'),
        (r'postgresql://[^\s]+', 'DATABASE_URL'),
        (r'\bselect\s+\*\s+from\s+\w+', 'SQL_QUERY'),
        (r'\binsert\s+into\s+\w+', 'SQL_QUERY'),
        (r'\bdelete\s+from\s+\w+', 'SQL_QUERY'),
        (r'\bupdate\s+\w+\s+set', 'SQL_QUERY'),
        (r'django\.db\.[a-z.]+', 'DJANGO_DB'),
        (r'psycopg[23]?\.[a-z.]+', 'PSYCOPG'),
    ]

    for pattern, label in system_info_patterns:
        if re.search(pattern, sanitized, re.IGNORECASE):
            sanitized = re.sub(
                pattern,
                f"[{label} REDACTED]",
                sanitized,
                flags=re.IGNORECASE
            )
            if "system_info" not in redactions:
                redactions.append("system_info")

    # Filter 5: Empty response fallback
    # If sanitization removed everything, provide a helpful message
    if not sanitized.strip():
        sanitized = "I'm here to help. Could you please rephrase your request?"
        redactions.append("empty_response_fallback")

    return OutputSanitizationResult(
        original_response=response,
        sanitized_response=sanitized,
        redactions=redactions,
    )
