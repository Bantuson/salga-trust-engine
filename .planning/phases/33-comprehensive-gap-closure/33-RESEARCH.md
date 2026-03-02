# Phase 33: Comprehensive v2.0 Gap Closure - Research

**Researched:** 2026-03-02
**Domain:** Multi-layer gap closure — backend bugfixes, frontend route registration, phase verification, tracking cleanup
**Confidence:** HIGH (all findings based on direct codebase inspection)

---

## Summary

Phase 33 is a targeted gap-closure phase that addresses the 15 issues catalogued in the v2.0 milestone audit (`v2.0-MILESTONE-AUDIT.md`). The audit found 45/60 requirements fully satisfied, 3 broken E2E flows, 4 integration bugs, and 2 unverified phases (27 and 28). All gaps are well-scoped and have clear file targets.

The gaps fall into four categories: (1) backend code bugs — 1 bug in `statutory_report_service.py`; (2) frontend missing routes/pages — 3 bugs in `App.tsx` requiring new pages and route registration; (3) requirement tracking fixes — 3 stale checkboxes in `REQUIREMENTS.md`; and (4) independent phase verification — writing `VERIFICATION.md` for Phases 27 and 28.

**Primary recommendation:** Decompose into 4 focused plans. Plan 33-01 fixes all backend/frontend code bugs and missing routes in one wave. Plan 33-02 handles the PA-01 investigation and IDP-04 route. Plan 33-03 creates VERIFICATION.md for Phases 27 and 28. Plan 33-04 updates stale tracking and adds the PMS readiness gate to role-dashboard endpoints. All work is in files already studied; no new dependencies are needed.

**Current status note:** Direct code inspection reveals that the PA-01 gap described in the audit has already been partially addressed in the current codebase. `PerformanceAgreementsPage.tsx` now includes `section57_manager_id` in the form state, the Select field, and the POST body. This should be verified to confirm it is fully working before marking it done.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RBAC-01 | Platform supports Tier 1 role approval workflow — SALGA Admin approves/rejects Tier 1 requests | Backend API exists at `GET /api/v1/roles/approvals/pending` and `POST /api/v1/roles/approvals/{id}/decide`. Frontend `/role-approvals` route is missing from App.tsx. Backend has `Tier1ApprovalRequest` model. Need new `RoleApprovalsPage.tsx`. |
| RBAC-02 | Admin can configure municipal department structure per tenant | Backend CRUD exists at `/api/v1/departments`. Frontend `/departments` nav link routes to nothing (no `<Route>` registered). `/departments/organogram` route exists but not `/departments`. Need a `DepartmentsPage.tsx` or redirect. |
| RBAC-04 | Platform enforces role hierarchy inheritance (senior inherits subordinate access) | Enforcement is in `require_min_tier()` in `deps.py`. `/pms-setup` standalone route missing from App.tsx — `PmsSetupWizardPage` is imported but never registered as a route (only accessible via `?view=setup` in PmsHub). Need `<Route path="/pms-setup">` |
| IDP-04 | User can view alignment mapping from IDP objectives down to linked SDBIP KPIs (golden thread) | `GoldenThreadPage.tsx` exists with `embedded` prop. Backend `/cycles/{cycle_id}/golden-thread` endpoint exists. Page is accessible via PmsHub dropdown but has no standalone route. Need `<Route path="/pms/golden-thread">` in App.tsx. |
| PA-01 | PMS officer can create performance agreement for Section 57 manager linked to financial year | Backend fully implemented. Current `PerformanceAgreementsPage.tsx` NOW includes `section57_manager_id` in form state and POST body (gap appears fixed vs audit). Also calls `/api/v1/pa/eligible-managers`. Needs verification run to confirm 422 no longer occurs. |
| REPORT-05 | Reports follow approval workflow (drafting → internal_review → mm_approved → submitted → tabled) | Bug: `_TRANSITION_ROLES["submit_for_review"]` in `statutory_report_service.py` contains `PMS_OFFICER`, `DEPARTMENT_MANAGER`, `CFO`, `ADMIN`, `SALGA_ADMIN` — but is **missing** `MUNICIPAL_MANAGER`. Frontend shows the button for MM. Backend returns 403. One-line fix: add `UserRole.MUNICIPAL_MANAGER` to the `submit_for_review` set. |
| RBAC-03 | Admin can configure municipality settings | Requirement is satisfied — Phase 27 code is wired. Gap is missing `VERIFICATION.md`. Need independent verification document for Phase 27. |
| RBAC-05 | Admin can view municipal organogram showing reporting structure | Requirement is satisfied — `OrganogramPage` exists and route `/departments/organogram` is registered. Gap is missing Phase 27 `VERIFICATION.md`. |
| RBAC-06 | Role changes and permission checks are fully audit-logged | Requirement is satisfied — `ROLE_CHANGE` audit events implemented. Gap is missing Phase 27 `VERIFICATION.md`. |
| REPORT-03 | System auto-generates Section 46 annual performance report | REQUIREMENTS.md now shows `[x]` (already updated from audit). Phase 30 VERIFICATION T3=VERIFIED. No action needed — was stale at audit time but is current. |
| REPORT-04 | System auto-generates Section 121 annual report performance chapter | REQUIREMENTS.md now shows `[x]` (already updated from audit). Phase 30 VERIFICATION T4=VERIFIED. No action needed. |
| REPORT-09 | System auto-creates report tasks 30 days before each statutory deadline | REQUIREMENTS.md now shows `[x]` (already updated from audit). Phase 30 VERIFICATION T9=VERIFIED. No action needed. |
</phase_requirements>

