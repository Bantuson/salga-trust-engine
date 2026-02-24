# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SALGA Trust Engine — AI-powered municipal service management for South African municipalities. Citizens report via WhatsApp (Twilio) or web portal, CrewAI agents triage and route tickets, municipal staff manage via operations dashboard, and public transparency dashboards show anonymized performance data. Trilingual: English, isiZulu, Afrikaans.

## Commands

### Backend (run from repo root)
```bash
uvicorn src.main:app --reload --port 8000          # FastAPI dev server
celery -A src.celery_app worker --loglevel=info --pool=solo  # Celery worker (--pool=solo required on Windows)
pytest                                               # Run all unit tests
pytest tests/test_auth.py -k test_login              # Run single test
pytest --cov=src --cov-report=html                   # Coverage (80% minimum)
pytest -m integration                                # Integration tests (requires PostgreSQL)
alembic upgrade head                                 # Apply migrations
alembic revision --autogenerate -m "description"     # Create migration
pip install -e ".[dev]"                              # Install with dev deps
```

### Frontend (each has its own package.json)
```bash
cd frontend-dashboard && npm run dev      # Municipal ops dashboard (port 5173)
cd frontend-public && npm run dev         # Public transparency dashboard (port 5174)
npm run build                             # Production build
npm run build:check                       # TypeScript type check (tsc -b)
npm run lint                              # ESLint
```

### E2E Tests
```bash
cd e2e-tests && npx playwright test                      # All E2E tests
npx playwright test --project=public-chromium             # Single project
npx playwright test tests/public/landing.spec.ts          # Single file
npx playwright test --ui                                  # UI debug mode
```

## Architecture

### Actual Directory Layout (README's `backend/` wrapper does not exist — `src/` and `tests/` are at repo root)

```
src/                          # Python backend (FastAPI)
├── agents/                   # CrewAI system: crews, config YAML, flows, tools, prompts
├── api/v1/                   # 21 route modules (auth, tickets, dashboard, whatsapp, etc.)
├── core/                     # Config, database, audit, encryption, security, tenant
├── guardrails/               # Input/output filters for agent safety
├── middleware/                # Tenant context, security headers, rate limiting, error handling
├── models/                   # SQLAlchemy ORM models (User, Ticket, Municipality, Team, etc.)
├── schemas/                  # Pydantic request/response schemas
├── services/                 # Business logic (dashboard, routing, SLA, WhatsApp, etc.)
├── tasks/                    # Celery task definitions and beat schedule
└── main.py                   # FastAPI app with lifespan, middleware stack, router includes

tests/                        # Python unit/integration tests
frontend-dashboard/           # React+Vite municipal ops dashboard (port 5173)
frontend-public/              # React+Vite public transparency dashboard (port 5174)
shared/                       # Shared UI components (accessed via @shared Vite alias)
e2e-tests/                    # Playwright E2E tests (5 projects)
alembic/                      # Database migrations (timestamp naming)
.planning/                    # Roadmap, requirements, state tracking
```

### Backend Patterns
- **Auth**: Supabase Auth with JWT — role and tenant_id in `app_metadata`. Token verified by `src/core/security.py:verify_supabase_token`
- **Dependencies**: `src/api/deps.py` exports `get_current_user`, `get_current_active_user`, `require_role(*allowed_roles)` factory
- **Multi-tenancy**: PostgreSQL RLS policies + application-level tenant_id filtering via `TenantContextMiddleware`
- **Config**: Pydantic Settings in `src/core/config.py`, loaded from `.env`
- **Async DB**: SQLAlchemy 2.0 with `AsyncSession`. Unit tests use SQLite in-memory (`aiosqlite`)
- **Middleware stack** (reverse order): CORS → SecurityHeaders → TenantContext → Rate limiting → Exception handlers
- **Audit logging**: SQLAlchemy event listeners registered in `src/core/audit.py` (imported in `main.py`)
- **Background tasks**: Celery with Redis broker, timezone `Africa/Johannesburg`, SLA checks on beat schedule

### Agent Architecture (CrewAI)
- **Manager Agent (Gugu)**: Routes citizen messages to specialist agents
- **Specialists**: Auth, Municipal Intake, GBV, Ticket Status — each handles a narrow scope, no delegation
- **Config**: YAML files in `src/agents/config/` define agent personas and task definitions
- **State**: Conversation state maintained in `src/agents/crews/intake_flow.py`
- **LLM**: DeepSeek via OpenAI-compatible API
- **Guardrails**: Input/output filters in `src/guardrails/` for content safety

### Frontend Patterns
- **Auth**: `AuthProvider` wraps app, `ProtectedRoute` for authenticated pages, Supabase client in `lib/`
- **State**: Zustand stores in dashboard, React context in public
- **Styling**: Tailwind CSS, GSAP animations, Lenis smooth scroll
- **Shared components**: `@shared` Vite alias points to `shared/` directory
- **Public dashboard**: Some pages query Supabase RLS views directly (no FastAPI dependency)

### Roles (6 total)
`citizen`, `manager`, `admin`, `field_worker`, `saps_liaison`, `ward_councillor`

## Security Rules

- **NEVER read `.env` files** — they contain secrets that get displayed in conversation. To verify env vars exist: `grep -c "VAR_NAME" .env`
- **SEC-05 GBV Firewall**: 5-layer defense (routing, DB RLS, API, storage, public views). GBV tickets visible only to `saps_liaison` and `admin`. Never weaken these filters.
- **POPIA Compliance**: Consent tracking, data access requests, deletion rights, audit logging. All models have audit event listeners.
- **Multi-tenant isolation**: Always filter by `tenant_id`. RLS policies + application-level checks.
- **Security comment markers**: `# SEC-01` through `# SEC-05` in code mark security-critical sections. `# POPIA` marks data protection points.

## Database

- PostgreSQL 15+ with PostGIS. 22+ tables including `users`, `tickets`, `municipalities`, `teams`, `audit_logs`, `whatsapp_sessions`, `sla_configs`
- Soft deletes via `is_deleted` flag, timestamps on all models (`created_at`, `updated_at`)
- Migrations in `alembic/versions/` with timestamp naming convention

## Testing Notes

- `asyncio_mode = "auto"` in pytest config — async tests work without `@pytest.mark.asyncio`
- Unit tests use SQLite in-memory (no PostgreSQL needed). Set `USES_SQLITE_TESTS` env var
- E2E tests have 60s timeout per test (accounts for GSAP animations)
- Coverage minimum: 80% (`fail_under = 80` in pyproject.toml)
