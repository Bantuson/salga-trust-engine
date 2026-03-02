# Phase 34: Municipal Onboarding Production Readiness — Research

**Researched:** 2026-03-02
**Domain:** Frontend UX (onboarding wizard, modal patterns, page architecture), E2E testing (Playwright production journeys)
**Confidence:** HIGH — all findings verified by direct code inspection and live Playwright MCP screenshots

---

## Summary

Phase 34 is a frontend-only production readiness phase. The backend is feature-complete across all v2.0 phases. Every API endpoint, model, and workflow exists. What is missing is: (1) a coherent onboarding sequence that takes a new municipality from "no account" to "PMS operational" without dead ends; (2) consistent UI patterns across all pages (modals, header alignment, settings content); (3) real page purposes differentiated by role journey; and (4) Playwright E2E tests that validate daily-use workflows rather than just smoke tests.

The existing `OnboardingWizardPage` covers citizen-level setup (profile, wards, SLA, team invites) but is **not** the PMS onboarding. The existing `PmsSetupWizardPage` (5 steps: settings, departments, directors, categories, organogram) is the PMS configuration core but lives inside the authenticated dashboard and requires the user to already be logged in as admin. The `RequestAccessPage` is a public form that sends a "please let us join" request — this is the interface that must be replaced/extended to become the full municipal onboarding entry point.

The phase divides into four distinct work streams: (A) Onboarding wizard extension replacing request-access with a proper PMS-connected sequence; (B) Tier 1–4 user creation with email invites inside the authenticated onboarding; (C) UI consistency fixes across every page; (D) Per-role E2E daily-journey test suite as the production readiness gate.

**Primary recommendation:** Build the new onboarding as a multi-phase wizard that distinguishes pre-auth onboarding (municipality registration) from post-auth PMS setup (department configuration, user invitation, activation gates). Reuse the existing `PmsSetupWizardPage` logic for the PMS steps. Fix UI inconsistencies in a dedicated pass using the `TeamCreateModal` as the canonical modal template. Deliver E2E journeys as a new `e2e-tests/tests/journeys/` folder distinct from existing smoke tests.

---

## Visual Evidence (Playwright MCP Screenshots)

Screenshots taken 2026-03-02 from live dashboard at http://localhost:5173, logged in as `salga_admin`.

### Critical UI Issues Documented

**Issue 1 — Header/notification icon gap (all pages)**
Every page (Analytics, SALGA Admin dashboard, Teams) has a `<header>` that is `position: fixed; top: 0; height: 48px; justify-content: flex-end` — the notification bell only. The page content inside `<main>` has `paddingTop: calc(48px + var(--space-2xl, 32px))` = 80px. Every page then renders its own `<h1>` + action buttons inside the main content area, starting 80px below the notification bell row. This creates a 32px dead zone between the bell and every page title/button row.

**Fix:** Each page's header row (title + action buttons) should be placed inside the fixed 48px header bar at the same vertical level as the notification bell. The DashboardLayout header should accept a `pageHeader` slot, or each page should provide its title row at 0px offset inside main with negative margin compensation, so the title row visually aligns with the bell. The simplest approach: make the header bar `justify-content: space-between` and inject a left-side title/action area from each page via a React context or portal.

**Issue 2 — Settings page renders nav tabs but no content**
Screenshot confirms: the sticky `<nav>` anchor bar (Profile, SLA Targets, Notifications, etc.) renders. The `<main>` area shows only the skyline background — all section components fail to render. Root cause: `useSettings()` hook calls `GET /api/v1/settings/sla` and `GET /api/v1/settings/municipality` which both return errors when the backend is not running. The page renders nothing in error state because `isLoading` stays `true` or the error branches show only skeletons. The SALGA Admin role also does not have `isManager = true` (only `manager` and `admin` pass that check), so ALL settings sections are gated behind `{isManager && ...}` and render nothing for `salga_admin`, `executive_mayor`, `cfo`, etc.

**Fix (dual):** (a) Use `viewRole` from `ViewRoleContext` (not `getUserRole()` which reads the JWT role) for the `isAdmin`/`isManager` check — or use a wider role list. (b) Add a fallback/empty state when `isLoading` finishes with errors instead of showing a blank page.

**Issue 3 — Departments page shows "Failed to load departments: Error 500"**
No page header, no create-department modal. The `+ Create Department` button calls `alert('Use the PMS Setup Wizard')` which is a placeholder. The page has no unique purpose — it duplicates what the PMS Setup Wizard step 2 already shows. This page needs a real purpose: department management (CRUD for directors, activate/deactivate departments, link to organogram).

**Issue 4 — Role Approvals page shows "Failed to load approvals: Error 500"**
Same pattern as Departments — error state but no data. When data exists, the page does have its own unique purpose (Tier 1 role approval workflow for SALGA Admin). The page is not a duplicate of the dashboard but it lacks the dashboard summary context. The issue is that without the backend, it only shows errors with no fallback content.

