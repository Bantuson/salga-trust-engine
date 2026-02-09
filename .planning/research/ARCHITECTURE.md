# Architecture Research

**Domain:** AI-Powered Municipal Service Management Platform
**Researched:** 2026-02-09
**Confidence:** MEDIUM-HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   WhatsApp   │  │ Manager Web  │  │   Public     │  │Field Worker  │   │
│  │   (Twilio)   │  │  Dashboard   │  │  Dashboard   │  │    Mobile    │   │
│  │              │  │   (React)    │  │   (React)    │  │   (React)    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                  │                 │            │
├─────────┼─────────────────┼──────────────────┼─────────────────┼────────────┤
│         │                 │                  │                 │            │
│         │                 └──────────┬───────┴─────────────────┘            │
│         │                            │                                      │
│         │                      ┌─────▼─────┐                                │
│         │                      │  Nginx /  │                                │
│         │                      │API Gateway│                                │
│         │                      └─────┬─────┘                                │
│         │                            │                                      │
├─────────┼────────────────────────────┼──────────────────────────────────────┤
│                        APPLICATION LAYER                                     │
├─────────┼────────────────────────────┼──────────────────────────────────────┤
│         │                            │                                      │
│  ┌──────▼───────┐         ┌─────────▼──────────┐                           │
│  │  Webhook     │         │   FastAPI Backend  │                           │
│  │  Receiver    │         │    (Multi-tenant)  │                           │
│  │  Service     │         │                    │                           │
│  └──────┬───────┘         │  ┌──────────────┐  │                           │
│         │                 │  │Auth/Tenancy  │  │                           │
│         │                 │  │   Middleware │  │                           │
│         │                 │  └──────┬───────┘  │                           │
│         │                 │         │          │                           │
│         │                 │  ┌──────▼───────┐  │                           │
│         │                 │  │  Ticket API  │  │                           │
│         │                 │  └──────────────┘  │                           │
│         │                 │                    │                           │
│         │                 │  ┌──────────────┐  │                           │
│         │                 │  │Dashboard API │  │                           │
│         │                 │  └──────────────┘  │                           │
│         │                 │                    │                           │
│         │                 │  ┌──────────────┐  │                           │
│         │                 │  │Analytics API │  │                           │
│         │                 │  └──────────────┘  │                           │
│         │                 └────────────────────┘                           │
│         │                            │                                      │
│         │         ┌──────────────────┼──────────────────┐                   │
│         │         │                  │                  │                   │
│  ┌──────▼─────────▼──┐      ┌────────▼────────┐  ┌──────▼───────┐         │
│  │  Message Queue    │      │  AI Pipeline    │  │ Geospatial   │         │
│  │  (Redis + Celery) │      │     Worker      │  │    Router    │         │
│  │                   │      │                 │  │              │         │
│  │ ┌───────────────┐ │      │ ┌─────────────┐ │  │ ┌──────────┐ │         │
│  │ │ WhatsApp Msg  │ │      │ │NLP Classifier│ │  │ │PostGIS   │ │         │
│  │ │    Queue      │ │      │ │(spaCy/LLM)  │ │  │ │ Engine   │ │         │
│  │ └───────────────┘ │      │ └─────────────┘ │  │ └──────────┘ │         │
│  │                   │      │                 │  │              │         │
│  │ ┌───────────────┐ │      │ ┌─────────────┐ │  │ ┌──────────┐ │         │
│  │ │Notification   │ │      │ │Translation  │ │  │ │Routing   │ │         │
│  │ │    Queue      │ │      │ │Engine       │ │  │ │Logic     │ │         │
│  │ └───────────────┘ │      │ └─────────────┘ │  │ └──────────┘ │         │
│  │                   │      │                 │  │              │         │
│  │ ┌───────────────┐ │      │ ┌─────────────┐ │  └──────────────┘         │
│  │ │Analytics      │ │      │ │Sentiment    │ │                           │
│  │ │    Queue      │ │      │ │Analysis     │ │                           │
│  │ └───────────────┘ │      │ └─────────────┘ │                           │
│  └───────────────────┘      └─────────────────┘                           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                          DATA LAYER                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐   │
│  │  PostgreSQL + PostGIS│  │   Redis Cache       │  │  S3/Object Store │   │
│  │                      │  │                     │  │                  │   │
│  │ ┌─────────────────┐  │  │ ┌─────────────────┐ │  │ ┌──────────────┐ │   │
│  │ │ Multi-tenant    │  │  │ │Session Data     │ │  │ │Attachments   │ │   │
│  │ │ Shared Schema   │  │  │ └─────────────────┘ │  │ │(Images)      │ │   │
│  │ │ (tenant_id col) │  │  │                     │  │ └──────────────┘ │   │
│  │ └─────────────────┘  │  │ ┌─────────────────┐ │  │                  │   │
│  │                      │  │ │WebSocket State  │ │  │ ┌──────────────┐ │   │
│  │ ┌─────────────────┐  │  │ └─────────────────┘ │  │ │Reports       │ │   │
│  │ │ Geospatial      │  │  │                     │  │ │(PDFs)        │ │   │
│  │ │ Indexes         │  │  │ ┌─────────────────┐ │  │ └──────────────┘ │   │
│  │ │ (PostGIS)       │  │  │ │Rate Limit       │ │  │                  │   │
│  │ └─────────────────┘  │  │ │Tracking         │ │  └──────────────────┘   │
│  │                      │  │ └─────────────────┘ │                         │
│  └─────────────────────┘  └─────────────────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Webhook Receiver** | Receives Twilio WhatsApp webhooks, validates signatures, enqueues messages | FastAPI endpoint with signature validation, pushes to Redis queue |
| **Message Queue** | Asynchronous task processing, decouples webhook receiver from processing | Redis as broker + Celery workers for task execution |
| **AI Pipeline Worker** | NLP classification (water/roads/electricity), language detection/translation, sentiment analysis | Celery worker with spaCy/transformers or LLM API calls |
| **Geospatial Router** | Maps reported locations to municipal jurisdictions, assigns to appropriate field team | PostGIS proximity queries, polygon containment checks |
| **Ticket API** | CRUD operations for service requests, status updates, assignment logic | FastAPI with SQLAlchemy ORM, tenant-scoped queries |
| **Dashboard API** | Aggregated metrics, real-time updates via WebSocket, public transparency data | FastAPI with Redis pub/sub for real-time, materialized views for analytics |
| **API Gateway** | SSL termination, rate limiting, request routing, authentication | Nginx or cloud API gateway (AWS API Gateway, Cloudflare) |
| **Multi-tenant Database** | Stores all ticket, user, municipality data with tenant isolation | PostgreSQL with tenant_id column in shared schema (simplest for 3-5 municipalities) |

