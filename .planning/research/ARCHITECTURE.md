# Architecture Research

**Domain:** PMS Integration — Adding Performance Management to Existing Municipal Platform
**Researched:** 2026-02-28
**Confidence:** HIGH (based on direct codebase inspection + integration plan document)

---

## Context: What This Document Covers

This is a v2.0 integration architecture document. The v1.0 system (FastAPI + PostgreSQL/PostGIS + Supabase Auth + Redis/Celery + React/Vite) is fully operational at ~88K LOC. This document covers only the **new PMS layer** and how it connects to the existing code.

For the original system architecture (WhatsApp pipeline, ticket CRUD, geospatial routing, real-time updates), refer to the v1.0 sections of this file.

---

## Standard Architecture

### System Overview: Four-Layer Municipal Operating System

```
┌─────────────────────────────────────────────────────────────────────┐
│                     STRATEGIC LAYER (NEW)                            │
│                                                                      │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────────┐  │
│  │  IDP Module  │  │  SDBIP Module   │  │  Performance Agreements│  │
│  │  (5-year     │  │  (KPIs, targets,│  │  (Section 56 managers) │  │
│  │   objectives)│  │   quarterly     │  │                        │  │
│  └──────┬───────┘  │   actuals, POE) │  └──────────┬─────────────┘  │
│         │          └────────┬────────┘             │               │
│         └──────────────────┼──────────────────────┘               │
│                             │ KPIs link downward                   │
├─────────────────────────────┼────────────────────────────────────── │
│                     OPERATIONAL LAYER (EXISTING)                     │
│                                                                      │
│  ┌──────────────┐  ┌────────┴───────┐  ┌─────────────────────────┐  │
│  │  Citizen     │  │ Auto-Population│  │   Ticket Management     │  │
│  │  Reports     │→ │    Engine      │  │   (Assignment, SLA,     │  │
│  │  (WhatsApp / │  │ (ticket data   │  │    Escalation)          │  │
│  │   Web)       │  │  → SDBIP       │  │                         │  │
│  └──────────────┘  │  actuals)      │  └─────────────────────────┘  │
│                    └────────────────┘                               │
├─────────────────────────────────────────────────────────────────────┤
│                     REPORTING LAYER (NEW)                            │
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │  Statutory │  │  Deadline  │  │  Document  │  │  Approval     │  │
│  │  Reports   │  │  Calendar  │  │  Generator │  │  Workflow     │  │
│  │ (s52/72/46)│  │  (MFMA)    │  │  (docx/PDF)│  │  Engine       │  │
│  └────────────┘  └────────────┘  └────────────┘  └───────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                 TRANSPARENCY LAYER (EXISTING, ENHANCED)              │
│                                                                      │
│  Public Dashboard → ticket stats + IDP progress + SDBIP achievement │
│  + audit outcomes (all anonymized, read-only)                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New vs Existing | Implementation |
|-----------|---------------|-----------------|----------------|
| **IDP Module** | 5-year strategic goals, objectives, annual cycles, version control | NEW | FastAPI router + SQLAlchemy models |
| **SDBIP Module** | KPIs, quarterly targets, actuals submission, evidence upload | NEW | FastAPI router + storage integration |
| **Auto-Population Engine** | Ticket aggregation queries → SDBIP actuals | NEW (Celery tasks) | Celery beat task + SQLAlchemy aggregations |
| **Performance Agreements** | Section 56 manager scorecards, quarterly reviews, annual assessments | NEW | FastAPI router + approval workflow |
| **Statutory Report Generator** | Auto-generate s52/72/46/121 reports with pre-populated data | NEW | Python-docx + Supabase Storage |
| **Approval Workflow Engine** | State machine for SDBIP, reports, performance agreements | NEW | Service layer + Celery notifications |
| **Deadline Calendar** | Legislated MFMA/MSA dates per tenant, Celery beat notifications | NEW | Celery beat schedule + notification service |
| **Role System Extension** | 4-tier hierarchy (10+ roles vs current 6) | MODIFIED | UserRole enum + require_role() factory |
| **Municipal Department Config** | Per-tenant org chart (director structure) | NEW | Municipality config model |
| **CFO / MM / Mayor Dashboards** | Role-scoped PMS views | NEW | FastAPI routes + React pages |
| **Ticket Model** | Add optional sdbip_kpi_id FK | MODIFIED | Alembic migration + existing model |
| **Municipality Model** | Add category, province, config flags | MODIFIED | Alembic migration + existing model |
| **Supabase Claims Hook** | Update to support 10+ new roles | MODIFIED | SQL function update |
| **Role-Based Nav** | Add PMS nav items per new role | MODIFIED | useRoleBasedNav.ts extension |

---

## Recommended Project Structure (New PMS Files Only)

The existing structure is already correct. PMS adds these new modules:

```
src/
├── models/
│   ├── pms/                           # NEW — all PMS SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── idp.py                     # IDPCycle, IDPObjective
│   │   ├── sdbip.py                   # SDBIPKpi, SDBIPQuarterlyTarget, SDBIPActual
│   │   ├── evidence.py                # EvidenceDocument
│   │   ├── performance_agreement.py   # PerformanceAgreement, PerformanceAgreementKpi
│   │   ├── reporting.py               # StatutoryReport
│   │   ├── department.py              # MunicipalDepartment
│   │   ├── risk.py                    # RiskRegisterItem
│   │   └── municipality_config.py     # MunicipalityConfig
│   ├── user.py                        # MODIFIED — extend UserRole enum
│   ├── municipality.py                # MODIFIED — add config fields
│   └── ticket.py                      # MODIFIED — add sdbip_kpi_id FK
│
├── api/v1/
│   ├── pms/                           # NEW — all PMS API routers
│   │   ├── __init__.py
│   │   ├── idp.py                     # IDP cycle CRUD, objective management
│   │   ├── sdbip.py                   # KPIs, targets, actuals submission
│   │   ├── evidence.py                # POE upload, list, verify
│   │   ├── performance_agreements.py  # PA create, review, assess
│   │   ├── statutory_reports.py       # Report generation, approval workflow
│   │   ├── departments.py             # Department config per tenant
│   │   ├── risk_register.py           # Risk items CRUD, KPI linkage
│   │   └── pms_dashboards.py          # CFO, MM, Mayor dashboard data
│   ├── dashboard.py                   # EXISTING — extend with PMS data for manager
│   └── public.py                      # EXISTING — extend with SDBIP public stats
│
├── services/
│   ├── pms/                           # NEW — PMS business logic
│   │   ├── __init__.py
│   │   ├── auto_population_service.py # Ticket aggregation → SDBIP actuals
│   │   ├── document_generation.py     # Statutory report docx/PDF generation
│   │   ├── approval_workflow.py       # State machine for report/PA lifecycles
│   │   ├── deadline_service.py        # MFMA calendar, upcoming deadline queries
│   │   └── sdbip_aggregation_service.py # KPI achievement calculations
│   └── storage_service.py             # EXISTING — extend with evidence bucket
│
├── tasks/
│   ├── celery_app.py                  # MODIFIED — add PMS beat schedules
│   ├── pms_auto_populate.py           # NEW — quarterly aggregation tasks
│   └── statutory_deadlines.py         # NEW — deadline notification tasks
│
└── schemas/
    └── pms/                           # NEW — Pydantic schemas
        ├── idp.py
        ├── sdbip.py
        ├── performance_agreement.py
        └── reporting.py

