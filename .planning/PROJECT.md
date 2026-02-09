# SALGA Trust Engine

## What This Is

An AI-powered municipal service management platform that lets South African citizens report service issues and GBV/abuse incidents via WhatsApp, automatically categorizes and routes them using CrewAI agentic architecture and geospatial analytics, and provides public transparency dashboards — rebuilding trust between citizens and municipalities through radical accountability. Security-first with POPIA compliance from day one. Built for SALGA's network of 257 municipalities, starting with a 3-5 municipality pilot cohort.

## Core Value

Citizens report a problem and the municipality visibly responds — the core feedback loop that transforms opaque, reactive local government into transparent, accountable service delivery.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] CrewAI agentic system: manager agent routes to specialist agents by category
- [ ] Citizens report service issues via WhatsApp in English, isiZulu, or Afrikaans
- [ ] Citizens report GBV/abuse via dedicated category, routed to nearest SAPS station
- [ ] Mandatory user accounts with proof of residence (OCR verification)
- [ ] Geospatial routing to correct municipal team or SAPS station
- [ ] Citizens receive WhatsApp status updates as tickets progress
- [ ] Municipal managers access web dashboard to view, assign, and track tickets
- [ ] Ward councillor dashboard filtered to their ward
- [ ] Public dashboard displays response times, resolution rates, and heatmaps
- [ ] SLA tracking with automated escalation on breach
- [ ] POPIA compliance from day one (consent, data rights, encryption)
- [ ] Security firewalls between endpoints, RBAC, audit logging
- [ ] Platform supports 3-5 pilot municipalities with data isolation

### Out of Scope

- ERP/Munsoft integration — standalone first, integrate later once data model is proven
- Real-time chat between citizens and officials — structured reporting is the priority
- Mobile native app — WhatsApp is the citizen interface, web dashboard for officials
- All 257 municipalities at launch — pilot cohort first, scale with proven results
- Video/media-heavy reporting — photos supported, video deferred
- Offline-first field worker app — deferred to v2
- SMS fallback reporting — WhatsApp + web sufficient for v1
- Spending transparency on public dashboard — requires municipality budget data sharing
- AI-generated responses to citizens — AI for routing only, human-written templates for responses

## Context

South African municipalities face systemic dysfunction: R100+ billion in debt, only 27 of 257 achieving clean audits (2019/2020), R1+ billion wasted on financial reporting consultants with 59% of statements still containing material misstatements. Citizens report issues like potholes, water leaks, and faulty streetlights that go unaddressed for weeks.

OUTA offered a free geolocation reporting app for three years — only Cape Town adopted it — revealing systemic resistance to tech-driven accountability. This platform is SALGA-led specifically to overcome that adoption barrier through institutional authority and standardization.

SALGA's national reach (8 directorates, 9 provincial offices) and existing partnerships (SITA, WRC, COGTA) provide the distribution channel. The platform aligns with SALGA's Intercity Innovation Challenge and goals for intelligent service delivery.

Proven tech exists: IoT, AI, and mobile solutions already piloted in metros like Tshwane and eThekwini.

## Constraints

- **Tech Stack**: Python — aligns with AI/NLP capabilities and team preference
- **WhatsApp API**: Twilio API / Meta BSP — WhatsApp is the citizen-facing channel (highest SA penetration)
- **Languages**: English, Zulu, Afrikaans for v1 — the three most widely spoken languages in SA
- **Multi-tenancy**: Platform must isolate data per municipality from day one (3-5 pilots)
- **Budget**: Development R200,000-R500,000 one-time, R10,000-R50,000/month operations, ~R35,000/month Twilio at 500k messages
- **Revenue Model**: Tiered municipal subscriptions — Small (<100k pop): R5,000/mo, Medium (100k-500k): R15,000/mo, Large (500k+): R30,000/mo

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| WhatsApp via Twilio as citizen channel | Highest mobile penetration in SA, no app download required | — Pending |
| Standalone ticket system (no ERP integration v1) | Control data model, avoid vendor lock-in, faster to ship | — Pending |
| Python stack (FastAPI + PostgreSQL/PostGIS) | Strong AI ecosystem, async-native, geospatial support | — Pending |
| CrewAI agentic architecture (not traditional NLP) | Manager agent + specialist agents; flexible, extensible, handles multiple categories | — Pending |
| GBV/abuse reporting with SAPS routing | Platform handles safety-critical reports, not just infrastructure | — Pending |
| Mandatory accounts with proof of residence (OCR) | Ensures municipal residency, prevents abuse, enables personalization | — Pending |
| POPIA compliance from day one | GBV data and personal info require security-first architecture | — Pending |
| Trilingual from v1 (EN/ZU/AF) | Adoption requires accessibility in dominant languages | — Pending |
| 3-5 municipality pilot cohort | Prove model across different sizes/contexts before scaling | — Pending |
| SALGA-led platform | Institutional authority overcomes municipal resistance to tech accountability | — Pending |

---
*Last updated: 2026-02-09 after requirements and roadmap*