---

## Standard Stack

### Core (no new libraries — all gaps use existing stack)

| Library/Tool | Version | Purpose | Status |
|---|---|---|---|
| FastAPI | existing | Backend route/endpoint framework | Used in all existing API files |
| React Router DOM | existing | Frontend route registration | `<Route>` components in App.tsx |
| TypeScript/React | existing | Frontend pages | Inline function components pattern established |
| pytest | 8.3.0 | Backend verification runner | `tests/` directory fully set up |
| CSS variables | existing | UI styling | Phase 27-03 lock: use `var(--space-*)`, `var(--glass-bg)`, etc. |

### No new installations required

All gap items use existing stack. No `npm install` or `pip install` needed.

---

## Architecture Patterns

### Pattern 1: Missing Route Registration (BUG-2, BUG-3, BUG-4, IDP-04)

**What:** Four routes are linked from `useRoleBasedNav.ts` but not registered in `App.tsx`.

**Where:** `frontend-dashboard/src/App.tsx` lines 236-264 (authenticated routes block).

**Pattern from existing code:**
```tsx
// Existing pattern (App.tsx line 244-261):
<Route path="/departments/organogram" element={<DashboardLayout><OrganogramPage /></DashboardLayout>} />
<Route path="/pms" element={<DashboardLayout><PmsHubPage /></DashboardLayout>} />
```

**Fix pattern for missing routes:**
```tsx
// Add after existing /departments/organogram route:
<Route path="/departments" element={<DashboardLayout><DepartmentsPage /></DashboardLayout>} />
<Route path="/role-approvals" element={<DashboardLayout><RoleApprovalsPage /></DashboardLayout>} />
<Route path="/pms-setup" element={<DashboardLayout><PmsSetupWizardPage /></DashboardLayout>} />
<Route path="/pms/golden-thread" element={<DashboardLayout><GoldenThreadPage /></DashboardLayout>} />
```

**Import pattern** (existing precedent in App.tsx):
```tsx
import { PmsSetupWizardPage } from './pages/PmsSetupWizardPage'; // already imported (line 26)
import { GoldenThreadPage } from './pages/GoldenThreadPage'; // needs adding
```

