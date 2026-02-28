# Phase 28: IDP, SDBIP Core & Performance Monitoring — Research

**Researched:** 2026-02-28
**Domain:** South African Municipal PMS — IDP/SDBIP data models, state machines, evidence upload, Celery auto-population engine
**Confidence:** HIGH (project patterns from codebase) / MEDIUM (South African regulatory specifics from official docs)

---

## Summary

Phase 28 is the data backbone of the entire PMS system. It creates 10–12 new SQLAlchemy models (IDP cycle hierarchy, SDBIP scorecard hierarchy, quarterly actuals, evidence, aggregation rules), three separate approval state machines (IDP, SDBIP, EVID validation), a Celery beat task for auto-population, and a file-upload pipeline with ClamAV virus scanning. Seven frontend pages are also required.

The project already has all the patterns needed: `TenantAwareModel` base class, `python-statemachine` (decided in STATE.md), `AsyncSession` ORM queries, `asyncio.run()` Celery task wrapper, `require_pms_ready()` dependency factory, and Supabase Storage via `storage3`. The primary research risk is the mSCOA reference table — the actual National Treasury Excel file (v5.5) is a pending product owner action before implementation, but the segment schema is well-documented and the seed migration can be stubbed with structure even without the full dataset.

The golden thread (IDP objective → SDBIP KPI foreign key chain) and the immutability pattern (append-only correction records, never update validated actuals) are the two architecturally non-negotiable decisions confirmed in both regulatory requirements and STATE.md.

**Primary recommendation:** Use `python-statemachine` 2.x `MachineMixin` pattern to bind state machine state to the `status` string column on each model. One state machine class per workflow (IDP, SDBIP, EVID validation). Store state as a plain `String` column (no JSON, no separate table). Celery auto-population task follows the exact same `asyncio.run()` wrapper pattern as `sla_monitor.py`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IDP-01 | Authorized user can create a 5-year IDP cycle with title, vision, mission, and status | `IDPCycle` TenantAwareModel; `IDPCycleStatus` StrEnum; `POST /api/v1/idp/cycles` gated by `require_pms_ready()` + `require_min_tier(3)` |
| IDP-02 | Authorized user can add strategic goals and objectives under an IDP cycle with National KPA alignment | `IDPGoal` and `IDPObjective` models with `national_kpa` enum (5 KPAs); FK chain `IDPCycle → IDPGoal → IDPObjective` |
| IDP-03 | Authorized user can create annual IDP review versions within a cycle with version control | `IDPVersion` model with `version_number` Integer and `financial_year` String; FK to `IDPCycle`; unique constraint on `(cycle_id, version_number)` |
| IDP-04 | User can view alignment mapping from IDP objectives down to linked SDBIP KPIs (golden thread) | Read-only API: `GET /api/v1/idp/cycles/{id}/golden-thread` — join `IDPObjective → SDBIPKpi.idp_objective_id` and return tree |
| IDP-05 | IDP cycle supports approval workflow (draft → approved → under_review) | `IDPWorkflow` python-statemachine; transitions: `submit` (draft→approved), `open_review` (approved→under_review); state stored in `IDPCycle.status` column |
| SDBIP-01 | PMS officer can create Top Layer SDBIP for a financial year with organizational KPIs | `SDBIPScorecard` TenantAwareModel with `layer=top`; `financial_year` String (e.g., "2025/26"); gated by `require_pms_ready()` |
| SDBIP-02 | Director can create Departmental SDBIP KPIs for their department linked to IDP objectives | `SDBIPKpi` model with `department_id` FK, `idp_objective_id` FK (nullable for top-layer); director-scoped create endpoint |
| SDBIP-03 | Each KPI includes description, unit of measurement, baseline, annual target, weight, and responsible director | `SDBIPKpi` columns: `description Text`, `unit_of_measurement String`, `baseline Numeric`, `annual_target Numeric`, `weight Numeric` (sum=100 per scorecard), `responsible_director_id UUID FK` |
| SDBIP-04 | Each KPI has quarterly targets (Q1–Q4) that align to the annual target | `SDBIPQuarterlyTarget` model (4 rows per KPI); `quarter` StrEnum Q1–Q4; `target_value Numeric`; API validates sum ≈ annual_target |
| SDBIP-05 | Each KPI links to a validated mSCOA budget code from seeded reference table (not free-text) | `MscoaReference` NonTenantModel seeded table; `SDBIPKpi.mscoa_code_id UUID FK`; lookup endpoint `GET /api/v1/sdbip/mscoa-codes?segment=IE&q=water` |
| SDBIP-06 | SDBIP supports approval workflow (draft → approved → revised) with Mayor sign-off | `SDBIPWorkflow` python-statemachine; transitions: `submit` (draft→approved), `revise` (approved→revised); sign-off requires `executive_mayor` role |
| SDBIP-07 | System auto-populates SDBIP actuals from ticket resolution data for service-delivery KPIs | Celery beat task `populate_sdbip_actuals`; queries `Ticket` WHERE `is_sensitive=FALSE AND status='resolved' AND resolved_at BETWEEN <quarter_start> AND <quarter_end>`; writes `SDBIPActual` with `is_auto_populated=True` |
| SDBIP-08 | Auto-population rules are configurable per KPI (ticket category, aggregation type, formula description) | `SDBIPTicketAggregationRule` model: `kpi_id UUID FK`, `ticket_category String`, `aggregation_type StrEnum (count/sum/avg)`, `formula_description Text`, `source_query_ref String` |
| SDBIP-09 | Authorized user can adjust SDBIP targets at mid-year when adjustments budget is approved | `PATCH /api/v1/sdbip/kpis/{id}/adjust-targets`; requires SDBIP status=approved + `require_min_tier(2)`; creates audit log entry; does NOT reset to draft |
| SDBIP-10 | mSCOA reference table is seeded from National Treasury classification and queryable by segment | `MscoaReference` table; migration creates table + seeds stub rows; full seed from NT Excel file (pending product owner); search endpoint by segment and code prefix |
| EVID-01 | Director or department manager can submit quarterly actual values against SDBIP KPI targets | `SDBIPActual` model: `kpi_id`, `quarter`, `actual_value Numeric`, `submitted_by`, `submitted_at`; `POST /api/v1/sdbip/actuals` gated by `require_min_tier(2)` |
| EVID-02 | System calculates achievement percentage for each KPI per quarter automatically | `achievement_pct = (actual_value / quarterly_target) * 100`; computed on write and stored in `SDBIPActual.achievement_pct Numeric`; `traffic_light_status` computed from threshold |
| EVID-03 | User can upload portfolio of evidence (documents, photos, spreadsheets) per quarterly actual | `EvidenceDocument` model linked to `SDBIPActual`; upload endpoint streams to Supabase Storage bucket `salga-evidence-{municipality_id}` after ClamAV scan |
| EVID-04 | PMS officer can validate submitted quarterly actuals via validation workflow | `validate_actual` transition on `ActualWorkflow` state machine; requires `pms_officer` role; sets `SDBIPActual.validated_by` and `validated_at` |
| EVID-05 | Validated actuals are immutable — corrections require new submission record with full audit trail | `SDBIPActual.is_validated Bool`; API enforces: if `is_validated=True`, reject PUT/PATCH; corrections POST new record with `corrects_actual_id UUID FK` to original |
| EVID-06 | System flags KPIs with traffic-light status (green ≥80%, amber 50–79%, red <50% achievement) | Enum `TrafficLight = green/amber/red`; computed: `>=80 → green`, `50-79 → amber`, `<50 → red`; stored in `SDBIPActual.traffic_light_status` |
| EVID-07 | Evidence documents are virus-scanned on upload before storage | `clamav-client` against ClamAV daemon on port 3310; reject upload with 422 if virus found; scan BEFORE storage write; log scan result in `EvidenceDocument.scan_status` |
| EVID-08 | Auto-populated actuals are clearly marked with source query reference and distinguishable from manual entries | `SDBIPActual.is_auto_populated Bool`, `SDBIPActual.source_query_ref String`; API response includes flag; frontend renders different badge for auto vs manual |
</phase_requirements>

