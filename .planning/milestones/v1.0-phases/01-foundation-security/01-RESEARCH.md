# Phase 1: Foundation & Security - Research

**Researched:** 2026-02-09
**Domain:** Multi-tenant FastAPI security architecture with POPIA compliance
**Confidence:** HIGH

## Summary

Phase 1 establishes the security foundation for a multi-tenant municipal trust reporting platform with POPIA compliance, role-based access control, and comprehensive audit logging. The research focused on FastAPI security patterns, PostgreSQL Row-Level Security (RLS), authentication/authorization mechanisms, data encryption, and POPIA-compliant consent management.

Key architectural decisions center on PostgreSQL RLS for tenant isolation (avoiding manual WHERE clauses), FastAPI's dependency injection for auth, and a layered security approach that assumes database context can fail. The stack leverages mature libraries (PyJWT, Argon2, slowapi) while avoiding deprecated tools (python-jose, passlib's bcrypt-only approach).

**Primary recommendation:** Implement defense-in-depth with PostgreSQL RLS as the database layer, application-level tenant filtering via SQLAlchemy event listeners as backup, and comprehensive audit logging. Use FastAPI dependency injection for auth checks at every endpoint, not middleware alone.

## Standard Stack

### Core Security Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **FastAPI** | 0.128.x | Web framework | Industry-standard async Python web framework with built-in security tooling, Pydantic validation, and dependency injection |
| **PyJWT** | 2.10+ | JWT token generation/verification | Actively maintained (vs deprecated python-jose), simple API, used in 70%+ FastAPI auth implementations |
| **Argon2-cffi** | 23.1+ | Password hashing | OWASP-recommended over bcrypt, default in fastapi-users v13+, GPU/ASIC resistant |
| **slowapi** | 0.1.9+ | Rate limiting | Production-tested (millions req/month), supports Redis, uses token bucket algorithm |
| **python-multipart** | 0.0.18+ | Form/file handling | Required for FastAPI file uploads, handles multipart form data |

### PostgreSQL Security

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **PostgreSQL** | 16+ | Database with RLS | Row-Level Security (RLS) for tenant isolation enforced at DB level |
| **psycopg[binary]** | 3.2+ | PostgreSQL adapter | Async support, connection pooling, native prepared statements |
| **SQLAlchemy** | 2.0.36+ | ORM with RLS support | Event listeners for auto-tenant filtering, prevents SQL injection |

### Audit & Compliance

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **sqlalchemy-audit** | 0.4+ | Audit trail tracking | Automatic revision tables with timestamps, operation tracking (I/U/D) |
| **python-magic** | 0.4.27+ | File type validation | Validates actual file content (magic numbers), not just extension/MIME type |
| **nh3** | 0.2.21+ | HTML sanitization | Rust-backed XSS prevention, 3.8x faster than bleach, actively maintained |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **email-validator** | 2.1+ | Email validation | Pydantic EmailStr validation, DNS checks |
| **python-dotenv** | 1.0+ | Environment config | Load secrets from .env, never commit credentials |
| **aiofiles** | 24.1+ | Async file I/O | Handle file uploads without blocking event loop |
| **redis** | 5.2+ | Rate limiting store | Distributed rate limiting across app instances |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| **Argon2** | bcrypt (passlib) | bcrypt is slower to compute but Argon2 is more resistant to GPU attacks; passlib maintenance ended 2020 |
| **PyJWT** | python-jose | python-jose last updated 2021 with security issues; PyJWT actively maintained |
| **slowapi** | fastapi-limiter | fastapi-limiter requires Redis; slowapi supports in-memory (dev) and Redis (prod) |
| **PostgreSQL RLS** | App-level filtering only | RLS enforces at DB level (prevents SQL injection bypass), but requires PostgreSQL 9.5+ |

**Installation:**

```bash
# Core security
pip install fastapi[standard]==0.128.0 uvicorn[standard]==0.34.0
pip install pyjwt==2.10.1 argon2-cffi==23.1.0
pip install python-multipart==0.0.18

# Database & ORM
pip install sqlalchemy==2.0.36 psycopg[binary]==3.2.3
pip install alembic==1.14.0

# Rate limiting & Redis
pip install slowapi==0.1.9 redis==5.2.0

# Audit & validation
pip install sqlalchemy-audit==0.4.0
pip install python-magic==0.4.27 nh3==0.2.21
pip install email-validator==2.1.0

# Utilities
pip install python-dotenv==1.0.1 aiofiles==24.1.0
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── core/
│   ├── security.py          # Auth dependencies, password hashing, JWT utils
│   ├── config.py            # Settings with pydantic-settings
│   ├── database.py          # SQLAlchemy engine, session factory
│   └── tenant.py            # Tenant context management (contextvars)
├── middleware/
│   ├── tenant_middleware.py # Extract tenant_id from header/subdomain
│   ├── rate_limit.py        # Rate limiting configuration
│   └── security_headers.py  # CORS, CSP, security headers
├── models/
│   ├── base.py              # Base model with tenant_id, audit fields
│   ├── user.py              # User model with role enum
│   └── audit_log.py         # Audit trail model
├── schemas/
│   ├── user.py              # Pydantic models for requests/responses
│   └── auth.py              # Login, token schemas
├── api/
│   ├── deps.py              # Reusable dependencies (get_current_user, etc.)
│   └── v1/
│       ├── auth.py          # Login, register, refresh token
│       └── users.py         # User CRUD (with RBAC checks)
└── tests/
    ├── conftest.py          # Test fixtures (override auth dependencies)
    └── test_security.py     # Security test cases
```

