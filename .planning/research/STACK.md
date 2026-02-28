# Stack Research

**Domain:** Municipal Performance Management System (PMS) — statutory reporting, workflow approval, evidence storage, mSCOA code management, hierarchical scorecard visualization
**Researched:** 2026-02-28
**Confidence:** HIGH (all library versions verified against PyPI and npm registries as of research date)

---

## Context: Existing Stack (Do Not Re-Add)

The v1.0 stack is fully operational. Everything below is already installed and proven — do not include these in installation commands for v2.0.

| Already Installed | Version | Notes |
|---|---|---|
| FastAPI | 0.128.0 | REST API, async endpoints |
| SQLAlchemy async | 2.0.36 | ORM, async sessions |
| Alembic | 1.14.0 | Migrations |
| Celery + Redis | 5.6.0+ | Task queue, beat scheduler |
| Supabase SDK | 2.27.3+ | Auth, Storage, Realtime already integrated |
| openpyxl | 3.1.0+ | Already installed — use for Excel exports, no addition needed |
| aiofiles | 24.1.0 | Async file I/O |
| python-multipart | 0.0.18 | File upload handling |
| boto3 | 1.34.0+ | S3-compatible storage fallback if needed |
| Recharts | 2.15.4 | Charts (upgrade to 3.x required for new components — see below) |
| React 19 + Vite + Tailwind + Zustand | current | Frontend foundation |
| Jinja2 | transitive | Already available as a FastAPI/Celery transitive dep |
| python-magic | 0.4.27 | File type detection on upload |

---

## New Stack Additions — PMS v2.0

### Core Technologies (New)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| WeasyPrint | 68.1 | PDF generation for statutory reports (Section 52/72/46/121/71) | Renders HTML+CSS to PDF without a headless browser; BSD-licensed; handles complex paginated documents with headers, footers, and tables; integrates natively with Jinja2 (already in the project); AG-auditable output with precise layout; Python 3.10+ required, project uses 3.12+ |
| docxtpl | 0.20.2 | DOCX report generation for Municipal Manager, Mayor, and AG submissions | Uses Jinja2 syntax inside a real Word .docx template file, so each municipality's comms team controls branding (logo, headers, page numbering) while code injects data via Jinja2 placeholders; CFOs and AGs receive native Word files they can annotate and sign; paired with python-docx 1.2.0 as its engine |
| python-docx | 1.2.0 | Runtime dependency of docxtpl; also used directly for programmatic sub-document generation | Released June 2025; explicit pinning required so docxtpl version alignment is controlled |
| python-statemachine | 3.0.0 | Approval workflow state machine for SDBIP/report approval chains | Declarative states and transitions with typed guards; version 3.0.0 (released 2026-02-24) auto-detects async callbacks and switches engine — transitions slot directly into FastAPI/Celery without wrappers; state is persisted in the PostgreSQL status column, not in the library |

### Supporting Libraries (New — Backend)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clamav-client | latest 2025 | Virus scanning on every evidence/POE upload before writing to Supabase Storage | Required because POE documents are uploaded from external municipal staff machines; call clamd daemon (Docker sidecar) via TCP; reject infected files before any storage write occurs; stream upload in chunks to avoid memory issues with large files |

### Supporting Libraries (New — Frontend)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| recharts | 3.7.0 | Upgrade from 2.15.4 — adds `SunburstChart` and improved `Treemap` for hierarchical KPI visualization | Use for IDP→SDBIP→KPI drill-down (sunburst), SDBIP scorecard grid (treemap), and budget execution charts on CFO dashboard; 3.x API is backward-compatible for existing 2.x charts with minor prop adjustments; 3,608 npm dependents confirms production stability |
| react-d3-tree | 3.x (current npm) | Interactive node-link tree for municipal organogram and IDP objective hierarchy | Recharts does not do node-link tree graphs; react-d3-tree wraps D3's tidy tree layout as idiomatic React components; minimal configuration for org-chart-style hierarchies |