---

## Standard Stack

### Core (already in pyproject.toml or decided in STATE.md)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| python-statemachine | 2.5.0 (latest) | IDP/SDBIP/EVID approval state machines | Chosen in STATE.md; `MachineMixin` binds FSM state to ORM `String` column cleanly |
| SQLAlchemy | 2.0.36 | All PMS models — async ORM | Already installed; `TenantAwareModel` base class in use |
| FastAPI | 0.128.0 | 30+ new PMS API routes | Already installed |
| celery[redis] | >=5.6.0 | Auto-population beat task | Already installed; pattern established in `sla_monitor.py` |
| supabase-py | >=2.27.3 | Supabase Storage for evidence upload | Already installed; `StorageService` exists |
| alembic | 1.14.0 | Schema migrations for 10+ new tables | Already installed; timestamp naming convention in use |
| clamav-client | latest | ClamAV virus scanning on evidence upload | Decided in STATE.md (`clamav-client` against Docker sidecar on port 3310) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| openpyxl | >=3.1.0 | Parse NT mSCOA Excel v5.5 for seeding | Seed migration script for `mscoa_reference` table |
| Decimal (stdlib) | — | Precise numeric calculations for KPI targets/actuals | All monetary/percentage calculations — never float |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| python-statemachine | transitions library | `transitions` is more Pythonic for simple cases, but `python-statemachine` has better Django/SQLAlchemy integration via `MachineMixin` and is the project decision |
| ClamAV Docker sidecar | REST-based clamav-rest-api | REST wrapper adds an HTTP hop; direct TCP clamd protocol via `clamav-client` is more reliable in a containerized environment |
| Computed achievement_pct on read | Store precomputed value | Storing is cheaper for dashboard queries that aggregate across many KPIs; always recompute if source data changes |

**Installation (new additions only):**
```bash
pip install clamav-client python-statemachine
```

---

## Architecture Patterns

### Recommended Model Structure

```
src/models/
├── idp.py               # IDPCycle, IDPGoal, IDPObjective, IDPVersion
├── sdbip.py             # SDBIPScorecard, SDBIPKpi, SDBIPQuarterlyTarget
│                        # SDBIPActual, SDBIPTicketAggregationRule
├── evidence.py          # EvidenceDocument
└── mscoa_reference.py   # MscoaReference (NonTenantModel — no tenant scope)

src/services/
├── idp_service.py       # IDP CRUD + golden thread query
├── sdbip_service.py     # SDBIP CRUD + achievement calculation
├── evidence_service.py  # POE upload + ClamAV scan + signed URL serving
└── pms_auto_populate.py # Auto-population engine (called from Celery task)

src/tasks/
└── pms_auto_populate_task.py  # Celery beat task (mirrors sla_monitor.py pattern)

src/api/v1/
├── idp.py               # IDP routes
└── sdbip.py             # SDBIP + KPI + actuals + evidence routes

frontend-dashboard/src/pages/
├── IdpPage.tsx           # IDP cycle list + create
├── IdpDetailPage.tsx     # Goals, objectives, golden thread
├── SdbipPage.tsx         # Scorecard list
├── SdbipKpiPage.tsx      # KPI list + create + quarterly targets
├── ActualsPage.tsx       # Quarterly actuals submission table
├── EvidencePage.tsx      # POE upload per actual
└── GoldenThreadPage.tsx  # Read-only alignment tree
```

