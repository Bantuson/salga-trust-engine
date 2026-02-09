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
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
}


class TenantContextMiddleware(BaseHTTPMiddleware):
    """Middleware to extract and validate X-Tenant-ID header.

    For all non-exempt endpoints, this middleware:
    1. Extracts the X-Tenant-ID header
    2. Validates it's a valid UUID format
    3. Sets tenant context for the request
    4. Clears context after request completes

    Exempt paths (auth, health, docs) skip tenant validation.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and set tenant context."""
        # Skip tenant check for exempt paths
        if request.url.path in EXCLUDED_PATHS:
            return await call_next(request)

        # Extract X-Tenant-ID header
        tenant_id = request.headers.get("X-Tenant-ID")

        # Reject requests without tenant ID
        if not tenant_id:
            return JSONResponse(
                status_code=400,
                content={"detail": "X-Tenant-ID header required"}
            )

        # Validate tenant_id is a valid UUID format
        try:
            uuid.UUID(tenant_id)
        except ValueError:
            return JSONResponse(
                status_code=400,
                content={"detail": "X-Tenant-ID must be a valid UUID"}
            )

        # Set tenant context for this request
        try:
            set_tenant_context(tenant_id)
            response = await call_next(request)
            return response
        finally:
            # Always clear context after request
            clear_tenant_context()
