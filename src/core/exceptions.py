"""Custom exception classes for the application."""


class SecurityError(Exception):
    """Raised when a security violation is detected.

    This includes:
    - Tenant context missing for tenant-aware queries (fail-closed behavior)
    - Attempted cross-tenant data access
    - Authentication/authorization failures at the security layer
    """
    pass