**Inline component pattern** (established in Phase 31-06 for MunicipalitiesPlaceholderPage/SystemPlaceholderPage):
`DepartmentsPage` and `RoleApprovalsPage` can be inline components in App.tsx if they are simple mock/redirect pages, or separate files if they need API calls. Given the departments CRUD API exists, a real `DepartmentsPage.tsx` that calls `/api/v1/departments` is better.

### Pattern 2: Backend One-Line Bug Fix (BUG-1 / REPORT-05)

**File:** `src/services/statutory_report_service.py` lines 59-68

**Current state:**
```python
_TRANSITION_ROLES: dict[str, set[str]] = {
    "submit_for_review": {
        UserRole.PMS_OFFICER,
        UserRole.DEPARTMENT_MANAGER,
        UserRole.CFO,
        UserRole.ADMIN,
        UserRole.SALGA_ADMIN,
        # MISSING: UserRole.MUNICIPAL_MANAGER
    },
```

**Fix:**
```python
    "submit_for_review": {
        UserRole.PMS_OFFICER,
        UserRole.DEPARTMENT_MANAGER,
        UserRole.CFO,
        UserRole.MUNICIPAL_MANAGER,  # ADD THIS
        UserRole.ADMIN,
        UserRole.SALGA_ADMIN,
    },
```

**Rationale:** The Municipal Manager is the primary statutory authority for submitting reports. The frontend (`StatutoryReportsPage.tsx`) already shows the button for this role. The backend gate was simply missing the role. The `approve` transition already correctly has `MUNICIPAL_MANAGER`, showing this is an omission not a design choice.

### Pattern 3: PMS Readiness Gate on Role Dashboards

**What:** Role-dashboard endpoints in `src/api/v1/role_dashboards.py` do not call `require_pms_ready()`. Other PMS endpoints (IDP, SDBIP, PA, Risk) all use it.

**Pattern from idp.py:**
```python
from src.services.pms_readiness import require_pms_ready

def _pms_deps():
    return [Depends(require_pms_ready()), Depends(require_min_tier(3))]
```

**Pattern for role_dashboards.py:**
```python
from src.services.pms_readiness import require_pms_ready

# Add to each endpoint that needs the gate (CFO, MM, Mayor, Section56):
@router.get("/cfo", dependencies=[Depends(require_pms_ready())])
async def get_cfo_dashboard(
    current_user: User = Depends(require_role(UserRole.CFO, ...)),
    db: AsyncSession = Depends(get_db),
):
```

**Decision needed:** The audit notes the gate is missing but marks it "nice to have" (priority 9). Per the success criteria, criterion 7 is "Role-dashboard endpoints enforce require_pms_ready() gate". This is an explicit success criterion, so it must be done.

**Scope caveat:** SALGA Admin cross-municipality and oversight dashboards (Councillor, Audit Committee, etc.) should NOT have the PMS readiness gate since they access data across tenants or read-only views not dependent on PMS setup. Only CFO, MM, Mayor, and Section56 Director (tenant-specific PMS data) should be gated.

### Pattern 4: Inline Page Component Pattern

**Established in Phase 31-06 (App.tsx):** Simple placeholder/stub pages are inline functions in App.tsx above the `App` function. Used for MunicipalitiesPlaceholderPage and SystemPlaceholderPage.

**For DepartmentsPage:** Since it needs API calls to list departments and link to `/departments/organogram`, it should be a proper separate file `DepartmentsPage.tsx` in `src/pages/` rather than an inline component.

**For RoleApprovalsPage:** It needs API calls to `GET /api/v1/roles/approvals/pending` and `POST /api/v1/roles/approvals/{id}/decide`. Should be a proper separate file.

### Pattern 5: VERIFICATION.md Structure

**Reference:** Look at `29-VERIFICATION.md` and `30-VERIFICATION.md` — both use the same format with a requirements table, verification tests, and artifact table.

**Phase 27 verification strategy:**
- Run `pytest tests/test_rbac_phase27.py tests/test_departments_api.py tests/test_pms_readiness.py -x` — confirms RBAC-01 through RBAC-06
- Functional test: call organogram API, confirm it returns a tree structure
- Note that `/departments` route was BUG-2 (no route), but organogram works