## Recommended Project Structure

```
salga-trust-engine/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app initialization
│   │   ├── config.py                # Environment config, secrets
│   │   ├── middleware/
│   │   │   ├── auth.py              # JWT verification
│   │   │   └── tenancy.py           # Tenant context injection
│   │   ├── models/
│   │   │   ├── base.py              # SQLAlchemy base with tenant_id mixin
│   │   │   ├── ticket.py
│   │   │   ├── municipality.py
│   │   │   └── user.py
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── webhooks.py      # Twilio webhook endpoints
│   │   │   │   ├── tickets.py
│   │   │   │   ├── dashboard.py
│   │   │   │   ├── analytics.py
│   │   │   │   └── auth.py
│   │   ├── services/
│   │   │   ├── whatsapp.py          # Twilio API wrapper
│   │   │   ├── geospatial.py        # PostGIS routing logic
│   │   │   ├── ai_pipeline.py       # NLP orchestration
│   │   │   └── notification.py      # Multi-channel notifications
│   │   ├── tasks/                    # Celery tasks
│   │   │   ├── message_processing.py
│   │   │   ├── ai_classification.py
│   │   │   ├── notifications.py
│   │   │   └── analytics.py
│   │   ├── db/
│   │   │   ├── session.py           # Database connection
│   │   │   └── migrations/          # Alembic migrations
│   │   ├── schemas/                  # Pydantic models
│   │   │   ├── ticket.py
│   │   │   └── dashboard.py
│   │   └── utils/
│   │       ├── tenancy.py           # Tenant scoping utilities
│   │       └── validation.py
│   ├── tests/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
├── worker/                           # Celery worker container
│   ├── celeryconfig.py
│   └── Dockerfile
├── frontend/
│   ├── manager-dashboard/           # React app for managers
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   │   └── useWebSocket.ts  # Real-time updates
│   │   │   ├── services/
│   │   │   │   └── api.ts           # API client
│   │   │   └── store/               # State management
│   │   └── package.json
│   ├── public-dashboard/            # React app for public transparency
│   └── mobile-app/                  # React Native (future)
├── infrastructure/
│   ├── docker-compose.yml           # Local development
│   ├── nginx/
│   │   └── nginx.conf
│   └── k8s/                         # Kubernetes manifests (future)
└── docs/
```

