# Phase 29: Individual Performance Agreements - Research

**Researched:** 2026-03-01
**Domain:** Performance agreement data models, state machine workflow, quarterly review scoring, POPIA retention, frontend integration
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PA-01 | PMS officer can create performance agreement for Section 57 manager linked to financial year | PerformanceAgreement model inheriting TenantAwareModel; pms_officer role is Tier 3 — pms_deps() gate applies; financial_year field validated as YYYY/YY |
| PA-02 | Performance agreement KPIs link to organizational SDBIP KPIs with individual targets and weights | PAKpi model with FK to sdbip_kpis.id; individual_target and weight columns; weight sum validation at service layer mirrors SDBIPKpi pattern |
| PA-03 | Evaluator can score individual KPIs per quarter in quarterly review workflow | PAQuarterlyScore model per (pa_kpi_id, quarter); scored_by stored as user ID string matching SDBIPActual.submitted_by pattern |
| PA-04 | System compiles annual assessment score from quarterly scores and KPI weights | Weighted average computation in PAService.compile_annual_score(); mirrors compute_achievement() from sdbip.py |
| PA-05 | Performance agreement supports status workflow (draft → signed → under_review → assessed) | PAWorkflow StateMachine using python-statemachine 3.0.0 with start_value binding; same pattern as IDPWorkflow and SDBIPWorkflow |
| PA-06 | Municipal Manager signs performance agreements for directors; Executive Mayor signs for Municipal Manager | Role-gated signing endpoints: require_role(MUNICIPAL_MANAGER, ADMIN) for directors; require_role(EXECUTIVE_MAYOR, ADMIN) for MM; determined by manager_role field on PA |
</phase_requirements>

---

## Summary

Phase 29 adds Individual Performance Agreements (PAs) for Section 57 managers — the layer between organizational SDBIP KPIs and individual staff accountability required by the Municipal Systems Act. The data model is a thin layer on top of existing Phase 28 models: a `PerformanceAgreement` anchored to a `financial_year` and a `section57_manager_id` (FK to `users.id`), with child `PAKpi` records referencing existing `sdbip_kpis.id` and carrying individual-level targets and weights. A `PAQuarterlyScore` table records per-quarter scores from evaluators, and a service method computes the weighted annual assessment score automatically.

The approval state machine follows the exact same python-statemachine 3.0.0 pattern established in Phases 28-01 (IDPWorkflow) and 28-02/28-03 (SDBIPWorkflow): `start_value=` model binding, `TransitionNotAllowed → HTTP 409`. The new four-state machine is `draft → signed → under_review → assessed`. Signing is role-gated: Municipal Manager signs director PAs, Executive Mayor signs the Municipal Manager's PA — enforced at the API layer using `require_role()` based on the `manager_role` stored on the agreement. POPIA retention is a boolean flag (`popia_retention_flag`) on `PerformanceAgreement` set at assessment completion, with deletion rights honored through the existing `data_rights.py` pattern (soft-delete and audit chain).

The frontend extends the existing `PmsHubPage` dropdown to add a `'performance-agreements'` view, consistent with how `IdpPage`, `SdbipPage`, and `GoldenThreadPage` are embedded. Celery notifications to evaluators at quarter-start reuse the existing beat schedule pattern from `celery_app.py`.

**Primary recommendation:** Follow the SDBIPWorkflow + SDBIPService layering exactly — model in `src/models/pa.py`, service in `src/services/pa_service.py`, router at `src/api/v1/pa.py`, Alembic migration `2026_03_XX-add_performance_agreements.py`, frontend in `PerformanceAgreementsPage.tsx` embedded in `PmsHubPage`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| python-statemachine | 3.0.0 | PA approval state machine (draft→signed→under_review→assessed) | Already installed; established pattern in IDPWorkflow, SDBIPWorkflow |
| SQLAlchemy 2.0 | 2.0.36 | Async ORM for PerformanceAgreement, PAKpi, PAQuarterlyScore models | Project standard; TenantAwareModel base class |
| FastAPI | 0.128.0 | REST API for PA CRUD and state transitions | Project standard |
| Pydantic v2 | bundled with FastAPI 0.128 | Schema validation for PA create/response payloads | Project standard |
| Alembic | 1.14.0 | Database migration for new tables | Project standard; timestamp naming convention |
| Celery + Redis | 5.6.0 | Quarter-start notifications to evaluators | Already in beat schedule; pattern from pms_auto_populate_task.py |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| aiosqlite | 0.20.0 | SQLite in-memory for unit tests | All PA tests run against SQLite (no PostgreSQL needed) |
| fakeredis | 2.21.0+ | Redis mock in tests | Any Celery notification tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| python-statemachine | transitions library | transitions is not installed; python-statemachine already proven in project with start_value= binding |
| Weighted average in service | DB-computed column | DB computed columns are PostgreSQL-specific and break SQLite unit tests; service layer is SQLite-safe |
| PAQuarterlyScore as JSON blob on PA | Separate table | Separate table enables per-quarter queries, corrections, and audit; JSON blob is unqueryable |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── models/pa.py              # PerformanceAgreement, PAKpi, PAQuarterlyScore, PAWorkflow
├── schemas/pa.py             # PACreate, PAKpiCreate, PAScoreCreate, PAResponse, etc.
├── services/pa_service.py    # PAService — CRUD + state machine + score compilation
├── api/v1/pa.py              # APIRouter prefix=/api/v1/pa
├── tasks/pa_notify_task.py   # Celery task: notify evaluators at quarter-start
alembic/versions/
└── 2026_03_XX-add_performance_agreements.py  # Migration: pa tables + RLS policies
frontend-dashboard/src/
├── pages/PerformanceAgreementsPage.tsx   # Embedded in PmsHubPage
tests/
└── test_pms_pa.py            # Unit tests covering PA-01 through PA-06
```

### Pattern 1: TenantAwareModel for PerformanceAgreement

All PA models inherit `TenantAwareModel` (same as IDP and SDBIP models). This gives automatic `tenant_id` filtering via the `do_orm_execute` session event.

```python
# Source: src/models/base.py (project pattern)
from src.models.base import TenantAwareModel
from statemachine import State, StateMachine
from statemachine.exceptions import TransitionNotAllowed  # noqa: F401