frontend-dashboard/src/
├── pages/
│   ├── pms/                           # NEW — PMS pages
│   │   ├── IdpPage.tsx
│   │   ├── SdbipPage.tsx
│   │   ├── SdbipActualsPage.tsx
│   │   ├── PerformanceAgreementsPage.tsx
│   │   ├── StatutoryReportsPage.tsx
│   │   ├── RiskRegisterPage.tsx
│   │   ├── DepartmentConfigPage.tsx
│   │   └── DeadlineCalendarPage.tsx
│   ├── CfoDashboardPage.tsx           # NEW — CFO role view
│   ├── MunicipalManagerDashboardPage.tsx  # NEW
│   ├── MayorDashboardPage.tsx         # NEW
│   └── OversightDashboardPage.tsx     # NEW — Audit Committee / MPAC view
├── hooks/
│   ├── pms/                           # NEW — PMS data hooks
│   │   ├── useIdp.ts
│   │   ├── useSdbip.ts
│   │   ├── usePerformanceAgreements.ts
│   │   └── useStatutoryReports.ts
│   └── useRoleBasedNav.ts             # MODIFIED — add PMS role nav items
└── types/
    └── pms.ts                         # NEW — TypeScript PMS types

alembic/versions/
└── 2026_03_xx_pms_foundation.py      # NEW — all 13 PMS entities in one migration
```

### Structure Rationale

- **`src/models/pms/`:** Groups all 13 new entities together, keeping existing models untouched except the 3 that need modification. Import all into `src/models/__init__.py` for Alembic autodiscovery.
- **`src/api/v1/pms/`:** Namespace isolation prevents route conflicts with existing 21 modules. All PMS routes use `/api/v1/pms/` prefix.
- **`src/services/pms/`:** Business logic separated from API layer, matches existing pattern. Auto-population engine is the most complex service and deserves its own module.
- **`frontend-dashboard/src/pages/pms/`:** Grouping PMS pages prevents sprawl. Role-specific dashboards (CFO, MM, Mayor) stay at the top level because they replace the root dashboard for those roles.
- **Single large Alembic migration:** All 13 new tables have dependencies between them (idp_objective references idp_cycle, sdbip_kpi references idp_objective, etc.). One migration avoids ordering issues.

---

## Architectural Patterns

### Pattern 1: Extend TenantAwareModel for All PMS Entities

**What:** Every new PMS entity inherits from `TenantAwareModel` — this gives automatic `tenant_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, and automatic tenant filtering via the existing `do_orm_execute` event listener.

