---
phase: 07-fix-whatsapp-ai-agent-integration
plan: 01
subsystem: agent-routing
tags: [bugfix, crewai, whatsapp, intake-pipeline, manager-crew]
dependency_graph:
  requires: []
  provides: [working-citizen-intake-via-whatsapp, working-citizen-intake-via-web-portal]
  affects: [src/api/v1/messages.py, src/api/v1/reports.py, src/services/whatsapp_service.py, src/api/v1/whatsapp.py]
tech_stack:
  added: []
  patterns: [ManagerCrew.kickoff() direct call, sanitize_reply() output cleaning, _format_history() multi-turn injection, stable phone-based session_id]
key_files:
  created: []
  modified:
    - src/api/v1/messages.py
    - src/api/v1/reports.py
    - src/services/whatsapp_service.py
    - src/api/v1/whatsapp.py
decisions:
  - "Replace all IntakeFlow usage with direct ManagerCrew.kickoff() calls matching crew_server.py reference pattern"
  - "session_id uses stable phone-based key (wa-{phone}) not per-message (wa-{MessageSid}) for multi-turn state persistence"
  - "Media linking deferred to Phase 8 when ticket_id is unavailable from ManagerCrew internal tool creation"
  - "English-only error fallback in all three endpoints per MVP decision (no trilingual error handling complexity)"
metrics:
  duration: 10m (638s)
  completed: 2026-02-22
  tasks: 2
  files: 4
---

# Phase 07 Plan 01: Fix WhatsApp/AI Agent Integration Summary

## One-liner

Replace broken IntakeFlow references (wrong kwargs, removed methods) with direct ManagerCrew.kickoff() calls matching the working crew_server.py pattern across three citizen intake paths.

## What Was Built

Fixed three citizen intake endpoints that crashed at runtime due to the Phase 6.9 refactor:

1. **messages.py** (web portal citizen messages): Removed `IntakeFlow(redis_url=..., llm_model="gpt-4o")` with wrong `llm_model` kwarg. Now calls `ManagerCrew(language=...).kickoff({...})` directly with full conversation history injected via `_format_history()`. Applies `sanitize_reply()` to agent output. Extracts `tracking_number` from result dict (was hardcoded `None`).

2. **reports.py** (web portal report submission): Removed `IntakeFlow` with `receive_message()` and `classify_message()` calls — both methods were removed in Phase 6.9. Now calls `ManagerCrew.kickoff()` for single-shot classification, then maps `routing_phase` to ticket category via `_PHASE_TO_CATEGORY` dict.

3. **whatsapp_service.py** (Twilio WhatsApp webhook): Removed `IntakeFlow(redis_url=..., llm_model="gpt-4o")` pattern. Now calls `ManagerCrew(language=...).kickoff({...})` with `_format_history()` for multi-turn context. Applies `sanitize_reply()` to output. Notes that media linking via `ticket_id` is deferred to Phase 8 (ManagerCrew creates tickets internally via tools).

4. **whatsapp.py** (Twilio webhook router): Fixed `session_id = f"wa-{payload.MessageSid}"` (unique per message, breaks multi-turn state) to `session_id = f"wa-{normalized_phone}"` (stable per phone number, enables GBV confirmation and conversation persistence).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 9ba0099 | fix(07-01): replace IntakeFlow with ManagerCrew.kickoff() in messages.py |
| Task 2 | 458efc6 | fix(07-01): replace IntakeFlow with ManagerCrew.kickoff() in reports, whatsapp_service; fix session_id |

## Decisions Made

1. **Direct ManagerCrew.kickoff() over IntakeFlow**: IntakeFlow was an intermediate layer that also called ManagerCrew.kickoff() internally. Skipping it eliminates the async/sync boundary issue and the `llm_model` kwarg incompatibility. The crew_server.py already used this direct pattern successfully.

2. **Stable phone-based session_id**: `wa-{phone}` instead of `wa-{MessageSid}` is critical for multi-turn conversations. Each new WhatsApp message arriving with a new MessageSid would previously create a brand-new session, losing GBV confirmation state and all conversation context.

3. **_PHASE_TO_CATEGORY mapping in reports.py**: ManagerCrew returns `routing_phase` ("municipal", "gbv", "auth", etc.) but reports.py needs a ticket category string. A small mapping dict handles this cleanly without coupling to ManagerCrew internals.

4. **Media linking deferred in whatsapp_service.py**: ManagerCrew creates tickets via its `create_municipal_ticket` tool internally, returning only a `tracking_number`. The `ticket_id` (UUID) is not surfaced in the result dict. Rather than adding complexity, added a TODO for Phase 8 to implement tracking_number-based media linking.

## Deviations from Plan

### Auto-fixed Issues

None beyond the planned scope.

**Additional cleanup (not in plan spec but needed for correctness):**

**[Rule 1 - Bug] Removed orphaned `from typing import Any` import in reports.py**
- Found during: Task 2 (reports.py)
- Issue: `Any` import was only used by `IntakeState` type annotations that were removed
- Fix: Removed the unused import to prevent linter warnings
- Files modified: src/api/v1/reports.py
- Commit: 458efc6

**[Rule 1 - Bug] Updated module docstring references to IntakeFlow in reports.py**
- Found during: Task 2 (reports.py)
- Issue: Module-level docstring and function docstring still referenced "IntakeFlow" after code change
- Fix: Updated docstrings to reference "ManagerCrew.kickoff()" accurately
- Files modified: src/api/v1/reports.py
- Commit: 458efc6

## Verification Results

All plan success criteria met:

1. No `llm_model` refs in src/api/ or src/services/ — 0 matches
2. No `receive_message` or `classify_message` refs in src/api/ or src/services/ — 0 matches
3. No `IntakeFlow` refs in messages.py, reports.py, whatsapp_service.py — 0 matches
4. All imports pass: `from src.api.v1.messages import router; from src.api.v1.reports import router; from src.services.whatsapp_service import WhatsAppService` — All OK
5. All three endpoints use `await manager_crew.kickoff()` — verified at lines messages.py:174, reports.py:79, whatsapp_service.py:274
6. `session_id = f"wa-{normalized_phone}"` in whatsapp.py — confirmed

## Self-Check: PASSED

Files exist:
- FOUND: src/api/v1/messages.py
- FOUND: src/api/v1/reports.py
- FOUND: src/services/whatsapp_service.py
- FOUND: src/api/v1/whatsapp.py

Commits exist:
- FOUND: 9ba0099
- FOUND: 458efc6