class PAStatus(StrEnum):
    DRAFT = "draft"
    SIGNED = "signed"
    UNDER_REVIEW = "under_review"
    ASSESSED = "assessed"

class ManagerRole(StrEnum):
    """Determines which executive signs the agreement."""
    SECTION57_DIRECTOR = "section57_director"   # signed by Municipal Manager
    MUNICIPAL_MANAGER = "municipal_manager"     # signed by Executive Mayor

class PAWorkflow(StateMachine):
    """PA approval workflow: draft -> signed -> under_review -> assessed.

    Usage with model binding (python-statemachine 3.x)::
        machine = PAWorkflow(model=agreement, state_field="status",
                             start_value=agreement.status)
        machine.send(event)  # modifies agreement.status in place
        # Catch TransitionNotAllowed -> HTTP 409
    """
    draft = State(initial=True, value="draft")
    signed = State(value="signed")
    under_review = State(value="under_review")
    assessed = State(value="assessed")

    sign = draft.to(signed)            # MM signs director PA; ExecMayor signs MM PA
    open_review = signed.to(under_review)   # Quarter review opens
    assess = under_review.to(assessed)      # Annual assessment compiled

class PerformanceAgreement(TenantAwareModel):
    __tablename__ = "performance_agreements"
    __table_args__ = (
        UniqueConstraint(
            "section57_manager_id", "financial_year", "tenant_id",
            name="uq_pa_manager_fy_tenant"
        ),
    )
    financial_year: Mapped[str]       # "2025/26" — validated YYYY/YY
    section57_manager_id: Mapped[UUID]  # FK to users.id (Section 57 manager)
    manager_role: Mapped[str]          # "section57_director" or "municipal_manager"
    status: Mapped[str]                # PAStatus enum, default "draft"
    annual_score: Mapped[Decimal | None]  # Compiled by PAService.compile_annual_score()
    popia_retention_flag: Mapped[bool]    # POPIA: set True at assessment
    popia_departure_date: Mapped[datetime | None]  # Set on official departure — triggers deletion eligibility
```

### Pattern 2: PAKpi — Linking to Existing SDBIPKpi

PAKpi is a child of PerformanceAgreement and references an existing `sdbip_kpis.id`. Individual targets and weights are stored separately from the org-level KPI.

```python
# Source: modeled on SDBIPKpi pattern (src/models/sdbip.py)
class PAKpi(TenantAwareModel):
    __tablename__ = "pa_kpis"
    __table_args__ = (
        UniqueConstraint("agreement_id", "sdbip_kpi_id", name="uq_pa_kpi_agreement_sdbip"),
    )
    agreement_id: Mapped[UUID]       # FK to performance_agreements.id
    sdbip_kpi_id: Mapped[UUID]       # FK to sdbip_kpis.id (links to org KPI)
    individual_target: Mapped[Decimal]  # Manager's individual target (may differ from org)
    weight: Mapped[Decimal]           # % weight (0-100); sum per PA validated at service layer
    description: Mapped[str | None]   # Optional notes on this individual KPI
