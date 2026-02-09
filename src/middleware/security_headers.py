"""Security headers middleware for OWASP best practices."""
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from src.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to all responses.

    Implements OWASP-recommended security headers:
    - X-Content-Type-Options: Prevent MIME sniffing
    - X-Frame-Options: Prevent clickjacking
    - X-XSS-Protection: Legacy XSS protection (disabled per OWASP)
    - Strict-Transport-Security: Enforce HTTPS (production only)
    - Content-Security-Policy: Restrict resource loading
    - Referrer-Policy: Control referrer information
    - Permissions-Policy: Restrict browser APIs
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add security headers to response."""
        response = await call_next(request)

        # Basic security headers (all environments)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "0"  # Disabled per OWASP - use CSP instead
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        # HSTS only in production (requires HTTPS)
        if not settings.DEBUG:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Content Security Policy - relax in dev for Swagger UI
        if settings.DEBUG:
            # Allow Swagger UI assets from CDN in development
            response.headers["Content-Security-Policy"] = (
                "default-src 'self' 'unsafe-inline' cdn.jsdelivr.net"
            )
        else:
            # Strict CSP in production
            response.headers["Content-Security-Policy"] = "default-src 'self'"

        return response
