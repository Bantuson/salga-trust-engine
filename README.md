# SALGA Trust Engine

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19+-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

AI-powered municipal service management platform for South African municipalities. Citizens report service issues and GBV incidents via WhatsApp or web portal, and the system automatically categorizes, routes, and tracks resolution using CrewAI agentic architecture and geospatial analytics. Public transparency dashboards rebuild trust through radical accountability.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Security Highlights](#security-highlights)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Overview

South African municipalities face systemic dysfunction: R100+ billion in debt, only 27 of 257 municipalities achieving clean audits (2019/2020), and widespread citizen distrust. The SALGA Trust Engine addresses this crisis by creating the core feedback loop that transforms opaque, reactive local government into transparent, accountable service delivery.

**The Core Value:** Citizens report a problem and the municipality visibly responds.

Built for SALGA's network of 257 municipalities, the platform starts with a 3-5 municipality pilot cohort to prove the model across different sizes and contexts before scaling nationwide.

### What Problem Does This Solve?

- **For Citizens**: Simple WhatsApp-based reporting in English, isiZulu, or Afrikaans. No app download required. Automatic status updates. Public transparency into municipal performance.
- **For Municipalities**: AI-powered triage and routing. Geospatial team assignment. SLA tracking with automated escalation. Real-time operational dashboards. Reduced administrative overhead.
- **For SALGA**: Standardized service delivery platform across all member municipalities. Data-driven policy insights. Demonstrable accountability to national government and citizens.

## Key Features

### Citizen Reporting
- **Multi-channel submission**: WhatsApp (via Twilio) and web portal
- **Trilingual support**: English, isiZulu, and Afrikaans from day one
- **Visual evidence**: Photo uploads with automatic GPS geolocation and manual address fallback
- **GBV privacy firewall**: Gender-based violence and abuse reports routed directly to SAPS police stations with enhanced encryption and need-to-know access controls
- **Account verification**: Proof of residence (OCR document analysis) to bind citizens to their municipality

### AI-Powered Routing
- **CrewAI agentic architecture**: Manager agent routes messages to specialist agents by category (water, roads, electricity, sanitation, GBV)
- **Structured intake**: Conversational AI extracts complete ticket information across three languages
- **Geospatial routing**: PostGIS-powered proximity matching to assign tickets to nearest municipal team or SAPS station
- **Automated escalation**: SLA monitoring with manager escalation on breach

### Municipal Operations
- **Role-based access control**: Six roles (citizen, manager, admin, field_worker, saps_liaison, ward_councillor)
- **Real-time dashboard**: Live ticket volumes, SLA compliance metrics, team workload charts
- **Ward councillor filtering**: Councillors see only issues in their specific ward
- **Ticket lifecycle management**: Assignment tracking, status updates, resolution verification
- **Data export**: CSV and Excel export for offline analysis

### Public Transparency
- **Anonymous public dashboard**: Average response times, resolution rates, and geographic heatmaps per municipality
- **K-anonymity protection**: Heatmap requires minimum 3 tickets per grid cell to prevent re-identification
- **GBV data exclusion**: Sensitive reports never appear in public statistics (aggregated counts only, no identifying details)

### Security and Compliance
- **POPIA compliance**: Consent at registration, data access requests, deletion rights, comprehensive audit logging
- **Multi-tenant architecture**: Complete data isolation per municipality with PostgreSQL Row-Level Security (RLS)
- **Encryption**: TLS in-transit, storage-level at-rest, enhanced field-level encryption for GBV data
- **SEC-05 GBV firewall**: Defense-in-depth isolation at routing, database, API, and storage layers

## Architecture

```mermaid
graph TB
    subgraph "Citizen Channels"
        WA[WhatsApp via Twilio]
        WEB[Web Portal React]
    end

    subgraph "API Layer"
        FAST[FastAPI Backend]
        AUTH[Supabase Auth]
    end

    subgraph "AI Layer"
        MGR[Manager Agent]
        MUN[Municipal Specialist]
        GBV[GBV Specialist]
        MGR --> MUN
        MGR --> GBV
    end

    subgraph "Data Layer"
        PG[(PostgreSQL + PostGIS)]
        REDIS[(Redis + Celery)]
        STORAGE[Supabase Storage]
    end

    subgraph "Municipal Ops"
        DASH[Operations Dashboard]
        SSE[Realtime Updates Supabase Realtime]
    end

    subgraph "Public Transparency"
        PUB[Public Dashboard]
        ANON[Anonymous RLS Views]
    end

    WA --> FAST
    WEB --> FAST
    FAST --> AUTH
    FAST --> MGR
    MUN --> PG
    GBV --> PG
    GBV --> STORAGE
    FAST --> REDIS
    REDIS --> PG
    DASH --> AUTH
    DASH --> SSE
    SSE --> PG
    PUB --> ANON
    ANON --> PG
```

### Data Flow

1. **Citizen submits report** via WhatsApp or web portal in any supported language
2. **Manager agent detects language** and routes to appropriate specialist agent (municipal or GBV)
3. **Specialist agent conducts structured intake** to extract complete ticket information
4. **Geospatial routing service** assigns ticket to nearest team or SAPS station based on location and category
5. **Celery background tasks** monitor SLA compliance and send WhatsApp status updates
6. **Municipal managers** view and manage tickets via real-time dashboard with Supabase Realtime WebSocket updates
7. **Public dashboard** displays anonymized performance metrics via direct Supabase RLS view queries

## Tech Stack

### Backend
- **Python 3.12+**: Core language
- **FastAPI**: API framework with async support
- **PostgreSQL 15+**: Primary database
- **PostGIS**: Geospatial extensions for proximity routing
- **Redis**: Rate limiting, caching, Celery message broker
- **Celery**: Background task queue for notifications and SLA monitoring

### AI and NLP
- **CrewAI**: Agentic AI framework with manager and specialist agents
- **lingua-py**: Language detection for trilingual support
- **Tesseract OCR**: Proof of residence document verification

### Frontend
- **React 19**: UI framework
- **Vite**: Build tool and dev server
- **TypeScript**: Type safety
- **Recharts**: Data visualizations
- **Leaflet**: Heatmap rendering
- **GSAP**: Animations and scroll effects
- **Lenis**: Smooth scroll

### Infrastructure
- **Supabase**: Database hosting, authentication, storage, realtime subscriptions
- **Twilio**: WhatsApp Business API
- **Vercel**: Frontend hosting (both dashboards)

### Testing
- **pytest**: Python unit and integration tests (130+ tests)
- **Playwright**: E2E browser tests (134 tests across 11 profiles)
- **Faker**: Test data generation

## Project Structure

```
salga-trust-engine/
├── backend/
│   ├── src/
│   │   ├── ai/                 # CrewAI agents and flows
│   │   ├── api/                # FastAPI endpoints
│   │   ├── config/             # Configuration and settings
│   │   ├── db/                 # Database models and migrations
│   │   ├── middleware/         # Security and tenant middleware
│   │   ├── services/           # Business logic layer
│   │   └── utils/              # Utilities and helpers
│   ├── tests/                  # Python unit and integration tests
│   └── requirements.txt
├── frontend-public/            # Public dashboard (port 5174)
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Page-level components
│   │   ├── hooks/              # Custom React hooks
│   │   └── lib/                # Utilities and Supabase client
│   └── package.json
├── frontend-dashboard/         # Municipal dashboard (port 5173)
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Page-level components
│   │   ├── stores/             # State management
│   │   └── lib/                # Utilities and Supabase client
│   └── package.json
├── e2e-tests/                  # Playwright E2E tests
│   ├── tests/                  # Test suites
│   ├── fixtures/               # Fixtures and page objects
│   └── playwright.config.ts
├── shared/                     # Shared UI components across dashboards
│   └── components/
├── .planning/                  # Project documentation
│   ├── phases/                 # 6 phase execution plans
│   ├── PROJECT.md              # Project overview
│   ├── ROADMAP.md              # 39 requirements across 6 phases
│   └── STATE.md                # Current progress tracking
└── README.md
```

## Getting Started

### Prerequisites

- **Python 3.12+** with pip
- **Node.js 18+** with npm
- **PostgreSQL 15+** with PostGIS extension
- **Redis 6+**
- **Tesseract OCR** (optional, for proof of residence verification)
- **Supabase account** (free tier sufficient for development)
- **Twilio account** (for WhatsApp integration)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Bantuson/salga-trust-engine.git
cd salga-trust-engine
```

2. Install backend dependencies:

```bash
cd backend
pip install -r requirements.txt
```

3. Install frontend dependencies for both dashboards:

```bash
cd ../frontend-public
npm install

cd ../frontend-dashboard
npm install
```

4. Install E2E test dependencies:

```bash
cd ../e2e-tests
npm install
npx playwright install
```

5. Set up Supabase project:
   - Create a new project at [supabase.com](https://supabase.com)
   - Run migrations from `backend/src/db/migrations/`
   - Configure custom access token hook in Supabase Dashboard (see Phase 6.1 docs)
   - Create storage buckets: `evidence`, `documents`, `gbv-evidence`, `access-request-docs`

6. Configure environment variables (see next section)

## Environment Variables

### Backend (.env)

Create `backend/.env` with the following variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/dbname
SUPABASE_DB_URL=postgresql://user:password@host:port/dbname

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Redis
REDIS_URL=redis://localhost:6379/0

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# OpenAI (for CrewAI agents)
OPENAI_API_KEY=your-openai-api-key

# Environment
ENVIRONMENT=development

# Rate Limiting
RATE_LIMIT_STORAGE=redis://localhost:6379/0

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

### Frontend Public (.env)

Create `frontend-public/.env`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Frontend Dashboard (.env)

Create `frontend-dashboard/.env`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### E2E Tests (.env)

Create `e2e-tests/.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PUBLIC_DASHBOARD_URL=http://localhost:5174
MUNICIPAL_DASHBOARD_URL=http://localhost:5173
```

## Running the Application

### Backend API Server

```bash
cd backend
uvicorn src.main:app --reload --port 8000
```

API documentation available at: http://localhost:8000/docs

### Celery Worker (Background Tasks)

```bash
cd backend
celery -A src.celery_app worker --loglevel=info --pool=solo
```

Note: `--pool=solo` required on Windows

### Frontend Public Dashboard

```bash
cd frontend-public
npm run dev
```

Available at: http://localhost:5174

### Frontend Municipal Dashboard

```bash
cd frontend-dashboard
npm run dev
```

Available at: http://localhost:5173

### Run All Services (Development)

Use separate terminal windows/tabs for each service:

1. Terminal 1: Backend API (`uvicorn` command)
2. Terminal 2: Celery worker
3. Terminal 3: Public dashboard (`npm run dev`)
4. Terminal 4: Municipal dashboard (`npm run dev`)

## Testing

### Python Unit Tests

```bash
cd backend
pytest
```

Run with coverage report:

```bash
pytest --cov=src --cov-report=html
```

### Python Integration Tests

Integration tests require PostgreSQL and Redis:

```bash
pytest -m integration
```

### E2E Tests with Playwright

Run all E2E tests:

```bash
cd e2e-tests
npx playwright test
```

Run specific test suite:

```bash
npx playwright test tests/public/landing.spec.ts
```

Run tests in UI mode:

```bash
npx playwright test --ui
```

View test report:

```bash
npx playwright show-report
```

### Test Coverage Summary

- **Backend**: 310 total tests, 130+ unit tests passing (integration tests require PostgreSQL setup)
- **E2E**: 134 tests across 11 role profiles
  - 5 public dashboard profiles (citizen, anonymous, GBV reporter, mobile, accessibility)
  - 6 municipal dashboard profiles (manager, admin, field worker, SAPS liaison, ward councillor, multi-tenant isolation)

## Security Highlights

### POPIA Compliance

The Protection of Personal Information Act (POPIA) is South Africa's data privacy law. The platform is POPIA-compliant from day one:

- **Consent at registration**: Clear purpose explanation in user's language
- **Data access requests**: Citizens can request all personal data held by the system
- **Deletion rights**: Account deletion with PII anonymization (keeps audit trail per legal requirement)
- **Audit logging**: Comprehensive tracking of all data access and modifications

### GBV Privacy Firewall (SEC-05)

Gender-based violence reports are protected by defense-in-depth isolation:

1. **Routing layer**: Explicit `is_saps == True` filter prevents municipal team assignment
2. **Database RLS**: Separate policies restrict GBV ticket visibility to `saps_liaison` and `admin` roles only
3. **Storage RLS**: `gbv-evidence` bucket accessible only to authorized roles
4. **Public views**: `is_sensitive == False` filter excludes GBV tickets from all public statistics
5. **Application layer**: SEC-05 validation throughout codebase

### Multi-Tenant Security

- **Row-Level Security (RLS)**: PostgreSQL policies enforce data isolation per municipality
- **JWT-based authentication**: Supabase Auth with role and tenant_id in `app_metadata`
- **Indexed RLS columns**: All tenant_id and role columns indexed for performance
- **Defense-in-depth**: RLS policies + application-level tenant filter

### Additional Security Measures

- **Rate limiting**: Redis-backed protection against brute force and DoS
- **Input sanitization**: FastAPI Pydantic validators on all endpoints
- **CORS**: Explicit origin whitelist (no wildcards)
- **Encryption**: TLS in-transit, storage-level at-rest, field-level for GBV data
- **Security headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options

## Roadmap

The platform was built in 6 phases over 39 requirements. All phases are complete as of February 2026.

### Phase 1: Foundation and Security
- Multi-tenant architecture
- POPIA compliance (consent, data rights, audit logging)
- Authentication with JWT and RBAC
- Security middleware (rate limiting, input sanitization, CORS)

### Phase 2: Agentic AI System
- CrewAI manager agent with specialist routing
- Municipal services specialist agent
- GBV specialist agent with enhanced privacy
- Trilingual language detection (EN/ZU/AF)

### Phase 3: Citizen Reporting Channels
- WhatsApp bot via Twilio
- Web portal with photo uploads
- GPS geolocation with manual fallback
- Proof of residence verification (OCR)
- GBV reporting with SAPS routing

### Phase 4: Ticket Management and Routing
- PostGIS geospatial routing
- SLA tracking and automated escalation
- Celery background tasks
- WhatsApp status notifications
- GBV data firewall at all layers

### Phase 5: Municipal Operations Dashboard
- Real-time ticket management dashboard
- SLA compliance metrics and team workload charts
- Ward councillor role with ward filtering
- CSV/Excel export
- Supabase Realtime WebSocket updates

### Phase 6: Public Transparency and Rollout
- Public dashboard with anonymized performance metrics
- Geographic heatmap with k-anonymity protection
- GBV data exclusion from public view
- Pilot municipality onboarding seed scripts

### Phase 6.1-6.6: Production Enhancements (Post-Completion)
- Supabase migration (database, auth, storage, realtime)
- Dashboard separation (two independent React apps)
- UX redesign with shared design system
- Complete UI redesign (pink/rose theme, glassmorphism, Johannesburg skyline)
- Citizen authentication and profile management
- Comprehensive E2E test suite with Playwright (134 tests)

## Contributing

Contributions are welcome. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature-name`)
3. Write tests for new functionality
4. Ensure all tests pass (`pytest` and `npx playwright test`)
5. Follow existing code style (PEP 8 for Python, ESLint config for TypeScript)
6. Submit a pull request with clear description of changes

### Code of Conduct

This project serves municipalities and citizens. All contributions must:
- Prioritize user privacy and data security
- Maintain POPIA compliance
- Preserve SEC-05 GBV firewall integrity
- Support trilingual accessibility (EN/ZU/AF)

## License

This project is licensed under the MIT License. See LICENSE file for details.

---

**Built for SALGA (South African Local Government Association)**

For questions or support, please open an issue on GitHub.
