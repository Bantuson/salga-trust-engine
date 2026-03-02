# Phase 32: Risk Register & Public Transparency - Research

**Researched:** 2026-03-02
**Domain:** Risk register data models, KPI-triggered Celery task, risk dashboard widget, public SDBIP transparency API
**Confidence:** HIGH

---

## Summary

Phase 32 has two distinct sub-features. The first is a Risk Register: a set of backend data models (`RiskItem`, `RiskMitigation`), a CRUD API, an auto-flagging mechanism driven by KPI traffic-light changes, and a dashboard widget surfaced on the CFO and Municipal Manager pages. The second is Public Transparency: new unauthenticated API endpoints on `/api/v1/public/sdbip-performance` that serve plain-language SDBIP achievement data, plus a new section on the public `TransparencyDashboardPage` in `frontend-public`.

The codebase is mature and stable. Every technical pattern needed for Phase 32 is already proven in Phases 28–31: `TenantAwareModel` + Alembic migration for new tables, Pydantic v2 schemas for CRUD, `require_role()` / `require_min_tier()` for endpoint gating, Celery task structure from `pms_auto_populate_task.py`, dashboard widget patterns from `CFODashboardPage.tsx`, and unauthenticated public API pattern from `public.py` + `PublicMetricsService`. No new libraries are required for this phase.

The only design decision requiring care is the auto-flagging mechanism (RISK-03): the REQUIREMENTS.md says "when a linked KPI's achievement status turns red," which means the flagging must be triggered by the same event loop as KPI actual submission/validation, not a purely time-based Celery beat. The safest approach is a lightweight Celery task invoked on-demand (not beat) when a red status is detected during `SDBIPActual` write. This avoids timing gaps that a daily beat schedule would introduce.

**Primary recommendation:** Implement auto-flagging as a Celery task dispatched from the actuals submission/validation endpoint (same pattern as how statutory tasks are dispatched from report generation), not as a beat schedule.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RISK-01 | Authorized user can create risk items linked to SDBIP KPIs with likelihood, impact, and rating | TenantAwareModel pattern from Phase 28; FK to `sdbip_kpis.id`; Pydantic schema validation; `require_min_tier(2)` gate matches director-and-above authorization |
| RISK-02 | Each risk item includes mitigation strategy and responsible person | `RiskMitigation` child model with FK to `risk_items.id`; responsible_person_id FK to `users.id`; service layer CRUD |
| RISK-03 | System auto-flags high-risk items when linked KPI status turns red | Celery task dispatched from actuals write path (not beat); query `risk_items` where `linked_kpi_id = kpi_id AND linked_kpi turns red`; set `risk_level = 'high'`; write AuditLog |
| RISK-04 | CFO and Municipal Manager can view risk register filtered by department | `require_role(CFO, MUNICIPAL_MANAGER)` endpoint; filter by `department_id`; aggregation service method `get_risk_register(tenant_id, department_id, db)` |
</phase_requirements>

---

## Standard Stack

### Core (all already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy 2.0 | already installed | ORM models + async queries | All PMS models use this |
| pydantic v2 | already installed | Request/response schemas | All existing schemas use v2 |
| FastAPI | already installed | CRUD API endpoints | All existing APIs use FastAPI |
| Celery + Redis | already installed | Auto-flagging task dispatch | Used by `pms_auto_populate_task.py`, `pa_notify_task.py`, etc. |
| python-statemachine | 3.0.0 (already installed) | NOT needed here — no workflow | Risk items are not stateful (high/medium/low is a computed field, not a state machine) |
| alembic | already installed | DB migration for new tables | All model additions use Alembic |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React + CSS variables | already installed | Risk widget on CFO/MM dashboards | CSS variables approach locked from Phase 27-03 |
| GlassCard, TrafficLightBadge | already in `shared/` and `components/pms/` | Widget UI | Reuse; no new components needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| On-demand Celery task for auto-flagging | Beat schedule (daily) | Beat would miss same-day flags; on-demand is triggered at write time; always correct |
| On-demand Celery task for auto-flagging | Synchronous flag within request handler | Sync is acceptable but Celery is consistent with project pattern and allows retry |
| Separate `RiskRating` enum table | Inline enum in model | Enum in model is simpler; ISO 31000 risk matrix uses 5-point likelihood/impact scales |