### Development/Infrastructure (New)

| Tool | Purpose | Notes |
|------|---------|-------|
| ClamAV daemon | Antivirus backend for clamav-client | Run as a Docker sidecar service; expose TCP port 3310; clamav-client Python lib connects via TCP; on Render deploy as an additional Background Worker service |
| WeasyPrint system deps | GTK/Pango libraries required by WeasyPrint's rendering engine | `apt-get install python3-weasyprint libpango-1.0-0 libharfbuzz0b libfontconfig1` on Render/Ubuntu build image — must be in Dockerfile/render.yaml build command |

---

## Installation

```bash
# Backend — PMS additions only (run from repo root)
pip install weasyprint==68.1 docxtpl==0.20.2 "python-docx>=1.2.0" "python-statemachine>=3.0.0" clamav-client
```

```toml
# pyproject.toml additions under [project] dependencies:
"weasyprint>=68.1",
"docxtpl>=0.20.2",
"python-docx>=1.2.0",
"python-statemachine>=3.0.0",
"clamav-client>=0.1.0",
```

```bash
# Frontend — upgrade recharts, add react-d3-tree
cd frontend-dashboard
npm install recharts@3.7.0 react-d3-tree

cd frontend-public
npm install recharts@3.7.0
# react-d3-tree only needed in dashboard (organogram lives there)
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| WeasyPrint (HTML→PDF) | ReportLab | If you need low-level PDF drawing control (e.g., dynamic signature boxes at arbitrary coordinates); ReportLab's Platypus layout engine is powerful but requires Python code for every visual element — not suitable when municipalities want to control document appearance |
| WeasyPrint (HTML→PDF) | Headless Chromium/Playwright | If pixel-perfect browser rendering is non-negotiable; adds 300MB+ container size, process management complexity, and Chromium licensing considerations; avoid when WeasyPrint's CSS support is sufficient |
| WeasyPrint (HTML→PDF) | xhtml2pdf (pisa) | Never — xhtml2pdf is unmaintained since 2022, CSS2 only, breaks on table layouts; do not use |
| docxtpl (Jinja2 in DOCX) | python-docx directly | If there are no pre-designed templates and all layout is generated from scratch in code; docxtpl is strictly better when a municipality provides their branded Word template |
| python-statemachine | Raw status column + Celery guards | For approval flows with no branching (single linear path only); for SDBIP approval which has conditional branches (reject → return to director, revision → return to drafting), explicit state machine makes transitions testable and impossible to skip |
| python-statemachine | Temporal.io / Prefect / Airflow | If the approval chain spans days/weeks with human-in-the-loop SLA timers at the orchestration level; those tools are distributed workflow engines with separate infrastructure — massive operational overhead for a 5-state approval flow |
| ClamAV sidecar | VirusTotal API | If zero operational overhead is required and scan latency is acceptable; VirusTotal has rate limits on free tier (500 req/day), requires network egress per upload, and introduces external dependency on every upload; ClamAV runs offline in the container network |
| recharts 3.x SunburstChart | AG Charts sunburst | If commercial licensing is acceptable and a more feature-rich sunburst is needed; AG Charts has a better sunburst but is the commercial AG Grid product family; recharts 3.x sunburst is sufficient for IDP→KPI hierarchy |
| react-d3-tree | vis-network / Cytoscape.js | If the visualization is a general graph (nodes with cycles) rather than a tree; Cytoscape is a graph/network library — unnecessary complexity for hierarchical org charts |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Celery chains for approval state | Approval state stored in Celery result backend is not SQL-queryable and not auditable by the AG; Celery chains model task pipelines, not business state transitions | python-statemachine for transition logic + PostgreSQL `status` column for persisted state; Celery handles async notifications and PDF generation triggered by transitions |
| Full ERP API integration (Munsoft, Sebata, SAGE) for mSCOA | Scope creep: each ERP has proprietary APIs, most small municipalities cannot provide API access, and this blocks delivery by weeks per municipality | Seeded `mscoa_reference` table from National Treasury v5.5 Excel; JSONB `mscoa_tags` column on `sdbip_kpi` for multi-dimensional code tagging |
| xhtml2pdf (pisa) | Unmaintained, CSS2 only, breaks table layouts | WeasyPrint 68.1 |
| PyPDF2 / pypdf for generation | These are PDF readers/mergers, not generators — commonly confused | WeasyPrint for generation; pypdf is acceptable only for post-processing (e.g., merging two generated PDFs) |
| Dedicated BPMN workflow engine (Camunda, Flowable) | Java-based, requires separate infrastructure, BPMN modelling tools, separate UI; total overkill for a 5-state approval chain | python-statemachine |
| A separate notification library | Supabase Realtime (already integrated) handles real-time approval notifications; Celery handles email; no new library needed | Existing Supabase Realtime + Celery |

---

## mSCOA Code Management (No New Library Needed)

mSCOA (Municipal Standard Chart of Accounts, v5.5) is a government-published Excel reference file — not a third-party API. It is a multi-dimensional classification framework with 7 segments:

| Segment | Purpose | Example |
|---------|---------|---------|
| Function | Service delivery function | `0300` = Water |
| Municipal Standard Classification | Expenditure category | `4200` = Repairs and Maintenance |
| Project | Capital project code | `P2024001` |
| Costing | Budget vote / cost centre | `CC001` |
| Regional | Geographic demarcation | `EC157` (Umsobomvu) |
| Funding | Funding source | `F001` = Own Revenue |
| Economic | Standard economic classification | `1000` = Personnel |

**Implementation approach:** Seed a `mscoa_reference` table at deployment time from the National Treasury Excel file (already parseable with `openpyxl`, which is installed). Store a JSONB `mscoa_tags` column on `sdbip_kpi` for the multi-dimensional code. This keeps linkage SQL-queryable without a full financial management module.

```python
# sdbip_kpi model addition (no new library)
from sqlalchemy.dialects.postgresql import JSONB
mscoa_tags: Mapped[dict] = mapped_column(JSONB, default={})
# Example runtime value:
# {"function": "0300", "classification": "4200", "cost_centre": "CC001", "funding": "F001"}
```

mSCOA tagging is validated by the CFO in the SDBIP editor UI. The platform does not replace Munsoft/Sebata for actual financial transaction capture.

---

## Evidence/POE Storage at Scale (Existing Stack Is Sufficient)

Supabase Storage (already integrated) handles evidence documents:

- Files up to 500GB on Pro+ plans via TUS resumable protocol
- Per-municipality RLS bucket policies matching existing multi-tenant model
- Metadata (`evidence_document` table) in PostgreSQL — AG audit trail is SQL-queryable

**Scale projection:** 1,000 POE documents per municipality over 36 months at 5MB average = 5GB per municipality. At 10 municipalities = 50GB. Within Supabase Pro plan included storage.

**The one required addition:** ClamAV scan in upload flow before any storage write.

```python
# Upload flow addition (fastapi endpoint)
from clamav_client import ClamdNetworkSocket