```

### Pattern 3: State Machine with start_value Binding

Exact pattern established in Phase 28-01 (IDPWorkflow) and Phase 28-03 (SDBIPWorkflow). Critical for non-initial states — without `start_value`, the machine resets to `draft`.

```python
# Source: src/models/sdbip.py SDBIPWorkflow + src/services/sdbip_service.py
async def transition_agreement(self, agreement_id: UUID, event: str, user: User, db: AsyncSession):
    agreement = await self._get_agreement_or_404(agreement_id, db)

    # Signing role gate: determined by manager_role on the agreement
    if event == "sign":
        if agreement.manager_role == ManagerRole.SECTION57_DIRECTOR:
            allowed = {UserRole.MUNICIPAL_MANAGER, UserRole.ADMIN, UserRole.SALGA_ADMIN}
        else:  # municipal_manager PA
            allowed = {UserRole.EXECUTIVE_MAYOR, UserRole.ADMIN, UserRole.SALGA_ADMIN}
        if user.role not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient role to sign this agreement")

    machine = PAWorkflow(model=agreement, state_field="status", start_value=agreement.status)
    try:
        machine.send(event)
    except TransitionNotAllowed:
        raise HTTPException(status_code=409, detail=f"Cannot '{event}' from status '{agreement.status}'")

    # Set POPIA retention flag on assessment
    if event == "assess":
        agreement.popia_retention_flag = True

    await db.commit()
    await db.refresh(agreement)
    return agreement
```

### Pattern 4: Annual Score Compilation

Weighted average of per-quarter, per-KPI scores. Mirrors `compute_achievement()` from `sdbip.py` — Decimal arithmetic to avoid float precision issues.

```python
# Source: modeled on compute_achievement() pattern (src/models/sdbip.py)
async def compile_annual_score(self, agreement_id: UUID, db: AsyncSession) -> Decimal:
    """Compile annual assessment score from quarterly scores and KPI weights.

    Formula: sum(avg_quarterly_score_for_kpi * kpi_weight) / sum(kpi_weights)

    Returns weighted average score (0-100 scale).
    Division by zero (no KPIs with weight): returns Decimal('0').
    """
    # Fetch PA KPIs with their quarterly scores (selectinload pattern)
    result = await db.execute(
        select(PAKpi).options(selectinload(PAKpi.quarterly_scores))
        .where(PAKpi.agreement_id == agreement_id)
    )
    pa_kpis = result.scalars().all()

    total_weighted = Decimal("0")
    total_weight = Decimal("0")
    for kpi in pa_kpis:
        if not kpi.quarterly_scores:
            continue
        avg_score = sum(s.score for s in kpi.quarterly_scores) / len(kpi.quarterly_scores)
        total_weighted += Decimal(str(avg_score)) * kpi.weight
        total_weight += kpi.weight

    if total_weight == Decimal("0"):
        return Decimal("0")
    return total_weighted / total_weight