**When to use:** For all 12 of the 13 new entities (all are municipality-scoped). `MunicipalityConfig` is the exception — it references `Municipality` which is `NonTenantModel` but logically tied to a single tenant.

**Trade-offs:**
- Pros: All new models get multi-tenant isolation for free. Audit logging fires automatically. No code changes needed to existing middleware.
- Cons: `municipality_id` and `tenant_id` are both present on some models — they are the same value (municipality.id === tenant_id), which creates redundancy.

**Recommendation:** Use `tenant_id` (inherited from `TenantAwareModel`) as the single source of truth. Do not add a separate `municipality_id` column to PMS models — query via `tenant_id`. Exception: `sdbip_kpi` needs explicit `responsible_director_id` FK to users.

```python
# src/models/pms/idp.py
from src.models.base import TenantAwareModel

class IDPCycle(TenantAwareModel):
    __tablename__ = "idp_cycles"

    financial_year_start: Mapped[int] = mapped_column(Integer, nullable=False)
    financial_year_end: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    vision: Mapped[str | None] = mapped_column(Text, nullable=True)
    mission: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft"
    )  # draft | approved | under_review
    approved_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    approved_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
```

### Pattern 2: State Machine for Approval Workflows

**What:** SDBIP, Performance Agreements, and Statutory Reports all have multi-step approval lifecycles. A service-layer state machine validates transitions and triggers notifications.

**When to use:** Any PMS entity with status that flows through a defined sequence (draft → internal_review → mm_approved → submitted → tabled).

**Trade-offs:**
- Pros: Status transitions are explicit, validated, and auditable. Celery notifications fire on valid transitions only.
- Cons: Adding a new allowed transition requires code change. More complex than simple status field updates.

**Example:**

```python
# src/services/pms/approval_workflow.py

REPORT_TRANSITIONS = {
    "drafting":         {"allowed_next": ["internal_review"],  "required_roles": ["pms_officer", "cfo", "municipal_manager"]},
    "internal_review":  {"allowed_next": ["drafting", "mm_approved"], "required_roles": ["municipal_manager"]},
    "mm_approved":      {"allowed_next": ["submitted"],         "required_roles": ["municipal_manager"]},
    "submitted":        {"allowed_next": ["tabled"],            "required_roles": ["municipal_manager", "executive_mayor"]},
    "tabled":           {"allowed_next": [],                    "required_roles": []},
}

async def transition_report(
    report: StatutoryReport,
    new_status: str,
    actor: User,
    db: AsyncSession,
) -> StatutoryReport:
    current = report.status
    config = REPORT_TRANSITIONS.get(current, {})

    if new_status not in config.get("allowed_next", []):
        raise HTTPException(400, f"Cannot transition {current} → {new_status}")

    if actor.role.value not in config.get("required_roles", []):
        raise HTTPException(403, f"Role {actor.role} cannot perform this transition")

    report.status = new_status
    await db.commit()

    # Notify next approver via Celery
    notify_report_transition.delay(str(report.id), new_status)
    return report
```

### Pattern 3: Ticket Aggregation Engine (The Killer Feature)

**What:** A Celery beat task runs on a configurable schedule (weekly for monitoring, quarterly for official actuals) and executes pre-configured SQL aggregation queries against the tickets table, then writes results to `sdbip_actual` with `auto_populated=True`.

**When to use:** For SDBIP KPIs whose measurement is derived from ticket data (resolution rates, response times, complaint counts by category).

**Trade-offs:**
- Pros: Eliminates manual data entry for service-delivery KPIs (the main value proposition). Fully auditable.
- Cons: Only works for ticket-derived KPIs. Non-ticket KPIs (budget execution, water quality tests) still require manual entry. Aggregation rules need careful design to avoid double-counting.

