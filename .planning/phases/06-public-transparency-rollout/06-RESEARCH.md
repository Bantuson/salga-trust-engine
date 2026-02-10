# Phase 6: Public Transparency & Rollout - Research

**Researched:** 2026-02-10
**Domain:** Public-facing dashboard with geographic heatmaps, multi-municipality aggregation, and pilot onboarding
**Confidence:** HIGH

## Summary

Phase 6 implements a public transparency dashboard accessible without login, displaying aggregated municipal performance metrics (response times, resolution rates, geographic heatmaps) while rigorously excluding all GBV/sensitive data. The phase also includes onboarding workflows for 3-5 pilot municipalities and comprehensive test suite validation across all 6 phases.

Critical findings: (1) **Leaflet.heat** is the standard for React geographic heatmaps, handling 10K+ points efficiently via grid-based clustering, integrated via **react-leaflet v5** (not v4, which is deprecated); (2) FastAPI public endpoints use `auto_error=False` in OAuth2PasswordBearer dependency to make authentication optional, with explicit RBAC checks skipped for public routes; (3) PostgreSQL aggregation queries must filter `is_sensitive = false` at the SQL WHERE clause level (not application layer) to guarantee GBV data exclusion—this pattern already established in Phase 5's DashboardService; (4) Multi-municipality aggregation requires cross-tenant queries (violating RLS) so public dashboard endpoints must use superuser database connection or disable RLS for specific queries; (5) Municipality onboarding is operational workflow (data seeding, not new code)—Phase 6 focuses on documentation, seed scripts, and verification checklists; (6) Test coverage uses pytest-cov with `--cov-report` flags, existing infrastructure at 310 tests passing provides solid foundation.

**Primary recommendation:** Create parallel public dashboard API endpoints (`/api/v1/public/*`) that aggregate across all municipalities with mandatory `is_sensitive = false` filters, use dedicated read-only database connection to bypass RLS for cross-tenant aggregation, implement Leaflet.heat heatmap with react-leaflet v5 for geographic visualization, build municipality onboarding as documented workflow with seed scripts (not application feature), and run full regression test suite with coverage verification to ensure no Phase 1-5 regressions.

## Standard Stack

### Core Libraries (Already in Stack from Phase 5)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2+ | Frontend framework | Already in stack, Phase 5 dashboard uses React 19 |
| react-leaflet | 5.0+ | React wrapper for Leaflet maps | Latest version (v5), v4 deprecated, React 19 compatible |
| Leaflet | 1.9+ | Interactive map library | Industry standard for web maps, 40K+ stars, OpenStreetMap integration |
| Leaflet.heat | 0.2+ | Heatmap plugin for Leaflet | Official Leaflet plugin, grid-based clustering, handles 10K+ points |
| Recharts | 2.15+ | React charting (trend lines) | Already in stack from Phase 5, used for resolution rate trends |
| FastAPI | 0.128+ | Backend API framework | Already in stack, async support, dependency injection |

### New Libraries for Phase 6

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-leaflet-heatmap-layer-v3 | 1.0+ | React wrapper for Leaflet.heat | Simplest integration for react-leaflet v5, provides `<HeatmapLayer />` component |
| leaflet.heat | 0.2+ | Leaflet heatmap plugin | Underlying library for react-leaflet-heatmap-layer-v3, tiny (3KB) and fast |

### Supporting Libraries (Optional)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-leaflet-markercluster | 3.0+ | Marker clustering for dense points | If heatmap not sufficient, cluster individual markers (alternative visualization) |
| date-fns | 4.1+ | Date formatting for trends | Already in stack from Phase 5, use for time-series data formatting |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Leaflet | Mapbox GL JS | Mapbox requires API key and billing, Leaflet free and open-source with OpenStreetMap |
| Leaflet.heat | Deck.gl HeatmapLayer | Deck.gl more powerful but heavier (400KB vs 3KB), overkill for municipal heatmaps |
| react-leaflet | Google Maps React | Google Maps requires API key and billing, Leaflet free with better OpenStreetMap support |
| Public API endpoints | Single dashboard with role check | Mixing public/private endpoints risks accidental data leakage, separate routes clearer |

**Installation:**

```bash
# Frontend (React public dashboard)
cd frontend
npm install react-leaflet@5 leaflet@1.9 react-leaflet-heatmap-layer-v3@1 leaflet.heat@0.2

# Backend (no new dependencies required)
# All dependencies already installed in Phase 1-5
```

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── pages/
│   ├── PublicDashboardPage.tsx      # NEW: Public dashboard landing page
│   ├── PublicHeatmapPage.tsx        # NEW: Geographic heatmap view
│   └── DashboardPage.tsx            # EXISTING: Authenticated manager dashboard
├── components/
│   ├── public/
│   │   ├── MunicipalitySelector.tsx # NEW: Dropdown to filter by municipality
│   │   ├── ResponseTimeChart.tsx    # NEW: Avg response time per municipality
│   │   ├── ResolutionRateChart.tsx  # NEW: Resolution rate trends
│   │   ├── HeatmapViewer.tsx        # NEW: Leaflet heatmap component
│   │   └── PublicMetricsCards.tsx   # NEW: Summary cards (excludes sensitive data)
│   └── dashboard/                   # EXISTING: Authenticated dashboard components
├── services/
│   └── publicApi.ts                 # NEW: API client for public endpoints (no auth)
└── types/
    └── public.ts                    # NEW: TypeScript types for public metrics

