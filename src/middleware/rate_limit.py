"""Rate limiting configuration using slowapi."""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from src.core.config import settings

# Rate limit constants for different endpoint types
AUTH_RATE_LIMIT = "5/minute"  # Login attempts
REGISTER_RATE_LIMIT = "3/hour"  # User registrations
API_DEFAULT_RATE_LIMIT = "60/minute"  # General API calls
DATA_EXPORT_RATE_LIMIT = "5/hour"  # POPIA data exports (expensive)

# Create limiter instance
# In production: use Redis for distributed rate limiting
# In development: use in-memory storage
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.REDIS_URL if not settings.DEBUG else None,
    default_limits=[API_DEFAULT_RATE_LIMIT]
)


def setup_rate_limiting(app):
    """Configure rate limiting on FastAPI app.

    Args:
        app: FastAPI application instance
    """
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