**Phase 28 verification strategy:**
- Run `pytest tests/test_pms_idp.py tests/test_pms_sdbip.py tests/test_pms_actuals.py tests/test_pms_auto_populate.py tests/test_pms_evidence.py -x`
- Verify golden thread API endpoint works (IDP-04 backend confirmed)
- Check SDBIP-07 and SDBIP-08 SUMMARY coverage

### Anti-Patterns to Avoid

- **Do not modify existing Phase 27/28 PLAN or SUMMARY files** — verification docs are additive, not retroactive rewrites
- **Do not add require_pms_ready() to SALGA Admin or oversight-role endpoints** — they are cross-tenant by design and should not be gated on a single tenant's PMS readiness
- **Do not change existing route paths** — only add new ones; existing URLs must stay stable for bookmarks/links
- **Do not add PmsSetupWizardPage to non-admin routes** — the page already checks `isAdmin` internally, but the route should still be guarded

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tier 1 approval list UI | Custom data table | Inline function component with existing glass card + table CSS variables | Same pattern as MunicipalitiesPlaceholderPage — no external library needed |
| Departments list UI | Custom table with edit | Fetch from `/api/v1/departments`, render with existing CSS variable pattern | API already exists at `/api/v1/departments` — just call it |
| Phase verification test runner | New pytest file | Run existing test files in VERIFICATION.md, document results | `test_rbac_phase27.py`, `test_departments_api.py`, `test_pms_readiness.py` all exist |

**Key insight:** Every gap has a pre-existing backend API or frontend component — this is purely integration and routing work, not new feature development.

---

## Common Pitfalls

### Pitfall 1: SALGA Admin Receives require_pms_ready() Accidentally

**What goes wrong:** Adding the pms_ready gate to all role-dashboard endpoints including SALGA Admin would break SALGA Admin functionality since their tenant setup may differ.

**Why it happens:** Copying the gate pattern from IDP/SDBIP endpoints without checking which roles are cross-tenant.

**How to avoid:** Only add `require_pms_ready()` to `/cfo`, `/municipal-manager`, `/mayor`, and `/section56-director` endpoints. The SALGA Admin endpoint uses raw SQL `text()` for cross-tenant queries and explicitly bypasses tenant context.

**Warning signs:** SALGA Admin dashboard returns 403 after adding the gate.

### Pitfall 2: GoldenThreadPage Route Conflict with Embedded Mode

**What goes wrong:** GoldenThreadPage has an `embedded` prop. Registering it as a standalone route (`/pms/golden-thread`) must pass `embedded={false}` (the default). If misrouted, navigation controls may appear/disappear unexpectedly.

**How to avoid:** The standalone route uses `<GoldenThreadPage />` with no props (defaults to `embedded=false`). The PmsHub continues to use `<GoldenThreadPage embedded />`.

**Warning signs:** Cycle selector dropdown is missing on the standalone route but present in PmsHub.

### Pitfall 3: DepartmentsPage vs OrganogramPage Duplication

**What goes wrong:** The `/departments/organogram` route already shows a tree view. Adding `/departments` that shows a flat list could cause confusion. Users may not understand the distinction.

**How to avoid:** Make the `/departments` list page include a prominent "View Organogram" button/link pointing to `/departments/organogram`. The list page should show a simple table of departments with edit/create actions for admins.

**Warning signs:** Confusion between list vs tree views — link both clearly.

### Pitfall 4: Stale REQUIREMENTS.md Checksboxes

**What goes wrong:** The audit flagged REPORT-03, REPORT-04, REPORT-09 as stale `[ ]`. Direct inspection of `REQUIREMENTS.md` shows they are already `[x]`. The audit was written before those were fixed.