src/api/v1/
├── public.py                        # NEW: Public dashboard API endpoints
├── dashboard.py                     # EXISTING: Authenticated dashboard endpoints
└── __init__.py                      # UPDATE: Register public router

src/services/
├── public_metrics_service.py        # NEW: Cross-tenant aggregation service
└── dashboard_service.py             # EXISTING: Single-tenant metrics (Phase 5)

tests/
├── test_public_api.py               # NEW: Public endpoints tests
├── test_public_metrics_service.py   # NEW: Cross-tenant aggregation tests
└── test_gbv_firewall_public.py      # NEW: Verify GBV exclusion on public endpoints

scripts/
└── seed_pilot_municipalities.py     # NEW: Onboarding seed script for pilot municipalities
```

### Pattern 1: Public API Endpoints Without Authentication

**What:** FastAPI endpoints accessible without JWT token, using dedicated `/api/v1/public/*` routes.

**When to use:** Public dashboard metrics (TRNS-04) that must be accessible to all citizens.

**Example:**

```python
# Source: FastAPI Security First Steps, FastAPI CORS Configuration
# https://fastapi.tiangolo.com/tutorial/security/first-steps/
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps import get_db  # No get_current_user dependency
from src.services.public_metrics_service import PublicMetricsService

router = APIRouter(prefix="/public", tags=["public"])

@router.get("/municipalities")
async def get_municipalities(
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get list of active municipalities (public access).

    No authentication required (TRNS-04).
    Returns only basic info (name, code, province).
    """
    service = PublicMetricsService()
    municipalities = await service.get_active_municipalities(db)
    return municipalities

@router.get("/metrics/{municipality_id}")
async def get_public_metrics(
    municipality_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get aggregated public metrics for municipality.

    Returns:
        - avg_response_hours: Average response time (TRNS-01)
        - resolution_rate: % tickets resolved (TRNS-02)
        - total_tickets: Total non-sensitive tickets
        - sensitive_tickets_count: Aggregated count only (TRNS-05)

    GBV/sensitive data NEVER included in response (SEC-05, TRNS-05).
    """
    service = PublicMetricsService()

    # All queries filter is_sensitive = false at SQL level
    metrics = await service.get_public_metrics(
        municipality_id=municipality_id,
        db=db
    )

    return metrics

@router.get("/heatmap")
async def get_heatmap_data(
    municipality_id: str | None = Query(None, description="Optional municipality filter"),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get geographic heatmap data for reported issues (TRNS-03).

    Returns list of {"lat": float, "lng": float, "intensity": int}.
    Excludes all GBV/sensitive tickets (TRNS-05).
    Aggregates by grid cell to anonymize exact locations.
    """
    service = PublicMetricsService()

    # Returns aggregated grid cells, not exact ticket locations
    heatmap_data = await service.get_heatmap_data(
        municipality_id=municipality_id,
        db=db
    )

    return heatmap_data
```

**Security considerations:**
- No `Depends(get_current_user)` dependency, so no JWT validation
- CORS must allow public origins (configured in middleware)
- Rate limiting CRITICAL to prevent abuse (use slowapi with stricter limits for public endpoints)
- SQL queries MUST filter `is_sensitive = false` at WHERE clause level
- Never return user-identifying data (no names, phone numbers, addresses)

### Pattern 2: Cross-Tenant Aggregation with RLS Bypass

**What:** PostgreSQL queries that aggregate data across multiple municipalities require bypassing Row-Level Security (RLS).

**When to use:** Public dashboard aggregating metrics from all pilot municipalities.

**Example:**

```python
# Source: PostgreSQL RLS patterns, Multi-tenant aggregation best practices
# https://www.tigerdata.com/learn/postgres-security-best-practices
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.ticket import Ticket
from src.models.municipality import Municipality

class PublicMetricsService:
    """Service for public-facing cross-tenant metrics.

    Uses read-only database connection with RLS disabled for aggregation.
    All queries MUST filter is_sensitive = false.
    """

    async def get_public_metrics_all_municipalities(
        self, db: AsyncSession
    ) -> list[dict]:
        """Get aggregated metrics across all active municipalities.

        Returns list of:
        {
            "municipality_id": str,
            "municipality_name": str,
            "avg_response_hours": float,
            "resolution_rate": float,
            "total_tickets": int,
            "sensitive_tickets_count": int  # Count only, no details
        }
        """
        # Query across all tenants (RLS bypass required)
        # CRITICAL: Filter is_sensitive = false for public metrics
        query = (
            select(
                Municipality.id.label("municipality_id"),
                Municipality.name.label("municipality_name"),
                func.count(Ticket.id).label("total_tickets"),
                func.avg(
                    func.extract("epoch", Ticket.first_responded_at - Ticket.created_at) / 3600
                ).label("avg_response_hours"),
                func.count(
                    case((Ticket.status.in_(["resolved", "closed"]), 1))
                ) * 100.0 / func.count(Ticket.id).label("resolution_rate"),
                func.count(
                    case((Ticket.is_sensitive == True, 1))
                ).label("sensitive_tickets_count")  # Aggregated count only
            )
            .join(Municipality, Ticket.tenant_id == Municipality.id)
            .where(
                and_(
                    Municipality.is_active == True,
                    # CRITICAL: Exclude sensitive tickets from public metrics
                    Ticket.is_sensitive == False
                )
            )
            .group_by(Municipality.id, Municipality.name)
        )

        result = await db.execute(query)
        rows = result.all()

        return [
            {
                "municipality_id": str(row.municipality_id),
                "municipality_name": row.municipality_name,
                "avg_response_hours": round(row.avg_response_hours or 0.0, 2),
                "resolution_rate": round(row.resolution_rate or 0.0, 2),
                "total_tickets": row.total_tickets,
                "sensitive_tickets_count": row.sensitive_tickets_count  # Count only
            }
            for row in rows
        ]
```

**RLS bypass options:**
1. **Dedicated read-only connection:** Create separate DB connection with `SET SESSION AUTHORIZATION` to superuser for public queries
2. **RLS policy with public flag:** Add RLS policy that allows read access when `current_setting('app.public_access')::boolean = true`
3. **Database view:** Create materialized view with RLS disabled, refresh periodically (recommended for performance)

**Recommendation:** Use materialized view refreshed every 15 minutes for public dashboard—reduces load, provides caching, and isolates public access from production database.

### Pattern 3: Geographic Heatmap with Grid-Based Aggregation

**What:** Aggregate ticket locations into grid cells to anonymize exact locations while showing density patterns.

**When to use:** Public heatmap (TRNS-03) must show issue density without revealing exact addresses.

**Example:**

```python
# Source: PostgreSQL PostGIS aggregation, Privacy-preserving geospatial data
# https://www.cambridgema.gov/Departments/opendata (Cambridge MA geomask approach)
from sqlalchemy import select, func, text
from geoalchemy2.functions import ST_SnapToGrid, ST_X, ST_Y

class PublicMetricsService:
    """Service for public-facing metrics with privacy-preserving aggregation."""

    async def get_heatmap_data(
        self, municipality_id: str | None, db: AsyncSession
    ) -> list[dict]:
        """Get heatmap data with grid-based aggregation for privacy.

        Aggregates tickets into 0.01-degree grid cells (~1km resolution).
        Returns {"lat": float, "lng": float, "intensity": int}.

        Privacy: Exact ticket locations never exposed, only grid cell centers.
        """
        # Grid size: 0.01 degrees (~1km at equator)
        grid_size = 0.01

        # Base conditions: non-sensitive tickets only
        base_conditions = [
            Ticket.is_sensitive == False,
            Ticket.location.isnot(None)
        ]

        if municipality_id:
            base_conditions.append(Ticket.tenant_id == municipality_id)

        # Aggregate into grid cells using ST_SnapToGrid
        query = (
            select(
                func.ST_X(
                    func.ST_SnapToGrid(Ticket.location, grid_size, grid_size)
                ).label("grid_lng"),
                func.ST_Y(
                    func.ST_SnapToGrid(Ticket.location, grid_size, grid_size)
                ).label("grid_lat"),
                func.count(Ticket.id).label("intensity")
            )
            .where(and_(*base_conditions))
            .group_by(
                func.ST_SnapToGrid(Ticket.location, grid_size, grid_size)
            )
            .having(func.count(Ticket.id) >= 3)  # Minimum 3 tickets per cell for privacy
        )

        result = await db.execute(query)
        rows = result.all()

        return [
            {
                "lat": float(row.grid_lat),
                "lng": float(row.grid_lng),
                "intensity": row.intensity
            }
            for row in rows
        ]
```

**React Leaflet heatmap component:**

```typescript
// Source: react-leaflet v5 docs, Leaflet.heat GitHub
// https://github.com/Leaflet/Leaflet.heat
import { MapContainer, TileLayer } from 'react-leaflet';
import HeatmapLayer from 'react-leaflet-heatmap-layer-v3';
import { useEffect, useState } from 'react';

interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

export function HeatmapViewer({ municipalityId }: { municipalityId?: string }) {
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadHeatmapData() {
      setIsLoading(true);
      try {
        const params = municipalityId ? `?municipality_id=${municipalityId}` : '';
        const response = await fetch(`/api/v1/public/heatmap${params}`);
        const data = await response.json();
        setPoints(data);
      } catch (err) {
        console.error('[HeatmapViewer] Failed to load heatmap data:', err);
        setPoints([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadHeatmapData();
  }, [municipalityId]);

  return (
    <div style={{ height: '600px', width: '100%' }}>
      {isLoading && <div>Loading heatmap...</div>}

      <MapContainer
        center={[-29.0, 24.0]}  // South Africa center
        zoom={6}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <HeatmapLayer
          points={points}
          longitudeExtractor={(p: HeatmapPoint) => p.lng}
          latitudeExtractor={(p: HeatmapPoint) => p.lat}
          intensityExtractor={(p: HeatmapPoint) => p.intensity}
          max={10}  // Max intensity for color scaling
          radius={25}  // Heatmap radius in pixels
          blur={15}  // Blur radius
          gradient={{
            0.0: 'blue',
            0.5: 'lime',
            0.7: 'yellow',
            1.0: 'red'
          }}
        />
      </MapContainer>
    </div>
  );
}
```

**Privacy safeguards:**
- Grid-based aggregation prevents exact location exposure
- Minimum 3 tickets per grid cell (suppress cells with <3 tickets)
- No ticket IDs or tracking numbers in heatmap data
- Municipality-level filtering only (no ward or street-level filters)

### Pattern 4: Municipality Onboarding as Operational Workflow

**What:** Pilot municipality onboarding is a manual operational process, not a new application feature.

**When to use:** Success criteria requires 3-5 pilot municipalities onboarded with active reporting (Phase 6 goal).

**Onboarding workflow:**

```python
# scripts/seed_pilot_municipalities.py
"""Seed script for onboarding pilot municipalities.

Usage:
    python scripts/seed_pilot_municipalities.py --municipality "City of Cape Town" \
        --code "CPT" --province "Western Cape" --contact "cpt@example.com"

Creates:
- Municipality record
- Default manager user account
- Default SLA configurations
- Default teams (water, roads, electricity, etc.)
- SAPS liaison team for GBV routing
"""
import asyncio
from uuid import uuid4
from sqlalchemy import select
from src.core.database import AsyncSessionLocal
from src.models.municipality import Municipality
from src.models.user import User, UserRole
from src.models.team import Team
from src.models.sla_config import SLAConfig
from src.core.security import get_password_hash

async def onboard_municipality(
    name: str,
    code: str,
    province: str,
    contact_email: str,
    population: int | None = None
):
    """Onboard a new pilot municipality with default configuration."""
    async with AsyncSessionLocal() as db:
        # 1. Create Municipality record
        municipality = Municipality(
            id=uuid4(),
            name=name,
            code=code,
            province=province,
            population=population,
            contact_email=contact_email,
            is_active=True
        )
        db.add(municipality)
        await db.flush()  # Get municipality.id

        # 2. Create default manager user
        manager = User(
            id=uuid4(),
            email=f"manager@{code.lower()}.gov.za",
            hashed_password=get_password_hash("ChangeMe123!"),
            full_name=f"{name} Manager",
            role=UserRole.MANAGER,
            tenant_id=municipality.id,
            is_verified=True,
            popia_consent=True
        )
        db.add(manager)

        # 3. Create default teams
        teams = [
            Team(id=uuid4(), name="Water Services", category="water", tenant_id=municipality.id),
            Team(id=uuid4(), name="Roads & Infrastructure", category="roads", tenant_id=municipality.id),
            Team(id=uuid4(), name="Electricity", category="electricity", tenant_id=municipality.id),
            Team(id=uuid4(), name="Waste Management", category="waste", tenant_id=municipality.id),
            Team(id=uuid4(), name="Sanitation", category="sanitation", tenant_id=municipality.id),
            Team(id=uuid4(), name="General Services", category="other", tenant_id=municipality.id),
            Team(id=uuid4(), name="SAPS GBV Liaison", category="gbv", is_saps=True, tenant_id=municipality.id)
        ]
        db.add_all(teams)

        # 4. Create default SLA configurations
        sla_configs = [
            SLAConfig(id=uuid4(), category="water", severity="critical",
                     response_hours=2, resolution_hours=24, tenant_id=municipality.id),
            SLAConfig(id=uuid4(), category="water", severity="high",
                     response_hours=4, resolution_hours=48, tenant_id=municipality.id),
            SLAConfig(id=uuid4(), category="roads", severity="high",
                     response_hours=8, resolution_hours=72, tenant_id=municipality.id),
            SLAConfig(id=uuid4(), category="electricity", severity="critical",
                     response_hours=1, resolution_hours=12, tenant_id=municipality.id),
            # ... more SLA configs
        ]
        db.add_all(sla_configs)

        await db.commit()

        print(f"""
        ✓ Municipality '{name}' onboarded successfully!

        Municipality ID: {municipality.id}
        Manager Email: {manager.email}
        Manager Password: ChangeMe123! (CHANGE IMMEDIATELY)
        Teams Created: {len(teams)}
        SLA Configs: {len(sla_configs)}

        Next steps:
        1. Manager logs in and changes password
        2. Manager creates additional user accounts (ward councillors, field workers)
        3. Manager configures team service areas (geospatial boundaries)
        4. Test WhatsApp reporting with citizen account
        5. Verify ticket routing and SLA tracking
        """)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Onboard pilot municipality")
    parser.add_argument("--municipality", required=True, help="Municipality name")
    parser.add_argument("--code", required=True, help="Municipality code")
    parser.add_argument("--province", required=True, help="Province name")
    parser.add_argument("--contact", required=True, help="Contact email")
    parser.add_argument("--population", type=int, help="Population (optional)")

    args = parser.parse_args()

    asyncio.run(onboard_municipality(
        name=args.municipality,
        code=args.code,
        province=args.province,
        contact_email=args.contact,
        population=args.population
    ))
```

**Onboarding checklist (manual verification):**

```markdown
# Pilot Municipality Onboarding Checklist

## Pre-Onboarding
- [ ] Municipality signed pilot agreement
- [ ] Municipality designated manager contact
- [ ] Twilio WhatsApp Business number configured for municipality
- [ ] S3 bucket created for municipality media uploads
- [ ] Database backup completed before onboarding

## Onboarding Script
- [ ] Run seed script: `python scripts/seed_pilot_municipalities.py`
- [ ] Verify municipality record in database
- [ ] Verify manager user created
- [ ] Verify teams created (including SAPS team)
- [ ] Verify SLA configs created

## Post-Onboarding Verification
- [ ] Manager logs in successfully (web portal)
- [ ] Manager changes default password
- [ ] Manager creates ward councillor accounts
- [ ] Test citizen registration with proof of residence
- [ ] Test WhatsApp ticket submission (EN/ZU/AF)
- [ ] Verify ticket routing to correct team
- [ ] Verify SLA deadlines calculated correctly
- [ ] Test GBV report routing to SAPS team (SEC-05 firewall active)
- [ ] Verify manager dashboard displays metrics
- [ ] Verify ward councillor dashboard filtered by ward
- [ ] Public dashboard displays municipality metrics (no sensitive data)

## Production Readiness
- [ ] SSL certificate configured for municipality subdomain
- [ ] Rate limiting configured for public endpoints
- [ ] CORS configured for public dashboard domain
- [ ] Monitoring alerts configured (Sentry, Datadog, etc.)
- [ ] Backup schedule verified
- [ ] Disaster recovery plan documented
```

### Anti-Patterns to Avoid

- **Exposing exact ticket locations on public map:** Use grid-based aggregation (0.01-degree cells) to anonymize locations
- **Including sensitive data in public API responses:** All queries MUST filter `is_sensitive = false` at SQL level, not application layer
- **Using authenticated dashboard for public view:** Create separate `/api/v1/public/*` routes to avoid RBAC complexity and accidental data leakage
- **Returning municipality contact info without sanitization:** Public API should return only name, code, province—no contact emails or internal IDs
- **Manual SQL queries for cross-tenant aggregation:** Use SQLAlchemy with explicit RLS bypass to prevent SQL injection and ensure audit logging

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Geographic heatmaps | Custom canvas rendering with density calculation | Leaflet.heat plugin | Handles edge cases (overlapping points, zoom levels, color gradients), tested with 10K+ points, 3KB bundle size |
| Interactive maps | Custom SVG with pan/zoom logic | Leaflet + react-leaflet | Industry standard, handles touch gestures, tile caching, projection systems, 40K+ stars |
| Cross-tenant aggregation | Manual multi-query loops | PostgreSQL JOIN with RLS bypass | Database-level aggregation orders of magnitude faster, prevents N+1 queries |
| Geospatial anonymization | Random noise addition | PostGIS ST_SnapToGrid with minimum count threshold | Consistent grid alignment, prevents re-identification attacks, standard geospatial privacy technique |
| Public dashboard CORS | Custom middleware | FastAPI CORSMiddleware with explicit origins | Handles preflight requests, credential policies, origin wildcards correctly |

**Key insight:** Geographic data visualization and multi-tenant aggregation are deceptively complex domains with privacy implications. Leaflet.heat handles coordinate projection, tile loading, and zoom-level optimization automatically. PostGIS spatial functions provide SQL-level aggregation that prevents data leakage. Using battle-tested libraries prevents privacy vulnerabilities and performance issues.

## Common Pitfalls

### Pitfall 1: Accidental Sensitive Data Leakage on Public Dashboard

**What goes wrong:** Public API endpoint returns GBV ticket count with municipality_id, allowing inference of which municipalities have GBV reports.

**Why it happens:** Aggregated counts seem safe ("just a number"), but revealing which municipalities have 0 vs >0 GBV reports is itself sensitive information.

**How to avoid:** Return aggregated sensitive count at system level only (sum across ALL municipalities), never per-municipality. Public API should return: `{"total_municipalities": 5, "total_tickets": 12543, "total_sensitive_tickets": 87}` without municipality breakdown.

**Warning signs:** Public API returns `sensitive_tickets_count: 0` for some municipalities but not others. Security audit finds GBV data leakage via aggregation.

### Pitfall 2: RLS Blocking Cross-Tenant Aggregation Queries

**What goes wrong:** Public dashboard query fails with "permission denied" error because PostgreSQL RLS prevents cross-tenant SELECT.

**Why it happens:** Phase 1 established RLS policies that filter by `tenant_id = current_setting('app.tenant_id')`, but public dashboard needs to query ALL tenants.

**How to avoid:** Create dedicated read-only database connection with `SET SESSION AUTHORIZATION` to superuser role for public queries, OR use materialized view with `SECURITY DEFINER` function to refresh data.

**Warning signs:** Public API returns 500 error. Logs show "permission denied for table tickets". Query works in pgAdmin but not in application.

### Pitfall 3: Heatmap Performance Degradation with 50K+ Tickets

**What goes wrong:** Public heatmap page loads slowly or times out when municipality has 50,000+ tickets.

**Why it happens:** Querying all ticket locations without aggregation overwhelms database and browser. Leaflet.heat handles 10K points efficiently but struggles at 50K+.

**How to avoid:** Use PostGIS grid-based aggregation (`ST_SnapToGrid`) to reduce 50K points to ~500 grid cells. Add database index on `(tenant_id, location, is_sensitive)`. Cache heatmap data with 15-minute refresh.

**Warning signs:** Heatmap API response time >5 seconds. Browser freezes when rendering heatmap. Database query plan shows sequential scan on tickets table.

### Pitfall 4: CORS Errors on Public Dashboard from Different Domain

**What goes wrong:** Public dashboard hosted on `transparency.salga.gov.za` can't fetch data from API at `api.salga.gov.za` due to CORS policy.

**Why it happens:** FastAPI CORSMiddleware not configured to allow public dashboard origin, or `allow_credentials=True` blocks wildcard origin.

**How to avoid:** Configure CORSMiddleware with explicit `allow_origins=["https://transparency.salga.gov.za"]` for public routes. Do NOT use wildcard `"*"` with `allow_credentials=True` (browsers reject).

**Warning signs:** Browser console shows "CORS policy: No 'Access-Control-Allow-Origin' header". API responds 200 but data doesn't load in frontend.

### Pitfall 5: Incomplete Test Coverage Causes Phase 1-5 Regressions

**What goes wrong:** Phase 6 changes break Phase 3 WhatsApp webhook or Phase 5 dashboard, but tests don't catch regressions before production.

**Why it happens:** Test suite doesn't cover all code paths, or fixtures don't set `is_sensitive=False` so GBV firewall tests fail after public dashboard changes.

**How to avoid:** Run FULL test suite with `pytest --cov=src --cov-report=term-missing` before Phase 6 sign-off. Verify >=80% coverage on new code AND no coverage decrease on existing modules. Add regression tests for critical paths (WhatsApp flow, GBV routing, dashboard metrics).

**Warning signs:** Test suite passes but production shows errors. Coverage report shows Phase 3/4/5 modules dropped from 85% to 60% coverage. Integration tests don't exist for cross-phase workflows.

### Pitfall 6: Municipality Onboarding Script Creates Duplicate Records

**What goes wrong:** Running onboarding script twice creates duplicate municipality with different ID, causing tenant isolation violation.

**Why it happens:** Script doesn't check if municipality already exists before inserting. Unique constraint on `code` prevents database-level duplicate but script crashes.

**How to avoid:** Add `SELECT` query before INSERT to check if municipality exists. Use `ON CONFLICT DO NOTHING` clause for idempotent script. Return error if municipality already exists with clear message.

**Warning signs:** Script crashes with "duplicate key value violates unique constraint". Database has two municipalities with same code but different IDs.

## Code Examples

Verified patterns from official sources:

### FastAPI Public Endpoint with CORS Configuration

```python
# Source: FastAPI CORS Tutorial, FastAPI Security Best Practices 2026
# https://fastapi.tiangolo.com/tutorial/cors/
# https://escape.tech/blog/how-to-secure-fastapi-api/
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Configure CORS for public dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://transparency.salga.gov.za",  # Public dashboard domain
        "http://localhost:5173",  # Local development
    ],
    allow_credentials=False,  # Public endpoints don't use cookies
    allow_methods=["GET"],  # Public dashboard only reads data
    allow_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Public routes (no authentication required)
from src.api.v1 import public
app.include_router(public.router, prefix="/api/v1")

# Protected routes (authentication required)
from src.api.v1 import dashboard
app.include_router(dashboard.router, prefix="/api/v1")
```

### Leaflet.heat Heatmap with React Leaflet v5

```typescript
// Source: react-leaflet v5 official docs, Leaflet.heat GitHub examples
// https://react-leaflet.js.org/ (v5.0.0)
// https://github.com/Leaflet/Leaflet.heat
import { MapContainer, TileLayer } from 'react-leaflet';
import HeatmapLayer from 'react-leaflet-heatmap-layer-v3';
import { useEffect, useState } from 'react';

interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

interface HeatmapViewerProps {
  municipalityId?: string;
}

export function HeatmapViewer({ municipalityId }: HeatmapViewerProps) {
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHeatmapData() {
      setIsLoading(true);
      setError(null);

      try {
        const params = municipalityId
          ? new URLSearchParams({ municipality_id: municipalityId })
          : '';

        // Public API endpoint (no authentication)
        const response = await fetch(`/api/v1/public/heatmap?${params}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setPoints(data);
      } catch (err) {
        console.error('[HeatmapViewer] Failed to load heatmap data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load heatmap');
        setPoints([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadHeatmapData();
  }, [municipalityId]);

  if (error) {
    return (
      <div style={{ padding: '1rem', color: 'red', border: '1px solid red' }}>
        Error loading heatmap: {error}
      </div>
    );
  }

  return (
    <div style={{ height: '600px', width: '100%', position: 'relative' }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          background: 'white',
          padding: '1rem',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          Loading heatmap...
        </div>
      )}

      <MapContainer
        center={[-29.0, 24.0]}  // South Africa center
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        {/* OpenStreetMap tiles (free, no API key required) */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Heatmap layer with Leaflet.heat */}
        {points.length > 0 && (
          <HeatmapLayer
            points={points}
            longitudeExtractor={(p: HeatmapPoint) => p.lng}
            latitudeExtractor={(p: HeatmapPoint) => p.lat}
            intensityExtractor={(p: HeatmapPoint) => p.intensity}
            max={10}  // Max intensity for color scaling
            radius={25}  // Heatmap radius in pixels
            blur={15}  // Blur radius for smooth gradients
            gradient={{
              0.0: 'blue',
              0.5: 'lime',
              0.7: 'yellow',
              1.0: 'red'
            }}
            fitBoundsOnLoad={true}  // Auto-zoom to data bounds
            fitBoundsOnUpdate={false}  // Maintain user zoom on updates
          />
        )}
      </MapContainer>

      {points.length === 0 && !isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          padding: '1rem',
          borderRadius: '4px',
          textAlign: 'center'
        }}>
          No heatmap data available for selected municipality.
        </div>
      )}
    </div>
  );
}
```

### PostgreSQL Grid-Based Geospatial Aggregation

```python
# Source: PostGIS documentation, Cambridge MA geomask approach
# https://postgis.net/docs/ST_SnapToGrid.html
# https://www.cambridgema.gov/Departments/opendata
from sqlalchemy import select, func, and_, text
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.ticket import Ticket
from src.models.municipality import Municipality

