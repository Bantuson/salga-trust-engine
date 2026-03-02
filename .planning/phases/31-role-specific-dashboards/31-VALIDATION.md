---
phase: 31
slug: role-specific-dashboards
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-02
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio |
| **Config file** | `pyproject.toml` (`asyncio_mode = "auto"`) |
| **Quick run command** | `pytest tests/test_role_dashboards.py -x` |
| **Full suite command** | `pytest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_role_dashboards.py -x`
- **After every plan wave:** Run `pytest tests/test_role_dashboards.py tests/test_pms_sdbip.py tests/test_statutory_reports.py -x`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | DASH-01 | unit | `pytest tests/test_role_dashboards.py::test_cfo_dashboard_structure -x` | ❌ W0 | ⬜ pending |
| 31-01-02 | 01 | 1 | DASH-02 | unit | `pytest tests/test_role_dashboards.py::test_cfo_sdbip_summary -x` | ❌ W0 | ⬜ pending |
| 31-01-03 | 01 | 1 | DASH-03 | unit | `pytest tests/test_role_dashboards.py::test_cfo_service_correlation -x` | ❌ W0 | ⬜ pending |
| 31-01-04 | 01 | 1 | DASH-04 | unit | `pytest tests/test_role_dashboards.py::test_cfo_deadline_calendar -x` | ❌ W0 | ⬜ pending |
| 31-02-01 | 02 | 1 | DASH-05 | unit | `pytest tests/test_role_dashboards.py::test_mm_department_overview -x` | ❌ W0 | ⬜ pending |
| 31-02-02 | 02 | 1 | DASH-06 | unit | `pytest tests/test_role_dashboards.py::test_mayor_approve_sdbip -x` | ❌ W0 | ⬜ pending |
| 31-03-01 | 03 | 2 | DASH-07 | unit | `pytest tests/test_role_dashboards.py::test_councillor_readonly_view -x` | ❌ W0 | ⬜ pending |
| 31-03-02 | 03 | 2 | DASH-08 | unit | `pytest tests/test_role_dashboards.py::test_audit_committee_view -x` | ❌ W0 | ⬜ pending |
| 31-03-03 | 03 | 2 | DASH-09 | unit | `pytest tests/test_role_dashboards.py::test_internal_auditor_poe_verify -x` | ❌ W0 | ⬜ pending |
| 31-03-04 | 03 | 2 | DASH-10 | unit | `pytest tests/test_role_dashboards.py::test_mpac_flag_investigation -x` | ❌ W0 | ⬜ pending |
| 31-04-01 | 04 | 2 | DASH-11 | unit | `pytest tests/test_role_dashboards.py::test_salga_admin_benchmarking -x` | ❌ W0 | ⬜ pending |
| 31-04-02 | 04 | 2 | DASH-12 | unit | `pytest tests/test_role_dashboards.py::test_section56_director_scoped -x` | ❌ W0 | ⬜ pending |
| 31-01-RBAC | 01 | 1 | DASH-01 | unit | `pytest tests/test_role_dashboards.py::test_cfo_endpoint_403_for_pms_officer -x` | ❌ W0 | ⬜ pending |
| 31-02-RBAC | 02 | 1 | DASH-06 | unit | `pytest tests/test_role_dashboards.py::test_mayor_approve_403 -x` | ❌ W0 | ⬜ pending |
| 31-04-RBAC | 04 | 2 | DASH-11 | unit | `pytest tests/test_role_dashboards.py::test_salga_admin_403 -x` | ❌ W0 | ⬜ pending |
| 31-04-EDGE | 04 | 2 | DASH-12 | unit | `pytest tests/test_role_dashboards.py::test_section56_no_department -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_role_dashboards.py` — stubs for all 12 DASH-XX requirements + RBAC + edge cases
- [ ] `src/api/v1/role_dashboards.py` — new router module registered in `src/main.py`
- [ ] `src/services/role_dashboard_service.py` — new service class with aggregation methods

*Existing infrastructure covers test framework and fixtures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RoleSwitcher changes dashboard view | All DASH-XX | Browser-specific role-switching UI | 1. Log in as admin 2. Switch role via RoleSwitcher 3. Verify dashboard page updates |
| Traffic-light badge colors display correctly | DASH-02, DASH-05 | Visual CSS verification | 1. Open CFO/MM dashboard 2. Verify green/amber/red badges render with correct colors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
