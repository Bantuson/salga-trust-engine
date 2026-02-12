---
status: verifying
trigger: "public-dashboard-console-errors"
created: 2026-02-11T10:00:00Z
updated: 2026-02-11T10:35:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED both issues
test: (1) Test GSAP fix by loading dashboard (2) Apply SQL and test public views
expecting: No GSAP error, views return data after SQL applied
next_action: User must apply SQL fix via Supabase dashboard, then verify both fixes work

## Symptoms

expected: Public dashboard loads without console errors. GSAP ScrollTrigger animations work. Supabase public views (public_heatmap, public_ticket_stats) return data to anon users.
actual: Two issues:
1. GSAP ScrollTrigger error: "Element not found: .dashboard-preview-section" at DashboardPreview.tsx:12 — the ScrollTrigger targets a CSS class that doesn't exist in the DOM when the effect runs.
2. Supabase RLS 401/42501: All API calls to public views return "permission denied for table tickets" (code 42501) and 401 Unauthorized. The anon role can't query the SECURITY INVOKER views because the underlying tickets table blocks anon SELECT access.
errors:
- DashboardPreview.tsx:12 Element not found: .dashboard-preview-section
- GET /rest/v1/public_heatmap?select=lat,lng,intensity 401 (Unauthorized)
- GET /rest/v1/public_ticket_stats?select=... 401 (Unauthorized)
- permission denied for table tickets (code 42501)
reproduction: Open public dashboard at localhost:5178, check browser console
started: First time testing after Phase 06.1 migration to Supabase

## Eliminated

- hypothesis: GSAP targets missing CSS class
  evidence: Class exists on line 26. Error was from timing race condition where useGSAP ran before ref was populated.
  timestamp: 2026-02-11T10:15:00Z

## Evidence

- timestamp: 2026-02-11T10:05:00Z
  checked: DashboardPreview.tsx component
  found: Line 26 has className="dashboard-preview-section". Line 12 targets it via string selector '.dashboard-preview-section'. Line 9 has sectionRef. Line 23 uses { scope: sectionRef }.
  implication: String selector '.dashboard-preview-section' can fail if run before ref is populated. Need ref existence check and use ref directly as trigger.

- timestamp: 2026-02-11T10:10:00Z
  checked: Migration 2026_02_11_0915-29fc6e5ac39c_migrate_rls_to_supabase_auth.py
  found: Lines 324-378 create public views with default SECURITY INVOKER. Line 325 revokes SELECT on tickets from anon. Lines 349, 359, 378 grant SELECT on views to anon.
  implication: Views execute with anon's privileges. Since anon can't SELECT from tickets, view queries fail with 42501. Need WITH (security_invoker=false) for SECURITY DEFINER.

- timestamp: 2026-02-11T10:12:00Z
  checked: usePublicStats.ts hooks
  found: Three hooks query public views - useMunicipalities, useResponseTimes, useResolutionRates, useHeatmapData.
  implication: All views need SECURITY DEFINER fix.

- timestamp: 2026-02-11T10:25:00Z
  checked: Alembic migration application
  found: `alembic upgrade head` fails - tries to connect to localhost:5432 but project uses Supabase Cloud.
  implication: SQL must be applied via Supabase dashboard or MCP tools, not Alembic.

- timestamp: 2026-02-11T10:30:00Z
  checked: Applied code fixes
  found: Updated DashboardPreview.tsx lines 12-13 (ref existence check) and line 20 (use sectionRef.current as trigger). Created fix_public_views_security_definer.sql with DROP CASCADE and CREATE VIEW statements using WITH (security_invoker=false).
  implication: GSAP fix is complete. SQL fix ready for manual application.

## Resolution

root_cause:
1. GSAP ScrollTrigger timing issue: useGSAP effect runs before sectionRef.current is populated, causing ScrollTrigger to fail finding element via string selector '.dashboard-preview-section'. Using string selector bypasses React's ref guarantees.
2. Public views SECURITY INVOKER: Views (public_ticket_stats, public_municipalities, public_heatmap) execute with caller's (anon's) privileges. Since tickets table explicitly revokes SELECT from anon (defense-in-depth), queries fail with "permission denied for table tickets" (42501). Views need WITH (security_invoker=false) to run with owner privileges.

fix:
1. DashboardPreview.tsx: Added if (!sectionRef.current) return; guard (line 13) and changed ScrollTrigger trigger from string '.dashboard-preview-section' to sectionRef.current (line 20). Ensures GSAP only runs after React populates ref.
2. Created fix_public_views_security_definer.sql with DROP CASCADE and CREATE VIEW statements using WITH (security_invoker=false) for all three public views (public_ticket_stats, public_municipalities, public_heatmap). Also created migration file 2026_02_11_1424-c7f4f9dbcfde_fix_public_views_security_definer.py for version control.

verification:
AWAITING USER ACTION: SQL must be applied via Supabase dashboard SQL editor.

After SQL applied:
1. Test GSAP fix: Open http://localhost:5178, check console - no "Element not found" error
2. Test public views: Check console - no 401 errors, charts load data, heatmap displays
3. Test API directly: curl public_municipalities endpoint - should return data (not 401)

files_changed:
- frontend-public/src/components/landing/DashboardPreview.tsx (GSAP fix applied)
- alembic/versions/2026_02_11_1424-c7f4f9dbcfde_fix_public_views_security_definer.py (migration created)
- fix_public_views_security_definer.sql (SQL to apply manually)
- FIX_PUBLIC_VIEWS_INSTRUCTIONS.md (user instructions)