```python
# src/services/pms/auto_population_service.py

AGGREGATION_FUNCTIONS = {
    "count":              "COUNT(*)",
    "avg_resolution_time": "AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)",
    "resolution_rate":    "100.0 * COUNT(*) FILTER (WHERE status = 'resolved') / NULLIF(COUNT(*), 0)",
}

async def populate_sdbip_actual_from_tickets(
    kpi_id: UUID,
    quarter: str,
    db: AsyncSession,
) -> SDBIPActual:
    # Load the aggregation rule
    rule = await get_aggregation_rule(kpi_id, db)

    # Build quarter date range (SA financial year: July = Q1)
    start_date, end_date = get_quarter_date_range(quarter)

    # Execute aggregation query
    agg_fn = AGGREGATION_FUNCTIONS[rule.aggregation_type]
    result = await db.execute(text(f"""
        SELECT {agg_fn} as value
        FROM tickets
        WHERE tenant_id = :tenant_id
          AND category = :category
          AND created_at BETWEEN :start_date AND :end_date
          AND is_sensitive = FALSE
    """), {
        "tenant_id": rule.tenant_id,
        "category": rule.ticket_category,
        "start_date": start_date,
        "end_date": end_date,
    })

    actual_value = result.scalar() or 0

    # Write or update SDBIPActual
    actual = SDBIPActual(
        sdbip_kpi_id=kpi_id,
        quarter=quarter,
        actual_value=actual_value,
        auto_populated=True,
        source_query=f"category={rule.ticket_category}, agg={rule.aggregation_type}",
        submitted_at=datetime.now(UTC),
    )
    db.add(actual)
    await db.commit()
    return actual
```

### Pattern 4: RBAC Hierarchy Extension Without Breaking Existing Auth

**What:** The existing `UserRole` enum (6 roles) is extended to 14+ roles. The existing `require_role()` factory dependency is unchanged. New endpoints use the extended role list.

**When to use:** Every new PMS endpoint.

**Critical constraint:** The Supabase custom access token hook (PostgreSQL function `set_user_role_claim`) must be updated to recognize new roles. The existing hook reads user role from the `users` table and sets it in `app_metadata`. New roles must be added to the allowed values.

```python
# src/models/user.py — MODIFIED

class UserRole(str, Enum):
    # Tier 1 — Political (fixed, legislated)
    EXECUTIVE_MAYOR = "executive_mayor"
    SPEAKER = "speaker"
    COUNCILLOR = "councillor"         # was ward_councillor, rename or alias

    # Tier 2 — Administrative (fixed per municipality)
    MUNICIPAL_MANAGER = "municipal_manager"
    CFO = "cfo"
    DIRECTOR = "director"             # Section 56 manager

    # Tier 3 — Operational (existing + new)
    MANAGER = "manager"               # EXISTING
    DEPARTMENT_MANAGER = "department_manager"  # NEW
    PMS_OFFICER = "pms_officer"       # NEW
    FIELD_WORKER = "field_worker"     # EXISTING
    ADMIN = "admin"                   # EXISTING
    SAPS_LIAISON = "saps_liaison"     # EXISTING

    # Tier 4 — Oversight
    AUDIT_COMMITTEE_MEMBER = "audit_committee_member"
    INTERNAL_AUDITOR = "internal_auditor"
    MPAC_MEMBER = "mpac_member"
    SALGA_ADMIN = "salga_admin"       # Cross-tenant visibility

    # Citizen
    CITIZEN = "citizen"               # EXISTING
```

**Backward compatibility:** The existing 6 roles (`citizen`, `field_worker`, `manager`, `admin`, `saps_liaison`, `ward_councillor`) must be preserved or aliased to prevent breaking existing users. `ward_councillor` maps to `councillor` via an alias or migration.

### Pattern 5: Evidence / POE Storage via Supabase Storage

**What:** Evidence documents (proof of evidence for SDBIP actuals) are stored in a new Supabase Storage bucket `pms-evidence`, using the same pattern as the existing `evidence` bucket for ticket photos. The frontend uses the Supabase JS client directly for uploads; FastAPI records the metadata.

**When to use:** All evidence document uploads for SDBIP actuals.

**Trade-offs:**
- Pros: Consistent with existing storage pattern. No new infrastructure needed. Supabase Storage RLS policies enforce per-tenant access.
- Cons: At scale (1,000+ documents per municipality per year), need to track storage costs and implement lifecycle policies.

```python
# Storage path convention:
# pms-evidence/{tenant_id}/sdbip/{sdbip_actual_id}/{uuid}_{filename}

# src/services/storage_service.py — extend existing StorageService
def get_evidence_upload_path(
    tenant_id: str,
    sdbip_actual_id: str,
    file_id: str,
    filename: str,
) -> dict:
    return {
        "bucket": "pms-evidence",
        "path": f"{tenant_id}/sdbip/{sdbip_actual_id}/{file_id}_{filename}",
        "file_id": file_id,
    }
```

---

## Data Flow

### Flow 1: Quarterly SDBIP Actuals Submission (Manual)