### Structure Rationale

- **Multi-tenant middleware at API layer:** Tenant context injected early in request lifecycle, all downstream queries automatically scoped
- **Separate worker container:** Isolates long-running AI tasks from API responsiveness, scales independently
- **Service layer pattern:** Business logic separated from API endpoints, reusable across HTTP and Celery tasks
- **Shared schema with tenant_id:** Simplest multi-tenancy approach for 3-5 municipalities, avoids schema migration complexity
- **PostGIS in same database:** Eliminates network hops for geospatial queries, leverages PostgreSQL's ACID guarantees

## Architectural Patterns

### Pattern 1: Event-Driven Webhook Processing

**What:** Twilio webhooks are received, validated, and immediately enqueued to Redis; actual processing happens asynchronously in Celery workers.

**When to use:** Essential for WhatsApp integration. Twilio requires webhook responses within 5 seconds, but AI classification can take 2-10 seconds.

**Trade-offs:**
- **Pros:** Decouples webhook reliability from AI processing speed, allows horizontal scaling of workers, retry logic for failed tasks
- **Cons:** Eventual consistency (message received but not processed yet), requires monitoring queue depth

**Example:**
```python
# backend/app/api/v1/webhooks.py
from fastapi import APIRouter, Request, HTTPException
from app.tasks.message_processing import process_whatsapp_message
from twilio.request_validator import RequestValidator

router = APIRouter()

@router.post("/twilio/whatsapp")
async def receive_whatsapp_message(request: Request):
    # Validate Twilio signature
    validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)
    signature = request.headers.get("X-Twilio-Signature")
    url = str(request.url)
    form_data = await request.form()

    if not validator.validate(url, dict(form_data), signature):
        raise HTTPException(status_code=403, detail="Invalid signature")

    # Immediately enqueue for async processing
    process_whatsapp_message.delay(
        from_number=form_data.get("From"),
        body=form_data.get("Body"),
        media_url=form_data.get("MediaUrl0"),
        timestamp=form_data.get("Timestamp")
    )

    # Respond quickly to Twilio (< 5 seconds)
    return {"status": "queued"}

# backend/app/tasks/message_processing.py
from celery import shared_task
from app.services.ai_pipeline import classify_issue
from app.services.geospatial import route_to_municipality

@shared_task(bind=True, max_retries=3)
def process_whatsapp_message(self, from_number, body, media_url, timestamp):
    try:
        # This can take 5-15 seconds
        classification = classify_issue(body)
        municipality = route_to_municipality(from_number, classification.location)

        # Create ticket in database
        create_ticket(
            tenant_id=municipality.id,
            category=classification.category,
            description=body,
            citizen_phone=from_number
        )
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)  # Retry after 1 minute
```

### Pattern 2: Multi-Tenant Row-Level Isolation