async def upload_evidence(file: UploadFile) -> str:
    content = await file.read()
    clamd = ClamdNetworkSocket(host="clamav", port=3310)
    scan_result = clamd.instream(BytesIO(content))
    if scan_result["stream"][0] == "FOUND":
        raise HTTPException(400, detail="File rejected: malicious content detected")
    path = supabase.storage.from_("evidence").upload(
        f"{municipality_id}/{sdbip_actual_id}/{file.filename}", content
    )
    return path
```

---

## Workflow Engine Pattern

The SDBIP → Mayor approval chain and statutory report approval have identical branching structure. Model once, reuse for both:

```python
from statemachine import StateMachine, State

class ReportApproval(StateMachine):
    # States — persisted in statutory_report.status (VARCHAR)
    drafting = State(initial=True)
    internal_review = State()
    mm_approved = State()
    submitted = State()
    tabled = State(final=True)
    rejected = State()  # Resubmit returns to internal_review

    # Transitions
    submit_for_review = drafting.to(internal_review)
    approve_by_mm      = internal_review.to(mm_approved)
    reject_by_mm       = internal_review.to(rejected)
    resubmit           = rejected.to(internal_review)
    submit_to_council  = mm_approved.to(submitted)
    table_at_council   = submitted.to(tabled)

    async def on_enter_internal_review(self):
        await notify_approver.apply_async(
            args=[self.model.id, "municipal_manager"]
        )

    async def on_enter_rejected(self):
        await notify_approver.apply_async(
            args=[self.model.id, "director"]
        )