```
[Director / PMS Officer logs in]
    ↓ GET /api/v1/pms/sdbip/actuals?quarter=Q1&year=2026
[SDBIPKpi + SDBIPQuarterlyTarget loaded for their department]
    ↓ POST /api/v1/pms/sdbip/actuals
[SDBIPActual created with actual_value, auto_populated=False]
    ↓
[POST /api/v1/pms/evidence (multipart upload URL returned)]
[Frontend → Supabase Storage direct upload]
[POST /api/v1/pms/evidence/{actual_id}/confirm]
[EvidenceDocument record created in PostgreSQL]
    ↓
[Celery task: notify PMS Officer / CFO for validation]
    ↓
[POST /api/v1/pms/sdbip/actuals/{id}/validate]
[SDBIPActual.validation_status = "validated", validated_by = current user]
    ↓
[Achievement % calculated: (actual_value / target_value) × 100]
[KPI status flagged GREEN / AMBER / RED on CFO dashboard]
```

### Flow 2: Auto-Population from Ticket Data (Celery)

```
[Celery Beat: pms_quarterly_aggregate — runs weekly for monitoring]
    ↓
[Load all SDBIPTicketAggregationRules where quarter matches]
    ↓ For each rule:
[Execute SQL aggregation on tickets table (category, status, created_at, resolved_at)]
[tenant_id scoped, GBV excluded (is_sensitive=FALSE)]
    ↓
[SDBIPActual upserted: auto_populated=True, source_query logged]
    ↓
[CFO dashboard updates: achievement % recalculated]
[No notification sent — auto-population is background only]
```

### Flow 3: Statutory Report Generation (s52 Quarterly)

```
[CFO or PMS Officer: POST /api/v1/pms/statutory-reports/generate]
[Report type: s52_quarterly, quarter: Q1, year: 2026]
    ↓
[StatutoryReport record created: status = "drafting"]
    ↓
[Celery task: generate_statutory_report]
    [Fetch all SDBIP actuals for the quarter (tenant-scoped)]
    [Fetch budget execution summary (if mSCOA data present)]
    [Populate Word template (python-docx) with data]
    [Save generated .docx to Supabase Storage: reports/{tenant_id}/s52-Q1-2026.docx]
    [Update StatutoryReport.generated_file_path]
    ↓
[Status: "drafting" → notify PMS Officer / CFO to review]
    ↓
[POST /api/v1/pms/statutory-reports/{id}/submit → approval workflow]
[Status transitions: drafting → internal_review → mm_approved → submitted → tabled]
```

### Flow 4: Performance Agreement Quarterly Review

```
[Director: POST /api/v1/pms/performance-agreements/{id}/quarterly-review]
[Body: {quarter: "Q2", self_assessment: {...scores}}]
    ↓
[PerformanceAgreementKpi q2_score fields updated]
[Status: "signed" → "under_review"]
    ↓
[Celery: notify evaluator (Municipal Manager or Mayor)]
    ↓
[MM: PUT /api/v1/pms/performance-agreements/{id}/quarterly-review/{quarter}]
[Body: {evaluator_scores: {...}, notes: "..."}]
    ↓
[Scores merged; status returns to "signed" for next quarter]
```

### State Management (Frontend)

```
[Role detected from Supabase JWT app_metadata.role]
    ↓
[useRoleBasedNav(role) → renders PMS nav items for cfo/municipal_manager/director/pms_officer]
    ↓
[Role-specific dashboard page mounts]
[Page calls dedicated hook: useCfoDashboard() / useMunicipalManagerDashboard()]
[Hook fetches from /api/v1/pms/dashboards/{role}]
    ↓
[Zustand store (existing dashboardStore.ts extended) holds PMS state]
[SDBIP achievement, deadline calendar, risk status held in store]
```

---

## Component Integration Map: New vs Modified vs Untouched

### Modified Components (Existing Code Changes Required)

| File | What Changes | Risk |
|------|-------------|------|
| `src/models/user.py` | Extend `UserRole` enum from 6 to 14+ roles | MEDIUM — existing role checks must keep working |
| `src/models/municipality.py` | Add `category`, `demarcation_code`, `province` fields (already has `province`) | LOW — additive |
| `src/models/ticket.py` | Add optional `sdbip_kpi_id` FK column | LOW — nullable, additive |
| `src/tasks/celery_app.py` | Add PMS beat schedules (quarterly aggregation, deadline checks) | LOW — additive |
| `src/api/v1/dashboard.py` | Add PMS summary widgets for manager dashboard | LOW — additive endpoints |
| `src/api/v1/public.py` | Add SDBIP achievement stats to public transparency data | LOW — additive |
| `src/services/storage_service.py` | Add `pms-evidence` bucket path generation | LOW — new method |
| `src/main.py` | Include 8+ new PMS API routers | LOW — additive `include_router` calls |
| `frontend-dashboard/src/hooks/useRoleBasedNav.ts` | Add PMS nav items for 8 new roles | LOW — extend switch cases |
| `frontend-dashboard/src/stores/dashboardStore.ts` | Add PMS state slices | MEDIUM — restructure store |
| `alembic/versions/` | New migration for 13 new entities + 3 modified tables | MEDIUM — careful ordering |
| Supabase custom access token hook | Add 8 new role values to allowed list | MEDIUM — SQL function update in Supabase dashboard |