**What:** Single shared database schema with `tenant_id` column on all tenant-scoped tables. Middleware automatically filters queries.

**When to use:** Early-stage SaaS (< 10 tenants), when tenant schemas are identical, when operational simplicity is priority.

**Trade-offs:**
- **Pros:** Single schema migration path, simple backups, lowest cost, easy cross-tenant analytics
- **Cons:** Risk of tenant data leakage if filtering fails, no per-tenant schema customization, all tenants share database resources

**Example:**
```python
# backend/app/models/base.py
from sqlalchemy import Column, Integer
from sqlalchemy.ext.declarative import declared_attr

class TenantMixin:
    @declared_attr
    def tenant_id(cls):
        return Column(Integer, nullable=False, index=True)

# backend/app/models/ticket.py
from app.models.base import Base, TenantMixin

class Ticket(Base, TenantMixin):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True)
    category = Column(String(50))
    description = Column(Text)
    # tenant_id automatically included via mixin

# backend/app/middleware/tenancy.py
from fastapi import Request
from sqlalchemy.orm import Session

async def inject_tenant_context(request: Request, call_next):
    # Extract tenant from JWT, subdomain, or API key
    tenant_id = extract_tenant_from_auth(request)
    request.state.tenant_id = tenant_id

    response = await call_next(request)
    return response

# backend/app/db/session.py
from sqlalchemy.orm import Session as SQLSession

class TenantScopedSession(SQLSession):
    def __init__(self, tenant_id: int, **kwargs):
        super().__init__(**kwargs)
        self.tenant_id = tenant_id

    def query(self, *entities, **kwargs):
        query = super().query(*entities, **kwargs)
        # Automatically add tenant filter
        for entity in entities:
            if hasattr(entity, 'tenant_id'):
                query = query.filter(entity.tenant_id == self.tenant_id)
        return query
```

### Pattern 3: Geospatial Routing with PostGIS

**What:** Use PostGIS polygon containment to map citizen-reported GPS coordinates or inferred locations to municipal jurisdictions.

**When to use:** When service areas are defined by geographic boundaries (municipalities), when routing needs sub-second latency.

**Trade-offs:**
- **Pros:** Sub-100ms queries, handles complex boundaries, supports proximity-based assignment (nearest team)
- **Cons:** Requires accurate GIS boundary data, learning curve for spatial SQL

**Example:**
```python
# backend/app/services/geospatial.py
from geoalchemy2 import Geometry
from sqlalchemy import func
from app.models.municipality import Municipality

def route_to_municipality(latitude: float, longitude: float) -> Municipality:
    point = f"SRID=4326;POINT({longitude} {latitude})"

    # Find municipality whose boundary contains this point
    municipality = db.query(Municipality).filter(
        func.ST_Contains(
            Municipality.boundary,  # PostGIS geometry column
            func.ST_GeomFromText(point)
        )
    ).first()

    if not municipality:
        # Fallback: find nearest municipality (within 50km)
        municipality = db.query(Municipality).order_by(
            func.ST_Distance(
                Municipality.boundary,
                func.ST_GeomFromText(point)
            )
        ).first()

    return municipality

# Migration to add geospatial support
"""
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column to municipalities table
ALTER TABLE municipalities
ADD COLUMN boundary geometry(POLYGON, 4326);

-- Create spatial index
CREATE INDEX idx_municipality_boundary
ON municipalities USING GIST(boundary);
"""
```

### Pattern 4: Real-Time Dashboard Updates via WebSocket + Redis Pub/Sub

**What:** When ticket status changes, publish event to Redis; WebSocket server subscribes and pushes update to connected dashboard clients.

**When to use:** When dashboard needs sub-second updates, when multiple users watch same data, when updates come from background workers.

**Trade-offs:**
- **Pros:** Instant updates without polling, scales to many concurrent watchers, works across multiple backend servers
- **Cons:** Adds complexity (WebSocket lifecycle management), requires Redis pub/sub, increases server resource usage

