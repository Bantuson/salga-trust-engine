"""SALGA Trust Engine - FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.api.v1 import (
    access_requests,
    audit_logs,
    auth,
    citizen,
    consent,
    dashboard,
    data_rights,
    departments,
    events,
    export,
    idp,
    invitations,
    messages,
    municipalities,
    notifications,
    onboarding,
    pa,
    public,
    reports,
    role_dashboards,
    roles,
    sdbip,
    settings as settings_api,
    statutory_reports,
    teams,
    tickets,
    uploads,
    users,
    verification,
    whatsapp,
)
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
app.include_router(data_rights.router)
app.include_router(consent.router)
app.include_router(messages.router, prefix="/api/v1")
app.include_router(whatsapp.router, prefix="/api/v1")
app.include_router(uploads.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
app.include_router(tickets.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(export.router, prefix="/api/v1")
app.include_router(public.router, prefix="/api/v1")

# Phase 6.2 routers: Access requests, onboarding, invitations, citizen portal
app.include_router(access_requests.router, prefix="/api/v1")
app.include_router(onboarding.router, prefix="/api/v1")
app.include_router(invitations.router, prefix="/api/v1")
app.include_router(citizen.router, prefix="/api/v1")

# Phase 6.1.1 routers: Teams CRUD, Settings (SLA + municipality profile), Audit logs
app.include_router(teams.router, prefix="/api/v1")
app.include_router(settings_api.router, prefix="/api/v1")
app.include_router(audit_logs.router, prefix="/api/v1")

# Phase 27 routers: Department CRUD, organogram, ticket category mapping, municipality PMS settings
app.include_router(departments.router)
app.include_router(departments.municipality_router)

# Phase 27 routers: Role assignment CRUD and Tier 1 approval workflow
app.include_router(roles.router)

# Phase 28 routers: IDP (Integrated Development Plan) CRUD and state machine
app.include_router(idp.router)

# Phase 28 routers: SDBIP scorecard, KPI, quarterly targets, mSCOA reference lookup
app.include_router(sdbip.router)

# Phase 29 routers: Individual Performance Agreements for Section 57 managers
app.include_router(pa.router)

# Phase 30 routers: Statutory reporting and approval workflows
app.include_router(statutory_reports.router)
# Phase 30 routers: In-app notifications
app.include_router(notifications.router)

# Phase 31 routers: Role-specific dashboard endpoints
app.include_router(role_dashboards.router, prefix="/api/v1")
