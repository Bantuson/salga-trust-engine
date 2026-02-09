"""SALGA Trust Engine - FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.api.v1 import auth, municipalities, users
from src.core.config import settings
from src.middleware.error_handler import (
    global_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from src.middleware.rate_limit import setup_rate_limiting
from src.middleware.security_headers import SecurityHeadersMiddleware
from src.middleware.tenant_middleware import TenantContextMiddleware

# Import audit module to register SQLAlchemy event listeners
import src.core.audit  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events."""
    # Startup
    print(f"Starting SALGA Trust Engine - Environment: {settings.ENVIRONMENT}")
    yield
    # Shutdown
    print("Shutting down SALGA Trust Engine")


# Create FastAPI application
app = FastAPI(
    title="SALGA Trust Engine",
    version="0.1.0",
    description="AI-powered municipal service management platform for South Africa",
    lifespan=lifespan
)

# Configure middleware (order matters - executes in REVERSE order of addition)
# 1. CORS (innermost - processes first)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-ID"],
)

# 2. Security headers
app.add_middleware(SecurityHeadersMiddleware)

# 3. Tenant context extraction
app.add_middleware(TenantContextMiddleware)

# 4. Rate limiting
setup_rate_limiting(app)

# 5. Global error handlers
app.add_exception_handler(Exception, global_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT
    }


# Include API routers
app.include_router(auth.router)
app.include_router(municipalities.router)
app.include_router(users.router)