**Example:**
```python
# backend/app/services/notification.py
import redis
import json

redis_client = redis.Redis.from_url(settings.REDIS_URL)

def publish_ticket_update(tenant_id: int, ticket_id: int, status: str):
    """Called when ticket status changes (API or worker)"""
    channel = f"tenant:{tenant_id}:tickets"
    message = json.dumps({
        "type": "ticket_update",
        "ticket_id": ticket_id,
        "status": status,
        "timestamp": datetime.utcnow().isoformat()
    })
    redis_client.publish(channel, message)

# backend/app/api/v1/websocket.py
from fastapi import WebSocket
import asyncio

@router.websocket("/ws/dashboard")
async def dashboard_websocket(websocket: WebSocket, tenant_id: int):
    await websocket.accept()

    # Subscribe to Redis pub/sub
    pubsub = redis_client.pubsub()
    channel = f"tenant:{tenant_id}:tickets"
    pubsub.subscribe(channel)

    try:
        for message in pubsub.listen():
            if message['type'] == 'message':
                # Forward Redis message to WebSocket client
                await websocket.send_text(message['data'])
    except WebSocketDisconnect:
        pubsub.unsubscribe(channel)
```

## Data Flow

### Request Flow: WhatsApp Message to Ticket Creation

```
[Citizen] sends WhatsApp message
    ↓
[Twilio] receives message, calls webhook
    ↓
[Webhook Receiver] validates signature, enqueues to Redis (< 5s response)
    ↓
[Celery Worker] picks up task from queue
    ↓
[AI Pipeline] classifies category, detects language, extracts location
    ↓
[Geospatial Router] maps location to municipality
    ↓
[Ticket Service] creates ticket in PostgreSQL (tenant-scoped)
    ↓
[Notification Service] publishes to Redis pub/sub
    ↓
[WebSocket Server] pushes update to connected dashboard clients
    ↓
[Manager Dashboard] displays new ticket in real-time
```

### State Management: Dashboard Real-Time Updates

```
[Backend Event] (ticket status change)
    ↓
[Redis Pub/Sub] publish to tenant-specific channel
    ↓ (subscribe)
[WebSocket Server] listens to Redis channel
    ↓ (push)
[React Dashboard] receives WebSocket message
    ↓
[State Management] updates local state (Zustand/Recoil)
    ↓
[React Components] re-render with new data
```

### Key Data Flows

1. **Inbound Message Flow:** Twilio → Webhook (validate) → Redis Queue → Celery Worker → AI Pipeline → Database
2. **Outbound Notification Flow:** Ticket Update → Redis Pub/Sub → WebSocket → Dashboard Client
3. **Geospatial Routing Flow:** GPS Coordinates → PostGIS Query → Municipality Match → Ticket Assignment
4. **Multi-Tenant Query Flow:** API Request → Auth Middleware (extract tenant_id) → Tenant-Scoped Session → Filtered Query

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **3-5 municipalities (MVP)** | Single server deployment, shared schema multi-tenancy, 2-4 Celery workers, Redis on same server, Nginx as reverse proxy. Total cost: ~$50-100/month (single VPS) |
| **10-20 municipalities** | Separate API and worker containers, managed PostgreSQL (RDS/Cloud SQL), Redis cluster, CDN for dashboard assets. Add monitoring (Sentry, Prometheus). Total cost: ~$300-500/month |
| **50+ municipalities** | Kubernetes deployment, auto-scaling workers based on queue depth, read replicas for analytics queries, separate databases for hot/cold data. Consider schema-per-tenant or database-per-tenant for large municipalities. Total cost: $1000+/month |

### Scaling Priorities

1. **First bottleneck: AI Pipeline Workers** - Classification can take 2-10 seconds per message. During service outages (water main break), expect 100s of messages simultaneously. Scale Celery workers horizontally (10-20 workers). Add worker monitoring for queue depth alerts.