### Pattern 1: Multi-Tenant Context Management

**What:** Use Python contextvars to store tenant_id per-request, combined with PostgreSQL RLS and SQLAlchemy event listeners for automatic filtering.

**When to use:** All multi-tenant applications to ensure tenant isolation without manual WHERE clauses.

**Implementation:**

```python
# src/core/tenant.py
from contextvars import ContextVar
from typing import Optional

# Context variable for current tenant (thread-safe for async)
current_tenant_id: ContextVar[Optional[str]] = ContextVar('current_tenant_id', default=None)

def set_tenant_context(tenant_id: str) -> None:
    """Set tenant context for current request."""
    current_tenant_id.set(tenant_id)

def get_tenant_context() -> Optional[str]:
    """Get tenant context for current request."""
    return current_tenant_id.get()

def clear_tenant_context() -> None:
    """Clear tenant context (use in middleware cleanup)."""
    current_tenant_id.set(None)
```

```python
# src/middleware/tenant_middleware.py
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from src.core.tenant import set_tenant_context, clear_tenant_context

class TenantContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Extract tenant from header (or subdomain, JWT claim, etc.)
        tenant_id = request.headers.get("X-Tenant-ID")

        if not tenant_id:
            # For multi-tenant, reject requests without tenant context
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="X-Tenant-ID header required"
            )

        # Validate tenant_id exists (check against municipality table)
        # ...

        # Set context for this request
        set_tenant_context(tenant_id)

        try:
            response = await call_next(request)
            return response
        finally:
            # Clear context after request
            clear_tenant_context()
```

```python
# src/models/base.py
from sqlalchemy import Column, String, DateTime, event, select
from sqlalchemy.orm import declarative_base, Session
from sqlalchemy.sql import func
from src.core.tenant import get_tenant_context

Base = declarative_base()

class TenantAwareModel(Base):
    """Base model with tenant isolation and audit fields."""
    __abstract__ = True

    tenant_id = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String, nullable=True)  # User ID who created
    updated_by = Column(String, nullable=True)  # User ID who last updated

# SQLAlchemy event listener to auto-filter by tenant_id
@event.listens_for(Session, "do_orm_execute")
def receive_do_orm_execute(orm_execute_state):
    """Automatically add tenant_id filter to all queries."""
    if orm_execute_state.is_select:
        tenant_id = get_tenant_context()
        if tenant_id is None:
            # Fail closed: no tenant context = no data access
            raise ValueError("Tenant context not set - potential data leakage")

        # Add tenant filter to all tenant-aware models
        for mapper in orm_execute_state.bind_mapper.registry._class_registry.data.values():
            if hasattr(mapper, 'tenant_id'):
                orm_execute_state.statement = orm_execute_state.statement.filter_by(
                    tenant_id=tenant_id
                )
```

