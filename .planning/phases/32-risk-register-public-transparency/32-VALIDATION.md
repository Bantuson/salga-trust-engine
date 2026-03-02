---
phase: 32
slug: risk-register-public-transparency
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-02
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend), vitest (frontend) |
| **Config file** | pyproject.toml, frontend-dashboard/vitest.config.ts |
| **Quick run command** | `pytest tests/test_risk_register.py -x -q` |
| **Full suite command** | `pytest tests/ -x -q` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_risk_register.py -x -q`
- **After every plan wave:** Run `pytest tests/ -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | RISK-01 | unit | `pytest tests/test_risk_register.py -k test_create_risk_item` | ❌ W0 | ⬜ pending |
| 32-01-02 | 01 | 1 | RISK-02 | unit | `pytest tests/test_risk_register.py -k test_mitigation_strategy` | ❌ W0 | ⬜ pending |
| 32-01-03 | 01 | 1 | RISK-03 | unit | `pytest tests/test_risk_register.py -k test_auto_flag` | ❌ W0 | ⬜ pending |
| 32-01-04 | 01 | 1 | RISK-04 | unit | `pytest tests/test_risk_register.py -k test_department_filter` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_risk_register.py` — stubs for RISK-01 through RISK-04
- [ ] Shared fixtures in `tests/conftest.py` — already exists, may need RiskItem factory

*Existing pytest infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Risk register dashboard widget renders | RISK-04 | Visual UI | Navigate to CFO dashboard, check risk register widget displays |
| Department filter dropdown works | RISK-04 | UI interaction | Select different departments, verify filter applies |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
