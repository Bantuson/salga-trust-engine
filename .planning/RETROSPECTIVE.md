# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-02-28
**Phases:** 26 | **Plans:** ~127 | **Timeline:** 19 days

### What Was Built
- Complete municipal service management platform: FastAPI backend (71+ endpoints), 2 React dashboards, WhatsApp bot
- CrewAI agentic system rebuilt twice (Process.hierarchical → Flow @router) with Gugu personality, 4 specialist agents
- 5-layer GBV firewall: routing → DB RLS → API → storage → public views
- Supabase migration: auth, storage, realtime — replacing custom PostgreSQL + Redis SSE
- Playwright E2E test suite: 110+ tests across 5 projects
- LLM evaluation framework: deepeval trajectory evals + Claude-as-judge rubrics
- Rich SA-authentic mock data for demo pitches (5 municipalities, realistic distributions)

### What Worked
- **Phase-based incremental delivery** — each phase produced a verifiable capability before moving on
- **Gap closure as separate phases** — audit identified 4 critical gaps, phases 7-10 resolved them cleanly without disrupting earlier work
- **YOLO mode with milestone audit** — fast execution with quality gate at the end
- **Decimal phase numbering** — inserted phases (6.1, 6.9.1, 10.3) kept scope clear without renumbering
- **Security-first architecture** — building POPIA/RBAC/RLS from Phase 1 meant later phases didn't need security retrofits
- **Agent rebuild (Phase 10.3)** — starting fresh with Flow @router was faster than fixing broken hierarchical manager

### What Was Inefficient
- **CrewAI hierarchical manager** — Phase 6.9 built it, 6.9.1 patched output quality, 10.3 rebuilt it entirely. Should have evaluated Process.hierarchical limitations earlier
- **UI redesign churn** — Phases 6.2 (Ndebele/globe) → 6.3 (pink/rose theme) → 6.4-6.5 (polish) iterated through 3 visual identities before settling
- **Phase directories without SUMMARY.md** — early phases (1-6) don't have standard GSD SUMMARY files, making retrospective extraction harder
- **Frontend chunk sizes** — 907KB + 1.25MB shipped without code splitting; should have added lazy loading earlier
- **Ward filtering approach** — used address text match instead of proper FK; known at implementation time but deferred

### Patterns Established
- **Flow @router for CrewAI** — deterministic agent dispatch via state routing, not LLM-based delegation
- **BaseCrew abstract pattern** — single agent + single task + Process.sequential + memory=False
- **Supabase Auth + custom claims hook** — role and tenant_id in JWT app_metadata for RBAC
- **RLS + application filtering** — double enforcement of tenant isolation
- **GSD milestone audit before completion** — catches gaps that phase-level verification misses
- **Mock data files with hook fallbacks** — `useMockFallback` pattern for demo-ready dashboards

### Key Lessons
1. **Evaluate framework limitations before building on them** — Process.hierarchical looked right on paper but failed in practice; a quick spike would have saved 3 phases of rework
2. **UI design should be settled before implementation** — 3 visual identity iterations cost ~20 plans; a design-first approach with mockups would have reduced churn
3. **Gap closure phases are valuable** — dedicated phases for fixing integration gaps (vs. patching inline) produce cleaner code and better audit trails
4. **Milestone audits are essential** — the v1.0 audit caught 4 critical integration gaps that would have shipped broken
5. **Security architecture pays compound interest** — Phase 1's RBAC/RLS/audit foundation meant phases 2-10 could focus on features, not retrofitting security

### Cost Observations
- Model mix: ~60% sonnet, ~30% haiku, ~10% opus (balanced profile)
- Sessions: ~50+ across 19 days
- Notable: Agent rebuild phases (10.3) were most expensive due to 11 plans and LLM eval development

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 MVP | 19 days | 26 | Established GSD workflow with YOLO mode, milestone audit gate |

### Cumulative Quality

| Milestone | Plans | LOC | Requirements Satisfied |
|-----------|-------|-----|----------------------|
| v1.0 MVP | ~127 | ~88K | 46/46 (100%) |

### Top Lessons (Verified Across Milestones)

1. Evaluate framework/library limitations with a spike before committing to multi-phase implementations
2. Settle visual design identity before building frontend components
3. Milestone audits catch integration gaps that phase-level verification misses
