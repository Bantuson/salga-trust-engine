---
phase: 34
slug: municipal-onboarding-production-readiness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-02
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (E2E), Vitest (unit) |
| **Config file** | `e2e-tests/playwright.config.ts`, `frontend-dashboard/vite.config.ts` |
| **Quick run command** | `cd e2e-tests && npx playwright test --project=dashboard-chromium` |
| **Full suite command** | `cd e2e-tests && npx playwright test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd e2e-tests && npx playwright test --project=dashboard-chromium`
- **After every plan wave:** Run `cd e2e-tests && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | E2E | TBD | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*To be populated by planner after task breakdown*

---

## Wave 0 Requirements

- [ ] `e2e-tests/tests/journeys/` — user journey test folder structure
- [ ] `e2e-tests/tests/journeys/README.md` — journey definitions per role
- [ ] Playwright fixtures for role-based auth (extend existing)

*Existing Playwright infrastructure covers most requirements — journeys folder is new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email invite delivery | Onboarding | Requires SMTP/Supabase email | Check Supabase dashboard for invite records |
| Visual modal consistency | UI fixes | Pixel-level comparison | Screenshot comparison across modals |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