**How to avoid:** Re-read REQUIREMENTS.md before creating a "fix stale checkboxes" task — only fix what is actually stale. Current state: REPORT-03 `[x]`, REPORT-04 `[x]`, REPORT-09 `[x]`. These are already correct. No action needed.

**Warning signs:** Creating a tracking fix task that changes already-correct checkboxes.

### Pitfall 5: Assuming PA-01 Is Still Broken

**What goes wrong:** The audit marked PA-01 as PARTIAL with the finding that `section57_manager_id` was missing from the POST body. The current code in `PerformanceAgreementsPage.tsx` now includes `section57_manager_id` in form state (line 36, 116), the Select field (lines 273-274), and the POST body (line 177). The fix may already be in place.

**How to avoid:** Before writing a PA-01 fix task, run `cd frontend-dashboard && npm run build:check` and check that the form compiles and that the eligible-managers API returns data. Only write a fix task if the current implementation is genuinely broken.

**Warning signs:** Writing duplicate fix code that overwrites a working implementation.

### Pitfall 6: PmsSetupWizardPage Exported as Named vs Default Export

**What goes wrong:** App.tsx line 26 already imports `PmsSetupWizardPage` with a named import pattern. If the export type in the file changes, the import breaks.

**How to avoid:** Verify the export type in `PmsSetupWizardPage.tsx` matches the import style in App.tsx before adding the route.

---

## Code Examples

### Fix for BUG-1 (REPORT-05)

```python
# File: src/services/statutory_report_service.py, lines 59-68
# Source: Direct code inspection

_TRANSITION_ROLES: dict[str, set[str]] = {
    "submit_for_review": {
        UserRole.PMS_OFFICER,
        UserRole.DEPARTMENT_MANAGER,
        UserRole.CFO,
        UserRole.MUNICIPAL_MANAGER,  # ADDED - was missing, caused 403 for MM
        UserRole.ADMIN,
        UserRole.SALGA_ADMIN,
    },
    # ... rest unchanged
}
```

### Fix for BUG-2, BUG-4, IDP-04 (App.tsx route registration)

```tsx
// File: frontend-dashboard/src/App.tsx (inside authenticated Routes block)
// Add after existing /departments/organogram route:

// BUG-2: /departments route was linked in nav but not registered
<Route path="/departments" element={<DashboardLayout><DepartmentsPage /></DashboardLayout>} />

// BUG-4: /pms-setup standalone URL had no route
<Route path="/pms-setup" element={<DashboardLayout><PmsSetupWizardPage /></DashboardLayout>} />

// IDP-04: /pms/golden-thread standalone route for discoverability
<Route path="/pms/golden-thread" element={<DashboardLayout><GoldenThreadPage /></DashboardLayout>} />
```

### Fix for BUG-3 (RoleApprovalsPage)

```tsx
// File: frontend-dashboard/src/pages/RoleApprovalsPage.tsx (new file)
// Pattern: Same fetch+render pattern as SALGAAdminDashboardPage

export function RoleApprovalsPage() {
  // Fetch from GET /api/v1/roles/approvals/pending
  // List pending requests with Approve/Reject buttons
  // POST /api/v1/roles/approvals/{id}/decide with { approved: true/false, reason: string }
  // Use CSS variables: var(--glass-bg), var(--text-primary), etc.
}
```

### Pattern: Adding require_pms_ready() to role dashboard endpoints

```python
# File: src/api/v1/role_dashboards.py
# Source: Pattern from src/api/v1/risk.py lines 29, 45-46

from src.services.pms_readiness import require_pms_ready

# Before the endpoint function (tenant-specific endpoints only):
@router.get(
    "/cfo",
    dependencies=[Depends(require_pms_ready())],
)
async def get_cfo_dashboard(
    current_user: User = Depends(
        require_role(UserRole.CFO, UserRole.ADMIN, UserRole.SALGA_ADMIN)
    ),
    db: AsyncSession = Depends(get_db),
):
    ...
```

### DepartmentsPage.tsx structure