```

### Pattern 5: Role-Gated Signing Endpoints

Rather than a generic `require_role` dependency, the signing role depends on the PA being signed. Use `require_min_tier(1)` as the gate and role-check inside the service:

```python
# Source: src/api/v1/pa.py
@router.post(
    "/{agreement_id}/transitions",
    response_model=PAResponse,
    dependencies=[Depends(require_pms_ready()), Depends(require_min_tier(1))],
    # Tier 1 required because both MM and ExecMayor are Tier 1 signers
    summary="Transition PA status (sign, open_review, assess)",
)
async def transition_agreement(
    agreement_id: UUID,
    payload: PATransitionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PAResponse:
    agreement = await _service.transition_agreement(agreement_id, payload.event, current_user, db)
    return PAResponse.model_validate(agreement)
```

### Pattern 6: Celery Notification for Quarter-Start

Add a new Celery beat task in `celery_app.py` and `pa_notify_task.py`. Runs at Q1-Q4 start dates (July 1, October 1, January 1, April 1 — first day of each South African financial quarter).

```python
# Source: src/tasks/celery_app.py beat_schedule (project pattern)
app.conf.beat_schedule["notify-pa-evaluators-q-start"] = {
    "task": "src.tasks.pa_notify_task.notify_pa_evaluators",
    # Runs on first day of each SA financial quarter at 08:00 SAST
    "schedule": crontab(day_of_month="1", month_of_year="1,4,7,10", hour=8, minute=0),
}
```

### Pattern 7: POPIA Retention Flag

The `popia_retention_flag` boolean is set to `True` when the agreement reaches `assessed` status (in the `assess` transition handler). The `popia_departure_date` is set by the PMS officer when the manager officially departs. The existing `data_rights.py` `/api/v1/data-rights/my-data` endpoint and deletion flow extend naturally — PA records for a user are included in their data export and eligible for deletion when `popia_departure_date` is set and retention period (typically 5 years for SA government records) has elapsed.

```python
# Extend data_rights.py pattern to include PA records
# POPIA: # PA records
pa_result = await db.execute(
    select(PerformanceAgreement).where(
        PerformanceAgreement.section57_manager_id == current_user.id
    )
)
pa_records = pa_result.scalars().all()
```

### Pattern 8: Frontend PmsHubPage Extension

Add `'performance-agreements'` to the existing `VIEW_OPTIONS` array in `PmsHubPage.tsx` and create `PerformanceAgreementsPage.tsx` as an embedded component.

```typescript
// Source: frontend-dashboard/src/pages/PmsHubPage.tsx (existing pattern)
type PmsView = 'idp' | 'sdbip' | 'golden-thread' | 'setup' | 'performance-agreements';

const VIEW_OPTIONS: ViewOption[] = [
  { value: 'idp', label: 'IDP Management', createLabel: '+ Create IDP Cycle' },
  { value: 'sdbip', label: 'SDBIP Scorecards', createLabel: '+ Create Scorecard' },
  { value: 'golden-thread', label: 'Golden Thread' },
  { value: 'performance-agreements', label: 'Performance Agreements', createLabel: '+ Create Agreement' },
  { value: 'setup', label: 'PMS Setup', adminOnly: true },
];
```

### Anti-Patterns to Avoid

- **Starting the state machine without `start_value`:** Always pass `start_value=agreement.status`. Without it, `PAWorkflow(model=agreement, state_field="status")` resets to the initial state (`draft`) for non-draft agreements, corrupting transitions. (Confirmed issue from Phase 28-01 notes in STATE.md.)
- **Computing annual score at query time:** Score compilation involves O(n×4) DB rows per agreement; pre-compute and store in `annual_score` on the PA record, recompute only when called explicitly (on `assess` transition or via dedicated endpoint).
- **Hardcoding role check outside service:** The signing role (MM vs ExecMayor) depends on the PA's `manager_role` field — this cannot be done purely as a FastAPI dependency because it requires DB lookup. Enforce in service layer, not in decorator.
- **Unique constraint on sdbip_kpi_id alone:** A single SDBIP KPI may appear in multiple PAs (different managers, different financial years). Uniqueness is `(agreement_id, sdbip_kpi_id)`, not `sdbip_kpi_id` alone.
- **Cascading delete from PerformanceAgreement to PAKpi:** Do NOT use `cascade="all, delete-orphan"` on the PA→PAKpi relationship if PAKpi records form part of the performance record. Soft-delete with `is_active` flag preferred for audit integrity (mirrors EvidenceDocument pattern).
- **Weight sum enforced as DB constraint:** DB check constraints break SQLite in unit tests. Enforce weight sum = 100 at service layer on creation/update (HTTPException 422), not as a CHECK constraint. Matches the SDBIPKpi pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State machine transitions | Custom if/elif status strings | python-statemachine 3.0.0 PAWorkflow | TransitionNotAllowed is atomic, thread-safe, already in project |
| Annual score computation | SQL aggregate window functions | Python service method (Decimal arithmetic) | SQLite test compatibility; same as compute_achievement() |
| Role-gated signing | Custom middleware | require_role() + service-layer role check | Dependency factory pattern established in deps.py |
| Tenant isolation | Manual WHERE clauses | TenantAwareModel + do_orm_execute event | Automatic fail-closed behavior on missing tenant context |
| Quarter determination | Date arithmetic from scratch | Python datetime + known quarter boundaries (July/Oct/Jan/Apr) | Simple, already done in pms_auto_populate.py |

**Key insight:** Every pattern needed for Phase 29 already exists in the codebase. This phase is fundamentally "apply the same layering used for SDBIP KPIs/actuals to a new domain (individual PAs)".

---

## Common Pitfalls

### Pitfall 1: SQLAlchemy Ambiguity with Multiple FKs

**What goes wrong:** `PAKpi` has two UUIDs that could relate to `users.id`: `scored_by` in `PAQuarterlyScore`, and the `section57_manager_id` on `PerformanceAgreement`. SQLAlchemy raises `AmbiguousForeignKeysError` if relationships are declared without `foreign_keys=` argument.

**Why it happens:** SQLAlchemy cannot infer which FK to use when a model has multiple columns referencing the same parent table.

**How to avoid:** Always declare `foreign_keys=[ColumnName]` explicitly on relationships, especially when a model FKs to `users.id` more than once.

**Warning signs:** `AmbiguousForeignKeysError` at startup (before any requests).

### Pitfall 2: start_value Omission on Non-Draft Agreements

**What goes wrong:** Loading a `signed` PA into `PAWorkflow(model=pa, state_field="status")` without `start_value=pa.status` resets the machine state to `draft`. The `open_review` transition then appears valid even though the agreement is in an illegal intermediate state.

**Why it happens:** python-statemachine 3.0.0 defaults to the `initial=True` state when no `start_value` is provided.

**How to avoid:** Always: `PAWorkflow(model=pa, state_field="status", start_value=pa.status)`. This is documented in STATE.md as a critical pattern from Phase 28-01.

**Warning signs:** Agreements in non-draft states unexpectedly accepting `sign` transition (should be rejected as already signed).

### Pitfall 3: ID Capture Before Commit in Async Context

**What goes wrong:** After `db.commit()`, SQLAlchemy expires all ORM objects. Accessing `agreement.id` after commit in an async context triggers `MissingGreenlet` error.

**Why it happens:** SQLAlchemy 2.0 async expiry — accessing expired attributes outside the async context raises an error.

**How to avoid:** Capture `agreement_id = agreement.id` before the commit. Pattern documented in STATE.md from Phase 28-03.

**Warning signs:** `MissingGreenlet` or `greenlet_spawn` errors in service layer.

### Pitfall 4: Weight Sum Validation With No KPIs

**What goes wrong:** Creating a PA with no KPIs and then calling compile_annual_score() returns Decimal('0'). If the state machine allows `assess` before any KPIs are scored, an empty agreement gets assessed with score 0.

**Why it happens:** No guard on minimum KPI count.

**How to avoid:** In `transition_agreement()`, before allowing `assess` event, verify at least one `PAQuarterlyScore` exists for the agreement. Return 422 with actionable message if none found.

**Warning signs:** Annual scores of exactly 0 on assessed agreements that appear to have KPIs.

### Pitfall 5: Unique Constraint on section57_manager_id + financial_year

**What goes wrong:** Allowing multiple draft agreements for the same manager in the same financial year creates ambiguity for the signing workflow and for score compilation.

**Why it happens:** No uniqueness enforcement at DB level.

**How to avoid:** `UniqueConstraint("section57_manager_id", "financial_year", "tenant_id")` in `__table_args__`. Catch `IntegrityError` at service layer → 409 Conflict. Same pattern as `uq_idp_cycle_title_tenant` and `uq_sdbip_scorecard_fy_layer_dept`.

**Warning signs:** Duplicate agreement creation succeeds without error.

### Pitfall 6: Celery Notification Task Must Iterate Tenants via Raw SQL

**What goes wrong:** The Celery notification task runs without any tenant JWT context. Accessing `PerformanceAgreement` via ORM triggers the `do_orm_execute` fail-closed guard (SecurityError: tenant context not set).

**Why it happens:** `TenantAwareModel` requires `tenant_id` in context; Celery tasks have no request/JWT context.

**How to avoid:** Discover tenant IDs via `text()` raw SQL (same pattern as `AutoPopulationEngine` in `pms_auto_populate.py`), then loop: `set_tenant_context(tenant_id)` → query → `clear_tenant_context()` with try/finally.

**Warning signs:** `SecurityError: Tenant context not set for tenant-aware query` in Celery worker logs.

---

## Code Examples

### PerformanceAgreement Model Skeleton

```python
# Source: project pattern from src/models/sdbip.py + src/models/idp.py
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from statemachine import State, StateMachine
from statemachine.exceptions import TransitionNotAllowed  # noqa: F401

from src.models.base import TenantAwareModel


class PAStatus(StrEnum):
    DRAFT = "draft"
    SIGNED = "signed"
    UNDER_REVIEW = "under_review"
    ASSESSED = "assessed"


class ManagerRole(StrEnum):
    SECTION57_DIRECTOR = "section57_director"
    MUNICIPAL_MANAGER = "municipal_manager"


class PAWorkflow(StateMachine):
    draft = State(initial=True, value="draft")
    signed = State(value="signed")
    under_review = State(value="under_review")
    assessed = State(value="assessed")

    sign = draft.to(signed)
    open_review = signed.to(under_review)
    assess = under_review.to(assessed)


class PerformanceAgreement(TenantAwareModel):
    __tablename__ = "performance_agreements"
    __table_args__ = (
        UniqueConstraint(
            "section57_manager_id", "financial_year", "tenant_id",
            name="uq_pa_manager_fy_tenant",
        ),
    )

    financial_year: Mapped[str] = mapped_column(String(10), nullable=False)
    section57_manager_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    manager_role: Mapped[str] = mapped_column(
        String(30), nullable=False,
        comment="'section57_director' or 'municipal_manager'",
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=PAStatus.DRAFT, server_default="draft"
    )
    annual_score: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    popia_retention_flag: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false",
        comment="POPIA: True once agreement is assessed; deletion eligible after departure",
    )
    popia_departure_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="POPIA: date of official departure; enables deletion rights",
    )

    # Relationships
    kpis: Mapped[list["PAKpi"]] = relationship(
        "PAKpi", back_populates="agreement", lazy="select"
    )
    manager: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[section57_manager_id], lazy="select"
    )