2. **Second bottleneck: PostgreSQL Write Throughput** - Ticket creation, status updates, analytics queries compete for locks. Solutions: (a) Use connection pooling (PgBouncer), (b) Offload analytics to read replica, (c) Use materialized views for dashboard aggregations, refreshed every 5 minutes.

3. **Third bottleneck: WebSocket Connections** - 50 municipalities × 20 concurrent users = 1000 concurrent WebSocket connections. Solutions: (a) Use Redis pub/sub to sync across multiple WebSocket servers, (b) Implement connection pooling with heartbeat, (c) Consider Server-Sent Events (SSE) for one-way updates.

## Anti-Patterns

### Anti-Pattern 1: Synchronous AI Processing in Webhook Handler

**What people do:** Call OpenAI/spaCy directly in the webhook endpoint, waiting for classification before responding to Twilio.

**Why it's wrong:** Twilio times out webhooks after 15 seconds (often sooner). LLM API calls can take 5-20 seconds. If webhook times out, Twilio retries, causing duplicate tickets.

**Do this instead:** Immediately enqueue to Celery, respond to Twilio within 1-2 seconds. Use idempotency keys (Twilio's `MessageSid`) to deduplicate retries.

### Anti-Pattern 2: Per-Request Database Connections Without Pooling

**What people do:** Create new database connection for each API request, especially in FastAPI async handlers.

**Why it's wrong:** PostgreSQL connection setup takes 50-100ms. Under load (100 req/s), database runs out of connections (default max: 100). Performance degrades catastrophically.

**Do this instead:** Use connection pooling (SQLAlchemy's QueuePool or PgBouncer). For async FastAPI, use `databases` library or SQLAlchemy 2.0 async sessions. Max pool size = 20-30 connections.

### Anti-Pattern 3: Polling Dashboard for Updates Every 5 Seconds

**What people do:** React dashboard sets `setInterval` to re-fetch ticket list every 5 seconds.

**Why it's wrong:** 50 users × 12 requests/minute = 600 req/min = wasted API calls, database queries, and bandwidth. 99% of requests return no changes.

**Do this instead:** Use WebSockets or Server-Sent Events (SSE) for real-time updates. Only fetch on page load. SSE is simpler than WebSocket for one-way updates (server → client).

### Anti-Pattern 4: Storing WhatsApp Media (Images) in PostgreSQL

**What people do:** Store base64-encoded images in `bytea` column.

**Why it's wrong:** PostgreSQL is optimized for structured data, not blobs. Large rows slow down table scans, bloat backups, and limit scalability. A single 5MB image in a table prevents efficient caching.

**Do this instead:** Store media URLs in PostgreSQL, actual files in S3/Cloudflare R2/Azure Blob. Twilio provides `MediaUrl` that expires after 30 days—download and re-upload to your object storage within 24 hours.

### Anti-Pattern 5: Global Tenant Context via Thread-Local Storage

**What people do:** Store `tenant_id` in Flask's `g` or thread-local variable, assuming single-threaded request handling.

**Why it's wrong:** FastAPI is async. Multiple requests share the same thread. Thread-local storage leaks tenant context across requests, causing catastrophic data leakage.

**Do this instead:** Use FastAPI's `request.state` or dependency injection to pass tenant context. For SQLAlchemy sessions, use context-aware session factories or explicit `tenant_id` parameters.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Twilio WhatsApp API** | Webhook receiver + REST API client | Validate signatures using `twilio.request_validator`. Store webhook URL in Twilio console. Use Twilio SDK for sending messages. Rate limit: 80 msg/second per number. |
| **OpenAI/LLM API** | REST API with retry logic | Implement exponential backoff (tenacity library). Use streaming for long responses. Budget: $0.002/message (GPT-4o-mini). Consider caching common classifications. |
| **PostGIS** | Direct database queries via GeoAlchemy2 | Load municipality boundaries from GeoJSON/Shapefile. Use SRID 4326 (WGS84) for GPS coordinates. Index all geometry columns with GIST indexes. |
| **SMS/Email Providers** | Queue-based async sending | Use Celery tasks for all notifications. Implement retry logic. Track delivery status. Consider Twilio SendGrid (email), Africa's Talking (SMS). |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **API ↔ Celery Workers** | Redis queue (async) | Workers pull tasks from Redis. API never calls workers synchronously. Use result backend to check task status. |
| **API ↔ Database** | SQLAlchemy ORM (sync/async) | Use async sessions for I/O-bound operations. Prefer bulk operations (bulk_insert_mappings). Enable query logging in dev. |
| **WebSocket Server ↔ Redis Pub/Sub** | Redis channels | Namespace channels by tenant (`tenant:{id}:tickets`). Use pattern subscriptions cautiously (performance). |
| **Dashboard ↔ API** | REST + WebSocket | REST for CRUD, WebSocket for real-time updates. Use JWT for auth. Implement token refresh. |
| **Worker ↔ External APIs** | REST with circuit breaker | Use `tenacity` for retries, `circuitbreaker` library to prevent cascading failures. Timeout: 30 seconds for LLM calls. |

## Build Order Implications

### Phase 1: Foundation (Week 1-2)
**Build first:**
1. PostgreSQL + PostGIS setup
2. FastAPI scaffolding with tenant middleware
3. Basic Ticket CRUD API (no AI, no WhatsApp)
4. Manager dashboard (basic React app, no real-time)

**Why:** Establishes data model, tenant scoping, and API patterns. Testable without external dependencies.

### Phase 2: WhatsApp Integration (Week 3)
**Build next:**
5. Twilio webhook receiver
6. Redis + Celery worker setup
7. Simple message queueing (no AI classification yet)

**Dependencies:** Requires Phase 1 Ticket API to store messages. Test with Twilio Sandbox before production WhatsApp number.

### Phase 3: AI Pipeline (Week 4)
**Build next:**
8. AI classification worker (category detection)
9. Language detection and translation
10. Geospatial routing (PostGIS queries)

**Dependencies:** Requires Phase 2 message queue. AI worker consumes messages and creates tickets.

### Phase 4: Real-Time Updates (Week 5)
**Build next:**
11. Redis pub/sub setup
12. WebSocket endpoint
13. Dashboard real-time updates

**Dependencies:** Requires Phase 1 dashboard. Enhances UX but not blocking for core functionality.

### Phase 5: Public Dashboard & Analytics (Week 6+)
**Build last:**
14. Public-facing analytics API
15. Transparency dashboard (React)
16. Reporting and exports

**Dependencies:** Requires sufficient ticket data. Can be deferred to v2.

## Sources

**Multi-Tenancy & SaaS Architecture:**
- [Microsoft Learn: Multitenant SaaS Patterns - Azure SQL Database](https://learn.microsoft.com/en-us/azure/azure-sql/database/saas-tenancy-app-design-patterns?view=azuresql)
- [ClickIT Tech: Designing Multi-tenant SaaS Architecture on AWS (2026)](https://www.clickittech.com/software-development/multi-tenant-architecture/)
- [Bytebase: Multi-Tenant Database Architecture Patterns Explained](https://www.bytebase.com/blog/multi-tenant-database-architecture-patterns-explained/)

**WhatsApp & Webhook Architecture:**
- [Twilio Docs: Overview of the WhatsApp Business Platform](https://www.twilio.com/docs/whatsapp/api)
- [Twilio Docs: Messaging Webhooks](https://www.twilio.com/docs/usage/webhooks/messaging-webhooks)
- [AWS Blog: Best practices for building high-performance WhatsApp AI assistant using AWS](https://aws.amazon.com/blogs/messaging-and-targeting/best-practices-for-building-high-performance-whatsapp-ai-assistant-using-aws/)
- [GeeksforGeeks: System Design - Designing WhatsApp Messenger](https://www.geeksforgeeks.org/system-design/designing-whatsapp-messenger-system-design/)

**Event-Driven Architecture & Reliability:**
- [Apidog: Comprehensive Guide to Webhooks and Event-Driven Architecture](https://apidog.com/blog/comprehensive-guide-to-webhooks-and-eda/)
- [System Design Handbook: Design a Webhook System](https://www.systemdesignhandbook.com/guides/design-a-webhook-system/)
- [Dataconomy: Reliability Classes For Event-driven Platforms (2026)](https://dataconomy.com/2026/01/09/reliability-classes-for-event-driven-platforms-lessons-from-billing-retail-and-security-systems-at-scale/)

**FastAPI Microservices:**
- [Talent500: FastAPI for Microservices - High-Performance Python API Design Patterns](https://talent500.com/blog/fastapi-microservices-python-api-design-patterns-2025/)
- [Medium: Modern FastAPI Architecture Patterns for Scalable Production Systems](https://medium.com/algomart/modern-fastapi-architecture-patterns-for-scalable-production-systems-41a87b165a8b)

**Celery & Task Queues:**
- [Programming Helper: Celery 2026 - Python Distributed Task Queue, Redis, RabbitMQ](https://www.programming-helper.com/tech/celery-2026-python-distributed-task-queue-redis-rabbitmq)
- [Medium: Celery and Redis - Asynchronous Task Processing (Jan 2026)](https://medium.com/@jasidhassan/celery-and-redis-asynchronous-task-processing-a1ea58956f3e)
- [OneUpTime: Building Production-Ready Task Queues with Celery (2026)](https://fullstackinfra.substack.com/p/day-29-building-production-ready)

**Geospatial & PostGIS:**
- [PostGIS.net: Official Site](https://postgis.net/)
- [Medium: Optimizing Geospatial Data Storage with PostgreSQL and PostGIS](https://medium.com/@lfoster49203/optimizing-geospatial-data-storage-with-postgresql-and-postgis-dd6aee7df005)
- [GlobeNewswire: Geographic Information System (GIS) Market (2026-2031)](https://www.globenewswire.com/news-release/2026/01/21/3222564/28124/en/Geographic-Information-System-GIS-Market-Share-Analysis-Industry-Trends-Statistics-Growth-Forecasts-Worldwide-2026-2031.html)

**Real-Time Updates & WebSockets:**
- [GeeksforGeeks: Real-time Updates with WebSockets and React Hooks](https://www.geeksforgeeks.org/reactjs/real-time-updates-with-websockets-and-react-hooks/)
- [OneUpTime: How to Use WebSockets in React for Real-Time Applications (2026)](https://oneuptime.com/blog/post/2026-01-15-websockets-react-real-time-applications/view)
- [Medium: I Built a Real-Time Dashboard in React Using WebSockets and Recoil](https://medium.com/@connect.hashblock/i-built-a-real-time-dashboard-in-react-using-websockets-and-recoil-076d69b4eeff)

**Municipal 311 Systems:**
- [Open311: Open Standard for Civic Issue Tracking](https://www.open311.org/)
- [Open Knowledge Forums: A New Open Source 311 Service Request Management Solution](https://discuss.okfn.org/t/a-new-open-source-311-service-request-management-solution/11158)
- [Data-Smart City Solutions: Modernizing 311 in Los Angeles](https://datasmart.hks.harvard.edu/news/article/modernizing-311-in-los-angeles-959)

**AI Pipeline Architecture:**
- [Lindy AI: What is an AI Pipeline? (2026)](https://www.lindy.ai/blog/ai-pipeline)
- [Clarifai: Top LLMs and AI Trends for 2026](https://www.clarifai.com/blog/llms-and-ai-trends)
- [ResearchGate: From Data to Deployment - End-to-End AI Pipeline Architecture for Real-Time NLP](https://www.researchgate.net/publication/393092186_From_Data_to_Deployment_an_End-to-End_AI_Pipeline_Architecture_for_Real-Time_NLP_and_Computer_Vision_Systems)

---
*Architecture research for: SALGA Trust Engine - AI-Powered Municipal Service Management Platform*
*Researched: 2026-02-09*