### Pattern 1: TenantAwareModel for All PMS Models

All new models except `MscoaReference` MUST inherit `TenantAwareModel`. The session-level `do_orm_execute` event listener in `base.py` adds `tenant_id` filter to every SELECT automatically. If a model doesn't inherit `TenantAwareModel`, it bypasses this security layer.

```python
# src/models/idp.py
from enum import StrEnum
from uuid import UUID
from sqlalchemy import String, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from src.models.base import TenantAwareModel, NonTenantModel

class IDPStatus(StrEnum):
    DRAFT = "draft"
    APPROVED = "approved"
    UNDER_REVIEW = "under_review"

class NationalKPA(StrEnum):
    BASIC_SERVICE_DELIVERY = "basic_service_delivery"
    LOCAL_ECONOMIC_DEVELOPMENT = "local_economic_development"
    MUNICIPAL_FINANCIAL_VIABILITY = "municipal_financial_viability"
    GOOD_GOVERNANCE = "good_governance"
    MUNICIPAL_TRANSFORMATION = "municipal_transformation"

class IDPCycle(TenantAwareModel):
    __tablename__ = "idp_cycles"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    vision: Mapped[str | None] = mapped_column(Text, nullable=True)
    mission: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_year: Mapped[int] = mapped_column(Integer, nullable=False)  # e.g. 2022
    end_year: Mapped[int] = mapped_column(Integer, nullable=False)    # e.g. 2027
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=IDPStatus.DRAFT
    )
```

### Pattern 2: python-statemachine with String Column Binding

Bind the FSM state to the model's `status` String column. The `MachineMixin` approach (Django docs) works with any ORM — just set `state_field_name` to the ORM column name. Call `machine.send(event)` then persist the model via `await db.commit()`.

```python
# Source: https://python-statemachine.readthedocs.io/en/latest/integrations.html
from statemachine import StateMachine, State

class IDPWorkflow(StateMachine):
    draft = State(initial=True, value="draft")
    approved = State(value="approved")
    under_review = State(value="under_review")

    submit = draft.to(approved)
    open_review = approved.to(under_review)
    re_approve = under_review.to(approved)

    def on_enter_approved(self):
        # Hook for notifications, audit logging
        pass

# Usage in service layer:
async def approve_idp_cycle(cycle: IDPCycle, actor: User, db: AsyncSession):
    machine = IDPWorkflow(model=cycle)
    machine.current_state_value = cycle.status  # restore from DB
    machine.submit()                             # raises InvalidTransitionError if invalid
    cycle.status = machine.current_state_value  # sync back to model
    cycle.updated_by = str(actor.id)
    await db.commit()
```

**Critical note on version:** python-statemachine 2.x changed the API from 1.x. The `State(value=...)` syntax is the 2.x approach. Do NOT use 1.x `State(value=...)` style with `initial=True` on the `State()` call. Verify installed version is 2.x before planning tasks.

### Pattern 3: Achievement Percentage and Traffic Light

Computed on write, stored as columns. Never re-derive on read — dashboards aggregate across many KPIs.

```python
# src/models/sdbip.py
from decimal import Decimal

class TrafficLight(StrEnum):
    GREEN = "green"
    AMBER = "amber"
    RED = "red"

def compute_achievement(actual: Decimal, target: Decimal) -> tuple[Decimal, str]:
    """Returns (achievement_pct, traffic_light)."""
    if target == 0:
        return Decimal("0"), TrafficLight.RED
    pct = (actual / target) * Decimal("100")
    if pct >= Decimal("80"):
        return pct, TrafficLight.GREEN
    elif pct >= Decimal("50"):
        return pct, TrafficLight.AMBER
    else:
        return pct, TrafficLight.RED
```

### Pattern 4: Immutability Enforcement — Correction Record Pattern

Validated actuals are immutable. Corrections are new records with a back-reference.

```python
class SDBIPActual(TenantAwareModel):
    __tablename__ = "sdbip_actuals"

    kpi_id: Mapped[UUID] = mapped_column(ForeignKey("sdbip_kpis.id"), nullable=False)
    quarter: Mapped[str] = mapped_column(String(2), nullable=False)  # Q1, Q2, Q3, Q4
    actual_value: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    achievement_pct: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    traffic_light_status: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Immutability
    is_validated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    validated_by: Mapped[str | None] = mapped_column(String, nullable=True)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Correction chain
    corrects_actual_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("sdbip_actuals.id"), nullable=True
    )

    # Auto-population
    is_auto_populated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source_query_ref: Mapped[str | None] = mapped_column(String(500), nullable=True)

# API enforcement:
# if actual.is_validated:
#     raise HTTPException(422, "Validated actuals are immutable. Submit a correction record.")
```

### Pattern 5: Celery Auto-Population Task