async def get_heatmap_data_aggregated(
    db: AsyncSession,
    municipality_id: str | None = None
) -> list[dict]:
    """Get heatmap data with grid-based aggregation for privacy.

    Aggregates tickets into 0.01-degree grid cells (~1km resolution).
    Suppresses cells with <3 tickets to prevent re-identification.

    Returns:
        list of {"lat": float, "lng": float, "intensity": int}
    """
    # Grid size: 0.01 degrees (~1km at equator)
    grid_size = 0.01

    # Base conditions: non-sensitive tickets with location
    base_conditions = [
        Ticket.is_sensitive == False,
        Ticket.location.isnot(None),
        Municipality.is_active == True
    ]

    if municipality_id:
        base_conditions.append(Ticket.tenant_id == municipality_id)

    # PostGIS grid aggregation query
    query = (
        select(
            # Extract grid cell center coordinates
            func.ST_X(
                func.ST_SnapToGrid(Ticket.location, grid_size, grid_size)
            ).label("grid_lng"),
            func.ST_Y(
                func.ST_SnapToGrid(Ticket.location, grid_size, grid_size)
            ).label("grid_lat"),
            # Count tickets in each cell
            func.count(Ticket.id).label("intensity")
        )
        .join(Municipality, Ticket.tenant_id == Municipality.id)
        .where(and_(*base_conditions))
        .group_by(
            # Group by grid cell
            func.ST_SnapToGrid(Ticket.location, grid_size, grid_size)
        )
        .having(
            # Suppress cells with <3 tickets (k-anonymity principle)
            func.count(Ticket.id) >= 3
        )
        .order_by(func.count(Ticket.id).desc())  # Highest intensity first
        .limit(1000)  # Cap at 1000 grid cells for performance
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "lat": float(row.grid_lat),
            "lng": float(row.grid_lng),
            "intensity": row.intensity
        }
        for row in rows
    ]