### New Components (No Existing Code Changes)

All files under `src/models/pms/`, `src/api/v1/pms/`, `src/services/pms/`, `src/tasks/pms_auto_populate.py`, `src/tasks/statutory_deadlines.py`, `src/schemas/pms/`, `frontend-dashboard/src/pages/pms/`, `frontend-dashboard/src/hooks/pms/`, `frontend-dashboard/src/types/pms.ts`.

### Untouched Components (No Changes Needed)

| Component | Why Untouched |
|-----------|--------------|
| `src/core/security.py` | JWT verification is role-agnostic |
| `src/core/audit.py` | Audit listener fires on all TenantAwareModel changes automatically |
| `src/core/tenant.py` | Context vars work for any tenant |
| `src/middleware/` (all 4) | Middleware stack unchanged |
| `src/agents/` (all CrewAI) | Agent system is citizen-facing only |
| `src/services/whatsapp_service.py` | WhatsApp pipeline unchanged |
| `src/services/escalation_service.py` | Ticket SLA unchanged |
| `frontend-public/` | Public dashboard enhanced via existing `public.py` endpoint |
| `e2e-tests/` | New E2E tests added for PMS flows, nothing removed |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **3-5 pilot municipalities (MVP)** | Current monolith fine. PMS shares Celery workers with SLA monitor. Document generation is async. Single Supabase Storage bucket for all tenants. |
| **20-50 municipalities** | Separate Celery queue for PMS tasks (`pms_queue`) vs ticket processing (`ticket_queue`). Consider Redis streams for higher-throughput aggregation. Add read replica for statutory report queries (heavy aggregations). |
| **100+ municipalities** | Statutory report generation on dedicated worker instances. Consider S3/R2 for POE storage at this scale (Supabase Storage limits). Pre-compute SDBIP achievement stats via materialized view, refresh on schedule. |

### Scaling Priorities

1. **First bottleneck: Evidence file storage.** Over 36 months, a single municipality can upload 2,000+ POE documents. Supabase Storage free tier has a 1GB limit per project. Plan paid storage tier from day one, or use S3 `af-south-1` (already configured in `Settings` — `S3_BUCKET_EVIDENCE` and `S3_BUCKET_DOCUMENTS` are present). The config already has `AWS_ACCESS_KEY_ID` and `AWS_REGION = "af-south-1"` — PMS evidence can go to S3 directly.

2. **Second bottleneck: Statutory report generation.** Generating a PDF/docx from a full quarter of SDBIP data for a large municipality (200+ KPIs) can take 10-30 seconds. Always generate via Celery task (async), never in the request handler. Store generated files; do not regenerate on every download.

3. **Third bottleneck: SDBIP aggregation queries.** The auto-population engine runs SQL aggregations on the `tickets` table. At 100K+ tickets, these need indexes. Add composite index on `(tenant_id, category, created_at, status)` in the migration.

---

## Anti-Patterns

### Anti-Pattern 1: Mixing Ticket and PMS Business Logic

**What people do:** Add SDBIP auto-population triggers inside the ticket resolution handler (e.g., in `src/api/v1/tickets.py` or `src/services/assignment_service.py`).

**Why it's wrong:** Ticket resolution becomes coupled to PMS state. A PMS configuration error can block ticket resolution. Unit tests for ticket logic start requiring PMS fixtures.

**Do this instead:** Keep the boundary clean. The auto-population engine is a periodic Celery task that reads ticket data as a read-only consumer. It never writes to the `tickets` table. Ticket resolution code remains unchanged.

### Anti-Pattern 2: One Giant PMS Router

**What people do:** Put all PMS endpoints in a single `src/api/v1/pms.py` router with 40+ endpoints.

**Why it's wrong:** The file becomes unmaintainable. Access control logic for IDP (municipal_manager, director) differs from evidence upload (director, department_manager) which differs from report approval (municipal_manager, executive_mayor).

**Do this instead:** One router per domain (`idp.py`, `sdbip.py`, `evidence.py`, `performance_agreements.py`, `statutory_reports.py`, `departments.py`, `risk_register.py`, `pms_dashboards.py`). Each has its own `require_role()` guards.

### Anti-Pattern 3: Storing Financial Numbers as Float