**Issue 5 — PMS Hub (/pms) has an "IDP Management" dropdown but it expands inline**
The dropdown selector in PmsHubPage expands to show IDP cycle cards below the button — this is the "expand with card element" pattern the user wants replaced with a modal. The Performance page create actions (new IDP cycle, new SDBIP, etc.) all open inline card forms, not modals.

**Issue 6 — SALGA Admin Municipality Performance Ranking expands inline**
The `SALGAAdminDashboardPage` uses `setExpandedMunicipality` to expand an inline detail panel in the table row — the "expand with card" pattern. The user wants this to be a modal.

**Issue 7 — PMS Hub /pms: the "IDP Management" button opens a dropdown not a modal**
The create actions for IDP, SDBIP, and Performance Agreement in PmsHubPage are inline form expanders, not modals. These must all be converted to match the `TeamCreateModal` pattern.

---

## Architecture Patterns

### Existing Modal Pattern (Canonical Template)

`TeamCreateModal` at `frontend-dashboard/src/components/teams/TeamCreateModal.tsx` is the established reference:

```typescript
// Overlay
overlay: {
  position: 'fixed', inset: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  backdropFilter: 'blur(4px)',
  zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem',
}

// Modal container
modal: {
  background: 'var(--glass-pink-frost)',
  backdropFilter: 'blur(var(--glass-blur-medium))',
  border: '1px solid var(--glass-border)',
  borderRadius: 'var(--radius-xl)',
  maxWidth: '720px', width: '100%',
  maxHeight: '85vh',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
}

// Header (sticky, glassmorphism)
// Body (scrollable flex: 1)
// Footer (sticky bottom, cancel + confirm buttons)
```

Key behaviors:
- `document.body.style.overflow = 'hidden'` while open (body scroll lock)
- Escape key closes
- Click-outside on overlay closes
- Sections inside body use `background: 'rgba(255,255,255,0.06)'` cards

**ALL new modals must follow this exact pattern.** This includes: department create modal, user invite modal, performance create modal, SALGA municipality ranking drill-down modal, IDP create modal, SDBIP create modal.

### Styling Rules (Phase 27-03 Lock)

From `STATE.md`: "CSS variables over Tailwind for all dashboard frontend components — no Tailwind config exists in frontend-dashboard; use inline styles with design-tokens.css variables and @shared/components."

All new components must use:
- `var(--glass-bg)`, `var(--glass-border)`, `var(--glass-pink-frost)` for containers
- `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)` for text
- `var(--color-teal)`, `var(--color-coral)`, `var(--color-gold)` for accents
- `var(--space-xs/sm/md/lg/xl/2xl)` for spacing
- `var(--radius-sm/md/lg/xl)` for border radius
- `var(--text-xs/sm/md/lg/xl/2xl)` for font sizes

No Tailwind classes. No new CSS files unless absolutely necessary.

### DashboardLayout Header Architecture

Current state (from `DashboardLayout.tsx`):
```typescript
// Fixed header — notification bell only, right-aligned
<header style={{
  position: 'fixed', top: 0, left: '64px', right: 0, height: '48px',
  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
  padding: '0 var(--space-xl, 24px)',
  background: 'transparent', zIndex: 100,
}}>
  {/* Bell icon only */}
</header>

// Main content — padded below header
<main style={{ paddingTop: 'calc(48px + var(--space-2xl, 32px))' }}>
  {children}
</main>
```

**Required change:** Change `justifyContent` from `'flex-end'` to `'space-between'` and add a left-side area. Each page provides its own title row content via a context. The implementation options are:

Option A (Context): Create `PageHeaderContext` with `setPageHeader(element)`. DashboardLayout renders it in the left area. Each page calls `usePageHeader()` to inject its title + buttons.

Option B (Portal): Each page renders a React portal targeting a `#page-header-left` div inside the header.

Option C (CSS offset): Remove the `calc(48px + var(--space-2xl))` gap from main. Each page renders its own title row at the TOP of its content with negative top margin to overlap the 48px header zone, using `padding-top: 48px` internally. This is the simplest approach: pages already have their own header divs — just remove the 32px gap from `<main>` paddingTop, change it to `paddingTop: '48px'`, and each page header row naturally sits at the same level as the notification bell.

**Recommendation: Option C** — minimal change, no new context required, works immediately for all pages. Change `paddingTop` from `calc(48px + var(--space-2xl, 32px))` to `48px`. Each page's own first-child header div will then start at the same vertical position as the notification bell. Pages must ensure their first-child has `paddingTop: 'var(--space-md)'` and `display: 'flex'; alignItems: 'center'` with `minHeight: '48px'` so button row aligns with the bell height.

