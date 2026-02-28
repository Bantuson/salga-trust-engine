# Pitfalls Research

**Domain:** Adding PMS/SDBIP/Statutory Reporting to an Existing Municipal Service Delivery Platform (South African Context)
**Researched:** 2026-02-28
**Confidence:** HIGH (cross-verified: AG reports, MFMA primary legislation, PostgreSQL RLS official docs, Supabase auth docs, real SA PMS implementations)

---

## Critical Pitfalls

### Pitfall 1: Blowing Up the UserRole Enum Causes a Migration Cascade

**What goes wrong:**
The existing `UserRole` Python enum in `src/models/user.py` has 6 values stored as strings in PostgreSQL. Adding 10+ new roles (`executive_mayor`, `municipal_manager`, `cfo`, `speaker`, `section56_director`, `pms_officer`, `audit_committee_member`, `internal_auditor`, `mpac_member`, `salga_admin`) as a flat enum addition triggers a chain reaction: every `require_role(...)` call that uses string comparison is still correct, but the Supabase custom access token hook (which injects `role` into `app_metadata`) must be updated simultaneously. If the hook is deployed before the DB migration or vice versa, live tokens issued between deployments carry unrecognised role strings, causing all affected users to receive 403 errors until they re-login.

**Why it happens:**
Developers treat the Python enum and the Supabase hook as independent deployments. They are not. The JWT's `app_metadata.role` must match a value `UserRole` recognises. There is also no type-level protection at the database column — the `user.role` column is `String`, not a PostgreSQL ENUM type, so bad values silently persist without errors.

**How to avoid:**
- Write the migration and the Supabase hook update as a single atomic deployment step.
- Keep `UserRole` backward-compatible: never rename or remove existing values; only add new ones.
- Add a database CHECK constraint on `users.role` listing all valid values, so bad role strings are rejected at the DB layer before they cause permission bypass bugs.
- Write a startup assertion in `src/main.py` that validates the set of `UserRole` enum values matches the CHECK constraint — fails fast on configuration drift.
- Stage the role extension behind a feature flag: introduce the new role values, validate Supabase hook, then enable user assignment — three separate steps.

**Warning signs:**
- You see `403 Requires role: manager` for a user who should be `municipal_manager`.
- Tests pass but production users with new roles cannot authenticate.
- The Supabase project dashboard still shows the old role list.
- No migration test checks the role column's constraint after the migration runs.

**Phase to address:**
Phase 1 (RBAC Foundation) — This is the first thing built and must be done atomically before any PMS feature is built on top of it.

---

### Pitfall 2: Flat Role Checking Cannot Express Hierarchical "View Down" Access

