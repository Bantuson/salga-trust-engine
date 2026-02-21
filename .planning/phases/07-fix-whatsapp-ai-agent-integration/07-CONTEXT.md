# Phase 7: Fix WhatsApp -> AI Agent Integration (GAP CLOSURE) - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix broken API calls in Messages and Reports endpoints that reference removed IntakeFlow methods. Ensure all citizen intake paths route correctly through ManagerCrew. This is a gap closure — fix what's broken, don't add new features. The goal is a working end-to-end flow: message in → agents route → tools execute → ticket created → persisted to DB → response back to citizen.

**What's broken (from codebase analysis):**
- `src/api/v1/messages.py` — passes `llm_model="gpt-4o"` (wrong param, should be `llm=None`)
- `src/api/v1/reports.py` — calls removed methods `receive_message()` / `classify_message()`
- WhatsApp webhook path (`src/services/whatsapp_service.py`) is actually correct

</domain>

<decisions>
## Implementation Decisions

### LLM Model Configuration
- All agents use DeepSeek (same model for all — manager, GBV, municipal, auth, ticket status)
- Move LLM config to YAML agent definitions (CrewAI best practice) instead of hardcoded Python params
- Remove `llm_model="gpt-4o"` from all Python callers — callers pass `llm=None`
- Keep `get_deepseek_llm()` in IntakeFlow as a safety net fallback if YAML LLM is missing

### GBV Safety in Webhook Path
- Add a confirmation step before routing to SAPS — citizen must confirm they want to report
- If citizen confirms: immediate SAPS notification AND ticket flagged for admin review (double coverage)
- If citizen declines: treat as regular ticket, no GBV flag (MVP simplicity)
- Confirmation message tone: Claude's discretion, using trauma-informed communication best practices

### Conversation Continuity
- Session-based context: remember within a 24-hour window, then start fresh
- Pass full conversation history to AI agent within a session (all previous turns)
- Topic switching: ManagerCrew asks citizen for consent before switching specialists ("finish current issue or switch?")

### Error/Fallback Behavior
- On AI failure: friendly English-only apology + retry hint ("Please try again in a few minutes")
- No staff logging of failures, no circuit breaker — keep it simple for MVP
- No error message translation for MVP (English only)

### MVP Priority (USER DIRECTIVE)
- Focus on what matters: tool use, agent trajectories, end-to-end workflow execution
- User info, ticket creation, and reporting success must persist in database
- Don't over-engineer — this is gap closure for demo MVP
- Fix the broken calls, verify the flow works end-to-end, move on

### Claude's Discretion
- GBV confirmation message wording (trauma-informed, empathetic)
- Error message exact wording
- Any technical implementation details for the fixes

</decisions>

<specifics>
## Specific Ideas

- CrewAI best practice: LLM should be configured in YAML agent config files, not hardcoded in Python
- The milestone audit should have caught framework pattern deviations — apply YAML config pattern now
- "Most important things right now: tool use, agent trajectories, end-to-end reporting workflow, user info, ticket creation and reporting success that persist in database"

</specifics>

<deferred>
## Deferred Ideas

- Trilingual error messages — future phase (currently English only)
- Circuit breaker for LLM outages — not needed for MVP
- Staff notification on failed AI processing — not needed for MVP
- Error logging for staff follow-up — not needed for MVP

</deferred>

---

*Phase: 07-fix-whatsapp-ai-agent-integration*
*Context gathered: 2026-02-21*