**Installation:** None required. All stack dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
├── models/
│   └── risk.py                   # RiskItem, RiskMitigation (new)
├── schemas/
│   └── risk.py                   # RiskItemCreate, RiskItemResponse, etc. (new)
├── services/
│   └── risk_service.py           # RiskService CRUD + auto-flag logic (new)
├── api/v1/
│   └── risk.py                   # /api/v1/risk-register endpoints (new)
│   └── public.py                 # + GET /public/sdbip-performance (extend existing)
├── tasks/
│   └── risk_autoflag_task.py     # Celery task: flag_risk_items_for_kpi() (new)
│   └── celery_app.py             # Add risk_autoflag_task to include list (extend)

frontend-dashboard/src/
├── pages/
│   ├── CFODashboardPage.tsx       # + Risk Register widget section (extend)
│   └── MunicipalManagerDashboardPage.tsx  # + Risk Register widget section (extend)
├── services/
│   └── api.ts                    # + fetchRiskRegister(), createRiskItem() (extend)
├── mocks/
│   └── mockRoleDashboards.ts     # + mockRiskRegister data (extend)

frontend-public/src/
├── pages/
│   └── TransparencyDashboardPage.tsx  # + SdbipAchievementSection (extend)
├── hooks/
│   └── usePublicStats.ts         # + useSdbipAchievement() hook (extend)
├── types/
│   └── public.ts                 # + SdbipAchievementData interface (extend)
```

### Pattern 1: TenantAwareModel for RiskItem

**What:** Inherit `TenantAwareModel` for all tenant-scoped entities. FK to `sdbip_kpis.id` for the KPI link.
**When to use:** All new PMS data models.
**Example:**
```python
# Source: src/models/sdbip.py (SDBIPKpi pattern), src/models/pa.py (PAKpi pattern)
from src.models.base import TenantAwareModel