Mirrors `sla_monitor.py` exactly. Uses `asyncio.run()` + `AsyncSessionLocal`.

```python
# src/tasks/pms_auto_populate_task.py
@app.task(bind=True, name="src.tasks.pms_auto_populate_task.populate_sdbip_actuals", max_retries=3)
def populate_sdbip_actuals(self):
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    async def _run():
        from src.core.database import AsyncSessionLocal
        from src.services.pms_auto_populate import AutoPopulationEngine
        async with AsyncSessionLocal() as db:
            engine = AutoPopulationEngine()
            result = await engine.populate_current_quarter(db)
            logger.info(f"Auto-populated {result['populated']} actuals")
            return result

    try:
        return asyncio.run(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
```

Add to celery beat schedule in `celery_app.py`:
```python
"populate-sdbip-actuals": {
    "task": "src.tasks.pms_auto_populate_task.populate_sdbip_actuals",
    "schedule": crontab(minute=0, hour=1),  # 01:00 SAST daily
},
```

**SEC-05 Extension:** Every aggregation query in the auto-population engine MUST include:
```python
.where(Ticket.is_sensitive == False)  # SEC-05: Never include GBV tickets
```

### Pattern 6: ClamAV Evidence Upload Pipeline

```python
# src/services/evidence_service.py
import clamav_client  # pypi: clamav-client

CLAMD_HOST = "localhost"  # or Docker service name
CLAMD_PORT = 3310

async def scan_and_upload_evidence(
    file_content: bytes,
    filename: str,
    actual_id: UUID,
    tenant_id: str,
) -> dict:
    # 1. Virus scan FIRST — reject before touching storage
    scan_result = clamav_client.scan_bytes(file_content, host=CLAMD_HOST, port=CLAMD_PORT)
    if scan_result != "OK":
        raise HTTPException(422, f"File rejected by virus scanner: {scan_result}")

    # 2. Upload to per-municipality bucket
    bucket = f"salga-evidence-{tenant_id}"
    path = f"actuals/{actual_id}/{filename}"
    # ... upload via StorageService
```

### Pattern 7: mSCOA Reference Table (NonTenantModel)

mSCOA codes are global — shared across all municipalities. Use `NonTenantModel` (not `TenantAwareModel`).

```python
class MscoaReference(NonTenantModel):
    __tablename__ = "mscoa_reference"

    segment: Mapped[str] = mapped_column(String(5), nullable=False, index=True)
    # Segments: C (Costing), F (Fund), FX (Function), IA (Item:Assets),
    #           IE (Item:Expenditure), IZ (Item:Gains/Losses), IR (Item:Revenue),
    #           P (Project), R (Regional)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
```

Lookup endpoint (no tenant filter needed — NonTenantModel bypasses `do_orm_execute`):
```python
@router.get("/sdbip/mscoa-codes")
async def search_mscoa(segment: str | None = None, q: str | None = None, db: AsyncSession = Depends(get_db)):
    stmt = select(MscoaReference).where(MscoaReference.is_active == True)
    if segment:
        stmt = stmt.where(MscoaReference.segment == segment.upper())
    if q:
        stmt = stmt.where(MscoaReference.description.ilike(f"%{q}%"))
    # ...
```

### Pattern 8: Quarter Boundary Logic

Financial year starts July 1 (MFMA standard). Quarter boundaries:

```python
from datetime import date

def get_quarter_boundaries(financial_year: str, quarter: str) -> tuple[date, date]:
    """e.g. financial_year='2025/26', quarter='Q1' → (2025-07-01, 2025-09-30)"""
    start_year = int(financial_year.split("/")[0])
    quarters = {
        "Q1": (date(start_year, 7, 1),  date(start_year, 9, 30)),
        "Q2": (date(start_year, 10, 1), date(start_year, 12, 31)),
        "Q3": (date(start_year + 1, 1, 1), date(start_year + 1, 3, 31)),
        "Q4": (date(start_year + 1, 4, 1), date(start_year + 1, 6, 30)),
    }
    return quarters[quarter]
```

### Pattern 9: Golden Thread Read Query

```python
async def get_golden_thread(cycle_id: UUID, db: AsyncSession) -> dict:
    """IDP Cycle → Goals → Objectives → SDBIP KPIs (read-only alignment view)."""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(IDPCycle)
        .options(
            selectinload(IDPCycle.goals)
            .selectinload(IDPGoal.objectives)
            .selectinload(IDPObjective.sdbip_kpis)
        )
        .where(IDPCycle.id == cycle_id)
    )
    cycle = result.scalar_one_or_none()
    # ... serialize to tree dict
```

### Anti-Patterns to Avoid

