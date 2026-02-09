# Stack Research

**Domain:** AI-powered municipal service management platform (South Africa)
**Researched:** 2026-02-09
**Confidence:** MEDIUM-HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Python | 3.12+ | Runtime | Best AI/NLP ecosystem; team preference; all key libraries support 3.12 |
| FastAPI | 0.128.x | REST API framework | Async-native, auto-generated OpenAPI docs, WebSocket support, 200-300% faster dev than Flask; ideal for real-time ticket updates |
| PostgreSQL + PostGIS | 16+ / 3.4+ | Database + geospatial | Industry standard for GIS; sub-100ms polygon containment queries for routing tickets to municipal boundaries |
| Redis | 7.x | Message broker + cache | Dual-purpose broker/cache for Celery tasks and real-time pub/sub for dashboard updates |
| Celery | 5.6.x | Task queue | Production-proven distributed task queue; handles async AI classification, WhatsApp message processing, notification delivery |
| React | 18+ | Dashboard frontend | Standard for data-heavy dashboards; rich ecosystem for maps (Leaflet/Mapbox), charts, real-time updates via WebSocket |
| Twilio | 9.x (Python SDK) | WhatsApp Business API | Official Meta BSP; reliable message delivery; webhook-based architecture fits async pattern |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SQLAlchemy | 2.0+ | ORM | Database models, multi-tenant query scoping with `tenant_id` |
| GeoAlchemy2 | 0.18.x | PostGIS ORM extension | Geospatial queries — point-in-polygon for routing, distance calculations |
| Alembic | 1.13+ | Database migrations | Schema versioning; critical for multi-tenant shared-schema approach |
| spaCy | 3.8.x | NLP text classification | Issue categorization (water, roads, electricity); supports custom training for domain-specific models |
| Pydantic | 2.x | Data validation | Request/response validation (built into FastAPI); settings management |
| python-socketio | 5.x | WebSocket server | Real-time dashboard updates; pairs with Redis pub/sub for cross-worker broadcasting |
| Shapely | 2.x | Geometry operations | Municipal boundary calculations, GeoJSON processing |
| Leaflet.js | 1.9+ | Map rendering (frontend) | Lightweight open-source maps for heatmaps and issue plotting; no license fees unlike Mapbox |
| Vite | 5.x | Frontend build tool | Replaces deprecated create-react-app; fast HMR, optimized builds |
| httpx | 0.27+ | Async HTTP client | Twilio API calls, external service integration |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Docker + Docker Compose | Local dev environment | PostgreSQL+PostGIS, Redis, Celery workers in containers |
| pytest | Testing | Use `pytest-asyncio` for async FastAPI tests |
| Flower | Celery monitoring | Web UI for queue monitoring; critical for debugging message processing |
| pre-commit | Code quality | Black, ruff, mypy hooks |
| Alembic | Migration management | Auto-generate from SQLAlchemy models |

## Installation

```bash
# Core
pip install fastapi[all] uvicorn[standard] sqlalchemy[asyncio] geoalchemy2 alembic
pip install celery[redis] redis python-socketio
pip install twilio httpx

# AI/NLP
pip install spacy
python -m spacy download en_core_web_sm

# Geospatial
pip install shapely geopandas

# Dev dependencies
pip install pytest pytest-asyncio pytest-cov
pip install black ruff mypy pre-commit
pip install flower
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| FastAPI | Django + DRF | If you need built-in admin panel, ORM migrations are complex, or team has Django experience; Django is heavier but "batteries included" |
| Celery + Redis | ARQ (async Redis queue) | If you want a lighter alternative with native async; less ecosystem support but simpler for small deployments |
| spaCy | LangChain + OpenAI | If classification requires nuanced understanding beyond keyword patterns; higher per-message cost (~$0.002/msg) but more accurate for complex inputs |
| Leaflet.js | Mapbox GL JS | If you need vector tiles, 3D terrain, or premium map styles; requires paid license at scale |
| React | Next.js | If you need SSR for public dashboard SEO; adds complexity but better for public-facing pages |
| PostgreSQL | MongoDB | Never for this use case — geospatial queries, relational ticket data, and multi-tenant row isolation strongly favor PostgreSQL |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Flask | No async support, no auto-docs, slower development for API-heavy apps | FastAPI |
| create-react-app | Deprecated, unmaintained since 2023 | Vite |
| Django Channels (alone) | Overkill if not using Django; adds Django dependency weight | python-socketio with FastAPI |
| MongoDB | Poor fit for relational ticket data, multi-tenant isolation, and geospatial polygon queries | PostgreSQL + PostGIS |
| RabbitMQ | Adds operational complexity over Redis for this scale; Redis serves dual broker/cache role | Redis (dual-purpose) |
| Pandas for geospatial in API | Too heavy for request-time geo operations | GeoAlchemy2 + PostGIS (database-level) |

## Stack Patterns by Variant

**If multilingual NLP accuracy is critical (v1.5+):**
- Use Lelapa AI VulaVula API or Botlhale AI for isiZulu/Afrikaans NLP
- Because: spaCy lacks trained models for South African languages; these are purpose-built for SA context
- Fallback: keyword matching + rule-based routing for v1

**If public dashboard needs SEO:**
- Use Next.js for public transparency pages, React SPA for manager dashboard
- Because: SSR improves indexing for public accountability data

**If message volume exceeds 1M/month:**
- Split Redis into separate broker and cache instances
- Add PostgreSQL read replicas for dashboard queries
- Because: separation prevents queue processing from impacting dashboard performance

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| FastAPI 0.128.x | Python 3.9+ | Requires Pydantic 2.x |
| GeoAlchemy2 0.18.x | Python 3.10+, SQLAlchemy 2.0+ | Requires PostGIS 3.x |
| Celery 5.6.x | Python 3.9+, Redis 6+ | Use Redis as both broker and result backend |
| spaCy 3.8.x | Python 3.9-3.13 | Custom models need training pipeline |
| Twilio SDK 9.x | Python 3.8+ | WhatsApp Business API requires approved template messages |

## Sources

- PyPI (fastapi, celery, spacy, geoalchemy2, twilio) — version verification
- Twilio WhatsApp Business API docs — webhook patterns, message pricing
- PostGIS documentation — geospatial query patterns
- FastAPI official docs — WebSocket and async patterns
- Celery 5.6 release notes — Python 3.13 support, memory leak fixes
- React + Python backend best practices 2025/2026 — Vite, API-first architecture

---
*Stack research for: AI-powered municipal service management platform*
*Researched: 2026-02-09*