```

### PAKpi and PAQuarterlyScore Models

```python
# Source: project pattern from src/models/sdbip.py SDBIPKpi + SDBIPActual
class PAKpi(TenantAwareModel):
    __tablename__ = "pa_kpis"
    __table_args__ = (
        UniqueConstraint("agreement_id", "sdbip_kpi_id", name="uq_pa_kpi_agreement_sdbip"),
    )

    agreement_id: Mapped[UUID] = mapped_column(
        ForeignKey("performance_agreements.id"), nullable=False, index=True
    )
    sdbip_kpi_id: Mapped[UUID] = mapped_column(
        ForeignKey("sdbip_kpis.id"), nullable=False, index=True,
        comment="Links to org-level KPI; individual_target may differ from org annual_target",
    )
    individual_target: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    weight: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False,
        comment="% contribution to individual PA score (0-100; sum per PA = 100)",
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    agreement: Mapped["PerformanceAgreement"] = relationship(
        "PerformanceAgreement", back_populates="kpis"
    )
    quarterly_scores: Mapped[list["PAQuarterlyScore"]] = relationship(
        "PAQuarterlyScore", back_populates="pa_kpi", cascade="all, delete-orphan",
        order_by="PAQuarterlyScore.quarter",
    )
    sdbip_kpi: Mapped["SDBIPKpi"] = relationship(  # type: ignore[name-defined]
        "SDBIPKpi", foreign_keys=[sdbip_kpi_id], lazy="select"
    )