### Onboarding Architecture

Two distinct phases of onboarding:

**Phase A: Pre-authentication (public-facing) — replaces RequestAccessPage**

Current `RequestAccessPage` flow:
1. Public form: municipality name, province, code, contact details, supporting docs
2. Submits to `POST /api/v1/access-requests`
3. Shows "Request Submitted — wait 5 business days"
4. No wizard, no progression, no PMS context

**Required replacement — MunicipalOnboardingPage:**
```
Step 1: Municipality Registration (public, no auth)
  - Municipality name, demarcation code, province, category (A/B/C)
  - Contact details: Executive Mayor name, municipal manager name, email
  - Supporting document: council resolution authorizing platform access
  → POST /api/v1/access-requests (existing backend)
  → Success: "Account request submitted. You will receive an email invitation."

[SALGA Admin approves → platform sends email invite to municipal_manager email]

Step 2: First Login (invited user sets password via Supabase invite)
  → Redirects to /onboarding after first login
```

**Phase B: Post-authentication onboarding wizard (authenticated)**

This is where the `OnboardingWizardPage` and `PmsSetupWizardPage` merge:

Current `OnboardingWizardPage` steps (Welcome → Profile → Team → Wards → SLA → Done):
- These are v1.0 field-worker era steps
- Profile step captures: municipality name, code, province, contact — ALREADY captured in Phase A
- Team step invites field workers and managers — but Phase 34 says exclude field_worker/saps_liaison from initial onboard
- Wards step configures ward boundaries
- SLA step configures SLA targets

**New post-auth wizard should be:**
```
Step 1: Welcome & Municipality Confirmation
  - Confirm municipality details (pre-filled from access request)
  - Choose SDBIP configuration level (top layer only / top + departmental)

Step 2: Department Structure
  - Add departments (name + code) — reuses PmsSetupWizardPage Step 2 logic
  - Minimum: 3 departments to proceed
  - Activates PMS gating

Step 3: Invite Tier 1 Leaders
  - Municipal Manager (if not already — they triggered onboarding)
  - CFO (email invite)
  - Speaker (email invite)
  - Executive Mayor (email invite — political role, may be same person)
  Uses: POST /api/v1/invitations/bulk with role parameter
  Excludes: field_worker, saps_liaison (department manager onboards these later)

Step 4: Assign Section 56 Directors
  - For each department created in Step 2, enter the director's email
  - System sends invite with section56_director role
  - Departments without directors flagged — can proceed but marked incomplete

Step 5: SLA & Ward Configuration
  - SLA targets per ticket category
  - Ward count (municipality structure)
  - These unlock the operational features

Step 6: PMS Activation Gate Review
  - Checklist: departments created (Y/N), Tier 1 invites sent (Y/N), SLA configured (Y/N)
  - Green: "Municipality is PMS-ready — proceed to dashboard"
  - Amber: "Proceed anyway" with note on what's missing
  - Uses: GET /api/v1/pms/readiness (existing endpoint from Phase 27-03)
```

### Tier 1–4 User Creation with Email Invites

Backend: `POST /api/v1/invitations/bulk` already exists (used in `OnboardingWizardPage.handleSubmitInvitations`). Accepts `{ email, role }` array.

Frontend pattern needed: A user creation modal (matching TeamCreateModal design) with:
- Email field
- Role dropdown (filtered to tier-appropriate roles per context)
- Send invite checkbox (checked by default)

For the onboarding wizard (Step 3 + 4): inline invite rows, same UX as existing `InviteTeamStep`.

For post-onboarding user management from the dashboard: a standalone "Invite User" modal accessible from any page where user management is needed.