```

The state machine instance is reconstructed from `statutory_report.status` on each request. Transitions are validated server-side; the database column is the source of truth. No state is held in memory between requests.

---

## PDF Generation Architecture

All statutory report PDF generation runs in Celery workers (CPU-bound — never block a FastAPI request thread):

```
Request: POST /reports/{id}/generate
  → FastAPI returns task_id immediately
  → Celery task picks up:
      1. Query report data from PostgreSQL
      2. Render Jinja2 HTML template (per report type: s52, s72, s46, s121)
      3. WeasyPrint renders HTML → PDF (in memory)
      4. Save PDF to Supabase Storage: reports/{municipality_id}/{year}/Q{n}/s52.pdf
      5. Update statutory_report.generated_file_path + status
  → Frontend: poll GET /reports/{id}/status OR Supabase Realtime subscription
  → On completion: return signed download URL
```

For DOCX variant (for AG submissions and MM signature):

```
  → Celery task:
      1. Load municipality's branded .docx template from Supabase Storage
      2. docxtpl renders Jinja2 placeholders with report data
      3. Save DOCX to Supabase Storage: reports/{municipality_id}/{year}/Q{n}/s52.docx
```

---

## Hierarchical Visualization Strategy

Three distinct visual patterns mapped to the right library:

| Pattern | Library | Specific Use |
|---|---|---|
| IDP goal → SDBIP KPI proportional hierarchy | Recharts 3.7.0 `SunburstChart` | Outer ring = IDP goals, inner ring = SDBIP objectives, fill color = achievement status (green/amber/red) |
| SDBIP scorecard (all KPIs in one view) | Recharts 3.7.0 `Treemap` | Each rectangle = one KPI, size = weight, color = achievement; nested for top-layer vs departmental |
| Municipal organogram / department tree | react-d3-tree | Who reports to whom; Section 56 manager → Directorate structure; clickable nodes expand to show KPIs |
| Quarterly actuals vs targets trend | Recharts 3.7.0 `LineChart` | Existing v1.0 component; unchanged after recharts upgrade |
| CFO budget execution (vote vs actual) | Recharts 3.7.0 `ComposedChart` | Bar for budget allocation, line for actual spend; traffic-light color for variances |

**Recharts 2.x → 3.x upgrade:** Migration guide confirms Treemap API is backward-compatible. SunburstChart is new in 3.x. Existing v1.0 charts render correctly after upgrade. Review migration guide for `CartesianAxis` prop changes.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| WeasyPrint 68.1 | Python 3.10+ | Project uses 3.12 — fully compatible |
| WeasyPrint 68.1 | GTK/Pango system libs | Required on Linux deploy; add to Dockerfile build step |
| docxtpl 0.20.2 | python-docx 1.2.0 | docxtpl declares python-docx as dependency; pin both explicitly in pyproject.toml |
| python-statemachine 3.0.0 | Python 3.10+, asyncio | Auto-detects async callbacks; no conflicting dependencies with existing stack |
| recharts 3.7.0 | React 18+, React 19 | Project uses React 19 — confirmed compatible |
| react-d3-tree 3.x | React 18/19, D3 7.x | Installs its own D3 subset — does not conflict with recharts' internal D3 |
| clamav-client | Python 3.7+ | Requires clamd daemon running as sidecar; TCP connection on port 3310 |

---

## Stack Patterns by Variant

**If generating a Section 52 Quarterly Report (standard statutory output):**
- WeasyPrint + Jinja2 HTML template for PDF (primary format for Council tabling)
- docxtpl for DOCX variant (MM edits and signs before submission)
- Trigger via Celery task from the `submit_for_review` state transition
- Store both in Supabase Storage: `reports/{municipality_id}/{year}/Q{n}/`

**If a municipality provides their own report template:**
- Use docxtpl — municipality uploads their `.docx` template via admin panel
- Per-tenant template storage in Supabase Storage bucket (separate from evidence bucket)
- Code injects data into Jinja2 placeholders only; layout and branding stay in the template

**If a POE evidence file exceeds 6MB:**
- Use Supabase Storage TUS resumable upload protocol (already supported in supabase-py SDK)
- ClamAV scan must complete before the upload commit
- Stream through in chunks rather than reading entire file into memory

**If mSCOA code alignment is required at budget vote level:**
- Use JSONB `mscoa_tags` on `sdbip_kpi`; no external API
- Seed `mscoa_reference` table from National Treasury v5.5 Excel using openpyxl (already installed) during deployment
- CFO validates tags in SDBIP editor UI; misalignments flagged as a CFO dashboard widget

**If the approval chain needs audit evidence for the AG:**
- Every state transition writes to the existing `audit_logs` table (already wired via SQLAlchemy event listeners in `src/core/audit.py`)
- No additional audit tooling needed — existing POPIA-compliant audit trail covers AG requirements

---

## Sources

- [WeasyPrint PyPI](https://pypi.org/project/weasyprint/) — v68.1, released 2026-02-06, Python 3.10+ requirement confirmed; HIGH confidence
- [docxtpl PyPI](https://pypi.org/project/docxtpl/) — v0.20.2, released 2025-11-13; Jinja2 inside DOCX templates confirmed; HIGH confidence
- [python-docx PyPI](https://pypi.org/project/python-docx/) — v1.2.0, released 2025-06-16; HIGH confidence
- [python-statemachine PyPI](https://pypi.org/project/python-statemachine/) — v3.0.0, released 2026-02-24; async-native confirmed in documentation; HIGH confidence
- [recharts npm](https://www.npmjs.com/package/recharts) — v3.7.0 current; SunburstChart and Treemap confirmed in 3.x; 3,608 dependents; HIGH confidence
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) — backward compatibility details for 2.x → 3.x; HIGH confidence
- [react-d3-tree GitHub](https://github.com/bkrem/react-d3-tree) — hierarchical node-link tree for React; HIGH confidence
- [Supabase Storage docs](https://supabase.com/docs/guides/storage) — 500GB max per file on paid plan, TUS resumable uploads confirmed; HIGH confidence
- [clamav-client PyPI](https://pypi.org/project/clamav-client/) — Python ClamAV client, updated 2025; MEDIUM confidence (integration approach based on community examples)
- [mSCOA National Treasury](https://mfma.treasury.gov.za/RegulationsandGazettes/MunicipalRegulationsOnAStandardChartOfAccountsFinal/Pages/default.aspx) — v5.5, Excel reference, mandatory from July 2017; HIGH confidence
- [FastAPI + docxtpl DEV.to](https://dev.to/huseinkntrc/automating-word-document-creation-with-python-and-fastapi-using-python-docx-template-41l) — FastAPI + docxtpl integration pattern; MEDIUM confidence
- [python-statemachine docs](https://python-statemachine.readthedocs.io/) — v3.0.0 API reference, async support documented; HIGH confidence

---

*Stack research for: SALGA Trust Engine v2.0 PMS Integration — document generation, workflow approval, evidence storage, mSCOA, hierarchical visualization*
*Researched: 2026-02-28*