- **Float for KPI values:** Use `Decimal` / `NUMERIC(12,4)` in SQLAlchemy — never `float` for monetary or percentage values.
- **Free-text mSCOA codes:** `SDBIPKpi.mscoa_code_id` must be a FK to `mscoa_reference.id`, not a String column. The requirement is explicit (SDBIP-05).
- **Updating validated actuals:** Any PUT/PATCH to `SDBIPActual` where `is_validated=True` must return 422. Enforce at API layer, not just DB.
- **GBV data in auto-population:** Every aggregation query MUST have `AND is_sensitive = FALSE`. Missing this is a SEC-05 violation.
- **Async in Celery without asyncio.run():** Celery workers are synchronous. Follow the `sla_monitor.py` pattern exactly.
- **Tenant filter on MscoaReference:** `MscoaReference` uses `NonTenantModel`. The session event listener skips it (no `tenant_id` attribute). Do not add `tenant_id` to this table.
- **Mid-year SDBIP target adjustment resetting to draft:** SDBIP-09 says the adjustment does NOT trigger a new approval workflow. The SDBIP remains approved; only the targets change. Create an audit log entry instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State machine transitions and validation | Custom if/elif status checks | `python-statemachine` | Guards, hooks, `InvalidTransitionError` are handled; prevents illegal state transitions |
| Virus scanning protocol | Custom TCP ClamAV client | `clamav-client` PyPI | Handles protocol framing, large file chunking, connection errors |
| Percentage calculations with rounding errors | Python `float` math | `Decimal` from stdlib | Financial/percentage values require exact decimal math |
| mSCOA code validation | Regex or string matching | FK to `mscoa_reference` table | Referential integrity enforced at DB level; prevents stale codes |
| Quarterly boundary dates | Hardcoded date lists | `get_quarter_boundaries()` helper function | Must compute dynamically from `financial_year_start_month` (July=7) on the `Municipality` model |

**Key insight:** The three approval workflows (IDP, SDBIP, EVID validation) are conceptually identical patterns. Write one `StateMachine` class per workflow, bind it to the model's `status` String column, and reuse the same service-layer pattern for all three.

---

## Common Pitfalls

### Pitfall 1: python-statemachine 1.x vs 2.x API Mismatch
**What goes wrong:** If `python-statemachine` 1.x is installed (not 2.x), `State(value=...)` doesn't exist in the same way and `MachineMixin` binds differently.
**Why it happens:** pyproject.toml uses `python-statemachine` without a pinned version in the base deps (it was decided but may not be installed yet).
**How to avoid:** Pin to `python-statemachine>=2.0.0` in pyproject.toml. In Wave 0, run `pip show python-statemachine` to verify version before writing state machine classes.
**Warning signs:** `State() got unexpected keyword argument 'value'` or `StateMachine has no attribute MachineMixin`.

### Pitfall 2: Celery Workers Use Sync DB Session
**What goes wrong:** Using `AsyncSession` directly in Celery task body (outside `asyncio.run()`) causes `RuntimeError: no running event loop`.
**Why it happens:** Celery workers are synchronous Python threads. `AsyncSession` requires a running asyncio event loop.
**How to avoid:** Always wrap async code in `async def _run(): ... asyncio.run(_run())` inside the `@app.task` function. This is the established `sla_monitor.py` pattern.
**Warning signs:** `RuntimeError: no current event loop` in Celery worker logs.

### Pitfall 3: mSCOA Reference Table Query Bypasses Tenant Filter Incorrectly
**What goes wrong:** Querying `MscoaReference` with a tenant context set causes the `do_orm_execute` listener to raise `SecurityError` if `NonTenantModel` check fails.
**Why it happens:** `do_orm_execute` checks `hasattr(mapper_class, 'tenant_id')`. If `MscoaReference` accidentally inherits `TenantAwareModel`, it will require tenant context.
**How to avoid:** `MscoaReference` MUST inherit `NonTenantModel` only.
**Warning signs:** `SecurityError: Tenant context not set for tenant-aware query` on mSCOA lookup endpoints.

### Pitfall 4: ClamAV Docker Sidecar Not Available in Test Environment
**What goes wrong:** Unit tests fail because ClamAV daemon is not running on port 3310.
**Why it happens:** ClamAV is a Docker sidecar; unit tests don't start Docker.
**How to avoid:** Mock `clamav_client.scan_bytes` in unit tests. Use the pattern established in `test_storage_service.py` (mock the external service). Integration tests tagged `@pytest.mark.integration` can test real ClamAV.
**Warning signs:** `ConnectionRefusedError: [Errno 111] Connection refused` in test output.

### Pitfall 5: Supabase Storage Bucket Naming
**What goes wrong:** Bucket name `salga-evidence-{municipality_id}` — if `municipality_id` is a UUID with hyphens, Supabase bucket names must be lowercase alphanumeric with hyphens. UUIDs contain hyphens so this is fine, but the bucket must be pre-created.
**Why it happens:** Supabase Storage does not auto-create buckets. Buckets must exist before upload.
**How to avoid:** Bucket creation should be part of municipality onboarding (existing `StorageService` should have a `ensure_bucket_exists()` method). Add to the evidence service pre-flight check.
**Warning signs:** `404 Bucket not found` on first upload attempt for a new municipality.

### Pitfall 6: Golden Thread Query N+1 Problem
**What goes wrong:** Loading IDP → Goals → Objectives → KPIs lazily in a loop causes N+1 queries.
**Why it happens:** SQLAlchemy lazy loading is the default; each relationship access triggers a new query.
**How to avoid:** Use `selectinload` chains (Pattern 9 above). For the golden thread, always load the full hierarchy in one query with `selectinload`.
**Warning signs:** Golden thread endpoint takes >2 seconds and logs show hundreds of SELECT statements.

### Pitfall 7: Achievement Percentage Division by Zero
**What goes wrong:** `actual / target` when `target == 0` raises `DivisionByZero` or produces `Infinity`.
**Why it happens:** Some KPIs may have 0 as a quarterly target (e.g., no target set for Q4 yet).
**How to avoid:** Use the `compute_achievement()` helper that guards for `target == 0 → return (0, "red")`.
**Warning signs:** Unhandled `InvalidOperation` exception from `Decimal` division in Celery logs.