```

### Pytest Coverage Configuration for Phase 6

```ini
# .coveragerc - Coverage.py configuration
# Source: pytest-cov documentation, Coverage.py 7.13.4
# https://coverage.readthedocs.io/
[run]
source = src
omit =
    src/__init__.py
    src/*/migrations/*
    */tests/*
    */test_*.py

[report]
exclude_lines =
    pragma: no cover
    def __repr__
    raise AssertionError
    raise NotImplementedError
    if __name__ == .__main__.:
    if TYPE_CHECKING:
    @abstractmethod

precision = 2
show_missing = True
skip_covered = False

[html]
directory = htmlcov

[json]
output = coverage.json
```

```bash
# Run full test suite with coverage report
pytest --cov=src --cov-report=term-missing --cov-report=html --cov-report=json

# Verify coverage gate (>=80%)
coverage report --fail-under=80

# Generate coverage badge for README
coverage-badge -o coverage.svg -f
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-leaflet v4 | react-leaflet v5 | 2025 | React 19 compatibility, v4 deprecated, breaking changes in API |
| Mapbox GL JS | Leaflet + OpenStreetMap | 2023+ | Mapbox pricing model changed, Leaflet free with OSM tiles, no vendor lock-in |
| Manual geospatial privacy | PostGIS ST_SnapToGrid with k-anonymity | 2022+ | Standardized approach from Cambridge MA, GDPR-compliant geographic anonymization |
| Single dashboard for public/private | Separate public API routes | 2024+ | Clearer security boundary, prevents accidental data leakage, easier CORS config |
| Coverage.py manual setup | pytest-cov plugin | 2020+ | Integrated pytest workflow, automatic combining of .coverage files, context support |