**Source:** [Multi-Tenant Architecture with FastAPI (Medium)](https://medium.com/@koushiksathish3/multi-tenant-architecture-with-fastapi-design-patterns-and-pitfalls-aa3f9e75bf8c), [Python FastAPI Postgres SqlAlchemy Row Level Security Multitenancy](https://adityamattos.com/multi-tenancy-in-python-fastapi-and-sqlalchemy-using-postgres-row-level-security)

### Pattern 2: PostgreSQL Row-Level Security Setup

**What:** Enforce tenant isolation at the database level using PostgreSQL RLS policies.

**When to use:** As defense-in-depth alongside application-level filtering; critical for preventing SQL injection bypasses.

**Implementation:**

```sql
-- Enable RLS on tables
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy: users can only see rows matching their tenant_id
CREATE POLICY tenant_isolation_policy ON incidents
    USING (tenant_id = current_setting('app.current_tenant')::TEXT);

CREATE POLICY tenant_isolation_policy ON users
    USING (tenant_id = current_setting('app.current_tenant')::TEXT);

-- Grant access to application role
GRANT SELECT, INSERT, UPDATE, DELETE ON incidents TO app_role;
```

```python
# Set tenant context in PostgreSQL session
from sqlalchemy import text

async def set_pg_tenant_context(session, tenant_id: str):
    """Set PostgreSQL session variable for RLS."""
    await session.execute(
        text("SET LOCAL app.current_tenant = :tenant_id"),
        {"tenant_id": tenant_id}
    )
```

**Warning:** PostgreSQL session context must be set on EVERY connection from the pool. With connection pooling (PgBouncer, SQLAlchemy pool), session variables don't persist. Use SQLAlchemy event listeners:

```python
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession

@event.listens_for(AsyncSession, "after_begin")
def set_tenant_on_connection(session, transaction, connection):
    """Set tenant context when connection starts transaction."""
    tenant_id = get_tenant_context()
    if tenant_id:
        connection.execute(
            text("SET LOCAL app.current_tenant = :tenant_id"),
            {"tenant_id": tenant_id}
        )
```

**Source:** [Multi-tenant data isolation with PostgreSQL Row Level Security (AWS)](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/), [Row Level Security for Tenants in Postgres (Crunchy Data)](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres)

### Pattern 3: Dependency Injection for Authentication

**What:** Use FastAPI's `Depends()` for auth checks on every protected endpoint, with reusable dependencies for role checks.

**When to use:** Always for authentication/authorization; preferred over middleware for granular control.

**Implementation:**

```python
# src/api/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.config import settings
from src.models.user import User, UserRole

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Validate JWT and return current user."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_role(*allowed_roles: UserRole):
    """Dependency factory for role-based access control."""
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(r.value for r in allowed_roles)}"
            )
        return current_user
    return role_checker

# Usage in routes
from src.api.deps import get_current_user, require_role
from src.models.user import UserRole

@router.get("/admin/reports")
async def get_admin_reports(
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER))
):
    """Only admins and managers can access."""
    pass
```

**Why not middleware?** Dependency injection is more flexible: (1) only protected routes pay auth overhead, (2) easy to test with `app.dependency_overrides`, (3) granular role checks per endpoint.

**Source:** [FastAPI Auth with Dependency Injection (PropelAuth)](https://www.propelauth.com/post/fastapi-auth-with-dependency-injection), [Dependency Injection in FastAPI: 2026 Playbook (TheLinuxCode)](https://thelinuxcode.com/dependency-injection-in-fastapi-2026-playbook-for-modular-testable-apis/)

### Pattern 4: Rate Limiting Configuration

**What:** Apply rate limits per endpoint using slowapi with Redis backend for distributed systems.

**When to use:** All public endpoints (auth, registration) and resource-intensive operations.

**Implementation:**

```python
# src/main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# src/api/v1/auth.py
from slowapi import Limiter
from fastapi import Request

@router.post("/login")
@limiter.limit("5/minute")  # 5 attempts per minute per IP
async def login(request: Request, credentials: LoginSchema):
    """Login endpoint with rate limiting."""
    pass

@router.post("/register")
@limiter.limit("3/hour")  # 3 registrations per hour per IP
async def register(request: Request, user_data: RegisterSchema):
    """Registration with stricter rate limit."""
    pass
```

**Production setup with Redis:**

```python
from slowapi import Limiter
from slowapi.util import get_remote_address
import redis

redis_client = redis.Redis(host='localhost', port=6379, db=0)

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="redis://localhost:6379"
)
```

**Source:** [Rate Limiting with FastAPI: An In-Depth Guide (Medium)](https://thedkpatel.medium.com/rate-limiting-with-fastapi-an-in-depth-guide-c4d64a776b83), [SlowApi Documentation](https://slowapi.readthedocs.io/)

### Pattern 5: Audit Logging Implementation

**What:** Automatically track all data modifications (INSERT/UPDATE/DELETE) with user context and timestamps.

**When to use:** Required for POPIA compliance, security investigations, and forensics.

**Implementation:**

```python
# src/models/audit_log.py
from sqlalchemy import Column, String, DateTime, Text, Enum
from sqlalchemy.sql import func
import enum

class OperationType(enum.Enum):
    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    tenant_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    operation = Column(Enum(OperationType), nullable=False)
    table_name = Column(String, nullable=False)
    record_id = Column(String, nullable=False)
    changes = Column(Text)  # JSON of old_values -> new_values
    ip_address = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

```python
# src/core/audit.py
from sqlalchemy import event
from sqlalchemy.orm import Session
from src.models.audit_log import AuditLog, OperationType
from src.core.tenant import get_tenant_context
import json

@event.listens_for(Session, "after_insert")
def audit_insert(mapper, connection, target):
    """Log all inserts."""
    log_audit(OperationType.CREATE, mapper.class_.__tablename__, target)

@event.listens_for(Session, "after_update")
def audit_update(mapper, connection, target):
    """Log all updates with changes."""
    changes = {}
    for attr in mapper.columns:
        hist = getattr(target, attr.key + '_history', None)
        if hist and hist.has_changes():
            changes[attr.key] = {
                "old": hist.deleted[0] if hist.deleted else None,
                "new": hist.added[0] if hist.added else None
            }
    log_audit(OperationType.UPDATE, mapper.class_.__tablename__, target, changes)

def log_audit(operation: OperationType, table_name: str, target, changes=None):
    """Create audit log entry."""
    # Get current user from request context (set in auth dependency)
    user_id = getattr(target, 'updated_by', None) or getattr(target, 'created_by', None)
    tenant_id = get_tenant_context()

    audit_entry = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        operation=operation,
        table_name=table_name,
        record_id=str(target.id),
        changes=json.dumps(changes) if changes else None
    )
    # Log to separate audit database or table
```

**Source:** [SQLAlchemy integration - PostgreSQL-Audit](https://postgresql-audit.readthedocs.io/en/stable/sqlalchemy.html), [Tracking queries, object and Session Changes with Events (SQLAlchemy)](https://docs.sqlalchemy.org/en/21/orm/session_events.html)

### Pattern 6: POPIA Consent Management

**What:** Capture, store, and manage user consent with clear purpose explanation and language preference.

**When to use:** Required by POPIA at registration and before processing personal data.

**Implementation:**

```python
# src/models/consent.py
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.sql import func

class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    tenant_id = Column(String, nullable=False, index=True)

    # What data processing the user consented to
    purpose = Column(String, nullable=False)  # e.g., "incident_reporting"
    purpose_description = Column(Text, nullable=False)  # Clear explanation
    language = Column(String, nullable=False)  # en, zu, xh, etc.

    # Consent status
    consented = Column(Boolean, nullable=False)
    consented_at = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String)  # For audit trail

    # Withdrawal
    withdrawn = Column(Boolean, default=False)
    withdrawn_at = Column(DateTime(timezone=True))

# src/schemas/consent.py
from pydantic import BaseModel

class ConsentRequest(BaseModel):
    purpose: str
    purpose_description: str  # "We will use your data to..."
    language: str = "en"
    consented: bool

class ConsentResponse(BaseModel):
    id: str
    purpose: str
    consented: bool
    consented_at: datetime
```

```python
# src/api/v1/consent.py
@router.post("/consent")
async def record_consent(
    consent: ConsentRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Record user consent for data processing."""
    consent_record = ConsentRecord(
        user_id=current_user.id,
        tenant_id=get_tenant_context(),
        purpose=consent.purpose,
        purpose_description=consent.purpose_description,
        language=consent.language,
        consented=consent.consented,
        ip_address=request.client.host
    )
    db.add(consent_record)
    await db.commit()
    return {"status": "consent_recorded"}

@router.post("/consent/{consent_id}/withdraw")
async def withdraw_consent(
    consent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Withdraw previously given consent."""
    consent = await db.get(ConsentRecord, consent_id)
    if not consent or consent.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Consent not found")

    consent.withdrawn = True
    consent.withdrawn_at = func.now()
    await db.commit()
    return {"status": "consent_withdrawn"}
```

**Source:** [How to Achieve POPIA Compliance: Complete Checklist (Scytale)](https://scytale.ai/resources/how-to-achieve-popia-compliance-complete-checklist/), [POPIA Compliance Framework](https://popia.net/popi/index.php/8-popia-compliance-framework-and-monitoring-system)

### Pattern 7: Input Validation & Sanitization

**What:** Use Pydantic for type validation and nh3 for HTML sanitization to prevent XSS/injection attacks.

**When to use:** All user inputs, especially text fields that may be rendered in UI.

**Implementation:**

```python
# src/schemas/incident.py
from pydantic import BaseModel, Field, field_validator
import nh3

class IncidentCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=20, max_length=5000)
    location: str

    @field_validator('title', 'description')
    def sanitize_html(cls, v):
        """Strip HTML tags to prevent XSS."""
        if not isinstance(v, str):
            return v
        # nh3 is Rust-backed, 3.8x faster than bleach
        return nh3.clean(v, tags=set())  # No HTML tags allowed

    @field_validator('location')
    def validate_location(cls, v):
        """Validate location format."""
        # Could validate against known locations or geocode
        if len(v) < 3:
            raise ValueError("Location must be at least 3 characters")
        return v
```

**File upload validation:**

```python
# src/api/v1/uploads.py
from fastapi import UploadFile
import magic

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "application/pdf"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload file with security validation."""
    # Check file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    # Validate actual file type (not just extension)
    mime_type = magic.from_buffer(contents, mime=True)
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type {mime_type} not allowed"
        )

    # Reset file pointer and save
    await file.seek(0)
    # Save to secure location...
```

**Source:** [Pydantic Validation Layers: Secure Python ML Input Sanitization 2025](https://johal.in/pydantic-validation-layers-secure-python-ml-input-sanitization-2025/), [How to secure APIs built with FastAPI: A complete guide (Escape)](https://escape.tech/blog/how-to-secure-fastapi-api/)

### Anti-Patterns to Avoid

1. **Middleware-only authentication:** Don't rely solely on middleware for auth—it's too coarse-grained and bypasses are easy. Use dependency injection per endpoint.

2. **Trusting Content-Type headers:** Don't validate file uploads by checking `content_type`—it's client-controlled. Use `python-magic` to check magic numbers.

3. **Manual tenant filtering:** Don't add `.filter(tenant_id=X)` to every query manually—it's error-prone and one missed filter causes data leakage. Use SQLAlchemy event listeners + PostgreSQL RLS.

4. **Storing passwords with bcrypt alone:** Don't use bcrypt without considering Argon2—OWASP now recommends Argon2id for new systems due to better GPU resistance.

5. **Global database connections:** Don't share database connections across tenants without setting RLS context variables per connection—connection pooling can leak tenant context.

6. **Disabling /docs in production by removal:** Don't remove `/docs` endpoint completely—instead, protect it with authentication so developers can still access with credentials.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| **JWT token generation** | Custom signing logic | PyJWT library | Edge cases: token expiration, refresh, algorithm negotiation, key rotation |
| **Password hashing** | Custom hash function | Argon2-cffi | Requires salt generation, key derivation parameters, timing attack prevention |
| **Rate limiting** | In-memory counter dict | slowapi + Redis | Distributed systems need shared state; memory counters don't work across instances |
| **Input sanitization** | Regex-based HTML stripping | nh3 library | XSS has 1000s of bypass techniques; Rust-backed parser handles edge cases |
| **File type detection** | Check file extension | python-magic | Extensions can be spoofed; magic numbers are authoritative |
| **Audit logging** | Manual INSERT statements | SQLAlchemy events + audit table | Easy to forget; event listeners are automatic and consistent |
| **Multi-tenant filtering** | Manual WHERE clauses | PostgreSQL RLS + SQLAlchemy events | One missed filter = data breach; automatic filtering is fail-safe |

**Key insight:** Security libraries exist because experts have battle-tested them against attack vectors you haven't encountered yet. Custom implementations miss edge cases that only appear under adversarial conditions.

## Common Pitfalls

### Pitfall 1: Tenant Context Leakage in Connection Pools

**What goes wrong:** PostgreSQL session variables (used for RLS) don't persist across connections in a pool. Connection is returned to pool with tenant_id=A, then reused for tenant B, but RLS still filters for A—wrong tenant's data is returned.

**Why it happens:** Connection pooling (PgBouncer, SQLAlchemy) reuses connections for performance, but session-level variables (SET LOCAL) are not reset between uses.

**How to avoid:**
1. Use SQLAlchemy `after_begin` event to set RLS context on every transaction start
2. Use application-level tenant filtering (SQLAlchemy event listeners) as backup
3. Test with connection pool min_size=1, max_size=1 in development to catch issues early

**Warning signs:**
- Intermittent "wrong data" bugs that disappear on app restart
- User reports seeing data from other municipalities
- Audit logs showing cross-tenant data access

**Source:** [Multi-Tenant Leakage: When "Row-Level Security" Fails in SaaS (Medium)](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c)

### Pitfall 2: Missing Tenant Context Check (Fail Open)

**What goes wrong:** If `get_tenant_context()` returns None and code doesn't explicitly check, queries succeed without tenant filtering—returning ALL data across ALL tenants.

**Why it happens:** Developers forget to validate tenant context exists before database operations.

**How to avoid:**
1. Fail closed: raise exception if `get_tenant_context()` returns None
2. Add assertion in SQLAlchemy event listener: `assert tenant_id is not None`
3. Create custom exception `TenantContextMissingError` for explicit handling

**Example:**

```python
# BAD: Fails open (returns all data if tenant_id is None)
@event.listens_for(Session, "do_orm_execute")
def add_tenant_filter(orm_execute_state):
    tenant_id = get_tenant_context()
    if tenant_id:  # <-- This is the bug
        orm_execute_state.statement = orm_execute_state.statement.filter_by(tenant_id=tenant_id)

# GOOD: Fails closed (raises error if tenant_id is None)
@event.listens_for(Session, "do_orm_execute")
def add_tenant_filter(orm_execute_state):
    tenant_id = get_tenant_context()
    if tenant_id is None:
        raise SecurityException("Tenant context not set - denying query")
    orm_execute_state.statement = orm_execute_state.statement.filter_by(tenant_id=tenant_id)
```

**Source:** [Failsafing Multitenancy in SQLAlchemy (Nick Mitchinson)](https://www.nrmitchi.com/2016/07/failsafing-multitenancy-in-sqlalchemy/)

### Pitfall 3: Weak JWT Secret Keys

**What goes wrong:** Using default/weak secret keys (e.g., "secret", "changeme") allows attackers to forge tokens and impersonate any user.

**Why it happens:** Developers use example code in production or forget to rotate keys.

**How to avoid:**
1. Generate strong secrets: `openssl rand -hex 32`
2. Store in environment variables, never hardcode
3. Use different secrets for dev/staging/production
4. Implement key rotation strategy (accept multiple keys during rotation)

**Warning signs:**
- Secrets in git history or .env.example files
- Secret key shorter than 32 characters
- Same secret used across environments

**Example:**

```python
# src/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str  # Must be set via environment variable
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Validate on startup
settings = Settings()
if len(settings.SECRET_KEY) < 32:
    raise ValueError("SECRET_KEY must be at least 32 characters")
```

**Source:** [FastAPI Security Pitfalls That Almost Leaked My User Data (Medium)](https://medium.com/@ThinkingLoop/fastapi-security-pitfalls-that-almost-leaked-my-user-data-c9903bc13fd7)

### Pitfall 4: Trusting Client-Provided Tenant IDs

**What goes wrong:** Accepting tenant_id from request body/query params allows users to access other tenants' data by changing the ID.

**Why it happens:** Confusing "which tenant does this user belong to?" (auth) with "which tenant's data should I access?" (user input).

**How to avoid:**
1. Derive tenant_id from authenticated user's JWT claims, not request parameters
2. If tenant_id is in header, validate it matches user's authorized tenants
3. Never trust client-provided tenant_id for authorization decisions

**Example:**

```python
# BAD: User can change tenant_id to access other tenants
@router.get("/incidents")
async def get_incidents(tenant_id: str = Query(...)):  # <-- NEVER do this
    set_tenant_context(tenant_id)
    return await db.query(Incident).all()

# GOOD: Derive tenant from authenticated user
@router.get("/incidents")
async def get_incidents(current_user: User = Depends(get_current_user)):
    tenant_id = current_user.tenant_id  # From JWT/database
    set_tenant_context(tenant_id)
    return await db.query(Incident).all()
```

**Source:** [Multi Tenant Security - OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)

### Pitfall 5: CORS Wildcard with Credentials

**What goes wrong:** Setting `allow_origins=["*"]` with `allow_credentials=True` allows any website to make authenticated requests to your API with user cookies.

**Why it happens:** Developers want to "fix CORS errors" quickly without understanding security implications.

**How to avoid:**
1. Never use `allow_origins=["*"]` in production
2. Whitelist specific frontend domains
3. Use environment variables for allowed origins

**Example:**

```python
# BAD: Any site can make authenticated requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # <-- DANGEROUS
    allow_credentials=True,
)

# GOOD: Explicit whitelist
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://salga-trust.gov.za",
        "https://staging.salga-trust.gov.za"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-ID"],
)
```

**Source:** [FastAPI CORS Middleware (Compile N Run)](https://www.compilenrun.com/docs/framework/fastapi/fastapi-middleware/fastapi-cors-middleware/)

### Pitfall 6: Missing Rate Limits on Auth Endpoints

**What goes wrong:** Without rate limiting, attackers can brute-force passwords or enumerate valid usernames.

**Why it happens:** Developers focus on functional requirements and forget about abuse scenarios.

**How to avoid:**
1. Apply aggressive rate limits on /login, /register, /forgot-password
2. Use exponential backoff: 5 tries → 1 min lockout, 10 tries → 1 hour lockout
3. Consider CAPTCHA after N failed attempts

**Example:**

```python
@router.post("/login")
@limiter.limit("5/minute")  # Only 5 login attempts per minute
async def login(request: Request, credentials: LoginSchema):
    pass

@router.post("/register")
@limiter.limit("3/hour")  # Max 3 registrations per hour
async def register(request: Request, data: RegisterSchema):
    pass
```

**Source:** [Rate Limiting in FastAPI: Essential Protection for ML API Endpoints](https://fullstackdatascience.com/blogs/rate-limiting-in-fastapi-essential-protection-for-ml-api-endpoints-d5xsqw)

### Pitfall 7: Exposing Sensitive Data in Error Messages

**What goes wrong:** Returning detailed error messages like "User with email X not found" allows attackers to enumerate valid accounts.

**Why it happens:** Developers prioritize helpful error messages over security.

**How to avoid:**
1. Return generic messages: "Invalid credentials" (not "User not found" or "Wrong password")
2. Use custom exception handlers to strip sensitive details in production
3. Log detailed errors server-side, but return sanitized messages to clients

**Example:**

```python
# BAD: Reveals whether user exists
@router.post("/login")
async def login(credentials: LoginSchema):
    user = await get_user_by_email(credentials.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")  # <-- Leaks info
    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Wrong password")  # <-- Leaks info

# GOOD: Generic error message
@router.post("/login")
async def login(credentials: LoginSchema):
    user = await get_user_by_email(credentials.email)
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
```

**Source:** [Fast API Security Complete Guide (AppSentinels)](https://appsentinels.ai/blog/fastapi-security/)

## Code Examples

Verified patterns from official sources:

### JWT Token Generation and Verification

```python
# src/core/security.py
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from src.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password using Argon2."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """Decode and verify JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None
```

**Source:** [OAuth2 with Password (and hashing), Bearer with JWT tokens - FastAPI](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/)

### Database Session with Tenant Context

```python
# src/core/database.py
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from typing import AsyncGenerator

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

**Source:** [Connection Pooling — SQLAlchemy 2.0 Documentation](https://docs.sqlalchemy.org/en/20/core/pooling.html)

### POPIA Data Access Request Handler

```python
# src/api/v1/data_rights.py
from fastapi import APIRouter, Depends
from src.api.deps import get_current_user

router = APIRouter(prefix="/data-rights", tags=["POPIA"])

@router.get("/my-data")
async def request_data_access(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """POPIA Right to Access: Return all personal data held about user."""
    # Gather data from all tables
    user_data = {
        "profile": current_user.dict(),
        "incidents": [i.dict() for i in await get_user_incidents(db, current_user.id)],
        "consent_records": [c.dict() for c in await get_user_consents(db, current_user.id)],
        "audit_logs": [a.dict() for a in await get_user_audit_logs(db, current_user.id)],
    }
    return user_data

@router.delete("/delete-account")
async def request_data_deletion(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """POPIA Right to Deletion: Delete user account and personal data."""
    # Mark user as deleted (soft delete for audit trail)
    current_user.deleted = True
    current_user.deleted_at = func.now()

    # Anonymize data (overwrite PII with generic values)
    current_user.email = f"deleted_{current_user.id}@deleted.local"
    current_user.name = "Deleted User"
    current_user.phone = None

    await db.commit()
    return {"status": "account_deleted"}
```

**Source:** [POPIA: Compliance with South Africa's Data Protection Law](https://www.cookiebot.com/en/popia/)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| **python-jose** | PyJWT | 2024 | python-jose unmaintained since 2021; PyJWT actively maintained with security fixes |
| **passlib bcrypt** | Argon2-cffi | 2025 | OWASP now recommends Argon2id; fastapi-users v13+ defaults to Argon2 |
| **bleach (HTML sanitizer)** | nh3 | 2024 | bleach deprecated; nh3 is Rust-backed, 3.8x faster, actively maintained |
| **Manual tenant filtering** | PostgreSQL RLS + SQLAlchemy events | 2023 | RLS prevents SQL injection bypass; automatic filtering reduces human error |
| **Middleware-only auth** | Dependency injection per endpoint | 2022 | Granular control, easier testing, better performance for public endpoints |

**Deprecated/outdated:**
- **python-jose:** Last release 2021, known security issues. Use PyJWT instead.
- **passlib bcrypt-only:** OWASP deprecates bcrypt for new systems. Use Argon2.
- **Global database sessions:** FastAPI best practices now recommend dependency injection for sessions.
- **Trust file extensions:** Always validate actual file content with python-magic, not extensions.

## Open Questions

1. **Multi-region RLS context propagation**
   - What we know: PostgreSQL RLS requires session variables per connection
   - What's unclear: Best approach for multi-region deployments with connection poolers
   - Recommendation: Use application-level filtering as primary, RLS as defense-in-depth for now; revisit when multi-region requirement confirmed

2. **Alembic migrations for multi-tenant schemas**
   - What we know: Alembic doesn't have first-class multi-tenant support
   - What's unclear: Should each municipality get its own Alembic version table?
   - Recommendation: Use single shared schema with tenant_id column (not schema-per-tenant) to avoid Alembic complexity

3. **Token refresh strategy**
   - What we know: Short-lived access tokens + long-lived refresh tokens is best practice
   - What's unclear: Should refresh tokens be stored in database or stateless?
   - Recommendation: Store refresh tokens in Redis with TTL for revocation support; implement rotation on use

4. **POPIA data retention policies**
   - What we know: POPIA requires data minimization and retention policies
   - What's unclear: Retention period for incident reports (conflict between transparency and privacy)
   - Recommendation: Flag for legal review; suggest 7 years for audit purposes with anonymization after resolution

## Sources

### Primary (HIGH confidence)

- [FastAPI Official Security Tutorial](https://fastapi.tiangolo.com/tutorial/security/)
- [FastAPI OAuth2 with JWT](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/)
- [SQLAlchemy 2.0 Connection Pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html)
- [SQLAlchemy Session Events](https://docs.sqlalchemy.org/en/21/orm/session_events.html)
- [PostgreSQL pgcrypto Documentation](https://www.postgresql.org/docs/current/pgcrypto.html)
- [Alembic Cookbook](https://alembic.sqlalchemy.org/en/latest/cookbook.html)

### Secondary (MEDIUM confidence)

- [Multi-Tenant Architecture with FastAPI (Medium, April 2025)](https://medium.com/@koushiksathish3/multi-tenant-architecture-with-fastapi-design-patterns-and-pitfalls-aa3f9e75bf8c)
- [Python FastAPI Postgres SqlAlchemy Row Level Security Multitenancy](https://adityamattos.com/multi-tenancy-in-python-fastapi-and-sqlalchemy-using-postgres-row-level-security)
- [Multi-tenant data isolation with PostgreSQL Row Level Security (AWS)](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Row Level Security for Tenants in Postgres (Crunchy Data)](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres)
- [FastAPI Auth with Dependency Injection (PropelAuth)](https://www.propelauth.com/post/fastapi-auth-with-dependency-injection)
- [Dependency Injection in FastAPI: 2026 Playbook (TheLinuxCode)](https://thelinuxcode.com/dependency-injection-in-fastapi-2026-playbook-for-modular-testable-apis/)
- [Rate Limiting with FastAPI: An In-Depth Guide (Medium)](https://thedkpatel.medium.com/rate-limiting-with-fastapi-an-in-depth-guide-c4d64a776b83)
- [SlowApi Documentation](https://slowapi.readthedocs.io/)
- [How to Secure FastAPI Applications Against OWASP Top 10 (OneUpTime, Jan 2025)](https://oneuptime.com/blog/post/2025-01-06-fastapi-owasp-security/view)
- [Pydantic Validation Layers: Secure Python ML Input Sanitization 2025](https://johal.in/pydantic-validation-layers-secure-python-ml-input-sanitization-2025/)
- [How to secure APIs built with FastAPI: A complete guide (Escape)](https://escape.tech/blog/how-to-secure-fastapi-api/)
- [How to Achieve POPIA Compliance: Complete Checklist (Scytale)](https://scytale.ai/resources/how-to-achieve-popia-compliance-complete-checklist/)
- [POPIA Compliance Framework](https://popia.net/popi/index.php/8-popia-compliance-framework-and-monitoring-system)
- [Protecting Against CSRF (Django Security)](https://docs.djangoproject.com/en/4.2/ref/csrf/) (general CSRF concepts applicable to FastAPI)

### Tertiary (LOW confidence - flag for validation)

- [Multi-Tenant Leakage: When "Row-Level Security" Fails in SaaS (Medium, Jan 2026)](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c) — Real-world pitfalls but single source
- [FastAPI Security Pitfalls That Almost Leaked My User Data (Medium)](https://medium.com/@ThinkingLoop/fastapi-security-pitfalls-that-almost-leaked-my-user-data-c9903bc13fd7) — Anecdotal but useful warnings
- [Failsafing Multitenancy in SQLAlchemy (Nick Mitchinson, 2016)](https://www.nrmitchi.com/2016/07/failsafing-multitenancy-in-sqlalchemy/) — Older but still relevant patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — FastAPI, PyJWT, Argon2, SQLAlchemy are industry-standard with official docs
- Architecture: HIGH — Multi-tenant patterns are well-documented with recent sources (2025-2026)
- Pitfalls: MEDIUM-HIGH — Mix of official best practices and community war stories; some single-source anecdotes flagged

**Research date:** 2026-02-09
**Valid until:** ~90 days (stable technologies; recheck for security patches monthly)

**Notes for planner:**
- Multi-tenant filtering requires both PostgreSQL RLS AND application-level filtering (defense-in-depth)
- POPIA compliance is non-negotiable from day one—consent management must be in Phase 1
- Authentication testing requires `app.dependency_overrides` pattern (document in PLAN.md)
- Connection pooling with RLS needs special attention—create test scenario early
- Consider security audit before production deployment (not in Phase 1 scope)