---

## Code Examples

### State Machine — SDBIP Approval Workflow (Confirmed Pattern)

```python
# Source: https://python-statemachine.readthedocs.io/en/latest/ (verified Context7)
from statemachine import StateMachine, State

class SDBIPWorkflow(StateMachine):
    """SDBIP approval: draft → approved → revised."""
    draft = State(initial=True, value="draft")
    approved = State(value="approved")
    revised = State(value="revised")

    submit = draft.to(approved)      # Mayor sign-off
    revise = approved.to(revised)
    resubmit = revised.to(approved)

    def before_submit(self, event_data):
        # Validate: all KPIs have quarterly targets
        pass

    def on_enter_approved(self, event_data):
        # Notify: Municipal Manager and CFO
        pass
```

### Alembic Migration — Numeric Column Pattern

```python
# Follow timestamp naming: 2026_02_28_0004-add_idp_sdbip_models.py
op.create_table(
    "sdbip_kpis",
    sa.Column("id", sa.Uuid(), primary_key=True),
    sa.Column("tenant_id", sa.String(), nullable=False, index=True),
    sa.Column("annual_target", sa.Numeric(12, 4), nullable=False),
    sa.Column("weight", sa.Numeric(5, 2), nullable=False),  # e.g. 20.00 (%)
    sa.Column("achievement_pct", sa.Numeric(8, 4), nullable=True),
    # ...
)
```

### Frontend — Traffic Light Badge Component

```tsx
// Use CSS variables from @shared/design-tokens.css (no Tailwind — project decision)
// Use GlassCard, Button, Input from @shared/components/ui/

interface TrafficLightBadgeProps {
  status: 'green' | 'amber' | 'red';
  pct: number;
}

export function TrafficLightBadge({ status, pct }: TrafficLightBadgeProps) {
  const colors = {
    green: 'var(--color-success)',
    amber: 'var(--color-warning)',
    red: 'var(--color-error)',
  };
  return (
    <span style={{
      backgroundColor: colors[status],
      color: 'white',
      borderRadius: '4px',
      padding: '2px 8px',
      fontSize: '0.75rem',
      fontWeight: 600,
    }}>
      {pct.toFixed(1)}%
    </span>
  );
}
```

---

## South African Regulatory Context

This section provides critical domain knowledge for implementation decisions.

### National KPA Structure (5 KPAs — IDP-02)

South African municipalities are required to align IDP goals to the five National Key Performance Areas:

1. **Basic Service Delivery and Infrastructure** — water, sanitation, electricity, roads, waste
2. **Local Economic Development** — job creation, investment attraction, SMME support
3. **Municipal Financial Viability and Management** — revenue collection, clean audits
4. **Good Governance and Public Participation** — public meetings, ward committees, transparency
5. **Municipal Transformation and Institutional Development** — organogram, HR, skills

These map directly to the `NationalKPA` enum on `IDPGoal`. Enum values should use snake_case.

### mSCOA Segment Structure (SDBIP-05, SDBIP-10)

mSCOA v5.5 defines 7–9 segments. For SDBIP KPI budget code linking, the relevant segments are:

| Segment Code | Name | PMS Relevance |
|---|---|---|
| IE | Item: Expenditure | Operating expenditure per KPI — most common for SDBIP |
| IA | Item: Assets/Liabilities | Capital expenditure KPIs |
| FX | Function | What municipal function (e.g., Roads, Water) |
| F | Fund | External/internal funding source |
| P | Project | Capital projects |

The `MscoaReference` table seed stub should include at minimum 20–30 common IE segment codes (personnel, repairs, contracted services) to make the lookup endpoint functional before the full NT Excel is available.

### Financial Year and Quarter Boundaries (EVID-01, SDBIP-07)

MFMA standard: financial year is July 1 – June 30. Municipality model stores `financial_year_start_month = 7`. Quarter dates:

| Quarter | Start | End | Section 52 Due |
|---------|-------|-----|----------------|
| Q1 | 1 Jul | 30 Sep | 31 Oct |
| Q2 | 1 Oct | 31 Dec | 31 Jan |
| Q3 | 1 Jan | 31 Mar | 30 Apr |
| Q4 | 1 Apr | 30 Jun | 31 Jul |

The auto-population task (SDBIP-07) must use `resolved_at BETWEEN quarter_start AND quarter_end`. Do not use `created_at`.

### IDP Version Control (IDP-03)

Municipalities are required to review the IDP annually within the 5-year cycle. Each annual review produces a new IDP version (Year 1 review, Year 2 review, etc.). The `IDPVersion` model represents these reviews — it is NOT a version of the cycle itself but an annual snapshot. The cycle spans 5 years; versions span individual financial years within that cycle.

### SDBIP Layers (SDBIP-01, SDBIP-02)

The `municipality.sdbip_layers` field (default=2) controls the scorecard depth:
- Layer 1: Top Layer SDBIP — organizational KPIs (created by PMS officer)
- Layer 2: Departmental SDBIP — KPIs per department (created by Section 56 Director)

The system currently supports 2 layers. Do not implement layer 3+ in Phase 28.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `transitions` library for FSM | `python-statemachine` 2.x | STATE.md decision | Better `MachineMixin` integration; cleaner state binding to ORM |
| Free-text budget codes | FK to `mscoa_reference` seeded table | SDBIP-05 requirement | Enforces referential integrity; eliminates typos in budget classifications |
| Manual quarterly reports | Section 52 auto-generation (Phase 30) | Phase 30 (not Phase 28) | Phase 28 just provides the data; Phase 30 generates reports |