class PAQuarterlyScore(TenantAwareModel):
    __tablename__ = "pa_quarterly_scores"
    __table_args__ = (
        UniqueConstraint("pa_kpi_id", "quarter", name="uq_pa_score_kpi_quarter"),
    )

    pa_kpi_id: Mapped[UUID] = mapped_column(
        ForeignKey("pa_kpis.id"), nullable=False, index=True
    )
    quarter: Mapped[str] = mapped_column(
        String(2), nullable=False,
        comment="Q1, Q2, Q3, or Q4 (SA financial year: July-June)",
    )
    score: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False,
        comment="Score out of 100 for this KPI in this quarter",
    )
    scored_by: Mapped[str | None] = mapped_column(String, nullable=True)
    scored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    pa_kpi: Mapped["PAKpi"] = relationship("PAKpi", back_populates="quarterly_scores")
```

### Schema Example (Pydantic v2)

```python
# Source: project pattern from src/schemas/sdbip.py
import re
from datetime import datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator

_FINANCIAL_YEAR_PATTERN = re.compile(r"^\d{4}/\d{2}$")

class PACreate(BaseModel):
    financial_year: str = Field(..., description="YYYY/YY format e.g. '2025/26'")
    section57_manager_id: UUID
    manager_role: str  # "section57_director" or "municipal_manager"

    @field_validator("financial_year")
    @classmethod
    def validate_financial_year(cls, v: str) -> str:
        if not _FINANCIAL_YEAR_PATTERN.match(v):
            raise ValueError("financial_year must match YYYY/YY")
        return v

class PAKpiCreate(BaseModel):
    sdbip_kpi_id: UUID
    individual_target: Decimal = Field(..., ge=0)
    weight: Decimal = Field(..., ge=0, le=100)
    description: str | None = None

class PAScoreCreate(BaseModel):
    quarter: str  # Q1|Q2|Q3|Q4
    score: Decimal = Field(..., ge=0, le=100)
    notes: str | None = None

class PATransitionRequest(BaseModel):
    event: str  # "sign", "open_review", "assess"

class PAResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    financial_year: str
    section57_manager_id: UUID
    manager_role: str
    status: str
    annual_score: Decimal | None
    popia_retention_flag: bool
    tenant_id: str
    created_at: datetime
    updated_at: datetime | None = None
```

### Unit Test Structure

```python
# Source: project pattern from tests/test_pms_sdbip.py, tests/test_pms_idp.py
# File: tests/test_pms_pa.py
import pytest
from decimal import Decimal
from uuid import uuid4
from unittest.mock import MagicMock
from src.core.tenant import set_tenant_context, clear_tenant_context
from src.models.pa import PerformanceAgreement, PAKpi, PAQuarterlyScore, PAStatus, PAWorkflow
from src.models.user import User, UserRole
from src.services.pa_service import PAService

pytestmark = pytest.mark.asyncio

def make_mock_pms_officer(tenant_id=None) -> MagicMock:
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.role = UserRole.PMS_OFFICER
    user.tenant_id = tenant_id or str(uuid4())
    return user

def make_mock_mm(tenant_id=None) -> MagicMock:
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.role = UserRole.MUNICIPAL_MANAGER
    user.tenant_id = tenant_id or str(uuid4())
    return user

# Tests:
# test_create_agreement_draft_status — POST creates PA in draft
# test_unique_constraint_manager_fy — second PA for same manager+year → 409
# test_add_kpi_to_agreement — PAKpi creates with individual_target and weight
# test_weight_sum_exceeds_100_rejected — service raises 422
# test_sign_agreement_by_mm — MM signs director PA, status → signed
# test_sign_agreement_wrong_role — Tier 3 user cannot sign → 403
# test_executive_mayor_signs_mm_pa — ExecMayor signs MM's PA → signed
# test_quarterly_score_submission — PAQuarterlyScore creates for Q1
# test_compile_annual_score — weighted average across 4 quarters 2 KPIs
# test_compile_annual_score_empty — no scores → 0 (no crash)
# test_assess_transition — status → assessed, popia_retention_flag=True
# test_assess_without_scores_rejected — assess before any scores → 422
# test_invalid_transition — sign twice → 409
# test_popia_departure_date_set — field stored correctly
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled status string comparisons | python-statemachine 3.0.0 StateMachine | Phase 28 decision (STATE.md) | AtomicTransitionNotAllowed, cleaner code |
| Full PMDS for all staff | Section 57 managers only (5-8 per municipality) | REQUIREMENTS.md Out of Scope | Keeps Phase 29 tractable |
| Python floats for scoring | Decimal arithmetic | Phase 28 (sdbip.py compute_achievement) | No float precision errors in percentage calculations |