**Tier mapping for onboarding (exclude field_worker/saps_liaison):**
- Tier 1 invites: `executive_mayor`, `municipal_manager`, `cfo`, `speaker`
- Tier 2 invites: `section56_director` (one per department), `ward_councillor`, `chief_whip`
- Tier 3 invites: `pms_officer`, `audit_committee_member`, `internal_auditor`, `mpac_member`
- Tier 4 (department manager's responsibility, NOT in initial onboard): `department_manager`, `field_worker`, `saps_liaison`

### Department Activation Gates

From Phase 27-03 context: `require_pms_ready()` factory already exists in `src/api/deps.py`. It returns 403 + structured `PMS_NOT_READY` checklist when municipality configuration is incomplete.

The frontend `PmsReadinessGate` component at `frontend-dashboard/src/components/rbac/PmsReadinessGate.tsx` renders this checklist overlay.

**Department activation gate** means: a department is only "fully operational" when:
1. Department has an assigned `section56_director` (not `null`)
2. Department has at least one `department_manager` assigned (Tier 4 frontline, post-initial-onboard)
3. Department has at least one SDBIP KPI defined

Until condition 1 is met: department shows as "Pending Director Assignment" in the departments list with an action button to send director invite.

Until condition 2 is met: department shows as "Pending Staff" — warning badge only, not a blocker.

### Page Deduplication Map

Based on salga-pms-integration-plan.md role-feature matrix and current page inventory:

| Route | Current State | Required Unique Purpose |
|-------|---------------|------------------------|
| `/` (Dashboard) | Role-based dashboard (CFO/MM/Mayor etc.) | Executive summary — role-specific KPIs, approval actions |
| `/departments` | Shows department list (Error 500 in prod) | Department management: CRUD, director assignment, activation status, link to organogram |
| `/departments/organogram` | Organogram tree | Org chart — reporting structure, NOT editable from here |
| `/role-approvals` | Tier 1 approval queue (SALGA Admin) | SALGA Admin only: approve/reject Tier 1 role requests |
| `/pms` | PMS Hub with dropdown selector | PMS workspace: IDP, SDBIP, actuals, evidence, agreements — all in one |
| `/pms-setup` | 5-step department wizard | Initial PMS configuration — post-onboard wizard |
| `/municipalities` | Placeholder table | SALGA Admin: municipality registry, onboarding status, activation |
| `/system` | Placeholder health page | Platform Admin: infrastructure monitoring |
| `/analytics` | Analytics charts | Operational analytics: ticket volume, resolution rates, SLA |
| `/settings` | BROKEN — nav tabs visible, no content | Municipality config: profile, SLA, notifications, branding |
| `/teams` | Team cards grid with modal | Field team management: create teams, assign workers |
| `/tickets` | Ticket list | Service delivery queue: view, assign, triage |

**Pages that currently duplicate dashboard content:**
- `/departments` for `executive_mayor` and `section56_director` shows the same department list data that appears on the dashboard — needs to be the management view, not just a read-only list
- `/role-approvals` for `salga_admin` feels like a secondary dashboard — needs to be a focused action queue with filters (by municipality, by date, by role)
- The SALGA Admin dashboard's municipality ranking table duplicates what `/municipalities` should show — the dashboard should show aggregated benchmarking stats; `/municipalities` should show per-municipality management actions

### Per-Role Page Purpose (from salga-pms-integration-plan.md)

| Role | Dashboard `/` | Primary Daily Action | Secondary Pages |
|------|--------------|---------------------|-----------------|
| `executive_mayor` | Org scorecard, SDBIP approval | Approve SDBIP → navigate to `/pms` | `/departments` (read), `/tickets` (oversight) |
| `municipal_manager` | All-dept KPI overview | Submit statutory report → `/pms` | `/departments`, `/analytics`, `/settings` |
| `cfo` | Budget execution + SDBIP achievement | Validate performance data, view s52 calendar | `/pms`, `/analytics`, `/departments` |
| `speaker` | Council reports | View quarterly reports | `/reports` (statutory) |
| `section56_director` | Own dept SDBIP, KPI submission prompt | Submit quarterly actuals → `/pms` | `/departments` (own dept only) |
| `ward_councillor` | Ward ticket summary + SDBIP | View ward tickets, read SDBIP | `/tickets`, `/pms?view=statutory-reports` |
| `chief_whip` | Council schedule + SDBIP read | Review statutory reports | `/pms?view=statutory-reports` |
| `pms_officer` | PMS admin overview | Validate actuals, manage IDP/SDBIP | `/pms` (all views), `/departments` |
| `audit_committee_member` | Audit trail + report review | Review performance reports | `/pms`, statutory reports |
| `internal_auditor` | POE verification queue | Verify evidence for KPIs | `/pms` (evidence tab) |
| `mpac_member` | Performance report reader | Flag investigations | `/pms`, statutory reports |
| `salga_admin` | Cross-municipality benchmarking | Approve Tier 1 roles, manage municipalities | `/municipalities`, `/role-approvals`, `/system` |
| `admin` | Municipal ops dashboard | Manage tickets, teams, settings | `/tickets`, `/teams`, `/settings`, `/analytics` |

---

## Standard Stack

No new libraries needed. All required capabilities exist:

| Library | Version | Already Used | Purpose in Phase 34 |
|---------|---------|-------------|---------------------|
| React Router DOM | v6 | Yes | Routing for onboarding wizard steps |
| GSAP + @gsap/react | Latest | Yes | Wizard step transitions |
| Playwright | 1.x | Yes | E2E daily journey tests |
| Supabase JS client | v2 | Yes | Auth, invitations |
| CSS variables + inline styles | — | Yes | All new component styling |

**No new npm packages required.** Phase 34 is purely frontend logic, pattern replication, and test writing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Modal scroll lock | Custom body overflow logic | Copy exact pattern from `TeamCreateModal` (body overflow hidden in useEffect) |
| Modal escape close | Custom keydown handler | Copy exact pattern from `TeamCreateModal` |
| Wizard step state | New state management | useState + localStorage (same as `OnboardingWizardPage`) |
| Email invite | New invitation system | `POST /api/v1/invitations/bulk` already exists |
| PMS readiness check | New readiness logic | `GET /api/v1/pms/readiness` already exists + `PmsReadinessGate` component |
| Role-based nav | New role filtering | `useRoleBasedNav` already handles all 18 roles |
| E2E auth fixtures | New auth setup | `e2e-tests/fixtures/auth.ts` already has `cfoPage`, `mayorPage`, etc. |

---

## Common Pitfalls

### Pitfall 1: Settings Page Role Check
**What goes wrong:** `SettingsPage` uses `getUserRole()` which reads from JWT `app_metadata.role`. For `salga_admin`, this returns `'salga_admin'` but the check is `role === 'manager' || role === 'admin'` — so `isManager = false`, all sections hidden.
**How to avoid:** Change role check to use `viewRole` from `ViewRoleContext` OR expand the `isManager` check to include all roles that should see settings (admin, manager, salga_admin, municipal_manager, executive_mayor, cfo).
**Deeper fix:** The settings page scope for Phase 34 is: admin-level settings (municipality profile, SLA, notifications) should be visible to all Tier 1 roles, not just `admin`/`manager`.

### Pitfall 2: Onboarding Wizard vs PMS Setup Wizard
**What goes wrong:** Building an entirely new PMS-aware wizard from scratch when `PmsSetupWizardPage` already has Steps 1–5 working (municipality settings, departments, directors, categories, organogram). The new onboarding wizard should CALL or NAVIGATE to PmsSetupWizardPage rather than duplicating it.
**How to avoid:** The new `MunicipalOnboardingWizardPage` should extend the existing wizard with Steps 0 (welcome/confirm) and +N (invite Tier 1 users) before and after the existing PMS setup steps. Or: make PmsSetupWizardPage the core and wrap it.

### Pitfall 3: Request Access vs Onboarding Entry Point
**What goes wrong:** The current `RequestAccessPage` is accessible at `/request-access` as a public (unauthenticated) route. But authenticated users redirected from login see the dashboard. The onboarding trigger must happen post-login when `onboarding_complete` is not set.
**How to avoid:** After the first successful login via email invite, check Supabase user metadata for `onboarding_complete`. If not set, redirect to `/onboarding` (which already exists but has v1.0 steps). Update the wizard steps and change the redirect logic in App.tsx.

### Pitfall 4: Header Alignment Changes Break Existing Pages
**What goes wrong:** Removing the `calc(48px + var(--space-2xl))` gap from main paddingTop and changing to `48px` causes pages that DON'T have their own title row to have content that collides with the notification bell header.
**How to avoid:** Audit every page for whether it has a title `<h1>` or header div as its first child. Pages that don't (e.g., `PmsHubPage` which starts with a dropdown button) need a wrapper container with `paddingTop: 'var(--space-md)'` to maintain visual breathing room.

### Pitfall 5: ViewRole vs Actual Role in Settings
**What goes wrong:** `SettingsPage` uses `getUserRole()` (JWT role) instead of `useViewRole().viewRole` (context role). If a user switches view role via RoleSwitcher, the settings page still shows based on their JWT role, not their current view.
**How to avoid:** Import and use `useViewRole()` from `ViewRoleContext` for all role-based rendering decisions in pages. `getUserRole()` should only be used for auth decisions, not UI rendering.

### Pitfall 6: Departments Page "Create" Action
**What goes wrong:** The current `DepartmentsPage` has `onClick={() => alert('Use the PMS Setup Wizard...')}` for the Create button. Building a full department CRUD inside DepartmentsPage when `PmsSetupWizardPage` already handles department creation properly.
**How to avoid:** The "Create Department" button in DepartmentsPage should open the `TeamCreateModal`-pattern modal for adding a single department (name + code), then POST to `POST /api/v1/departments`. This is different from the full wizard setup — it's a quick-add for ongoing management after initial onboarding.

### Pitfall 7: E2E Tests with `profiles/` vs hardcoded credentials
**What goes wrong:** The existing E2E auth fixture uses profile-based authentication (`e2e-tests/profiles/`). New journey tests must use the same fixture system, not hardcode test credentials.
**How to avoid:** Extend `e2e-tests/fixtures/auth.ts` with journey-specific fixtures (e.g., `onboardingAdminPage`) that reuse the same storageState pattern. New journey tests go in `e2e-tests/tests/journeys/` and import from `'../../fixtures/auth'`.

---

## Code Examples

### Canonical Modal Shell (from TeamCreateModal — use verbatim)
```typescript
// frontend-dashboard/src/components/teams/TeamCreateModal.tsx
const styles = {
  overlay: {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-xl)',
    maxWidth: '720px', width: '100%', maxHeight: '85vh',
    display: 'flex', flexDirection: 'column' as const, overflow: 'hidden',
  },
  // ... header, body, footer patterns
};
```

### DashboardLayout Header Fix (Option C — minimal change)
```typescript
// In DashboardLayout.tsx — change main paddingTop:
<main className="dashboard-main" style={{ paddingTop: '48px' }}>
  {children}
</main>

// Each page's first child div:
<div style={{
  display: 'flex', alignItems: 'center',
  minHeight: '48px',
  padding: 'var(--space-md) var(--space-xl)',
  // ... rest of page header
}}>
  <h1>Page Title</h1>
  <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-sm)' }}>
    {/* action buttons */}
  </div>
</div>
```

### Settings Page Role Fix
```typescript
// In SettingsPage.tsx — replace:
const { getUserRole } = useAuth();
const role = getUserRole();
const isAdmin = role === 'admin';
const isManager = role === 'manager' || role === 'admin';

// With:
const { viewRole } = useViewRole();
const ADMIN_ROLES = ['admin', 'salga_admin'];
const MANAGER_ROLES = ['admin', 'salga_admin', 'manager', 'municipal_manager',
                       'executive_mayor', 'cfo', 'speaker', 'pms_officer'];
const isAdmin = ADMIN_ROLES.includes(viewRole);
const isManager = MANAGER_ROLES.includes(viewRole);
```

### E2E Journey Test Pattern
```typescript
// e2e-tests/tests/journeys/municipal-manager-daily.spec.ts
import { test as authTest, expect } from '../../fixtures/auth';

authTest.describe('Municipal Manager — Daily Journey', () => {
  authTest('Morning: check dashboard, navigate to pending reports', async ({ mmPage }) => {
    await mmPage.goto('/');
    await expect(mmPage.locator('h1')).toContainText('Municipal Manager');
    // Navigate to statutory reports section
    await mmPage.goto('/pms?view=statutory-reports');
    // Assert pending reports list visible
    await expect(mmPage.locator('[data-testid="statutory-reports-list"]')).toBeVisible();
  });
  // ... more journey steps
});
```

---

## Phase Scope: Concrete Deliverables

### Work Stream A: Municipal Onboarding Wizard
1. **Extend `RequestAccessPage`** (or create `MunicipalOnboardingPage`) with:
   - Clearer framing as "start onboarding" not just "submit form"
   - Progress indicator (just the external registration step)
   - Better success state explaining what happens next (email invite process)

2. **Refactor `OnboardingWizardPage`** for PMS-aware authenticated onboarding:
   - Replace old steps (profile/team/wards/SLA) with new sequence:
     Welcome → Department Setup (embedded PmsSetupWizardPage steps) → Invite Tier 1 → Invite Directors → SLA Config → PMS Gate Review
   - The "Invite Team" step filters roles: only Tier 1 + Tier 2 roles, no field_worker/saps_liaison
   - The wizard checks `pms_readiness` at the end and shows the gate result

3. **Department Activation Gate UI:**
   - `DepartmentsPage` shows activation status per department: green (director assigned, has KPIs), amber (director assigned, no KPIs), red (no director)
   - Each department row has "Invite Director" button that opens an InviteUserModal

### Work Stream B: User Creation with Email Invites
1. **`InviteUserModal`** component (matches TeamCreateModal pattern):
   - Fields: email, role (dropdown filtered by context), first name (optional), send invite (checkbox)
   - POST to `/api/v1/invitations/bulk`
   - Accessible from: onboarding wizard Step 3+4, DepartmentsPage (per-department action), a new "Users" or "Team" management surface for Tier 1 admins

2. **Role-filtered invite lists** in the onboarding wizard:
   - Step 3 (Tier 1): executive_mayor, municipal_manager, cfo, speaker
   - Step 4 (Directors): section56_director only (one per department)
   - Post-onboarding (from dashboard): ward_councillor, chief_whip, pms_officer, audit_committee_member, internal_auditor, mpac_member, department_manager

### Work Stream C: UI Consistency Fixes
1. **Header alignment:** Change DashboardLayout main `paddingTop` from `calc(48px + var(--space-2xl))` to `'48px'`. Update all page header divs to have `minHeight: '48px'; display: 'flex'; alignItems: 'center'`.

2. **Settings page:** Fix role check (use viewRole, expand MANAGER_ROLES list). Add error fallback state when API calls fail (show content with placeholder values, not blank screen).

3. **Modal conversion — Performance page (PmsHubPage):**
   - IDP create action → `CreateIdpModal` (TeamCreateModal pattern)
   - SDBIP create action → `CreateSdbipModal`
   - PA create action → `CreatePaModal`

4. **Modal conversion — SALGA Admin dashboard:**
   - Municipality Performance Ranking row click → `MunicipalityDetailModal` (instead of inline expand)

5. **DepartmentsPage:** Replace `alert()` with `CreateDepartmentModal`. Add department activation status badges. Add "Invite Director" button per row.

6. **RoleApprovalsPage:** Add mock data fallback when API unavailable. Add role filter dropdown. Keep existing approve/reject functionality.

### Work Stream D: E2E User Journeys
New folder: `e2e-tests/tests/journeys/`

One spec file per role:
- `executive-mayor-journey.spec.ts` — Login → dashboard → SDBIP approval → view reports
- `municipal-manager-journey.spec.ts` — Login → dashboard → submit statutory report → check deadlines
- `cfo-journey.spec.ts` — Login → dashboard → validate actuals → export CSV
- `section56-director-journey.spec.ts` — Login → dashboard → submit quarterly actual
- `pms-officer-journey.spec.ts` — Login → PMS hub → validate actuals → create IDP
- `salga-admin-journey.spec.ts` — Login → benchmarking → approve role request → view municipality
- `admin-journey.spec.ts` — Login → create team → invite user → configure settings
- `onboarding-journey.spec.ts` — Register municipality → receive invite → complete wizard → PMS gate

Each spec follows the pattern:
```
Step 1: Navigate to starting page
Step 2: Assert role-specific dashboard content visible
Step 3: Perform primary daily action (the thing they do every working day)
Step 4: Assert action completed successfully
Step 5: Navigate to secondary page
Step 6: Assert secondary content visible
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.x |
| Config file | `e2e-tests/playwright.config.ts` |
| Quick run command | `cd e2e-tests && npx playwright test tests/journeys/ --project=dashboard-chromium` |
| Full suite command | `cd e2e-tests && npx playwright test --project=dashboard-chromium` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ONBOARD-01 | Onboarding wizard completes without errors | E2E | `npx playwright test tests/journeys/onboarding-journey.spec.ts` | No — Wave 0 |
| ONBOARD-02 | Tier 1 email invite sent during onboarding | E2E | `npx playwright test tests/journeys/onboarding-journey.spec.ts` | No — Wave 0 |
| ONBOARD-03 | Department activation gate shows correct status | E2E | `npx playwright test tests/journeys/admin-journey.spec.ts` | No — Wave 0 |
| UI-01 | Page headers align with notification bell row | Visual/E2E | `npx playwright test tests/journeys/ -k "header"` | No — Wave 0 |
| UI-02 | Settings page renders content for all Tier 1 roles | E2E | `npx playwright test tests/journeys/ -k "settings"` | No — Wave 0 |
| UI-03 | Create actions open modal not card | E2E | `npx playwright test tests/journeys/ -k "modal"` | No — Wave 0 |
| JOURNEY-01 | Executive Mayor daily journey completes | E2E | `npx playwright test tests/journeys/executive-mayor-journey.spec.ts` | No — Wave 0 |
| JOURNEY-02 | Municipal Manager daily journey completes | E2E | `npx playwright test tests/journeys/municipal-manager-journey.spec.ts` | No — Wave 0 |
| JOURNEY-03 | CFO daily journey completes | E2E | `npx playwright test tests/journeys/cfo-journey.spec.ts` | No — Wave 0 |
| JOURNEY-04 | Section 56 Director daily journey completes | E2E | `npx playwright test tests/journeys/section56-director-journey.spec.ts` | No — Wave 0 |
| JOURNEY-05 | SALGA Admin daily journey completes | E2E | `npx playwright test tests/journeys/salga-admin-journey.spec.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `cd e2e-tests && npx playwright test tests/journeys/ --project=dashboard-chromium --reporter=list`
- **Per wave merge:** Full `npx playwright test --project=dashboard-chromium`
- **Phase gate:** All journey specs green before marking Phase 34 complete

### Wave 0 Gaps
- [ ] `e2e-tests/tests/journeys/` — directory does not exist
- [ ] `e2e-tests/tests/journeys/onboarding-journey.spec.ts` — covers ONBOARD-01, ONBOARD-02
- [ ] `e2e-tests/tests/journeys/admin-journey.spec.ts` — covers ONBOARD-03, UI-01, UI-02, UI-03
- [ ] `e2e-tests/tests/journeys/executive-mayor-journey.spec.ts` — covers JOURNEY-01
- [ ] `e2e-tests/tests/journeys/municipal-manager-journey.spec.ts` — covers JOURNEY-02
- [ ] `e2e-tests/tests/journeys/cfo-journey.spec.ts` — covers JOURNEY-03
- [ ] `e2e-tests/tests/journeys/section56-director-journey.spec.ts` — covers JOURNEY-04
- [ ] `e2e-tests/tests/journeys/salga-admin-journey.spec.ts` — covers JOURNEY-05
- [ ] `e2e-tests/tests/journeys/pms-officer-journey.spec.ts` — covers PMS officer role
- [ ] `e2e-tests/tests/journeys/oversight-journey.spec.ts` — covers audit_committee, internal_auditor, mpac_member

---

## Open Questions

1. **RequestAccessPage replacement scope**
   - What we know: RequestAccessPage is a public form that submits to `/api/v1/access-requests`. The user wants the full onboarding wizard to replace it.
   - What's unclear: Does the replacement redirect unauthenticated users away from `/request-access` entirely? Or does it coexist? The ROADMAP says "replacing request-access interface" — implies full replacement.
   - Recommendation: Keep `/request-access` route but render the new `MunicipalOnboardingPage`. The existing `RequestAccessPage` component can be preserved in case rollback is needed.

2. **Backend-not-running handling for journey E2E tests**
   - What we know: The existing E2E tests (cfo-dashboard.spec.ts) use `authTest.skip()` when navigation times out, and fall back to mock data in the frontend.
   - What's unclear: The journey tests require actual navigation through multiple pages and API interactions. If the backend is down, the journey tests can only validate UI rendering, not data flow.
   - Recommendation: Journey tests should use the existing mock-data fallback pattern. Each test should assert on content that renders even when APIs return errors (mock data paths). Backend-required assertions (e.g., actual invite sent) should be marked as `skip` with explanatory comment when backend unavailable.

3. **Phase 33 completion dependency**
   - What we know: Phase 34 depends on Phase 33 being complete. Phase 33 has Plans 33-02 and 33-03 still outstanding (verification and E2E fixes).
   - What's unclear: Whether Phase 33 gaps (if any remain) affect the Phase 34 scope.
   - Recommendation: Phase 34 planning should note the dependency but proceed assuming Phase 33 completes. Any Phase 33 gaps discovered during Phase 34 execution become Wave 0 of Phase 34.

4. **Settings page scope for Phase 34**
   - What we know: Settings page is visually broken (blank content). The fix has two parts: role check and error fallback.
   - What's unclear: Should the settings page gain new PMS-era sections (e.g., PMS Configuration, Email Templates, Report Branding)?
   - Recommendation: Phase 34 scope is limited to making the existing 8 sections work correctly for all roles that should see them. New sections are deferred.

---

## Sources

### Primary (HIGH confidence — direct code inspection)
- `frontend-dashboard/src/pages/` — all page components read directly
- `frontend-dashboard/src/components/teams/TeamCreateModal.tsx` — canonical modal pattern
- `frontend-dashboard/src/components/layout/DashboardLayout.tsx` — header architecture
- `frontend-dashboard/src/hooks/useRoleBasedNav.ts` — all 18 role nav definitions
- `frontend-dashboard/src/App.tsx` — all routes
- `e2e-tests/playwright.config.ts` — test framework configuration
- `e2e-tests/tests/municipal/cfo-dashboard.spec.ts` — existing test pattern
- `.planning/STATE.md` — Phase 27-03 CSS lock decision, all accumulated decisions

### Primary (HIGH confidence — live Playwright MCP screenshots)
- Settings page: visually broken, nav renders, content empty
- Departments page: "Failed to load departments: Error 500"
- Role Approvals page: "Failed to load approvals: Error 500"
- SALGA Admin dashboard: inline expand pattern (not modal) for municipality ranking
- PMS Hub: inline card expand (not modal) for IDP management dropdown
- All pages: 32px gap between notification bell row and page title/buttons
- Teams page: canonical modal pattern reference (header + bell aligned, modal works correctly)

### Secondary (MEDIUM confidence — planning documents)
- `.planning/ROADMAP.md` Phase 34 section — scope definition
- `salga-pms-integration-plan.md` — role-feature matrix, daily journey context
- `.planning/STATE.md` — all Phase 27-33 accumulated decisions

---

## Metadata

**Confidence breakdown:**
- Current page inventory and UI issues: HIGH — verified with direct code inspection + live screenshots
- Onboarding wizard architecture: HIGH — based on existing code patterns (OnboardingWizardPage, PmsSetupWizardPage, InviteTeamStep)
- Modal conversion scope: HIGH — TeamCreateModal pattern is well-documented, conversion is straightforward
- E2E journey test structure: HIGH — existing fixtures and config are known
- Settings page fix: HIGH — role check issue confirmed by code reading
- Header alignment fix: HIGH — DashboardLayout code is clear, Option C is mechanical

**Research date:** 2026-03-02
**Valid until:** 2026-03-16 (stable codebase, no moving targets)
