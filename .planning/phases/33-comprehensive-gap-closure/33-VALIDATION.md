---
phase: 33
slug: comprehensive-gap-closure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-02
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend), vitest (frontend-dashboard), vitest (frontend-public) |
| **Config file** | pyproject.toml, frontend-dashboard/vite.config.ts, frontend-public/vite.config.ts |
| **Quick run command** | `pytest tests/ -x -q` |
| **Full suite command** | `pytest tests/ && cd frontend-dashboard && npm run build:check && cd ../frontend-public && npm run build:check` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/ -x -q`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | REPORT-05, RBAC-01, RBAC-02, RBAC-04 | unit+build | `pytest tests/ -x -q && cd frontend-dashboard && npm run build:check` | ✅ | ⬜ pending |
| 33-01-02 | 01 | 1 | IDP-04, PA-01 | build | `cd frontend-dashboard && npm run build:check` | ✅ | ⬜ pending |
| 33-02-01 | 02 | 2 | RBAC-03, RBAC-05, RBAC-06 | verification | `pytest tests/test_rbac_phase27.py -v` | ✅ | ⬜ pending |
| 33-02-02 | 02 | 2 | REPORT-03, REPORT-04, REPORT-09 | verification | `grep -c "\[x\]" .planning/REQUIREMENTS.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar navigation links resolve | BUG-2/3/4 | Visual route verification | Click each sidebar link, verify page renders |
| Report submission flow | REPORT-05 | E2E multi-step flow | Login as MM, create report, submit for review |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