```tsx
// File: frontend-dashboard/src/pages/DepartmentsPage.tsx (new file)
// Calls GET /api/v1/departments to list departments for the tenant
// Shows table of departments with name, code, director
// Has "View Organogram" button linking to /departments/organogram
// Admin roles see Create Department button

export function DepartmentsPage() {
  const { session } = useAuth();
  const [departments, setDepartments] = useState([]);

  // fetch /api/v1/departments on mount
  // render table with CSS variables
}
```

---

## Current Bug Status (Direct Code Inspection)

| Bug | Audit Status | Current Code Status | Action Needed |
|-----|-------------|---------------------|---------------|
| BUG-1: REPORT-05 municipal_manager 403 | OPEN | `_TRANSITION_ROLES["submit_for_review"]` still missing `UserRole.MUNICIPAL_MANAGER` | YES — one-line fix |
| BUG-2: /departments no route | OPEN | `App.tsx` has `/departments/organogram` but not `/departments` | YES — register route + create page |
| BUG-3: /role-approvals no page | OPEN | No `RoleApprovalsPage.tsx` exists; `App.tsx` has no route | YES — create page + register route |
| BUG-4: /pms-setup no route | OPEN | `PmsSetupWizardPage` imported in App.tsx (line 26) but no `<Route>` | YES — register route only |
| PA-01: form missing section57_manager_id | Audit: PARTIAL | Current code HAS section57_manager_id in form state + POST body | VERIFY — may already be fixed |
| IDP-04: golden thread no standalone route | OPEN | `GoldenThreadPage.tsx` exists, backend API exists, no App.tsx route | YES — register route |
| REQUIREMENTS.md stale checkboxes | Audit: 3 stale | Current REQUIREMENTS.md: REPORT-03, -04, -09 all `[x]` | NONE — already fixed |
| Phase 27 VERIFICATION.md missing | OPEN | Only `VALIDATION.md` exists — no independent `VERIFICATION.md` | YES — write verification |
| Phase 28 VERIFICATION.md missing | OPEN | Only `VALIDATION.md` exists — no independent `VERIFICATION.md` | YES — write verification |
| PMS readiness gate on role dashboards | OPEN | `role_dashboards.py` has no `require_pms_ready()` calls | YES — add to 4 tenant-specific endpoints |

---

## Recommended Plan Structure

Based on the above, Phase 33 should be broken into 3 plans (not 1 as the roadmap suggests):

**Plan 33-01: Code Bug Fixes + Missing Routes** (backend + frontend code changes)
- Fix BUG-1: Add `UserRole.MUNICIPAL_MANAGER` to `_TRANSITION_ROLES["submit_for_review"]`
- Fix BUG-2: Create `DepartmentsPage.tsx`, register `/departments` route
- Fix BUG-3: Create `RoleApprovalsPage.tsx`, register `/role-approvals` route
- Fix BUG-4: Register `/pms-setup` route (page already exists)
- Fix IDP-04: Register `/pms/golden-thread` standalone route
- Verify PA-01: Run `npm run build:check`; confirm form POSTs with `section57_manager_id`
- Add `require_pms_ready()` gate to 4 role-dashboard endpoints (CFO, MM, Mayor, Section56)

**Plan 33-02: Phase 27 Verification**
- Run `pytest tests/test_rbac_phase27.py tests/test_departments_api.py tests/test_pms_readiness.py`
- Document results as `27-VERIFICATION.md` for RBAC-01 through RBAC-06

**Plan 33-03: Phase 28 Verification**
- Run `pytest tests/test_pms_idp.py tests/test_pms_sdbip.py tests/test_pms_actuals.py tests/test_pms_auto_populate.py tests/test_pms_evidence.py`
- Document results as `28-VERIFICATION.md` for IDP-01 through IDP-05, SDBIP-01 through SDBIP-10, EVID-01 through EVID-08

---

## State of the Art