**What people do:** Use `Float` or `Numeric` for SDBIP actual values, budget amounts, and achievement percentages.

**Why it's wrong:** Floating point arithmetic errors compound across quarterly calculations. When the AG asks "why does this figure not match?" you cannot trace the error. A 87.33333...% vs 87.34% discrepancy is an audit finding.

**Do this instead:** Use `Numeric(precision=15, scale=4)` (SQLAlchemy Numeric type, maps to PostgreSQL `NUMERIC`). This is exact. Store all monetary values as cents (integer) if mSCOA budget data is added later.

### Anti-Pattern 4: Hardcoding Financial Year Logic

**What people do:** Hardcode "Q1 = July–September" throughout the codebase.

**Why it's wrong:** `MunicipalityConfig.financial_year_start_month` exists precisely because the SA municipal financial year (July) must be configurable. If this ever changes (e.g., testing with a non-July municipality), hardcoded logic fails silently.

**Do this instead:** A `get_quarter_date_range(quarter, tenant_id, db)` helper that reads `municipality_config.financial_year_start_month`. Default to July (month 7) if not set.

### Anti-Pattern 5: Skipping Audit Trail on SDBIP Actuals

**What people do:** Treat auto-populated actuals as computed values, not auditable records — allow silent overwrites.

**Why it's wrong:** The AG will ask "who changed this from 87% to 91% and when?" If auto-population overwrites a manually validated actual without an audit trace, this is an audit finding. The existing audit log system fires on all TenantAwareModel changes automatically (via `after_flush` listener). Do not bypass it with raw SQL inserts.

**Do this instead:** Always use SQLAlchemy ORM for `SDBIPActual` writes (even in auto-population), ensuring the `after_flush` listener captures the change. Add `auto_populated: bool` and `source_query: str` fields to differentiate machine vs human entries.

---

## Integration Points

### External Services (New Requirements)

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **python-docx** | Library call in Celery task | Generate Word-format statutory reports from templates. Templates stored in `src/services/pms/templates/`. Municipality-specific headers injected at generation time. |
| **Supabase Storage (pms-evidence bucket)** | Same pattern as existing evidence bucket | New RLS policy: `tenant_id` prefix enforces per-municipality isolation. PMS Officer and above can upload. Audit Committee can read but not write. |
| **mSCOA / Municipal ERP** | NOT in v2.0 scope | Budget actual data (expenditure vs budget) requires ERP integration. For v2.0, CFO manually enters budget execution %. Auto-link deferred to v3.0. |

### Internal Boundaries (New)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Ticket service ↔ PMS auto-population** | Read-only SQL query from Celery task | PMS reads tickets; tickets never reference PMS entities except the optional `sdbip_kpi_id` FK. One-directional dependency. |
| **PMS API ↔ Approval workflow service** | Direct service call | `approval_workflow.py` is called from PMS routers to validate and execute transitions. Returns updated entity. |
| **Approval workflow ↔ Notification service** | Celery task dispatch | On valid status transition, Celery task dispatched to notify next actor via WhatsApp or email. Uses existing `notification_service.py`. |
| **CFO Dashboard ↔ SDBIP service** | FastAPI route calls service | `/api/v1/pms/dashboards/cfo` assembles data from multiple services: deadline_service, sdbip_aggregation_service, statutory_reports query. Response is assembled in the route handler, not a separate service. |
| **Frontend PMS hooks ↔ FastAPI** | REST (Axios, same `api.ts` client) | PMS React hooks use the same `api` Axios instance with Supabase JWT auth. New hooks added under `frontend-dashboard/src/hooks/pms/`. |
| **PMS auto-population ↔ Celery beat** | Beat schedule (cron-style) | Two new tasks added to `celery_app.py` beat schedule. `pms_weekly_monitor` runs every Sunday (soft monitoring). `pms_quarterly_aggregate` runs on configured quarter-end dates (official actuals). |

---

## Suggested Build Order (Dependency-Driven)

### Phase 1: Foundation — Roles, Departments, Config (Build First)

**Why first:** Every subsequent PMS feature depends on the role hierarchy. Cannot build CFO dashboard without `cfo` role. Cannot build director SDBIP submission without `director` role and `MunicipalDepartment`.

1. Extend `UserRole` enum (14+ roles) + Alembic migration for `users` table
2. Update Supabase custom access token hook to recognize new roles
3. Update `require_role()` usage in deps — add tier-aware helper: `require_tier(min_tier=2)` for common patterns
4. Create `MunicipalDepartment` model + migration + CRUD API (`/api/v1/pms/departments/`)
5. Create `MunicipalityConfig` model + migration + admin API
6. Extend `useRoleBasedNav` with new role nav items (placeholder pages, no data yet)