class RiskRating(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class RiskItem(TenantAwareModel):
    __tablename__ = "risk_items"

    kpi_id: Mapped[UUID] = mapped_column(ForeignKey("sdbip_kpis.id"), nullable=False, index=True)
    department_id: Mapped[UUID | None] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    likelihood: Mapped[int] = mapped_column(Integer, nullable=False, comment="1-5 scale (ISO 31000)")
    impact: Mapped[int] = mapped_column(Integer, nullable=False, comment="1-5 scale (ISO 31000)")
    risk_rating: Mapped[str] = mapped_column(String(20), nullable=False, default=RiskRating.MEDIUM)
    responsible_person_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    is_auto_flagged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    auto_flagged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    kpi: Mapped["SDBIPKpi"] = relationship("SDBIPKpi", foreign_keys=[kpi_id], lazy="select")
    mitigations: Mapped[list["RiskMitigation"]] = relationship(
        "RiskMitigation", back_populates="risk_item", cascade="all, delete-orphan"
    )
```

### Pattern 2: RiskMitigation Child Model

**What:** Each RiskItem can have one or more mitigation strategies with a responsible person.
**When to use:** RISK-02.
**Example:**
```python
# Source: pattern from PAKpi (src/models/pa.py)
class RiskMitigation(TenantAwareModel):
    __tablename__ = "risk_mitigations"

    risk_item_id: Mapped[UUID] = mapped_column(ForeignKey("risk_items.id"), nullable=False, index=True)
    strategy: Mapped[str] = mapped_column(Text, nullable=False)
    responsible_person_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")

    risk_item: Mapped["RiskItem"] = relationship("RiskItem", back_populates="mitigations")
```

### Pattern 3: Auto-Flagging via On-Demand Celery Task

**What:** When a `SDBIPActual` is submitted or validated with `traffic_light_status == 'red'`, dispatch `flag_risk_items_for_kpi.delay(kpi_id, tenant_id)`.
**When to use:** RISK-03.
**Example:**
```python
# Source: src/tasks/pms_auto_populate_task.py pattern

# In src/tasks/risk_autoflag_task.py:
@app.task(
    bind=True,
    name="src.tasks.risk_autoflag_task.flag_risk_items_for_kpi",
    max_retries=3,
)
def flag_risk_items_for_kpi(self, kpi_id: str, tenant_id: str):
    """Auto-flag risk items linked to a KPI that has turned red."""
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    async def _run():
        from src.core.database import AsyncSessionLocal
        from src.services.risk_service import RiskService
        service = RiskService()
        async with AsyncSessionLocal() as db:
            count = await service.auto_flag_for_kpi(kpi_id=UUID(kpi_id), tenant_id=tenant_id, db=db)
            logger.info(f"Auto-flagged {count} risk items for KPI {kpi_id}")
            return {"flagged": count}

    try:
        return asyncio.run(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

# In src/api/v1/sdbip.py (actuals submission endpoint) — dispatch task on red status:
# After SDBIPActual is committed:
if actual.traffic_light_status == "red":
    from src.tasks.risk_autoflag_task import flag_risk_items_for_kpi
    flag_risk_items_for_kpi.delay(str(actual.kpi_id), current_user.tenant_id)
```

### Pattern 4: Risk Register API with Department Filter

**What:** GET endpoint returns risk items filtered by department_id (optional), with KPI info joined.
**When to use:** RISK-04.
**Example:**
```python
# Source: role_dashboards.py pattern
@router.get("/", dependencies=[Depends(require_pms_ready()), Depends(require_min_tier(1))])
async def list_risk_items(
    department_id: UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = RiskService()
    return await service.list_risk_items(
        tenant_id=current_user.tenant_id,
        department_id=department_id,
        db=db,
    )
```

**Note:** RISK-04 specifies CFO and Municipal Manager. Use `require_role(UserRole.CFO, UserRole.MUNICIPAL_MANAGER, UserRole.ADMIN, UserRole.SALGA_ADMIN)` for the filtered view endpoint. The base CRUD (RISK-01, RISK-02) can be `require_min_tier(2)` (Directors+) to allow directors to create/manage risks for their own department.

### Pattern 5: Public SDBIP Transparency Endpoint

**What:** Unauthenticated GET endpoint on `/api/v1/public/sdbip-performance` returns aggregate SDBIP achievement per municipality, without exposing individual KPI data.
**When to use:** Phase 32 public transparency sub-feature.
**Example:**
```python
# Source: src/api/v1/public.py pattern
@router.get("/sdbip-performance")
@limiter.limit(PUBLIC_RATE_LIMIT)
async def get_sdbip_performance(
    request: Request,
    municipality_id: str | None = None,
    financial_year: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get SDBIP achievement summary for public transparency (TRNS-06).
    No auth required. GBV filter not applicable (no ticket data). Returns:
    [{municipality_name, financial_year, total_kpis, green, amber, red, overall_pct}]
    """
    service = PublicMetricsService()
    return await service.get_sdbip_achievement(db, municipality_id=municipality_id, financial_year=financial_year)
```

### Pattern 6: Dashboard Widget (frontend-dashboard)

**What:** Risk Register section on CFO and MM dashboard pages. Reads from `GET /api/v1/risk-register/` with department filter. Mock data fallback in catch block.
**When to use:** RISK-04 dashboard display.
**Example:**
```typescript
// Source: CFODashboardPage.tsx pattern
const [riskData, setRiskData] = useState<any[]>([]);
try {
  const result = await fetchRiskRegister(session.access_token);
  setRiskData(result.items);
} catch {
  setRiskData(mockRiskRegister.items);
}
// Render: GlassCard + table with TrafficLightBadge for risk_rating column
```

### Pattern 7: Public SDBIP Section (frontend-public)

**What:** New `SdbipAchievementSection` component on `TransparencyDashboardPage` using `usePublicStats` pattern (Supabase direct query or FastAPI fallback).
**When to use:** Phase 32 public transparency sub-feature.
**Example:**
```typescript
// Source: usePublicStats.ts pattern
export function useSdbipAchievement(municipalityId?: string) {
  const [data, setData] = useState<SdbipAchievementData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    async function fetch() {
      try {
        const res = await fetch(`/api/v1/public/sdbip-performance?municipality_id=${municipalityId}`);
        const json = await res.json();
        setData(json.length > 0 ? json : mockSdbipAchievement);
      } catch {
        setData(mockSdbipAchievement);
      } finally {
        setIsLoading(false);
      }
    }
    fetch();
  }, [municipalityId]);
  return { data, isLoading };
}
```

### Anti-Patterns to Avoid

- **State machine for risk_rating:** Risk level is a computed/updatable field, not an approval workflow. Use plain enum string, not `python-statemachine`. No `RiskWorkflow` class needed.
- **Celery beat for auto-flagging:** A daily beat schedule would miss same-day risk flags. Dispatch on actuals write instead (on-demand task).
- **Separate risk_register route module in main.py without registering:** All new APIRouters must be added to `src/main.py`. See existing pattern: `app.include_router(risk_register.router, prefix="/api/v1")`.
- **Public SDBIP endpoint without SEC-05 check:** Although KPI achievement data doesn't contain citizen PII, the public endpoint should NOT include is_sensitive ticket data. The query is purely on `sdbip_actuals` and `sdbip_kpis` tables — no ticket table join needed for this endpoint.
- **Using tenant filter in public endpoint:** Public endpoints in `public.py` are cross-tenant and do NOT use `get_current_user`. They must NOT set tenant context. Same pattern as existing `PublicMetricsService.get_active_municipalities()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Risk likelihood × impact matrix | Custom matrix calculation | Precompute risk_rating at write time: `likelihood * impact >= 15 → critical, >= 9 → high, >= 4 → medium, else low` | ISO 31000 standard matrix; simple multiplication is sufficient |
| Retry logic on Celery tasks | Custom retry wrapper | `self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))` | Already pattern-matched in `pms_auto_populate_task.py` |
| Windows event loop compat | Custom event loop setup | Copy `if sys.platform == "win32": asyncio.set_event_loop_policy(...)` from existing tasks | All Celery tasks already do this |
| Tenant filter for risk queries | Custom WHERE clause | `TenantAwareModel` + `do_orm_execute` event listener does it automatically | Already in `src/models/base.py` |
| RBAC guard for risk endpoints | Custom decorator | `require_role()` and `require_min_tier()` from `src/api/deps.py` | Factory pattern already tested in Phase 31 |
| Mock fallback in dashboard pages | Custom mock system | Extend `mockRoleDashboards.ts` and set mock in catch block | Established pattern from Phase 31 |
| Auto-population of department_id on RiskItem | Cross-table join at query time | Denormalize: store `department_id` on `RiskItem` directly (mirrors `SDBIPKpi.department_id` pattern) | Avoids join; direct filter for RISK-04 department filter |

**Key insight:** All infrastructure (Celery, ORM, RBAC, audit logging, tenant filtering, frontend patterns) is in place. Phase 32 is pure feature addition on proven foundation.

---

## Common Pitfalls

### Pitfall 1: ID capture before commit in async SQLAlchemy
**What goes wrong:** After `db.commit()`, all ORM objects are expired. Accessing `new_risk_item.id` after commit raises `MissingGreenlet` in async context.
**Why it happens:** SQLAlchemy 2.0 lazy-loads expired attributes, which requires an active session/event loop context.
**How to avoid:** Save `risk_item_id = new_risk_item.id` BEFORE calling `db.commit()`. See STATE.md: "ID capture before commit: save UUID to local variable before any service call that commits."
**Warning signs:** `MissingGreenlet` or `DetachedInstanceError` in service layer logs.

### Pitfall 2: Circular import between risk.py model and sdbip.py model
**What goes wrong:** `risk.py` imports `SDBIPKpi` from `sdbip.py`; if `sdbip.py` is also modified to add a `risk_items` back-reference, Python raises circular import.
**Why it happens:** SQLAlchemy model files import each other for relationships.
**How to avoid:** Use string-based relationship reference: `relationship("SDBIPKpi", foreign_keys=[kpi_id], lazy="select")` — no import of `SDBIPKpi` class needed. See `sdbip.py` line 317 (string reference to `IDPObjective`).
**Warning signs:** `ImportError: cannot import name 'SDBIPKpi' from partially initialized module`.

### Pitfall 3: Auto-flagging task dispatched before commit
**What goes wrong:** `flag_risk_items_for_kpi.delay(...)` is called before `await db.commit()`. The Celery worker runs immediately and queries `sdbip_actuals` but the actual is not yet committed, so it finds no red actuals.
**Why it happens:** Async database commits are not instantaneous; Celery tasks run in separate processes.
**How to avoid:** Always dispatch the Celery task AFTER `await db.commit()`. Pattern: commit → capture ID → dispatch task.

### Pitfall 4: Raw SQL text() required for cross-tenant SALGA Admin queries
**What goes wrong:** ORM queries through `do_orm_execute` tenant filter fail with `SecurityError` when tenant context is not set (as in SALGA Admin cross-tenant view).
**Why it happens:** `TenantAwareModel` `do_orm_execute` event listener raises `SecurityError` if no tenant context.
**How to avoid:** Use `text()` raw SQL for any cross-tenant queries (same pattern as `RoleDashboardService.get_salga_admin_benchmarking()`). The public SDBIP endpoint is cross-tenant and unauthenticated — use `text()` or set/clear tenant context around the query.
**Warning signs:** `SecurityError: Tenant context not set for tenant-aware query`.

### Pitfall 5: `require_pms_ready()` gate needed on risk register endpoints
**What goes wrong:** Risk register endpoints are accessible before PMS department configuration is complete, returning empty data or 500 errors.
**Why it happens:** PMS readiness gate (`require_pms_ready()`) is mandatory for all PMS endpoints.
**How to avoid:** Add `Depends(require_pms_ready())` to all risk register CRUD endpoints. Same pattern as `sdbip.py` endpoints.

### Pitfall 6: Auto-flagging overwrites manual risk rating changes
**What goes wrong:** Auto-flagging sets `risk_rating = 'high'` unconditionally, overwriting a CFO's deliberate manual rating downgrade.
**Why it happens:** No distinction between auto-flagged and manually-set ratings.
**How to avoid:** Set `is_auto_flagged = True` and `risk_rating = 'high'` ONLY when current rating is not already `'critical'`. Store `auto_flagged_at` timestamp. Manual edits should clear `is_auto_flagged = False`. Allows CFO to override auto-flag.

---

## Code Examples

### RiskItem Model Pattern
```python
# Source: src/models/sdbip.py (SDBIPKpi), src/models/pa.py (PAKpi)
from enum import StrEnum
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import TenantAwareModel


class RiskRating(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


def compute_risk_rating(likelihood: int, impact: int) -> str:
    """ISO 31000-style 5x5 matrix: score = likelihood * impact.
    critical: 15-25, high: 8-14, medium: 4-7, low: 1-3
    """
    score = likelihood * impact
    if score >= 15:
        return RiskRating.CRITICAL
    elif score >= 8:
        return RiskRating.HIGH
    elif score >= 4:
        return RiskRating.MEDIUM
    return RiskRating.LOW


class RiskItem(TenantAwareModel):
    __tablename__ = "risk_items"

    kpi_id: Mapped[UUID] = mapped_column(ForeignKey("sdbip_kpis.id"), nullable=False, index=True)
    department_id: Mapped[UUID | None] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    likelihood: Mapped[int] = mapped_column(Integer, nullable=False, comment="1-5 scale (ISO 31000)")
    impact: Mapped[int] = mapped_column(Integer, nullable=False, comment="1-5 scale (ISO 31000)")
    risk_rating: Mapped[str] = mapped_column(
        String(20), nullable=False, default=RiskRating.MEDIUM, server_default="medium"
    )
    responsible_person_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    is_auto_flagged: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false",
        comment="True when auto-flagged by KPI red status transition"
    )
    auto_flagged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    mitigations: Mapped[list["RiskMitigation"]] = relationship(
        "RiskMitigation", back_populates="risk_item", cascade="all, delete-orphan"
    )
    # String reference avoids circular import with sdbip.py
    kpi: Mapped["SDBIPKpi"] = relationship(  # type: ignore[name-defined]
        "SDBIPKpi", foreign_keys=[kpi_id], lazy="select"
    )
```

### Celery Task Pattern
```python
# Source: src/tasks/pms_auto_populate_task.py
import asyncio
import logging
import sys
from uuid import UUID

from src.tasks.celery_app import app

logger = logging.getLogger(__name__)


@app.task(
    bind=True,
    name="src.tasks.risk_autoflag_task.flag_risk_items_for_kpi",
    max_retries=3,
)
def flag_risk_items_for_kpi(self, kpi_id: str, tenant_id: str):
    """Flag risk items linked to a KPI that just turned red."""
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    async def _run():
        from src.core.database import AsyncSessionLocal
        from src.services.risk_service import RiskService
        service = RiskService()
        async with AsyncSessionLocal() as db:
            try:
                count = await service.auto_flag_for_kpi(
                    kpi_id=UUID(kpi_id), tenant_id=tenant_id, db=db
                )
                logger.info(f"Auto-flagged {count} risk items for KPI {kpi_id}")
                return {"flagged": count}
            except Exception as e:
                logger.error(f"Auto-flag failed: {e}", exc_info=True)
                raise

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error(f"Risk auto-flag task failed, retrying: {exc}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
```

### Alembic Migration Pattern
```python
# Source: alembic/versions/2026_03_01_0001-add_performance_agreements.py
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "2026_03_02_0001"
down_revision: Union[str, None] = "20260302_add_evidence_verification_status"

def upgrade() -> None:
    op.create_table(
        "risk_items",
        sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("kpi_id", sa.Uuid(), sa.ForeignKey("sdbip_kpis.id"), nullable=False),
        sa.Column("department_id", sa.Uuid(), sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("likelihood", sa.Integer(), nullable=False),
        sa.Column("impact", sa.Integer(), nullable=False),
        sa.Column("risk_rating", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("responsible_person_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("is_auto_flagged", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("auto_flagged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
    )
    op.create_index("ix_risk_items_kpi_id", "risk_items", ["kpi_id"])
    op.create_index("ix_risk_items_department_id", "risk_items", ["department_id"])
    op.create_index("ix_risk_items_tenant_id", "risk_items", ["tenant_id"])
    # ... risk_mitigations table similarly
```

### Frontend Risk Widget Pattern (CSS variables, no Tailwind)
```typescript
// Source: CFODashboardPage.tsx pattern — no Tailwind, CSS variables only
import { GlassCard } from '@shared/components/ui/GlassCard';
import { TrafficLightBadge } from '../components/pms/TrafficLightBadge';

// Risk rating color map (reuses traffic light pattern)
const riskColor: Record<string, string> = {
  critical: 'var(--color-coral)',
  high: 'var(--color-gold)',
  medium: '#a78bfa',  // purple-ish for medium
  low: 'var(--color-teal)',
};

// In CFODashboardPage render:
<GlassCard>
  <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
    Risk Register
  </h2>
  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead>
      <tr>
        <th>Risk</th><th>KPI</th><th>Rating</th><th>Auto-Flagged</th>
      </tr>
    </thead>
    <tbody>
      {riskData.items?.map((item: any) => (
        <tr key={item.id}>
          <td>{item.title}</td>
          <td>{item.kpi_number}</td>
          <td>
            <span style={{ color: riskColor[item.risk_rating] }}>{item.risk_rating}</span>
          </td>
          <td>{item.is_auto_flagged ? 'Yes' : 'No'}</td>
        </tr>
      ))}
    </tbody>
  </table>
</GlassCard>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Beat-scheduled risk flagging | On-demand task dispatch at actuals write | Phase 32 design decision | Always correct; same-day flags |
| Hard-coded risk thresholds | ISO 31000 5×5 matrix (likelihood × impact) | Industry standard | Recognized by AG auditors |
| Separate public data app | Extend existing `/api/v1/public/` router | Consistent with Phase 6 public metrics | No new server; same rate limiting |

**Deprecated/outdated:**
- Polling from frontend for auto-flag status: Use existing refresh button pattern instead of polling. Risk items are not time-critical enough to warrant WebSocket.

---

## Open Questions

1. **Who is "authorized user" for RISK-01/RISK-02?**
   - What we know: REQUIREMENTS.md says "authorized user" without specifying exact roles. RISK-04 says CFO and Municipal Manager can *view* the register.
   - What's unclear: Can Section 56 Directors create risk items for their own department? Can PMS Officers create them?
   - Recommendation: Use `require_min_tier(2)` (Directors+) for create/update/delete, and `require_min_tier(1)` (Executives+) for the department-filtered view endpoint. This is consistent with SDBIP access patterns. Planner should confirm.

2. **Should public SDBIP transparency aggregate all municipalities or one at a time?**
   - What we know: REQUIREMENTS.md says "public dashboard shows plain-language SDBIP achievement data." The existing public dashboard has a `MunicipalitySelector`.
   - What's unclear: Is this per-municipality (like existing transparency metrics) or a cross-municipality league table?
   - Recommendation: Follow the existing `municipality_id` optional filter pattern (per-municipality when selected, all active municipalities when not). Consistent with existing public endpoints.

3. **Does auto-flagging apply to non-validated actuals?**
   - What we know: RISK-03 says "when a linked KPI's achievement status turns red." A red status can come from a non-validated submitted actual or a validated one.
   - What's unclear: Should the flag trigger on submission (before PMS officer validation) or only after validation?
   - Recommendation: Trigger on submission (when `actual.traffic_light_status == 'red'` is set by `compute_achievement`). This gives earliest warning. Auto-flag can be cleared if PMS officer rejects the actual.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x with asyncio_mode = "auto" |
| Config file | `pyproject.toml` (`[tool.pytest.ini_options]`) |
| Quick run command | `pytest tests/test_risk_register.py -x` |
| Full suite command | `pytest tests/ --cov=src --cov-report=term-missing` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RISK-01 | Create risk item linked to SDBIP KPI with likelihood/impact/rating | unit | `pytest tests/test_risk_register.py::test_create_risk_item -x` | ❌ Wave 0 |
| RISK-01 | Risk rating computed from likelihood × impact on create | unit | `pytest tests/test_risk_register.py::test_risk_rating_computation -x` | ❌ Wave 0 |
| RISK-01 | Unauthorized role cannot create risk item (403) | unit | `pytest tests/test_risk_register.py::test_create_risk_item_403 -x` | ❌ Wave 0 |
| RISK-02 | Risk item with mitigation strategy and responsible person saves correctly | unit | `pytest tests/test_risk_register.py::test_create_risk_mitigation -x` | ❌ Wave 0 |
| RISK-03 | Auto-flag task marks linked risk items as high-risk when KPI turns red | unit | `pytest tests/test_risk_register.py::test_auto_flag_risk_items -x` | ❌ Wave 0 |
| RISK-03 | Auto-flag does not overwrite critical rating | unit | `pytest tests/test_risk_register.py::test_auto_flag_respects_critical -x` | ❌ Wave 0 |
| RISK-04 | CFO endpoint returns risk register filtered by department_id | unit | `pytest tests/test_risk_register.py::test_list_risk_items_department_filter -x` | ❌ Wave 0 |
| RISK-04 | Non-CFO/MM role receives 403 on risk register view endpoint | unit | `pytest tests/test_risk_register.py::test_list_risk_items_403 -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pytest tests/test_risk_register.py -x`
- **Per wave merge:** `pytest tests/ -x --timeout=60`
- **Phase gate:** `pytest tests/ --cov=src --cov-report=term-missing` (80% coverage required)

### Wave 0 Gaps

- [ ] `tests/test_risk_register.py` — covers RISK-01 through RISK-04 (8 tests above)
- [ ] `src/models/risk.py` — `RiskItem`, `RiskMitigation`, `RiskRating`, `compute_risk_rating`
- [ ] `src/schemas/risk.py` — `RiskItemCreate`, `RiskItemResponse`, `RiskMitigationCreate`
- [ ] `src/services/risk_service.py` — `RiskService` class
- [ ] `src/api/v1/risk.py` — API router
- [ ] `src/tasks/risk_autoflag_task.py` — `flag_risk_items_for_kpi` task
- [ ] Alembic migration: `alembic/versions/2026_03_02_0001-add_risk_register.py`

*(No framework install needed — pytest, asyncio_mode=auto, and SQLite in-memory fixtures already configured.)*

---

## Sources

### Primary (HIGH confidence)

- `src/models/sdbip.py` — SDBIPKpi, SDBIPActual, TenantAwareModel patterns
- `src/models/pa.py` — child model (PAKpi, PAQuarterlyScore) relationship patterns
- `src/models/base.py` — TenantAwareModel, NonTenantModel, do_orm_execute event listener
- `src/tasks/pms_auto_populate_task.py` — Celery task template (asyncio.run, Windows compat, retry pattern)
- `src/api/v1/role_dashboards.py` — require_role() RBAC enforcement on dashboard endpoints
- `src/api/v1/public.py` — unauthenticated public endpoint pattern, rate limiting
- `src/services/role_dashboard_service.py` — aggregation service pattern
- `src/api/v1/sdbip.py` — require_pms_ready() + require_min_tier() combined dependency pattern
- `src/tasks/celery_app.py` — task include list, beat schedule registration
- `frontend-dashboard/src/pages/CFODashboardPage.tsx` — widget pattern (useState, catch→mock, GlassCard, CSS vars)
- `frontend-dashboard/src/services/api.ts` — fetch API function pattern
- `frontend-dashboard/src/mocks/mockRoleDashboards.ts` — mock data structure
- `frontend-public/src/hooks/usePublicStats.ts` — public stats hook pattern
- `frontend-public/src/pages/TransparencyDashboardPage.tsx` — public page structure

### Secondary (MEDIUM confidence)

- ISO 31000:2018 risk management standard — 5×5 likelihood × impact matrix (industry standard for municipal risk registers in South Africa; AGSA audit recommendations reference this)
- `.planning/STATE.md` Accumulated Context section — confirmed all architectural decisions from Phases 28–31 that apply here

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project; verified by reading actual source files
- Architecture: HIGH — all patterns directly copied/adapted from existing Phase 28–31 implementations
- Pitfalls: HIGH — all pitfalls documented from STATE.md accumulated context entries
- Validation: HIGH — existing test infrastructure verified; only new test file needed

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable stack; no fast-moving dependencies)
