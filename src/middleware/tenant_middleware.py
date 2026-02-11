"""Tenant context extraction and validation middleware."""
import uuid
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from src.core.tenant import clear_tenant_context, set_tenant_context

# Paths that do NOT require tenant context
EXCLUDED_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
    "/api/v1/auth/otp/send",
    "/api/v1/auth/otp/verify",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
}

# Path prefixes that do NOT require tenant context
EXCLUDED_PATH_PREFIXES = [
    "/api/v1/municipalities",
    "/api/v1/whatsapp",  # WhatsApp webhook resolves tenant from user lookup, not header
    "/api/v1/public",  # Public transparency endpoints are cross-tenant (no auth required)
]


class TenantContextMiddleware(BaseHTTPMiddleware):
    """Middleware to manage tenant context for the request lifecycle.

    With Supabase Auth, tenant_id primarily comes from JWT app_metadata claims
    via get_current_user dependency (see src/api/deps.py). This middleware
    provides backward compatibility and handles special cases:

    1. For authenticated endpoints: tenant context set by get_current_user from JWT
    2. For WhatsApp webhook: tenant resolved from phone-to-user lookup
    3. For public endpoints: no tenant context required
    4. Backward compatibility: Still reads X-Tenant-ID header if present

    The middleware ensures tenant context is properly cleared after each request
    to prevent cross-request contamination in async environments.

    Exempt paths (auth, health, docs, public) skip tenant validation.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and set tenant context.

        For most authenticated endpoints, tenant context is set by get_current_user
        dependency which extracts tenant_id from JWT app_metadata. This middleware
        provides a cleanup mechanism and handles backward compatibility.
        """
        # Skip tenant check for exempt paths
        if request.url.path in EXCLUDED_PATHS:
            return await call_next(request)

        # Skip tenant check for exempt path prefixes
        for prefix in EXCLUDED_PATH_PREFIXES:
            if request.url.path.startswith(prefix):
                return await call_next(request)

        # Extract X-Tenant-ID header (backward compatibility, optional)
        # With Supabase Auth, tenant_id comes from JWT via get_current_user
        tenant_id = request.headers.get("X-Tenant-ID")

        # If X-Tenant-ID header is provided, validate and set it
        # Otherwise, tenant context will be set by get_current_user from JWT
        if tenant_id:
            # Validate tenant_id is a valid UUID format
            try:
                uuid.UUID(tenant_id)
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "X-Tenant-ID must be a valid UUID"}
                )

            # Set tenant context for this request
            set_tenant_context(tenant_id)

        # Process request
        try:
            response = await call_next(request)
            return response
        finally:
            # Always clear context after request to prevent cross-request contamination
            clear_tenant_context()