**Decisions carried from STATE.md (non-negotiable):**
- python-statemachine 3.0.0 for all PMS workflows
- `start_value=` model binding on every state machine instantiation
- ID capture before commit to avoid `MissingGreenlet`
- Service-layer (not DB constraint) enforcement of business rules for SQLite test compatibility
- Soft-delete (not hard-delete) for audit integrity

---

## Open Questions

1. **Who are valid evaluators for quarterly scoring (PA-03)?**
   - What we know: The requirement says "Evaluator" without specifying the role. In MFMA context, Municipal Manager evaluates Section 57 directors, and Executive Mayor/Council evaluates the MM.
   - What's unclear: Should the evaluator be the same person as the signer, or can PMS officers also enter scores on behalf of evaluators?
   - Recommendation: Store `scored_by` as a free-form user ID string (same pattern as `submitted_by` on SDBIPActual) and enforce role check at API level: `require_min_tier(1)` for scoring — only Tier 1 users and the assigned manager's supervisor can score. If ambiguous, default to: Tier 1 + pms_officer can score (same as `validate_actual` permissions from 28-05).

2. **Should score be 0-100 percentage, or a DPSA rating scale (1-5)?**
   - What we know: REQUIREMENTS.md Out of Scope explicitly states "Standardized scoring (percentage-based) for v2.0; custom rubrics add complexity without clear value."
   - What's unclear: The DPSA (Department of Public Service and Administration) uses a 1-5 performance scale for Section 57 evaluations in South Africa.
   - Recommendation: Use 0-100 (percentage-based) as per REQUIREMENTS.md. Store as Numeric(5,2) to support both percentage scores (e.g., 85.50) and future scale remapping without schema change.

3. **How many PA KPIs per agreement in practice?**
   - What we know: Phase 28 `SDBIPKpi.weight` enforces sum=100 at service layer; same rule applies to PAKpi.
   - What's unclear: Typical Section 57 agreements in SA municipalities have 5-10 KPIs.
   - Recommendation: No minimum KPI count enforced at model level, but prevent `assess` if no scored KPIs exist (service-layer guard in `transition_agreement`).

4. **POPIA retention period for PA records?**
   - What we know: PA-06 requires POPIA retention flag and deletion rights on official departure.
   - What's unclear: The statutory retention period for Section 57 performance records in South Africa. National Archives Act requires 5 years minimum for government personnel records.
   - Recommendation: Store `popia_departure_date` on the PA; surface it in `/data-rights/my-data` export; actual deletion eligibility determination is a product decision. Do not auto-delete — set flag, let admin confirm deletion manually. This matches the existing `is_deleted` soft-delete pattern.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.3.0 + pytest-asyncio 0.24.0 |
| Config file | `pyproject.toml` (asyncio_mode = "auto") |
| Quick run command | `pytest tests/test_pms_pa.py -x` |
| Full suite command | `pytest --cov=src --cov-report=term-missing` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PA-01 | PMS officer creates PA in draft status | unit | `pytest tests/test_pms_pa.py::test_create_agreement_draft_status -x` | ❌ Wave 0 |
| PA-01 | Unique constraint enforced (same manager + FY) | unit | `pytest tests/test_pms_pa.py::test_unique_constraint_manager_fy -x` | ❌ Wave 0 |
| PA-02 | PA KPI created with sdbip_kpi_id, individual_target, weight | unit | `pytest tests/test_pms_pa.py::test_add_kpi_to_agreement -x` | ❌ Wave 0 |
| PA-02 | Weight sum > 100 rejected with 422 | unit | `pytest tests/test_pms_pa.py::test_weight_sum_exceeds_100_rejected -x` | ❌ Wave 0 |
| PA-03 | Evaluator can submit quarterly score for a PA KPI | unit | `pytest tests/test_pms_pa.py::test_quarterly_score_submission -x` | ❌ Wave 0 |
| PA-04 | Annual score compiled from quarterly scores × weights | unit | `pytest tests/test_pms_pa.py::test_compile_annual_score -x` | ❌ Wave 0 |
| PA-04 | Compile with no scores returns 0, no crash | unit | `pytest tests/test_pms_pa.py::test_compile_annual_score_empty -x` | ❌ Wave 0 |
| PA-05 | draft → signed transition succeeds | unit | `pytest tests/test_pms_pa.py::test_sign_agreement_by_mm -x` | ❌ Wave 0 |
| PA-05 | Invalid transition (sign twice) returns 409 | unit | `pytest tests/test_pms_pa.py::test_invalid_transition -x` | ❌ Wave 0 |
| PA-05 | assess sets popia_retention_flag=True | unit | `pytest tests/test_pms_pa.py::test_assess_transition -x` | ❌ Wave 0 |
| PA-05 | assess without scores returns 422 | unit | `pytest tests/test_pms_pa.py::test_assess_without_scores_rejected -x` | ❌ Wave 0 |
| PA-06 | MM signs director PA (correct role) | unit | `pytest tests/test_pms_pa.py::test_sign_agreement_by_mm -x` | ❌ Wave 0 |
| PA-06 | ExecMayor signs MM's PA (correct role) | unit | `pytest tests/test_pms_pa.py::test_executive_mayor_signs_mm_pa -x` | ❌ Wave 0 |
| PA-06 | Wrong role cannot sign → 403 | unit | `pytest tests/test_pms_pa.py::test_sign_agreement_wrong_role -x` | ❌ Wave 0 |
| PA-06 | POPIA departure date stored correctly | unit | `pytest tests/test_pms_pa.py::test_popia_departure_date_set -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pytest tests/test_pms_pa.py -x`
- **Per wave merge:** `pytest tests/test_pms_pa.py tests/test_pms_sdbip.py tests/test_pms_idp.py -x`
- **Phase gate:** `pytest --cov=src --cov-report=term-missing` (80% minimum)

