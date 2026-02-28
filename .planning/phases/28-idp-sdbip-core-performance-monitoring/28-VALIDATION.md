---
phase: 28
slug: idp-sdbip-core-performance-monitoring
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-02-28
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3.0 + pytest-asyncio 0.24.0 |
| **Config file** | `pyproject.toml` (`[tool.pytest.ini_options]`) |
| **Quick run command** | `pytest tests/test_pms_idp.py tests/test_pms_sdbip.py tests/test_pms_actuals.py tests/test_pms_auto_populate.py tests/test_pms_evidence.py -x --tb=short` |
| **Full suite command** | `pytest --cov=src --cov-report=term-missing` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_pms_idp.py tests/test_pms_sdbip.py tests/test_pms_actuals.py tests/test_pms_auto_populate.py tests/test_pms_evidence.py -x --tb=short`
- **After every plan wave:** Run `pytest --cov=src --cov-report=term-missing`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-01-T1 | 01 | 1 | IDP-01, IDP-02, IDP-03, IDP-05 | unit | `python -c "from src.models.idp import IDPCycle, IDPGoal, IDPObjective, IDPVersion, IDPStatus, NationalKPA, IDPWorkflow; ..."` | ❌ W0 | ⬜ pending |
| 28-01-T2 | 01 | 1 | IDP-01, IDP-02, IDP-03, IDP-04, IDP-05 | unit | `pytest tests/test_pms_idp.py -x --tb=short` | ❌ W0 | ⬜ pending |
| 28-02-T1 | 02 | 2 | SDBIP-01, SDBIP-02, SDBIP-05, SDBIP-10 | unit | `python -c "from src.models.sdbip import SDBIPScorecard, SDBIPKpi, SDBIPQuarterlyTarget, ...; ..."` | ❌ W0 | ⬜ pending |
| 28-02-T2 | 02 | 2 | SDBIP-01, SDBIP-02, SDBIP-03, SDBIP-04, SDBIP-05, SDBIP-10 | unit | `pytest tests/test_pms_sdbip.py -x --tb=short` | ❌ W0 | ⬜ pending |
| 28-03-T1 | 03 | 3 | SDBIP-06, SDBIP-09 | unit | `pytest tests/test_pms_sdbip.py -x --tb=short -k "approval or midyear or transition"` | ❌ W0 | ⬜ pending |
| 28-04-T1 | 04 | 3 | EVID-01, EVID-02, EVID-06 | unit | `python -c "...compute_achievement..."` | ❌ W0 | ⬜ pending |
| 28-04-T2 | 04 | 3 | EVID-01, EVID-02, EVID-05, EVID-06 | unit | `pytest tests/test_pms_actuals.py -x --tb=short` | ❌ W0 | ⬜ pending |
| 28-05-T1a | 05 | 4 | EVID-03, EVID-07 | unit | `pytest tests/test_pms_evidence.py -x --tb=short` | ❌ W0 | ⬜ pending |
| 28-05-T1b | 05 | 4 | EVID-04 | unit | `pytest tests/test_pms_actuals.py -x --tb=short -k "validate"` | ❌ W0 | ⬜ pending |
| 28-06-T1 | 06 | 4 | SDBIP-07, SDBIP-08 | unit | `python -c "...AutoPopulationEngine(); get_quarter_boundaries..."` | ❌ W0 | ⬜ pending |
| 28-06-T2 | 06 | 4 | SDBIP-07, SDBIP-08, EVID-08 | unit | `pytest tests/test_pms_auto_populate.py -x --tb=short` | ❌ W0 | ⬜ pending |
| 28-07-T1a | 07 | 5 | IDP-04 | unit | `pytest tests/test_pms_idp.py -x --tb=short -k "golden_thread"` | ❌ W0 | ⬜ pending |
| 28-07-T1b | 07 | 5 | SDBIP-03, SDBIP-04 | tsc | `npx tsc --noEmit --pretty` | ✅ | ⬜ pending |
| 28-07-T2 | 07 | 5 | IDP-04, SDBIP-03, SDBIP-04 | tsc | `npx tsc --noEmit --pretty` | ✅ | ⬜ pending |
| 28-07-T3 | 07 | 5 | — | checkpoint | Human visual verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_pms_idp.py` — stubs for IDP-01 through IDP-05 (12 tests incl. golden thread)
- [ ] `tests/test_pms_sdbip.py` — stubs for SDBIP-01 through SDBIP-10
- [ ] `tests/test_pms_actuals.py` — stubs for EVID-01, EVID-02, EVID-04, EVID-05, EVID-06
- [ ] `tests/test_pms_evidence.py` — stubs for EVID-03, EVID-07 (ClamAV mocked)
- [ ] `tests/test_pms_auto_populate.py` — stubs for SDBIP-07, SDBIP-08, EVID-08

*Note: No dedicated Wave 0 plan exists. Tests are created within each implementation plan's tasks (inline TDD). Each plan creates its test file alongside the implementation code.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Evidence file upload with real ClamAV scan | EVID-03 | Requires running ClamAV daemon | Start ClamAV container, upload PDF via API, verify file appears in Supabase Storage bucket |
| Frontend golden thread visual hierarchy | IDP-04 | Visual correctness of tree rendering | Navigate to IDP detail page, verify goals -> objectives -> KPIs tree renders correctly |
| Traffic light badge colors | EVID-06 | CSS color accuracy | Submit actuals with values producing green (>=80%), amber (50-79%), red (<50%), verify badge colors |
| SDBIP Mayor sign-off flow | SDBIP-06 | Role-based UI flow | Log in as executive_mayor, navigate to SDBIP, approve scorecard, verify status change |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (tests created inline per plan)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