**Deprecated/outdated:**
- **react-leaflet v4:** Deprecated in 2025, v5 required for React 19 compatibility
- **Mapbox free tier:** Ended 2023, now requires billing for any usage (Leaflet + OSM is free alternative)
- **Manual CORS headers:** FastAPI CORSMiddleware handles preflight requests correctly, custom middleware error-prone
- **python-jose for JWT:** Deprecated since 2021 with security issues, use PyJWT (already in stack from Phase 1)

## Open Questions

1. **Public Dashboard Deployment Domain**
   - What we know: Public dashboard must be accessible without login (TRNS-04)
   - What's unclear: Should public dashboard be subdomain (`transparency.salga.gov.za`) or separate domain (`salga-trust.gov.za`)?
   - Recommendation: Use subdomain for consistency, configure CORS to allow cross-origin requests from public dashboard to API

2. **Heatmap Refresh Frequency**
   - What we know: Heatmap data expensive to compute (PostGIS aggregation across 50K+ tickets)
   - What's unclear: Should heatmap refresh real-time, every 15 minutes, or daily?
   - Recommendation: Use materialized view refreshed every 15 minutes (balance between freshness and performance). Add "Last updated: X minutes ago" timestamp on UI.

3. **Pilot Municipality Selection Criteria**
   - What we know: Success criteria requires 3-5 pilot municipalities onboarded
   - What's unclear: Which municipalities? Urban vs rural mix? Province distribution?
   - Recommendation: Select pilots with: (1) existing WhatsApp infrastructure, (2) municipal manager buy-in, (3) diverse demographics (1 metro, 2 local, 1 rural), (4) different provinces for geographic coverage