### Wave 0 Gaps

- [ ] `tests/test_pms_pa.py` — covers PA-01 through PA-06 (all 15 test cases above)
- [ ] `src/models/pa.py` — PerformanceAgreement, PAKpi, PAQuarterlyScore, PAWorkflow, PAStatus, ManagerRole
- [ ] `src/schemas/pa.py` — PACreate, PAKpiCreate, PAScoreCreate, PATransitionRequest, PAResponse, PAKpiResponse, PAScoreResponse
- [ ] `src/services/pa_service.py` — PAService with create_agreement, add_kpi, add_quarterly_score, compile_annual_score, transition_agreement, list_agreements
- [ ] `src/api/v1/pa.py` — APIRouter prefix=/api/v1/pa with all CRUD + transition endpoints
- [ ] `alembic/versions/2026_03_XX-add_performance_agreements.py` — creates performance_agreements, pa_kpis, pa_quarterly_scores tables with indexes, constraints, RLS policies
- [ ] `src/tasks/pa_notify_task.py` — Celery task for quarter-start evaluator notifications
- [ ] `frontend-dashboard/src/pages/PerformanceAgreementsPage.tsx` — embedded in PmsHubPage

*(No framework install needed — pytest + pytest-asyncio already installed)*

---

## Sources

### Primary (HIGH confidence)

- Project codebase — `src/models/sdbip.py`, `src/models/idp.py`, `src/models/base.py`: TenantAwareModel pattern, PAWorkflow structure, start_value binding, Decimal arithmetic
- Project codebase — `src/services/sdbip_service.py`, `src/services/idp_service.py`: service layer patterns, state machine usage, ID capture before commit
- Project codebase — `src/api/v1/sdbip.py`, `src/api/v1/idp.py`: router patterns, _pms_deps(), require_min_tier, require_pms_ready
- Project codebase — `src/api/deps.py`: TIER_ORDER, require_role(), require_min_tier() — signing role enforcement
- Project codebase — `src/tasks/celery_app.py`, `src/tasks/pms_auto_populate_task.py`: Celery beat schedule, tenant iteration via raw SQL
- Project codebase — `src/api/v1/data_rights.py`: POPIA retention and deletion pattern
- `.planning/STATE.md`: Critical execution decisions: start_value= binding, ID capture before commit, SQLite compatibility for unit tests, pyclamd import pattern
- `.planning/REQUIREMENTS.md`: PA-01 through PA-06 verbatim; Out of Scope (no custom rubrics, no PMDS for all staff)
- `pyproject.toml`: python-statemachine 3.0.0 confirmed installed

### Secondary (MEDIUM confidence)

- Municipal Systems Act (SA) Section 57 — Section 57 managers are Municipal Manager and Section 56/57 directors; Municipal Manager evaluates directors, Executive Mayor evaluates Municipal Manager (established South African local government governance structure)
- MFMA performance management framework — quarterly review cycle aligned to SA financial quarters (July-June); 4 quarters starting July 1, October 1, January 1, April 1

### Tertiary (LOW confidence)

- DPSA 1-5 performance scale — noted as alternative to 0-100 percentage scoring; not adopted (REQUIREMENTS.md explicitly mandates percentage-based scoring for v2.0)
- National Archives Act 5-year retention — informational only; actual deletion eligibility is a product decision not implemented automatically

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and proven in project
- Architecture: HIGH — directly mirrors established IDPWorkflow/SDBIPWorkflow patterns from STATE.md
- Pitfalls: HIGH — most pitfalls discovered from STATE.md execution notes (start_value, ID capture, SQLite compat, Celery tenant iteration)
- Open questions: MEDIUM — scoring scale and evaluator role are functional decisions; POPIA retention period requires product owner input

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable stack; statemachine API unlikely to change)