**Dependency check:** No IDP, SDBIP, or reporting code depends on this being done after — everything else depends on this being done first.

### Phase 2: IDP and SDBIP Core (Second)

**Why second:** IDP objectives are the parent of SDBIP KPIs. Cannot create KPIs without objectives. Cannot set targets without KPIs.

7. `IDPCycle` + `IDPObjective` models + migration
8. IDP CRUD API (`/api/v1/pms/idp/`) with role guards (municipal_manager, director, pms_officer can create)
9. `SDBIPKpi` + `SDBIPQuarterlyTarget` models + migration
10. Add composite index on tickets: `(tenant_id, category, created_at, status)` for aggregation queries
11. SDBIP CRUD API (`/api/v1/pms/sdbip/`) — KPI create/edit, target setting
12. `SDBIPTicketAggregationRule` model + API for configuring auto-population rules
13. IDP + SDBIP frontend pages (create/list/edit views)

**Dependency check:** Evidence upload depends on `SDBIPActual` IDs existing. Auto-population depends on rules + KPIs existing.

### Phase 3: Actuals, Evidence, and Auto-Population (Third)

**Why third:** Actuals submission is the daily workflow. Auto-population is the killer feature. Both depend on Phase 2 data structures.

14. `SDBIPActual` model + migration
15. Actuals submission API (`/api/v1/pms/sdbip/actuals/`) — manual entry flow
16. `EvidenceDocument` model + migration + Supabase Storage bucket `pms-evidence`
17. Evidence upload API (`/api/v1/pms/evidence/`) — upload path generation + metadata confirmation
18. `auto_population_service.py` — SQL aggregation queries
19. Celery task: `pms_auto_populate.py` (weekly monitoring + quarterly official)
20. Validation API — PMS Officer / CFO validates submitted actuals
21. Frontend: SDBIP actuals page with evidence upload and validation status

**Dependency check:** Performance agreements reference `SDBIPKpi` IDs. Reports aggregate `SDBIPActual` records.

### Phase 4: Performance Agreements (Fourth)

**Why fourth:** Agreements link to KPIs (Phase 2) and are reviewed against actuals (Phase 3). Can be built while actuals are being tested.

22. `PerformanceAgreement` + `PerformanceAgreementKpi` models + migration
23. PA CRUD API — create, sign, quarterly review, annual assessment
24. Approval workflow for PA lifecycle (draft → signed → under_review → assessed)
25. Frontend: Performance agreements page, quarterly review form

**Dependency check:** Statutory reports aggregate PA scores for the annual performance report.

### Phase 5: Statutory Reports and Dashboards (Fifth)

**Why fifth:** Reports aggregate data from all previous phases. Dashboards display data from all previous phases. Building last means all data sources are available.

26. `StatutoryReport` model + migration
27. Document generation service (`python-docx` templates for s52, s72, s46)
28. Report generation Celery task
29. Report approval workflow API (drafting → submitted → tabled)
30. Deadline calendar service + Celery beat for escalating notifications
31. CFO Dashboard API (`/api/v1/pms/dashboards/cfo`)
32. Municipal Manager Dashboard API
33. Mayor + Oversight (Audit Committee / MPAC) Dashboard APIs
34. Frontend: All 4 role-specific dashboard pages
35. Frontend: Statutory reports page with download and approval actions
36. Frontend: Deadline calendar widget

### Phase 6: Risk Register and Public Transparency (Sixth)

**Why last:** Risk register is a "nice to have" that enhances but doesn't block reporting. Public transparency enhancement adds SDBIP data to the existing public dashboard.

37. `RiskRegisterItem` model + migration + CRUD API
38. Risk-to-KPI linkage API
39. Risk register frontend page
40. Extend `public.py` endpoint with SDBIP achievement stats (aggregated, anonymized)
41. Extend public dashboard frontend with IDP progress and SDBIP summary

---

## Sources

- Direct inspection of existing codebase: `src/models/`, `src/api/v1/`, `src/services/`, `src/tasks/`, `src/core/`, `src/middleware/`, `frontend-dashboard/src/`
- `salga-pms-integration-plan.md` — integration strategy, data model extensions, role hierarchy definition
- `.planning/PROJECT.md` — v2.0 feature requirements and constraints
- Municipal Systems Act (MSA) sections 46, 52, 56, 57, 72, 121 — statutory reporting requirements
- Municipal Finance Management Act (MFMA) sections 71, 72, 80-81, 165 — CFO and financial reporting requirements
- Supabase Documentation — custom access token hooks, Storage RLS policies (HIGH confidence — well-documented)
- python-docx library documentation — document generation patterns (HIGH confidence — stable library)

---

*Architecture research for: SALGA Trust Engine v2.0 — PMS Integration*
*Researched: 2026-02-28*