**Not changing in this phase:**
- Authentication/JWT: unchanged from Phase 27
- Celery/Redis: existing configuration extended with new beat tasks
- Supabase Storage: existing `StorageService` extended with evidence bucket logic

---

## Open Questions

1. **mSCOA v5.5 Excel file availability**
   - What we know: The full NT mSCOA v5.5 Excel file is a pending product owner action (STATE.md Pending Todos)
   - What's unclear: Whether the file will be available before Phase 28 planning begins
   - Recommendation: Plan the migration and seeding script to read from the Excel file; stub with 30 common IE-segment codes in the migration so the system is usable. The full import can be a separate follow-up task.

2. **ClamAV Docker sidecar deployment environment**
   - What we know: clamav-client on port 3310 is the decided approach (STATE.md). ClamAV sidecar configuration on Render/Fly.io is a pending validation (STATE.md Pending Todos).
   - What's unclear: Whether the hosting platform supports Docker sidecars or requires a separate ClamAV service.
   - Recommendation: Implement with `CLAMAV_HOST` and `CLAMAV_PORT` as environment variables. If ClamAV unavailable, log warning and allow upload (fail-open) in dev, fail-closed in production (`ENVIRONMENT=production`).

3. **Supabase Storage bucket count at scale**
   - What we know: Per-municipality bucket pattern (`salga-evidence-{municipality_id}`) is the decision. Bucket count validation at 257-municipality scale is pending (STATE.md Pending Todos).
   - What's unclear: Supabase Pro bucket limit for the configured plan.
   - Recommendation: Proceed with per-municipality buckets as decided. If limit is hit, the fallback is a single `salga-evidence` bucket with tenant-prefixed paths (RLS enforced). This can be changed without model migration.

4. **Auto-population frequency**
   - What we know: The beat task should run after each quarter closes. Daily is too frequent; monthly may miss the first day after quarter end.
   - Recommendation: Run the beat task daily at 01:00 SAST. Include idempotency guard: if a non-validated auto-populated actual already exists for `(kpi_id, quarter, financial_year)`, skip it. If a validated auto-populated actual exists, skip it.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.0 + pytest-asyncio 0.24.0 |