**What goes wrong:**
The existing `require_role(*allowed_roles)` factory does exact-match role checking: a user either has a permitted role or gets 403. The PMS introduces a 4-tier hierarchy where `municipal_manager` should see everything a `section56_director` sees, a `section56_director` should see everything their `department_manager` submits, and `executive_mayor` gets read-only across all departments. Implementing this as expanded `require_role(UserRole.MUNICIPAL_MANAGER, UserRole.CFO, UserRole.DIRECTOR, ...)` on every endpoint creates an unmaintainable role matrix — 40+ role combinations across 60+ new endpoints — and will miss cases (a new `salga_admin` role needs all-tenant oversight, but the flat check won't express that without another code change).

**Why it happens:**
The original RBAC was designed for 6 flat roles with no hierarchy. Developers incrementally add new roles to each `require_role()` call as features are built, resulting in role lists that diverge across endpoints.

**How to avoid:**
- Introduce a role hierarchy table or ordered enum (tier 1 > tier 2 > tier 3 > tier 4) before building any PMS endpoint.
- Create a `require_minimum_tier(tier: int)` dependency alongside the existing `require_role()` — it checks whether the user's role tier is equal to or higher than the minimum required.
- For department-scoped access (a director sees only their department), implement a separate `require_department_access(department_id)` dependency that validates `user.department_id == requested_department_id` OR `user.role` is tier 1/2.
- Document the permission matrix in a single place (not scattered across endpoint files) before writing code — the integration plan's role-feature matrix is the source of truth.

**Warning signs:**
- `require_role()` calls contain more than 3 roles.
- Different endpoints have inconsistent role lists for the same conceptual permission.
- A `section56_director` can access endpoints they logically should access, but only because a developer forgot to add them to the allowed list.
- No test asserts that `municipal_manager` can call all endpoints a `section56_director` can.

**Phase to address:**
Phase 1 (RBAC Foundation) — The hierarchy model must be established before any Phase 2+ PMS endpoints are built.

---

### Pitfall 3: PostgreSQL RLS Policies Don't Automatically Cover New Tables

**What goes wrong:**
The existing system uses PostgreSQL RLS for tenant isolation on all tables inheriting `TenantAwareModel`. When 10+ new PMS tables (`sdbip_kpi`, `sdbip_actual`, `evidence_document`, `performance_agreement`, etc.) are added, each one gets tenant isolation from the SQLAlchemy base model, but RLS policies must be explicitly created for each new table via Alembic migrations. Developers who forget to add `CREATE POLICY` statements to a migration expose cross-tenant data leakage — a CFO at Municipality A can query Municipality B's SDBIP targets. Because new tables default to `PERMISSIVE` with no policies (PostgreSQL allows all rows when no policies exist if RLS is enabled but no policy matches), and the application adds `WHERE tenant_id = :tenant_id` at the query level, this feels like it works correctly until someone bypasses the application layer.

**Why it happens:**
The application-level tenant filter `WHERE tenant_id = :tenant_id` in SQLAlchemy queries works correctly for normal use, creating false confidence that new tables are isolated. RLS is a defense-in-depth layer that requires explicit table-by-table configuration. When adding many tables quickly, RLS migration steps are skipped.

**How to avoid:**
- Create a Makefile/CI check that queries `pg_policies` and fails if any `TenantAwareModel` table lacks a `tenant_isolation` policy.
- Write a shared Alembic migration helper function that creates the standard tenant isolation policy — one call per new table, not boilerplate copy-paste.
- Never `BYPASSRLS` on the application database user.
- Add an integration test for each new PMS table: connect as Tenant A user, attempt to read Tenant B's data, assert 0 rows returned.

**Warning signs:**
- A new table migration has no `CREATE POLICY` statement.
- The only mention of `tenant_id` in a migration is the column definition, not the policy.
- Integration tests only check happy-path data retrieval, not cross-tenant access.

**Phase to address:**
Phase 1 (RBAC Foundation) and every subsequent phase when new tables are added.

---

### Pitfall 4: The Ticket→SDBIP Auto-Population Engine Produces Auditor-General-Adverse Data

**What goes wrong:**
The auto-population engine is the product's killer differentiator: ticket resolution data automatically feeds SDBIP actuals so municipalities don't manually capture performance data. But the AG specifically checks that performance data is "reliable, accurate, and complete" (MFMA s46 and the Municipal Planning and Performance Management Regulations, Reg 13). The 2023-24 AG consolidated report found that 48% of municipalities submitted performance reports with unreliable or unusable information. If auto-populated actuals:
- Include tickets from before the financial quarter's start date (boundary error)
- Count tickets across both the GBV category (which is `is_sensitive = True`) in service-delivery KPIs
- Double-count tickets that were re-opened (status cycling `resolved → open → resolved`)
- Are recalculated retroactively when historical ticket data is corrected
- Run with a different `tenant_id` scope than expected

...the SDBIP report will be mathematically wrong in a way that looks credible until the AG runs their own count.

**Why it happens:**
The aggregation query for auto-population is written once and trusted permanently. Query boundary conditions (quarter start/end, status transitions, GBV exclusion) are not re-validated when the ticket schema evolves. The `auto_populated` flag on `sdbip_actual` reassures reviewers without proving data integrity.

**How to avoid:**
- Every aggregation rule in `sdbip_ticket_aggregation_rule` must store its SQL `source_query` plus the exact parameters used at execution time (quarter start, quarter end, tenant_id, category filter). This is already in the data model — make it mandatory, never NULL.
- Add a reconciliation job that runs 24 hours after auto-population: recount from the same query with frozen parameters, compare to the stored actual, alert if they differ by more than 0.5%.
- Explicitly exclude `is_sensitive = True` tickets from all service-delivery KPI aggregations (GBV data must never appear in public performance reports — this is a SEC-05 extension).
- Use a point-in-time snapshot approach: when a quarter closes, freeze the ticket counts. Any subsequent data corrections create a correction record, not a retroactive edit.
- Apply the existing Nyquist validation principle from the integration plan: validate monthly data even for quarterly KPIs.

**Warning signs:**
- The auto-population query uses `WHERE status = 'resolved'` without a `resolved_at BETWEEN quarter_start AND quarter_end` date filter (counts all-time resolved tickets, not quarterly).
- GBV tickets appear in "service delivery complaint" KPI counts.
- A ticket closed in Q1 but re-opened and re-closed in Q2 is counted in both quarters.
- The `source_query` column is nullable and mostly NULL in production data.

**Phase to address:**
Phase 2 (IDP/SDBIP Core) — the aggregation engine must be built with forensic-grade query logging from day one. Never add retroactive data integrity to an existing engine.

---

### Pitfall 5: Workflow States Without a State Machine Become Spaghetti

**What goes wrong:**
The PMS introduces at least 6 approval workflows: SDBIP draft → approved, performance agreement draft → signed → under_review → assessed, statutory report drafting → internal_review → mm_approved → submitted → tabled, quarterly actual pending → submitted → validated, performance agreement under dispute → escalated, and risk items open → mitigated → closed. Each model has a `status` string column. Without a centralised state machine, transitions are managed by ad-hoc `if status == X: status = Y` blocks scattered across services. Within weeks, invalid transitions appear: a `submitted` report gets pushed back to `drafting` without triggering the re-notification workflow. A `validated` SDBIP actual is edited without resetting to `pending`. There is no single authoritative list of valid transitions for each workflow.

**Why it happens:**
FastAPI + SQLAlchemy patterns encourage treating status as just another field. The temptation is to inline transition logic in endpoint handlers. Once three developers have each added one transition, there is no ownership of the state machine.

**How to avoid:**
- Create a `src/core/state_machine.py` module before building any workflow endpoint. It defines valid transitions as a dict: `{(current_state, target_state): [required_roles, side_effects]}`.
- All status transitions go through a single `transition(entity, new_state, user)` function that: validates the transition is in the dict, checks user role, executes side effects (send notification, create audit log entry, set timestamps), and saves.
- Make invalid transitions raise a typed exception (`InvalidTransitionError`) that the API returns as 422 with a human-readable message.
- Test the state machine separately from the API — unit tests for every valid and invalid transition, every role combination.

**Warning signs:**
- Status transitions appear in more than one place in the codebase.
- A status column update does not automatically trigger a notification or audit log.
- The API accepts `status: "approved"` as a field in a PUT body (client decides the status, not the server).
- No test covers the "what happens if a submitted report is submitted again" path.

**Phase to address:**
Phase 2 (IDP/SDBIP Core) — establish the state machine before the first workflow endpoint is written. Phase 4 (Reporting) relies on it for approval chains.

---

### Pitfall 6: Statutory Reports That Fail the AG's Format Expectations

**What goes wrong:**
Section 52, 72, 46, and 121 reports have prescribed formats. The AG reviews the actual document submitted — headers, section numbering, and signature blocks must conform to National Treasury templates. A report generated as clean HTML-to-PDF often looks good but fails when:
- Municipality logo/letterhead is missing from the first page
- Section numbering doesn't match the gazette-prescribed structure
- Tables don't include all mandatory columns (e.g., baseline value, annual target, quarterly target, actual, variance, reason for deviation — six mandatory columns in SDBIP tables)
- Numeric precision differs from the official template (percentages to 1 decimal, Rands to 0 decimal)
- The "responsible person" signature block is missing for quarterly actuals
- Page breaks split tables in ways that make tabling awkward in Council

When the AG finds format defects, they classify it as a compliance finding, which contributes to an adverse audit outcome — even if the data itself is correct.

**Why it happens:**
Developers test report generation against their own judgment of "looks correct." No one validates against the actual MFMA gazette schedule or National Treasury circular format guidance. Performance data and financial data use different precision conventions (e.g., R1,234,567 vs. R1.23M) and both can appear in the same report.

**How to avoid:**
- Obtain the actual National Treasury Section 52 and Section 46 report templates (available on treasury.gov.za) before writing the report generation module.
- Build report templates as Jinja2 HTML files with explicit section numbering matching the gazette schedule — do not auto-generate section numbers programmatically.
- Implement a mandatory field completeness check before report generation: refuse to generate if any mandatory column is NULL (log which KPIs are missing data).
- Test generated reports against at least one real municipality's submitted report (available on municipal websites) to compare structure.
- Include a "draft watermark" feature: watermark = `DRAFT` until `mm_approved` status, remove for `submitted` status.
- WeasyPrint (Python HTML→PDF) is the correct tool; validate that it handles `@page` size correctly for A4 (South African standard) with 25mm margins.

**Warning signs:**
- Report generation code uses `section_number += 1` logic to number sections (should be static template).
- No one on the team has read an actual Section 52 report from a real municipality.
- Report template is "finalized" before National Treasury circular format guidance is reviewed.
- PDF export shows `R 1.23M` in some cells and `R 1,234,567.00` in others — inconsistent number formatting.
- Signature blocks are missing or use generic `[SIGNATURE]` placeholder text.

**Phase to address:**
Phase 4 (Reporting Engine) — do not design the report template until Phase 4 starts. Obtain official templates first, then design around them.

---

### Pitfall 7: Evidence Document Storage Without Lifecycle Management Collapses at Scale

**What goes wrong:**
The integration plan notes that a single municipality may upload 1,000+ evidence documents over 36 months. The existing system uses Supabase Storage (S3-compatible). Without per-municipality storage buckets and folder organisation, the storage bucket becomes a flat dump of files with UUIDs for names. Problems that follow:
- No way to enumerate all evidence for a specific quarter's audit without querying every `evidence_document` record and fetching file metadata.
- Supabase Storage's per-bucket RLS policies cannot scope access to a single municipality's documents within a shared bucket — cross-tenant document access is possible if a URL is guessed or leaked.
- Uploaded documents are not virus-scanned — a municipality staff member uploading a malicious `.docx` as "evidence" could compromise anyone who downloads it.
- No retention or archival policy — after 36 months, storage costs are unbounded and AG-required 5-year retention is not implemented.
- Large PDFs (50+ MB scan uploads) slow the upload endpoint, timeout on poor connections, and blow the file size budget.

**Why it happens:**
Evidence upload is a Phase 2 feature delivered quickly as "upload to Supabase Storage, store the path." The long-term lifecycle problems are deferred because they don't manifest immediately.

**How to avoid:**
- Use per-municipality storage buckets: `salga-evidence-{municipality_id}` — Supabase RLS can then be applied per-bucket, not per-file.
- Folder structure within bucket: `/{financial_year}/{quarter}/{sdbip_kpi_id}/{evidence_document_id}.{ext}` — this enables bulk enumeration for audit.
- Enforce a maximum file size of 20 MB per upload with a server-side check (not just client-side). Convert large PDFs to compressed versions using a Celery task.
- Integrate Supabase Storage with a virus scan on upload (ClamAV via a Celery task that fetches the file, scans, and either marks as `clean` or quarantines). The `evidence_document` model needs a `scan_status` column (`pending | clean | quarantined`).
- Set a Supabase Storage lifecycle rule (or a Celery beat job) that archives documents older than 5 years to cheaper cold storage (Supabase does not natively support lifecycle rules — a custom Celery beat task is needed).
- Never store raw Supabase Storage URLs in the database — store paths and generate signed URLs on demand (1-hour expiry) in the API response.

**Warning signs:**
- Evidence documents share a single bucket with ticket attachments from v1.
- The `evidence_document.file_path` column stores a full `https://` URL rather than a relative path.
- No `scan_status` field exists on the evidence model.
- Upload endpoint has no file size limit middleware.
- The upload Celery task does not have a timeout — a 500 MB upload hangs indefinitely.

**Phase to address:**
Phase 2 (IDP/SDBIP Core, evidence upload) — get the storage architecture right before the first upload. Retrofitting per-municipality buckets after thousands of files are in a shared bucket requires a migration nightmare.

---

### Pitfall 8: mSCOA Budget Code Linkage Treated as a Free-Text Field

**What goes wrong:**
Every SDBIP KPI must link to a budget vote via mSCOA (Municipal Standard Chart of Accounts) codes. The data model defines `sdbip_kpi.mscoa_code` as a string field. If this is implemented as a free-text input, the following happens:
- Different directors at the same municipality enter the same vote as `"0100/001"`, `"0100-001"`, `"100/001"`, and `"Vote 1 - Technical"` — four representations of the same budget line.
- The CFO's "budget vs SDBIP achievement" view cannot join on `mscoa_code` because values don't match across departments.
- The AG's budget vs performance cross-reference fails because the mSCOA codes in the performance report don't match the codes in the financial statements.
- When mSCOA regulations are updated (National Treasury amends the chart periodically), no lookup table exists to update all affected KPIs.

**Why it happens:**
mSCOA has 7 segments (Function, Project, Funding, SCoA Item, Cost String, Regional Identifier, and Costing) with hundreds of valid combinations. A full mSCOA lookup table is complex to implement. The shortcut is to let users type whatever they know.

**How to avoid:**
- Import the mSCOA reference tables from National Treasury's official mSCOA Excel release (updated annually) into a `mscoa_reference` lookup table in the database — this is a one-time data load, not a custom implementation.
- The `mscoa_code` field becomes a FK to `mscoa_reference.code` with a typeahead/autocomplete in the UI (search by description, not code — officials know "Basic Water" not "7200/0/0/1/0000").
- Only include the Vote level (Function + Project combination) in the SDBIP linkage — the full 7-segment string is for financial systems, not PMS.
- Display the mSCOA description alongside the code in all reports — the AG expects to see "Water Services — Infrastructure" not "7200/0001".

**Warning signs:**
- `mscoa_code` is a `VARCHAR(50)` with no FK constraint and no validation.
- Two SDBIP KPIs for the same budget vote have different `mscoa_code` values.
- The CFO dashboard query joins on `mscoa_code` using `ILIKE` instead of `=`.
- No admin interface exists to update the mSCOA reference table when National Treasury publishes new codes.

**Phase to address:**
Phase 2 (IDP/SDBIP Core) — mSCOA linkage is required from the first SDBIP KPI created. Retrofitting FK validation after unvalidated free-text codes exist is a data cleanup project.

---

### Pitfall 9: Configurable Department Structures Break If Tenant Setup Is Incomplete

**What goes wrong:**
Every municipality has a different department structure. The platform solves this with a configurable `municipal_department` table per tenant. But if a municipality's departments are not configured before Section 56 directors are invited, the system cannot route quarterly actual submissions — the SDBIP KPIs have a `responsible_director_id` FK that requires a `department_id`, and `department_id` requires a `municipal_department` record. The onboarding sequence must enforce: configure departments → assign director to department → then create SDBIP KPIs. If this sequence is not enforced by the API, a PMS officer can create KPIs with a NULL `department_id`, which silently breaks every departmental report, rollup, and CFO overview.

**Why it happens:**
The onboarding wizard is built as a sequence of optional steps for UX flexibility. Developers add validation later when they discover the dependency — but by then, some pilot municipalities have incomplete configurations.

**How to avoid:**
- Make `department_id` NOT NULL on `sdbip_kpi` at the database level.
- The PMS module is locked (returns 403 with a clear message: "Configure your department structure before creating SDBIP KPIs") until the municipality has at least one `municipal_department` record and a valid `municipality_config` record.
- Build a configuration completeness check endpoint: `GET /api/v1/municipalities/{id}/pms-readiness` returns a checklist: departments configured, directors assigned, financial year set, SDBIP layers selected. The PMS dashboard shows this checklist with progress indicators.
- Require SALGA admin to approve tenant PMS configuration before live data entry begins — this creates an audit trail that the tenant was properly onboarded.

**Warning signs:**
- `sdbip_kpi.department_id` is nullable in the migration.
- No endpoint validates configuration completeness before allowing SDBIP creation.
- A PMS officer can create KPIs on day one of access, before departments are configured.
- The CFO dashboard silently drops KPIs with NULL `department_id` from aggregations.

**Phase to address:**
Phase 1 (RBAC Foundation and Tenant Config) — department structure configuration is the first PMS action any tenant performs. Block all subsequent PMS features until it is complete.

---

### Pitfall 10: Supabase JWT Claims Stale After Role Changes Cause Silent Permission Failures

**What goes wrong:**
In the existing system, a user's role is stored in Supabase `app_metadata` and injected into the JWT by the custom access token hook. When a user is promoted from `manager` to `municipal_manager`, the backend updates `User.role` in the PostgreSQL `users` table. But the user's active JWT still carries the old role. Until the token expires (Supabase default: 1 hour) or the user logs out and back in, they will continue to receive 403 on `municipal_manager`-required endpoints. For senior officials (CFO, Municipal Manager, Mayor) who use persistent sessions across days, this gap can last hours. The user experiences "the system doesn't work" and calls support.

This is worse for the inverse case: if a Section 56 director is demoted or suspended, their JWT continues granting elevated permissions until expiry. In a politically sensitive context (SA municipalities have significant political turbulence), this is a governance risk.

**Why it happens:**
Supabase JWTs are stateless bearer tokens. The custom access token hook runs at login time, not at every request. Role changes at the database level do not invalidate existing tokens. This is a fundamental JWT architecture constraint that the v1.0 system never encountered because role changes were infrequent.

**How to avoid:**
- Implement server-side token revocation: maintain a `revoked_tokens` table (or Redis set) with `jti` values of tokens that should no longer be accepted. The `get_current_user` dependency checks this list before accepting the token.
- On any role change via the admin API: invalidate all existing tokens for that user by adding their `sub` to a `force_logout` Redis set with a TTL of Supabase's max token lifetime.
- Reduce Supabase access token lifetime to 15 minutes for users with elevated roles (tier 1-2). Supabase allows configuring token expiry.
- In the `get_current_user` dependency, also query the database for the user's current role (it already does this via `db.execute(select(User).where(User.id == user_id))`) — compare `User.role` from DB to `role` from JWT; if they differ, reject the token with a specific error message prompting re-login.

**Warning signs:**
- A role change in the admin panel takes immediate effect in the database but not in the UI for the affected user.
- No forced logout mechanism exists for role changes.
- The `get_current_user` dependency uses only the JWT's `app_metadata.role` without cross-checking the database `users.role`.
- Supabase token expiry is set to the default (which may be longer than acceptable for elevated roles).

**Phase to address:**
Phase 1 (RBAC Foundation) — token revocation strategy must be decided before senior roles are assigned to real users.

---

### Pitfall 11: Retroactive Corrections to SDBIP Actuals Destroy Audit Trail

**What goes wrong:**
A PMS officer submits Q2 actuals for a water KPI as "85% resolved within SLA." The municipal manager approves it. The report is tabled to Council. Two months later, someone discovers the SLA calculation excluded a category of tickets and the correct value was 72%. In a naive implementation, the `sdbip_actual.actual_value` field is updated in place and the audit log shows the field changed — but the original approved value is gone from the primary table, and the Council-tabled report now contradicts the current database value.

The AG specifically asks: "What was reported to Council on [date]? Show me the evidence." If the database value has been silently corrected, the answer is different from what Council was told. This is an audit finding.

**Why it happens:**
UPDATE semantics feel natural for correcting wrong numbers. The audit log in `audit_logs` table records the change (old/new value) but does not link to which statutory report was generated from the old value. Report generation fetches current values from the database, not point-in-time snapshots.

**How to avoid:**
- `sdbip_actual` records are immutable once their `validation_status = 'validated'`. Corrections go through a `sdbip_actual_correction` record that references the original, stores the corrected value, and requires PMS officer + municipal manager approval via the same workflow.
- Statutory report generation snapshots all source data at generation time into a `statutory_report_snapshot` table (JSON blob per report). Subsequent corrections create a new report version, not an edit.
- The CFO dashboard shows a data lineage indicator: if the current `actual_value` differs from the value used in a previously generated statutory report, flag it with a "Data Corrected After Reporting" warning.
- Reports carry a generation timestamp and a data-as-of timestamp in the footer — the AG can verify the data was correct at the time of generation.

**Warning signs:**
- `sdbip_actual.actual_value` is updatable after `validation_status = 'validated'`.
- Report generation queries the current value from `sdbip_actual` at generation time without snapshotting.
- The audit log shows an `actual_value` change on a record that was previously used in a tabled report, with no linkage between the correction and the report.

**Phase to address:**
Phase 2 (IDP/SDBIP Core) — immutability rules must be enforced from the first `sdbip_actual` record created. Adding them retroactively requires a data migration and a correction workflow that is expensive to retrofit.

---

### Pitfall 12: Statutory Deadline Tracking Without a Reliable Financial Year State Machine

**What goes wrong:**
All statutory deadlines are relative to the financial year: "Section 72 mid-year assessment is due January 25" means January 25 of the calendar year during the financial year that runs July to June. The platform stores `financial_year` as a string (e.g., `"2024/2025"`) on each SDBIP and statutory report record. The deadline tracking system hardcodes: `if month == 1 and day == 25: send_s72_reminder()`.

Problems:
- When 2025/2026 starts in July 2025, the old 2024/2025 SDBIP is still active (mid-year assessment for 2024/2025 happens in January 2026, which is in the new calendar year but the old financial year).
- Municipalities on different SDBIP rollout schedules (some are still completing onboarding during mid-year) get the wrong deadline.
- When a deadline falls on a public holiday (SA has 12 per year), the system does not adjust.
- The financial year state machine has no concept of "current active year" per tenant — two municipalities could be on different financial years during a pilot rollout period.

**Why it happens:**
Deadlines look simple: they are legislated dates. Developers hardcode them as date constants, not as computed relative to a per-tenant financial year start/end record.

**How to avoid:**
- Introduce a `financial_year` model per tenant: `{id, municipality_id, financial_year_start, financial_year_end, status (planning | active | closed)}`. Only one financial year per tenant can be `active` at a time.
- All deadlines are computed as offsets from the `active` financial year's dates: `Section 71 = financial_year_start + (month_offset * 30) + 10 days`. This generalises to any financial year.
- Load South African public holidays from the Department of Labour's official calendar (available as a structured list) and shift deadlines forward to the next business day when they fall on a public holiday.
- The deadline notification Celery beat task reads from the `financial_year` table per tenant — it is never a global hardcoded date.

**Warning signs:**
- Deadline logic contains Python `datetime(year, 1, 25)` literals with a hardcoded year.
- No `financial_year` model exists — deadlines are derived from `SDBIP.financial_year` string.
- A `SALGA_ADMIN` looking at the deadline dashboard sees a single list of deadlines, not per-municipality deadline states.
- No public holiday adjustment exists in deadline calculations.

**Phase to address:**
Phase 4 (Reporting and Deadline Tracking) — but the `financial_year` model belongs in Phase 1 as it underpins SDBIP creation. Build the model in Phase 1; build the deadline engine in Phase 4.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store mSCOA code as free text instead of FK to reference table | No mSCOA import needed | CFO dashboard joins break; AG cross-reference fails; data cleanup required | Never — import the reference table in Phase 2 |
| Extend `UserRole` enum in-place without atomic Supabase hook update | Faster deployment | Users with new roles get 403 until forced re-login | Never — deploy as atomic operation |
| Allow `sdbip_actual.actual_value` to be UPDATE-able after validation | Simpler correction UX | Destroys audit trail; AG finding; report/database mismatch | Never for validated records — use correction records |
| Skip RLS policy creation for new PMS tables ("app layer handles it") | Faster migration authoring | Cross-tenant data exposure if app layer has a bug or is bypassed | Never — defense in depth is mandatory |
| Generate reports by querying current live data (no snapshot) | No snapshot complexity | Reports change retroactively when data is corrected; AG disputes | Never for tabled/submitted reports — snapshot at generation time |
| Hardcode financial year deadlines as date literals | Simple calendar logic | Breaks across financial year boundaries and public holidays | Never — use per-tenant financial year model |
| Evidence documents in shared Supabase bucket with sequential names | Faster to ship | Cross-tenant path guessing; no per-tenant RLS; audit enumeration fails | Never — per-municipality buckets from day one |
| Skip virus scanning on evidence uploads | No ClamAV setup needed | Malicious files served to AG reviewers and oversight committee | Never in production — acceptable in Phase 2 dev environment only |
| Inline state transition logic in API endpoint handlers | Faster initial development | State machine diverges across handlers; invalid transitions possible | Never — centralise in state machine from first workflow endpoint |
| `sdbip_kpi.department_id` as nullable | Flexible onboarding | Department rollup queries silently drop NULLs; CFO dashboard incorrect | Never — enforce NOT NULL and onboarding gate |

---

## Integration Gotchas

Common mistakes when connecting the existing ticket system to new PMS features.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Ticket → SDBIP auto-population | Query uses `WHERE status = 'resolved'` without date bounds | Always filter `resolved_at BETWEEN quarter_start AND quarter_end` with explicit quarter boundaries |
| GBV tickets in service delivery KPIs | `is_sensitive = True` tickets included in water/roads/sanitation aggregations | Explicit `AND is_sensitive = FALSE` in every auto-population query — make it enforced in the `sdbip_ticket_aggregation_rule` validation |
| Supabase Auth role changes | Only update `User.role` in PostgreSQL, assume JWT reflects it | Force token revocation via Redis `force_logout` set; validate DB role vs JWT role in `get_current_user` |
| mSCOA to financial system | Treat mSCOA as a display-only code | Store as FK to reference table; use it for grouping and reconciliation with financial reports |
| Celery beat for deadline notifications | Single global beat schedule for all tenants | Per-tenant `financial_year` model drives deadline calculation; beat task iterates over active financial years |
| Evidence document URLs in reports | Store Supabase Storage public URLs in report snapshots | Store paths only; generate signed 1-hour URLs at serve time; never hardcode URLs in report content |
| Statutory report → Council tabling | Generate report at the moment of submission | Generate report at `mm_approved` status with a snapshot; the submitted file is the snapshot, not re-generated |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Auto-population query scans all tickets per municipality per quarter | Job takes 60+ seconds for municipalities with 10,000+ tickets | Add composite index on `(tenant_id, category, status, resolved_at)`; pre-aggregate into a `ticket_quarterly_summary` materialised view | >5,000 tickets per municipality |
| CFO dashboard loads all SDBIP KPIs without pagination | Dashboard timeout for 200+ KPI municipalities | Paginate by department; lazy-load achievement percentages; cache per-department rollups for 5 minutes | >100 KPIs per municipality |
| Generating statutory report synchronously in API handler | Request times out for 50+ KPI municipalities | Move report generation to Celery task; return a task ID; poll for completion; present download link when done | >30 KPIs in report |
| `evidence_document` table queried with `WHERE sdbip_actual_id = ?` without index | Evidence loading for a KPI takes 3+ seconds | Add FK index on `evidence_document.sdbip_actual_id` at migration time | >500 evidence documents per municipality |
| N+1 queries for SDBIP KPI → quarterly targets → actuals → evidence | Dashboard API takes 10+ seconds | Use SQLAlchemy `selectinload` for targets/actuals; separate endpoint for evidence (load on demand) | >50 KPIs displayed simultaneously |
| Hierarchical department rollup calculated at query time | CFO dashboard "total achievement" takes 5+ seconds | Pre-calculate and cache department rollup scores after each quarterly actual submission | >5 departments, >20 KPIs each |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Auto-populating GBV ticket data into SDBIP actuals | GBV victim data visible in performance reports (SEC-05 firewall breach) | Explicit `is_sensitive = FALSE` filter in every aggregation rule; validator rejects rules without this filter |
| `executive_mayor` role can edit SDBIP actuals | Political manipulation of performance data; AG finding for lack of segregation of duties | Mayor/Council roles are read-only on all PMS data; only `section56_director`, `department_manager`, and `pms_officer` can submit actuals |
| MPAC members can access individual performance agreement scores | Privacy violation; political exposure of individual officials | Performance agreement scores are viewable only by the assessed official, their evaluator, `municipal_manager`, and `pms_officer`; MPAC sees aggregate scores only |
| Statutory reports accessible to all municipality users | Pre-publication leak of politically sensitive performance data | Reports have a `status`-gated visibility: `drafting/internal_review` visible only to `mm` and `pms_officer`; `tabled` status makes them publicly visible |
| `salga_admin` bypasses tenant isolation for benchmarking | Cross-tenant PII exposure | `salga_admin` accesses aggregated benchmarking data only; individual municipality data requires explicit `municipality_id` scope in every query, enforced in a dedicated `SALGAAdmin` dependency |
| Evidence documents served without access check | A councillor from Municipality A downloads Municipality B's sensitive audit evidence | All document URLs are signed with tenant-scoped storage paths; API checks `user.municipality_id == document.municipality_id` before issuing signed URL |
| Performance agreement scores permanently readable after official departure | Former official's performance history exposed | Performance agreements carry a `retention_period` (POPIA 5-year rule); a POPIA deletion request for a former official must anonymise their performance scores |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| PMS dashboard built for desktop with wide tables | Municipal officials using laptops in low-light Council chambers cannot read cramped data | Responsive table design with priority columns visible on 1280px; progressive disclosure for additional columns |
| SDBIP KPI entry uses ID fields (dropdown lists of 200 items) | PMS officer spends 20 minutes finding the right KPI for a quarterly actual | Typeahead search on KPI description text; group by department; remember last-selected department per user |
| Quarterly actual submission form shows all 50+ KPIs at once | Officials miss submitting some KPIs; form is overwhelming | Show only KPIs assigned to the logged-in director's department; group by month; show completion progress bar |
| Statutory report status is a technical enum value | Municipal manager sees `mm_approved` instead of "Approved by Municipal Manager — Awaiting Submission" | Map every status to a plain-language description with the next required action and who is responsible |
| Evidence upload accepts any file type | Corrupt files, executables, or unsupported formats break document review | Accept PDF, DOCX, XLSX, JPG, PNG only; server-side validation; clear error message listing accepted types |
| CFO budget vs SDBIP view uses finance jargon (mSCOA code segments) | CFO knows their budget but not the mSCOA segment codes | Show "Water Services — Infrastructure (R 2.4M)" not "7200/0001/0/0/00 (R 2,400,000.00)" |
| Unreliable internet: form submission loses data mid-upload | PMS officer re-enters two hours of quarterly actual data | Auto-save draft to localStorage every 30 seconds; resume submission after connectivity restores; show "Last saved: 2 minutes ago" |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **RBAC extension:** Often the Python enum and Supabase hook are updated but the CHECK constraint on `users.role` is not. Verify: `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'users'::regclass AND conname LIKE '%role%';`

- [ ] **Auto-population engine:** Often the happy path works but GBV exclusion is missing. Verify: create a GBV ticket, resolve it, run auto-population, assert the GBV ticket is NOT counted in any service-delivery KPI.

- [ ] **State machine:** Often the happy-path transitions are implemented but invalid transitions return 200. Verify: attempt to transition a `validated` actual back to `pending` via the API — it must return 422 with `InvalidTransitionError`.

- [ ] **Report generation:** Often report looks correct in development but fails for municipality-specific data. Verify: generate a report for a municipality with NULL baseline values, a KPI with 0 annual target, and a KPI where actual exceeds target by 200% — all edge cases must produce valid output.

- [ ] **Evidence upload:** Often virus scanning is planned but not wired up. Verify: upload an EICAR test file (standard antivirus test string) — the system must quarantine it and return an error, not store it.

- [ ] **Token revocation:** Often role changes appear to work but stale tokens still work until expiry. Verify: log in as a `section56_director`, change their role to `department_manager` via the admin API, immediately call a `section56_director`-required endpoint with the old token — must return 401 or 403, not 200.

- [ ] **Tenant isolation on PMS tables:** Often verified for the main SDBIP tables but missed for junction tables (`sdbip_quarterly_target`, `evidence_document`, `performance_agreement_kpi`). Verify: query each new PMS table as Tenant B user — assert 0 rows for Tenant A data.

- [ ] **Statutory deadline notifications:** Often the Celery beat task sends notifications to the correct role but the financial year boundary is wrong. Verify: set a test municipality's financial year to end June 30 and run the deadline calculation for January 25 (Section 72 due date) — the system must identify the correct financial year and the correct recipient.

- [ ] **mSCOA reference table:** Often a migration creates the `mscoa_reference` table but does not seed it with data. Verify: create a SDBIP KPI via the API using a valid mSCOA code and confirm it resolves to a human-readable description in the response.

- [ ] **Offline form resilience:** Often the auto-save draft feature is built for Chrome but fails on older Android WebViews used in rural municipalities. Verify: disable network in Chrome DevTools, fill a quarterly actual form, re-enable network — draft must have been saved and submission must succeed.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Role enum deployed out-of-sync with Supabase hook | MEDIUM | Immediately force logout all affected users (revoke tokens), deploy hook update, have users re-login; no data loss but service disruption for minutes |
| GBV data found in SDBIP actuals | HIGH | Immediate statutory report retraction, delete affected `sdbip_actual` records, re-run auto-population with corrected query, notify AG of the correction, implement SEC-05 filter retrospectively |
| Cross-tenant data exposure via missing RLS policy | HIGH | Immediate audit of access logs to determine scope, notify affected municipalities, patch RLS policy, consider mandatory POPIA breach notification if personal data was exposed |
| Invalid state transitions created corrupt workflow states | MEDIUM | Write a data migration to identify and reset invalid states to the last valid state, add state machine validation retroactively, re-queue affected approvals for re-submission |
| Statutory reports contain incorrect auto-populated actuals | HIGH | Generate corrected report versions, retract the original from Council records (requires Council resolution), submit correction to AG, add data lineage tracking retroactively |
| Evidence documents in mixed-tenant bucket | HIGH | Enumerate all documents by `tenant_id` from the `evidence_document` table, move to per-municipality buckets in a migration, update stored paths, validate RLS policies on new buckets |
| Stale JWT grants elevated access after role demotion | MEDIUM | Add force-logout mechanism (Redis set) immediately, revoke all tokens for affected user, audit audit logs for actions taken during the stale-token window |
| mSCOA free-text codes prevent CFO dashboard joins | MEDIUM | Data cleanup migration: normalise codes to standard format, create reference table, FK constraint, PMS officer re-validates each KPI's mSCOA linkage |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Role enum/hook sync | Phase 1 (RBAC) | Atomic deployment test: change a role, force re-login, confirm new role works immediately |
| Hierarchical role checking | Phase 1 (RBAC) | Test matrix: every role combination against every tier-required endpoint |
| RLS missing on new tables | Phase 1 + every subsequent phase | CI check: `pg_policies` query fails build if any TenantAwareModel table lacks policy |
| GBV data in auto-population | Phase 2 (SDBIP Core) | Integration test: GBV ticket not counted in any service KPI |
| Ticket→SDBIP date boundaries | Phase 2 (SDBIP Core) | Integration test: ticket created in Q1, resolved in Q2, counted only in Q2 auto-population |
| Workflow state machine | Phase 2 (SDBIP Core) | Unit tests: every invalid transition returns 422; every valid transition triggers correct side effects |
| Report format compliance | Phase 4 (Reporting) | Manual review: compare generated Section 52 against official National Treasury template |
| Report data snapshot | Phase 4 (Reporting) | Verify: correct a `sdbip_actual` after report generation; confirm the generated report still shows original value |
| Evidence lifecycle | Phase 2 (SDBIP Core) | Integration test: upload EICAR file, check quarantine status; enumerate all evidence by tenant, verify no cross-tenant access |
| mSCOA reference table | Phase 2 (SDBIP Core) | Verify: SDBIP KPI creation with invalid mSCOA code returns 422 |
| Department config gate | Phase 1 (RBAC/Tenant Config) | Verify: PMS module returns 403 until department structure is configured |
| Stale JWT permissions | Phase 1 (RBAC) | Verify: role change + immediate API call with old token returns 403 |
| Retroactive actual correction | Phase 2 (SDBIP Core) | Verify: validated actual cannot be updated via PUT; correction record required |
| Deadline financial year logic | Phase 4 (Reporting) | Verify: deadline computed correctly for both calendar year and cross-boundary financial year cases |
| mSCOA free text | Phase 2 (SDBIP Core) | Verify: two KPIs for the same budget vote show identical mSCOA descriptions |
| Storage per-tenant bucket | Phase 2 (SDBIP Core) | Verify: evidence uploaded by Municipality A returns 403 when fetched by Municipality B user |

---

## Sources

### AG Municipal Audit Reports
- [AGSA Consolidated General Report on Local Government Audit Outcomes 2022-23](https://www.parliament.gov.za/storage/app/media/OISD/Reports/Auditor_General/2024/august/28-08-2024/MFMA_Report_2022-23_FINAL.pdf)
- [AGSA MFMA 2023-24 Consolidated Report](https://mfma-2024.agsareports.co.za/)
- [AGSA MFMA Reports Index](https://www.agsa.co.za/Reporting/MFMAReports.aspx)
- [Auditor-General: Only 34 of 257 municipalities achieved clean audits in 2022-23](https://mg.co.za/politics/2024-08-27-auditor-general-only-34-of-257-municipalities-achieved-clean-audits-in-2022-23/)

### SA Municipal PMS Implementation
- [Strengthening Performance Management System Implementation in SA Municipalities](https://www.researchgate.net/publication/320377855_Strengthening_Performance_Management_System_Implementation_in_South_African_Municipalities)
- [Factors that influence the performance management system in KZN Municipality](https://www.tandfonline.com/doi/full/10.1080/23311975.2024.2350789)
- [Steve Tshwete Local Municipality — PMDS Framework 2024-25](https://stlm.gov.za/wp-content/uploads/2024/12/ANNEXURE-B-STLM-IPMS-vol2-PMDS-framework-review-2024-2025.pdf)
- [SALGA Municipal PMS Training Programme](http://salga.org.za/khub/KMP%20Issue%202/Municipal%20Capabilities%20and%20Governance/Performance%20Management%20Training%20Manuals/201900%20Learner%20Guide%20-%20PMS%20POLITICAL%20STREAM.pdf)
- [A Post-Mortem of Municipal Audit Action Plans in South Africa (MDPI)](https://www.mdpi.com/2071-1050/17/4/1535)

### mSCOA Integration
- [mSCOA Challenges — IMQS Infrastructure Perspective](https://www.imqs.co.za/news-articles/three-challenges-to-mscoa-implementation-an-infrastructure-asset-management-perspective/)
- [National Treasury mSCOA Regulations](https://mfma.treasury.gov.za/RegulationsandGazettes/MunicipalRegulationsOnAStandardChartOfAccountsFinal/Pages/default.aspx)
- [Understanding mSCOA: A Key to Fixing Municipal Financial Woes](https://www.accountingweekly.com/audit-accounting/understanding-mscoa-a-key-to-fixing-south-africas-municipal-financial-woes)

### RBAC and RLS
- [Custom Claims & RBAC in Supabase](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Custom Access Token Hook — Supabase](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [PostgreSQL RLS Implementation Guide — Pitfalls](https://www.permit.io/blog/postgres-rls-implementation-guide)
- [Multi-tenant data isolation with PostgreSQL RLS — AWS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [RBAC Challenges](https://www.crossid.io/academy/role-based-access-control-rbac-challenges)
- [10 RBAC Best Practices 2025](https://www.osohq.com/learn/rbac-best-practices)

### Workflow Engine Design
- [Simplifying Approval Process with State Machine](https://medium.com/@wacsk19921002/simplifying-approval-process-with-state-machine-a-practical-guide-part-1-modeling-26d8999002b0)
- [Workflow Engine vs State Machine](https://workflowengine.io/blog/workflow-engine-vs-state-machine/)
- [Designing a Workflow Engine Database](https://exceptionnotfound.net/designing-a-workflow-engine-database-part-1-introduction-and-purpose/)

### Data Integrity
- [Common Data Integrity Issues — Dataversity](https://www.dataversity.net/common-data-integrity-issues-and-how-to-overcome-them/)
- [Why Data Reconciliation Protects Integrity — Acceldata](https://www.acceldata.io/blog/reconciliation-the-critical-lifeline-for-enterprise-data-integrity)

---

*Pitfalls research for: SALGA Trust Engine v2.0 — PMS/SDBIP/Statutory Reporting Integration*
*Researched: 2026-02-28*
*Research confidence: HIGH — AG reports verified, MFMA primary legislation cross-checked, existing codebase patterns analysed (auth, RLS, audit, ticket models), SA municipal PMS literature reviewed*