4. **GBV Data Aggregation Level**
   - What we know: TRNS-05 requires "aggregated counts only, no identifying details"
   - What's unclear: Should public dashboard show GBV counts per municipality, or only system-wide total?
   - Recommendation: System-wide total only—revealing which municipalities have 0 vs >0 GBV reports is itself sensitive information

5. **Test Suite Runtime for Full Regression Check**
   - What we know: Phase 6 requires running ALL Phase 1-5 tests (310 tests currently passing)
   - What's unclear: Will full suite runtime (currently ~2 minutes) become bottleneck with Phase 6 tests added?
   - Recommendation: Monitor test runtime, add `pytest-xdist` for parallel execution if runtime exceeds 5 minutes. Use `pytest -n auto` for local development, sequential for CI to avoid race conditions.

## Sources

### Primary (HIGH confidence)

- [Leaflet Official Site](https://leafletjs.com/) - Open-source JavaScript map library
- [Leaflet.heat GitHub](https://github.com/Leaflet/Leaflet.heat) - Official Leaflet heatmap plugin with 10K point demo
- [react-leaflet v5 Documentation](https://react-leaflet.js.org/) - Official React wrapper for Leaflet (v5.0.0, React 19 compatible)
- [react-leaflet-heatmap-layer-v3 NPM](https://www.npmjs.com/package/react-leaflet-heatmap-layer-v3) - React heatmap component for react-leaflet v3+
- [FastAPI CORS Tutorial](https://fastapi.tiangolo.com/tutorial/cors/) - Official FastAPI CORS middleware configuration
- [FastAPI Security First Steps](https://fastapi.tiangolo.com/tutorial/security/first-steps/) - Official FastAPI authentication patterns
- [PostGIS ST_SnapToGrid Documentation](https://postgis.net/docs/ST_SnapToGrid.html) - Grid-based spatial aggregation
- [pytest-cov PyPI](https://pypi.org/project/pytest-cov/) - Official pytest coverage plugin (v7.0.0)
- [Coverage.py Documentation](https://coverage.readthedocs.io/) - Python code coverage tool (v7.13.4, released 2026-02-09)

### Secondary (MEDIUM confidence)

- [How to Secure FastAPI APIs: Complete Guide](https://escape.tech/blog/how-to-secure-fastapi-api/) - FastAPI security best practices 2026
- [FastAPI CORS Configuration Guide](https://www.stackhawk.com/blog/configuring-cors-in-fastapi/) - CORS setup patterns
- [PostgreSQL Aggregation Best Practices](https://www.tigerdata.com/learn/postgresql-aggregation-best-practices) - Query optimization for large datasets
- [Postgres Security Best Practices](https://www.tigerdata.com/learn/postgres-security-best-practices) - Row-Level Security patterns
- [Cambridge MA Open Data Program](https://www.cambridgema.gov/Departments/opendata) - Municipal data anonymization approach (geomask technique)
- [Multi-Tenant Analytics for SaaS](https://www.tinybird.co/blog/multi-tenant-saas-options) - Cross-tenant aggregation patterns
- [From Pilot to Production: Scaling AI Projects](https://agility-at-scale.com/implementing/scaling-ai-projects/) - Pilot onboarding best practices
- [What is Pytest Coverage Report](https://www.testmuai.com/blog/pytest-code-coverage-report/) - pytest-cov usage guide

### Tertiary (LOW confidence)

- WebSearch results on react-leaflet heatmap implementation 2026 - Community patterns and examples
- WebSearch results on FastAPI optional authentication - Custom decorator patterns (not official)
- WebSearch results on municipality pilot onboarding - General project management frameworks

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-leaflet v5, Leaflet.heat, FastAPI CORS verified with official docs
- Architecture patterns: HIGH - Public API patterns verified with FastAPI docs, PostGIS aggregation from PostGIS docs
- Pitfalls: MEDIUM - Based on community patterns (CORS errors, RLS blocking) and security best practices, not all officially documented
- Municipality onboarding: MEDIUM - Operational workflow patterns from pilot project management, not SALGA-specific
- Test coverage: HIGH - pytest-cov and Coverage.py official documentation, current test suite exists with 310 tests

**Research date:** 2026-02-10
**Valid until:** 30 days (fast-moving: react-leaflet v5 just released 2025, may have breaking changes)
