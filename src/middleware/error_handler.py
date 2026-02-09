"""Global error handler to prevent information leakage."""
import logging
from typing import Union

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.core.config import settings

logger = logging.getLogger(__name__)


async def global_exception_handler(
    request: Request,
    exc: Exception
) -> JSONResponse:
    """Handle uncaught exceptions globally.

    In production: Log full error, return generic message
    In development: Return detailed error for debugging

    This prevents information leakage of stack traces, SQL errors,
    internal paths, or other sensitive details in production.
    """
    # Log full exception with traceback
    logger.exception(
        f"Unhandled exception during request to {request.url.path}",
        exc_info=exc
    )

    if settings.DEBUG:
        # Development: return detailed error
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": str(exc),
                "type": type(exc).__name__,
            }
        )
    else:
        # Production: return generic error
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"}
        )


async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException
) -> JSONResponse:
    """Handle HTTP exceptions (preserve FastAPI's default 4xx behavior)."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
) -> JSONResponse:
    """Handle request validation errors.

    Returns field-level validation errors without internal details.
    """
    if settings.DEBUG:
        # Development: return full validation details
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": exc.errors(),
                "body": exc.body if hasattr(exc, 'body') else None
            }
        )
    else:
        # Production: return sanitized validation errors
        errors = []
        for error in exc.errors():
            # Remove internal context, keep field path and message only
            errors.append({
                "field": ".".join(str(loc) for loc in error["loc"]),
                "message": error["msg"],
                "type": error["type"]
            })
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Validation error", "errors": errors}
        )
