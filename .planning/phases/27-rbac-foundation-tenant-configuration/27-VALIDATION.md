---
phase: 27
slug: rbac-foundation-tenant-configuration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-02-28
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3.0 + pytest-asyncio 0.24.0 (backend); TypeScript `tsc --noEmit` (frontend) |
| **Config file** | `pyproject.toml` (`[tool.pytest.ini_options]`) |
| **Quick run command** | `pytest tests/test_rbac_phase27.py tests/test_departments_api.py tests/test_pms_readiness.py -x` |
| **Full suite command** | `pytest --cov=src --cov-report=term-missing` |
| **Estimated runtime** | ~15 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_rbac_phase27.py tests/test_departments_api.py tests/test_pms_readiness.py -x`
- **After every plan wave:** Run `pytest --cov=src --cov-report=term-missing`
- **Before `/gsd:verify-work`:** Full suite must be green + coverage >= 80%
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | RBAC-01 | unit (import check) | `python -c "from src.models.user import UserRole; assert len(UserRole) == 18..."` | N/A (inline) | ⬜ pending |
| 27-01-02 | 01 | 1 | RBAC-01, RBAC-04, RBAC-06 | unit | `pytest tests/test_rbac_phase27.py -x -v` | ❌ W0 | ⬜ pending |
| 27-02-01 | 02 | 1 | RBAC-02 | unit (import check) | `python -c "from src.models.department import Department, DepartmentTicketCategoryMap; ..."` | N/A (inline) | ⬜ pending |
| 27-02-02 | 02 | 1 | RBAC-02, RBAC-03, RBAC-05 | unit | `pytest tests/test_departments_api.py -x -v` | ❌ W0 | ⬜ pending |
| 27-03-01 | 03 | 2 | RBAC-04, RBAC-06 | unit | `pytest tests/test_pms_readiness.py -x -v` | ❌ W0 | ⬜ pending |
| 27-03-02 | 03 | 2 | RBAC-01, RBAC-02, RBAC-05 | type check | `npx tsc --noEmit` | ✅ (built-in) | ⬜ pending |
| 27-03-03 | 03 | 2 | RBAC-02, RBAC-05 | manual | checkpoint:human-verify (wizard + organogram visual) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_rbac_phase27.py` — stubs for RBAC-01, RBAC-04, RBAC-06 (role hierarchy, tier inheritance, JWT blacklist, audit logging)
- [ ] `tests/test_departments_api.py` — stubs for RBAC-02, RBAC-03, RBAC-05 (department CRUD, organogram, municipality settings lock)
- [ ] `tests/test_pms_readiness.py` — stubs for PMS readiness gate (3-condition checklist, 403 enforcement)
- [ ] `tests/conftest.py` — add fixtures: `pms_officer_user`, `section56_director_user`, `executive_mayor_user`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 5-step setup wizard completes end-to-end | RBAC-02 | Multi-step UI flow with drag/drop interactions | Walk through wizard: settings → departments → directors → category mapping → organogram review |
| Organogram tree renders with expand/collapse | RBAC-05 | Visual SVG rendering (react-d3-tree) | Verify tree nodes are interactive, expand/collapse works, pan/zoom functions |
| Role switcher appears for multi-role users, hidden for single-role | RBAC-01 | UI conditional rendering + navbar layout | Login with multi-role user → see switcher; login with single-role → no switcher |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
