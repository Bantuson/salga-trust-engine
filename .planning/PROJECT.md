# SALGA Trust Engine

## What This Is

An AI-powered municipal service management platform that lets South African citizens report service issues and GBV/abuse incidents via WhatsApp and web portal, automatically categorizes and routes them using CrewAI agentic architecture (Flow @router with Gugu manager agent) and geospatial analytics, tracks SLA compliance with automated escalation, provides municipal operations dashboards for ticket management, and delivers public transparency dashboards showing anonymized performance data — rebuilding trust between citizens and municipalities through radical accountability. Security-first with POPIA compliance, 5-layer GBV firewall, and comprehensive audit logging. Built for SALGA's network of 257 municipalities, starting with a 3-5 municipality pilot cohort.

## Core Value

Citizens report a problem and the municipality visibly responds — the core feedback loop that transforms opaque, reactive local government into transparent, accountable service delivery.

## Requirements

### Validated

- ✓ CrewAI agentic system: Gugu manager agent routes to 4 specialist agents (Auth, Municipal, GBV, TicketStatus) — v1.0
- ✓ Citizens report service issues via WhatsApp in English, isiZulu, or Afrikaans — v1.0
- ✓ Citizens report GBV/abuse via dedicated category, routed to nearest SAPS station — v1.0
- ✓ Mandatory user accounts with proof of residence (OCR verification bridged to Supabase) — v1.0
- ✓ Geospatial routing to correct municipal team or SAPS station via PostGIS — v1.0
- ✓ Citizens receive WhatsApp status updates as tickets progress via Celery beat — v1.0
- ✓ Municipal managers access web dashboard to view, assign, and track tickets — v1.0
- ✓ Ward councillor dashboard filtered to their ward (User.ward_id + endpoint filtering) — v1.0
- ✓ Public dashboard displays response times, resolution rates, and geographic heatmaps — v1.0
- ✓ SLA tracking with automated escalation on breach — v1.0
- ✓ POPIA compliance from day one (consent at registration, data rights endpoints, encryption) — v1.0
- ✓ Security firewalls between endpoints, RBAC (6 roles), comprehensive audit logging — v1.0
- ✓ Platform supports 3-5 pilot municipalities with complete data isolation (RLS + tenant filtering) — v1.0

### Active

- [ ] Production deployment to Render staging with live Twilio WhatsApp
- [ ] Live pilot municipality onboarding (3-5 municipalities)
- [ ] Frontend code splitting for performance (907KB public, 1.25MB dashboard chunks)
- [ ] WhatsApp media FK linking (MediaAttachment.ticket_id for WhatsApp uploads)
- [ ] Ward filtering upgrade from address text match to proper ward_id FK

### Out of Scope

- ERP/Munsoft integration — standalone first, integrate later once data model is proven; still valid
- Real-time chat between citizens and officials — structured reporting is the priority; still valid
- Mobile native app — WhatsApp is the citizen interface, web dashboard for officials; PWA could help
- All 257 municipalities at launch — pilot cohort first, scale with proven results; still valid
- Video/media-heavy reporting — photos supported, video deferred; still valid
- Offline-first field worker app — deferred to v2; still valid
- SMS fallback reporting — WhatsApp + web sufficient for v1; still valid
- Spending transparency on public dashboard — requires municipality budget data sharing; still valid
- AI-generated responses to citizens — AI for routing only, human-written templates for responses; still valid

## Context

Shipped v1.0 MVP with ~88K LOC (49K Python, 39K TypeScript) across 905 files in 19 days.
Tech stack: FastAPI + PostgreSQL/PostGIS + Supabase (Auth, Storage, Realtime) + Redis/Celery + CrewAI (DeepSeek LLM) + React/Vite (2 dashboards) + Twilio WhatsApp + Playwright E2E.

South African municipalities face systemic dysfunction: R100+ billion in debt, only 27 of 257 achieving clean audits. OUTA offered a free geolocation reporting app for three years — only Cape Town adopted it. This platform is SALGA-led to overcome adoption barriers through institutional authority.

46/46 v1 requirements satisfied. 12 tech debt items accepted (non-blocking). LLM evaluation framework established with deepeval trajectory evals and Claude-as-judge rubrics.

## Constraints

- **Tech Stack**: Python (FastAPI) + TypeScript (React/Vite) — proven through v1.0
- **WhatsApp API**: Twilio API — integrated and tested, ~R35,000/month at 500k messages
- **AI/LLM**: DeepSeek via OpenAI-compatible API through CrewAI — cost-effective for SA context
- **Languages**: English, isiZulu, Afrikaans — agent prompts tuned for all three
- **Multi-tenancy**: PostgreSQL RLS + application-level tenant filtering — proven through 6 phases
- **Auth**: Supabase Auth (email+password, phone OTP, email OTP) with RBAC via custom claims hook
- **Budget**: Development R200,000-R500,000 one-time, R10,000-R50,000/month operations

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| WhatsApp via Twilio as citizen channel | Highest mobile penetration in SA, no app download required | ✓ Good — integrated, GBV confirmation flow works |
| Standalone ticket system (no ERP integration v1) | Control data model, avoid vendor lock-in, faster to ship | ✓ Good — full ticket lifecycle working |
| Python stack (FastAPI + PostgreSQL/PostGIS) | Strong AI ecosystem, async-native, geospatial support | ✓ Good — 49K LOC, 71+ endpoints |
| CrewAI agentic architecture (not traditional NLP) | Manager agent + specialist agents; flexible, extensible | ✓ Good — rebuilt with Flow @router, 4 specialists working |
| GBV/abuse reporting with SAPS routing | Platform handles safety-critical reports, not just infrastructure | ✓ Good — 5-layer firewall verified by audit |
| Mandatory accounts with proof of residence (OCR) | Ensures municipal residency, prevents abuse | ✓ Good — OCR service + Supabase metadata bridge |
| POPIA compliance from day one | GBV data and personal info require security-first architecture | ✓ Good — consent, data rights, encryption all operational |
| Trilingual from v1 (EN/ZU/AF) | Adoption requires accessibility in dominant languages | ✓ Good — agent prompts in all 3 languages |
| 3-5 municipality pilot cohort | Prove model across different sizes/contexts before scaling | — Pending (ready for onboarding) |
| SALGA-led platform | Institutional authority overcomes municipal resistance | — Pending (no SALGA engagement yet) |
| Supabase migration (from custom PostgreSQL) | Managed auth, storage, realtime; faster to ship | ✓ Good — reduced infrastructure complexity significantly |
| CrewAI Flow @router (replacing Process.hierarchical) | Hierarchical manager was unreliable; @router gives deterministic dispatch | ✓ Good — all agents working, eval framework established |
| Email OTP verification (replacing email confirmation links) | Users stuck with unconfirmed accounts; inline OTP fixes registration | ✓ Good — zero "invalid credentials" reports after fix |
| Password complexity hardening (12 chars, mixed case + digit) | HIBP integration, OWASP compliance | ✓ Good — Supabase + FastAPI both enforce |
| Rich mock data for demo (SA-authentic) | Dashboards need convincing data for pilot pitches | ✓ Good — 5 municipalities, realistic distributions |

---
*Last updated: 2026-02-28 after v1.0 milestone*