| Old Approach | Current Approach | Impact |
|---|---|---|
| Stale audit (phase 27/28 unverified) | Write VERIFICATION.md post-hoc | Closes verification gap without re-running full phase |
| Missing routes (nav links to void) | Register routes + minimal pages | Unblocks 3 broken E2E flows |
| Backend role gate omission | One-line dict fix | Unblocks Municipal Manager statutory workflow |

---

## Open Questions

1. **PA-01 actual status**
   - What we know: The current code has `section57_manager_id` in form state, Select field, and POST body. The audit VERIFICATION T6 documented it as missing.
   - What's unclear: Was the fix applied after the audit was written, or is the audit VERIFICATION.md itself pre-fix?
   - Recommendation: Run a quick smoke test — the 29-VERIFICATION.md says the form sends `{financial_year, manager_role}` at line 152-155. Current code line 177 shows all three fields. Cross-check by checking git log for `PerformanceAgreementsPage.tsx`. If it was already fixed, mark PA-01 as verified and skip the fix.

2. **DepartmentsPage scope**
   - What we know: Backend CRUD exists. The nav link says "Departments" for admin, director, MM roles.
   - What's unclear: Should the Departments page be full CRUD (create/edit/delete) or read-only list for non-admin roles?
   - Recommendation: Match the PmsHub pattern — show "Create Department" button only for admin roles using an `isAdmin` check. Read-only list for other roles. CRUD modals are out of scope for gap-closure.

3. **Role Approvals page scope**
   - What we know: Backend has `GET /api/v1/roles/approvals/pending` (salga_admin only) and `POST /api/v1/roles/approvals/{id}/decide`.
   - What's unclear: Should the approval decision require a reason/comment field?
   - Recommendation: Use a simple approve/reject button pair with an optional notes field. Match the MPAC investigation flag pattern from Phase 31-03 (inline expandable form row).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.0 + pytest-asyncio 0.24.0 (backend); TypeScript tsc (frontend) |
| Config file | `pyproject.toml` ([tool.pytest.ini_options]) |
| Quick run command | `pytest tests/test_statutory_reports.py tests/test_role_dashboards.py -x -k "submit_for_review or pms_ready"` |
| Full suite command | `pytest --cov=src --cov-report=term-missing` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REPORT-05 BUG-1 | `MUNICIPAL_MANAGER` can call `submit_for_review` without 403 | unit | `pytest tests/test_statutory_reports.py -x -k "municipal_manager"` | Check if test exists |
| RBAC-01 BUG-3 | `/role-approvals` page renders for salga_admin | smoke (frontend build) | `cd frontend-dashboard && npm run build:check` | Wave 0 — create test |
| RBAC-02 BUG-2 | `/departments` route renders DepartmentsPage | smoke (frontend build) | `cd frontend-dashboard && npm run build:check` | Wave 0 — new route |
| RBAC-04 BUG-4 | `/pms-setup` route renders PmsSetupWizardPage | smoke (frontend build) | `cd frontend-dashboard && npm run build:check` | Wave 0 — new route |
| IDP-04 | `/pms/golden-thread` route renders GoldenThreadPage | smoke (frontend build) | `cd frontend-dashboard && npm run build:check` | Wave 0 — new route |
| PA-01 | Create PA form includes section57_manager_id in POST body | unit (build check) | `cd frontend-dashboard && npx tsc --noEmit` | Verify current state |
| PMS gate | `/api/v1/role-dashboards/cfo` returns 403 when PMS not ready | unit | `pytest tests/test_role_dashboards.py -x -k "pms_ready or readiness"` | Wave 0 — add test |
| RBAC-03/05/06 | Phase 27 tests pass independently | unit | `pytest tests/test_rbac_phase27.py tests/test_departments_api.py tests/test_pms_readiness.py` | ✅ All exist |
| IDP-01 through EVID-08 | Phase 28 tests pass independently | unit | `pytest tests/test_pms_idp.py tests/test_pms_sdbip.py tests/test_pms_actuals.py tests/test_pms_auto_populate.py tests/test_pms_evidence.py` | ✅ All exist |