| Config file | `pyproject.toml` (`[tool.pytest.ini_options]`) |
| Quick run command | `pytest tests/test_pms_idp.py tests/test_pms_sdbip.py -x --tb=short` |
| Full suite command | `pytest --cov=src --cov-report=html` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IDP-01 | Create IDP cycle returns 201 with status=draft | unit | `pytest tests/test_pms_idp.py::test_create_idp_cycle -x` | Wave 0 |
| IDP-02 | Add goal with national_kpa enum value succeeds | unit | `pytest tests/test_pms_idp.py::test_add_idp_goal_with_kpa -x` | Wave 0 |
| IDP-03 | Create IDP version with unique constraint enforced | unit | `pytest tests/test_pms_idp.py::test_idp_version_unique -x` | Wave 0 |
| IDP-04 | Golden thread returns full hierarchy | unit | `pytest tests/test_pms_idp.py::test_golden_thread_structure -x` | Wave 0 |
| IDP-05 | IDP draft→approved state machine transition | unit | `pytest tests/test_pms_idp.py::test_idp_workflow_submit -x` | Wave 0 |
| IDP-05 | Invalid transition raises 409 | unit | `pytest tests/test_pms_idp.py::test_idp_invalid_transition -x` | Wave 0 |
| SDBIP-01 | Create top-layer scorecard returns 201 | unit | `pytest tests/test_pms_sdbip.py::test_create_top_layer_scorecard -x` | Wave 0 |
| SDBIP-02 | Director creates departmental KPI linked to objective | unit | `pytest tests/test_pms_sdbip.py::test_create_departmental_kpi -x` | Wave 0 |
| SDBIP-03 | KPI weight validation (sum ≠ 100 rejected) | unit | `pytest tests/test_pms_sdbip.py::test_kpi_weight_validation -x` | Wave 0 |
| SDBIP-04 | Quarterly targets Q1+Q2+Q3+Q4 roughly ≈ annual target | unit | `pytest tests/test_pms_sdbip.py::test_quarterly_targets_sum -x` | Wave 0 |
| SDBIP-05 | Invalid mSCOA code FK rejected at API | unit | `pytest tests/test_pms_sdbip.py::test_invalid_mscoa_code_rejected -x` | Wave 0 |
| SDBIP-06 | SDBIP draft→approved requires executive_mayor role | unit | `pytest tests/test_pms_sdbip.py::test_sdbip_approval_role_gate -x` | Wave 0 |
| SDBIP-07 | Auto-population task writes SDBIPActual with is_auto_populated=True | unit | `pytest tests/test_pms_auto_populate.py::test_auto_populate_writes_actual -x` | Wave 0 |
| SDBIP-07 | SEC-05: GBV tickets excluded from auto-population | unit | `pytest tests/test_pms_auto_populate.py::test_gbv_excluded_from_auto_populate -x` | Wave 0 |
| SDBIP-08 | Aggregation rule count type counts resolved tickets | unit | `pytest tests/test_pms_auto_populate.py::test_count_aggregation -x` | Wave 0 |
| SDBIP-09 | Mid-year adjustment does not reset SDBIP to draft | unit | `pytest tests/test_pms_sdbip.py::test_midyear_adjustment_no_draft_reset -x` | Wave 0 |
| SDBIP-10 | mSCOA search by segment returns matching codes | unit | `pytest tests/test_pms_sdbip.py::test_mscoa_search_by_segment -x` | Wave 0 |
| EVID-01 | Director submits actual; achievement_pct computed | unit | `pytest tests/test_pms_actuals.py::test_submit_actual_computes_pct -x` | Wave 0 |
| EVID-02 | Achievement percentage formula correct | unit | `pytest tests/test_pms_actuals.py::test_achievement_pct_formula -x` | Wave 0 |
| EVID-03 | Evidence upload endpoint accepts PDF | manual (ClamAV) | `pytest tests/test_pms_evidence.py::test_evidence_upload -x -m integration` | Wave 0 |
| EVID-04 | PMS officer validate endpoint sets is_validated=True | unit | `pytest tests/test_pms_actuals.py::test_pms_officer_validates_actual -x` | Wave 0 |
| EVID-05 | PUT/PATCH on validated actual returns 422 | unit | `pytest tests/test_pms_actuals.py::test_validated_actual_immutable -x` | Wave 0 |
| EVID-05 | Correction record corrects_actual_id links to original | unit | `pytest tests/test_pms_actuals.py::test_correction_record_links_original -x` | Wave 0 |
| EVID-06 | Traffic light green ≥80, amber 50–79, red <50 | unit | `pytest tests/test_pms_actuals.py::test_traffic_light_thresholds -x` | Wave 0 |
| EVID-07 | ClamAV scan: virus detected returns 422 | unit (mocked ClamAV) | `pytest tests/test_pms_evidence.py::test_virus_rejected -x` | Wave 0 |
| EVID-08 | Auto-populated actual has source_query_ref set | unit | `pytest tests/test_pms_auto_populate.py::test_source_query_ref_populated -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/test_pms_idp.py tests/test_pms_sdbip.py tests/test_pms_actuals.py tests/test_pms_auto_populate.py tests/test_pms_evidence.py -x --tb=short`
- **Per wave merge:** `pytest --cov=src --cov-report=term-missing`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/test_pms_idp.py` — covers IDP-01 through IDP-05
- [ ] `tests/test_pms_sdbip.py` — covers SDBIP-01 through SDBIP-10
- [ ] `tests/test_pms_actuals.py` — covers EVID-01 through EVID-06, EVID-08
- [ ] `tests/test_pms_evidence.py` — covers EVID-03, EVID-07 (ClamAV mocked)
- [ ] `tests/test_pms_auto_populate.py` — covers SDBIP-07, SDBIP-08, EVID-08

---

## Sources

### Primary (HIGH confidence)
- `/fgmacedo/python-statemachine` (Context7) — state machine patterns, MachineMixin, transition callbacks
- `/supabase/storage-py` (Context7) — storage client, signed URLs, upload patterns
- `src/models/base.py` — TenantAwareModel, NonTenantModel, do_orm_execute event listener
- `src/tasks/sla_monitor.py` — Celery asyncio.run() + AsyncSessionLocal pattern
- `src/services/pms_readiness.py` — require_pms_ready() factory pattern
- `src/api/deps.py` — require_role(), require_min_tier(), TIER_ORDER
- `pyproject.toml` — installed library versions
- `.planning/STATE.md` — python-statemachine, WeasyPrint, clamav-client, per-municipality bucket decisions

### Secondary (MEDIUM confidence)
- [MFMA National Treasury mSCOA Regulations](https://mfma.treasury.gov.za/RegulationsandGazettes/MunicipalRegulationsOnAStandardChartOfAccountsFinal/Pages/default.aspx) — mSCOA 7-segment structure verified
- [SALGA PMS Training Manual](http://salga.org.za/khub/KMP%20Issue%202/Municipal%20Capabilities%20and%20Governance/Performance%20Management%20Training%20Manuals/201900%20Learner%20Guide%20-%20PMS%20POLITICAL%20STREAM.pdf) — 5 National KPAs, KPI structure, Section 57 requirements
- [George Municipality Section 52 Report](https://www.george.gov.za/wp-content/uploads/2023/07/GMPerformanceAssessmentReportQ4_01April_30June2023.pdf) — Section 52 field structure: baseline, annual target, quarterly target, actual, variance
- [clamav-client PyPI](https://pypi.org/project/clamav-client/) — Python ClamAV client verified as the library to use

### Tertiary (LOW confidence)
- WebSearch for Celery beat + SQLAlchemy async quarterly scheduling — no authoritative source found; the `sla_monitor.py` project pattern is the implementation guide

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in pyproject.toml or STATE.md decisions; Context7 confirms python-statemachine and storage-py patterns
- Architecture: HIGH — all patterns derived from existing project code (`sla_monitor.py`, `pms_readiness.py`, `TenantAwareModel`, `StorageService`); no speculation
- South African regulatory domain: MEDIUM — mSCOA segment structure verified from NT official docs; 5 KPAs verified from SALGA training material; Section 52 quarterly field structure verified from real municipal reports
- Pitfalls: HIGH — derived from actual codebase analysis (`do_orm_execute` listener logic, Celery worker sync/async boundary, existing test patterns)

**Research date:** 2026-02-28
**Valid until:** 2026-04-30 (stable regulatory framework; library APIs unlikely to break)