### Sampling Rate
- **Per task commit:** `cd frontend-dashboard && npm run build:check` (frontend tasks); `pytest tests/test_statutory_reports.py tests/test_role_dashboards.py -x` (backend tasks)
- **Per wave merge:** `pytest --cov=src --cov-report=term-missing && cd frontend-dashboard && npm run build`
- **Phase gate:** Full suite green before verification sign-off

### Wave 0 Gaps

- [ ] `tests/test_statutory_reports.py` — add test for `municipal_manager` calling `submit_for_review` (may already exist — verify first)
- [ ] `tests/test_role_dashboards.py` — add test for `require_pms_ready()` on CFO/MM/Mayor endpoints returning 403 when PMS not configured
- [ ] `frontend-dashboard/src/pages/DepartmentsPage.tsx` — new file for `/departments` route
- [ ] `frontend-dashboard/src/pages/RoleApprovalsPage.tsx` — new file for `/role-approvals` route
- [ ] `.planning/phases/27-rbac-foundation-tenant-configuration/27-VERIFICATION.md` — new verification document
- [ ] `.planning/phases/28-idp-sdbip-core-performance-monitoring/28-VERIFICATION.md` — new verification document

---

## Sources

### Primary (HIGH confidence — direct code inspection)

All findings based on direct reading of:
- `src/services/statutory_report_service.py` — confirmed `MUNICIPAL_MANAGER` missing from `submit_for_review`
- `frontend-dashboard/src/App.tsx` — confirmed `/departments`, `/role-approvals`, `/pms-setup`, `/pms/golden-thread` routes absent
- `frontend-dashboard/src/pages/PerformanceAgreementsPage.tsx` — confirmed `section57_manager_id` IS present in form state (lines 36, 116, 177, 273-274)
- `frontend-dashboard/src/pages/GoldenThreadPage.tsx` — confirmed `embedded` prop exists, page is production-ready
- `.planning/REQUIREMENTS.md` — confirmed REPORT-03/04/09 are already `[x]`
- `.planning/v2.0-MILESTONE-AUDIT.md` — primary source of gap identification
- `src/api/v1/role_dashboards.py` — confirmed no `require_pms_ready()` calls
- `src/api/v1/roles.py` lines 317-388 — confirmed tier1 approval API exists at `/approvals/pending` and `/approvals/{id}/decide`
- `.planning/phases/27-*/` directory — confirmed no `VERIFICATION.md` exists (only `VALIDATION.md`)
- `.planning/phases/28-*/` directory — confirmed no `VERIFICATION.md` exists (only `VALIDATION.md`)
- `tests/test_rbac_phase27.py`, `tests/test_departments_api.py`, `tests/test_pms_readiness.py` — all exist and cover Phase 27 requirements
- Phase 28 test files (`test_pms_idp.py`, `test_pms_sdbip.py`, etc.) — all exist

### Secondary (MEDIUM confidence)

- Phase 31-06 PLAN.md — established pattern for inline App.tsx placeholder components (MunicipalitiesPlaceholderPage, SystemPlaceholderPage)
- Phase 31-03 PLAN.md — established pattern for MPAC inline expandable form rows (RoleApprovalsPage should follow)
- STATE.md accumulated decisions — CSS variables pattern, require_pms_ready() factory pattern, raw SQL text() for cross-tenant queries

---

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — all 4 bugs directly confirmed in source code
- PA-01 status: MEDIUM — appears fixed but needs confirmation via build check; VERIFICATION.md pre-dates current code
- Phase 27/28 test coverage: HIGH — test files exist and names match requirements
- REQUIREMENTS.md stale tracking: HIGH — direct inspection shows REPORT-03/04/09 already `[x]`
- PMS readiness gate scope: HIGH — pattern is established in risk.py, idp.py, sdbip.py, pa.py

**Research date:** 2026-03-02
**Valid until:** 2026-04-01 (stable codebase — no external dependencies)
