---
phase: 07-fix-whatsapp-ai-agent-integration
verified: 2026-02-22T12:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 07: Fix WhatsApp / AI Agent Integration — Verification Report

**Phase Goal:** Fix broken WhatsApp intake path — WhatsAppService calls removed IntakeFlow API (llm_model kwarg, receive_message(), classify_message()). Update to route through ManagerCrew. Fix GBV routing via Twilio webhook path.
**Verified:** 2026-02-22
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Plan 01)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | messages.py calls ManagerCrew.kickoff() directly (not IntakeFlow with wrong kwarg) | VERIFIED | `await manager_crew.kickoff({...})` at line 174; `from src.agents.crews.manager_crew import ManagerCrew` at line 18 |
| 2 | reports.py calls ManagerCrew.kickoff() for AI classification (not removed receive_message/classify_message) | VERIFIED | `await manager_crew.kickoff({...})` at line 79; `from src.agents.crews.manager_crew import ManagerCrew` at line 17 |
| 3 | whatsapp_service.py calls ManagerCrew.kickoff() directly (not IntakeFlow with wrong kwarg) | VERIFIED | `await manager_crew.kickoff({...})` at line 338; imported at line 18 |
| 4 | WhatsApp session_id is stable per phone number (not per MessageSid) | VERIFIED | `session_id = f"wa-{normalized_phone}"` at whatsapp.py line 189 |
| 5 | All three endpoints extract response from ManagerCrew result dict correctly | VERIFIED | messages.py: lines 187-197 (`agent_result.get("message"/"tracking_number"/"routing_phase")`); reports.py: line 92; whatsapp_service.py: lines 384-392 |
| 6 | sanitize_reply() is used on agent output before returning to citizen | VERIFIED | messages.py lines 194-199; whatsapp_service.py lines 386-390; both import `sanitize_reply` from crew_server |

### Observable Truths (Plan 02)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 7 | GBV confirmation step exists before routing to SAPS — citizen must explicitly confirm | VERIFIED | crew_server.py line 867: `if routing_phase == "gbv_pending_confirm"`; lines 944-950: intercepts first GBV signal. whatsapp_service.py line 272: same gate |
| 8 | Citizen who confirms GBV gets routed to GBVCrew with SAPS notification | VERIFIED | crew_server.py lines 872-881: positive YES sets routing_phase="gbv", which hits specialist short-circuit map (GBVCrew). reports.py calls `notify_saps()` on GBV tickets (line 205) |
| 9 | Citizen who declines GBV gets treated as regular municipal ticket | VERIFIED | crew_server.py lines 882-893: negative NO sets routing_phase="municipal", returns early with helpful message. whatsapp_service.py lines 281-305 |
| 10 | GBV confirmation message includes emergency numbers (10111, 0800 150 150) | VERIFIED | `GBV_CONFIRMATION_MESSAGES` at crew_server.py lines 376-398: EN/ZU/AF all contain "10111" and "0800 150 150" (8 occurrences each in crew_server.py) |
| 11 | Existing tests updated to match new ManagerCrew-based pipeline | VERIFIED | test_messages_api.py: `MockManagerCrew` class at line 39, `mock_manager_crew` fixture at line 88; 0 IntakeFlow/MockIntakeFlow references |
| 12 | New tests cover GBV confirmation accept/decline paths | VERIFIED | `TestGBVConfirmation` class in test_whatsapp_service.py with 6 async tests + 1 sync test (14 gbv_pending_confirm references) |

**Score:** 12/12 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/api/v1/messages.py` | Fixed message endpoint using ManagerCrew directly | VERIFIED | Contains `ManagerCrew` (line 18); calls kickoff (line 174); no IntakeFlow/llm_model |
| `src/api/v1/reports.py` | Fixed report endpoint using ManagerCrew for classification | VERIFIED | Contains `ManagerCrew` (line 17); kickoff at line 79; SAPS notify at line 205 |
| `src/services/whatsapp_service.py` | Fixed WhatsApp service using ManagerCrew directly | VERIFIED | Contains `ManagerCrew` (line 18); kickoff at line 338; GBV gate at lines 268-330 |
| `src/api/v1/whatsapp.py` | Fixed stable session_id per phone number | VERIFIED | `session_id = f"wa-{normalized_phone}"` at line 189 |
| `src/api/v1/crew_server.py` | GBV confirmation state machine in crew_server chat() | VERIFIED | `gbv_pending_confirm` at 6 locations; `GBV_CONFIRMATION_MESSAGES` defined at module level (line 376) |
| `tests/test_messages_api.py` | Updated unit tests for ManagerCrew-based messages pipeline | VERIFIED | `MockManagerCrew` at line 39; fixture at line 88; 5 ManagerCrew references; 0 IntakeFlow |
| `tests/test_whatsapp_service.py` | Tests for GBV confirmation flow | VERIFIED | `TestGBVConfirmation` class with 14 gbv_pending_confirm references; 0 IntakeFlow |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/api/v1/messages.py` | `src/agents/crews/manager_crew.py` | `await manager_crew.kickoff(context)` | WIRED | Confirmed at line 174; ManagerCrew imported at line 18 |
| `src/api/v1/reports.py` | `src/agents/crews/manager_crew.py` | `await manager_crew.kickoff(context)` | WIRED | Confirmed at line 79; ManagerCrew imported at line 17 |
| `src/services/whatsapp_service.py` | `src/agents/crews/manager_crew.py` | `await manager_crew.kickoff(context)` | WIRED | Confirmed at line 338; ManagerCrew imported at line 18 |
| `src/api/v1/whatsapp.py` | `src/services/whatsapp_service.py` | stable phone-based session_id | WIRED | `session_id = f"wa-{normalized_phone}"` at line 189; passed to `process_incoming_message()` at line 191 |
| `src/api/v1/crew_server.py` | `ConversationState.routing_phase` | gbv_pending_confirm intermediate state | WIRED | 6 references to gbv_pending_confirm; state written at lines 874, 884, 900, 945, 952 |
| `src/services/whatsapp_service.py` | `ConversationState.routing_phase` | gbv_pending_confirm intermediate state | WIRED | 3 references; state written at lines 279, 282, 358 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| RPT-01 | Plan 01 | Citizen can report service issues via WhatsApp using hybrid bot (guided intake + AI agent) | SATISFIED | WhatsApp webhook (whatsapp.py) routes through WhatsAppService which calls ManagerCrew.kickoff(); full intake pipeline functional. Session stable per phone for multi-turn conversations |
| RPT-07 | Plan 02 | GBV reports are automatically routed to the nearest SAPS police station based on geolocation | SATISFIED | Two-turn GBV confirmation gate in crew_server.py and whatsapp_service.py; citizen YES routes to GBVCrew and reports.py calls notify_saps(); reports.py line 205 explicitly triggers SAPS notification. Notes: geolocation routing is handled by existing saps_tool.py (pre-existing), confirmation gate is new |

No orphaned requirements — both RPT-01 and RPT-07 are covered by the plans and verified in the codebase.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/services/whatsapp_service.py` | 398 | `# TODO (Phase 8): Link uploaded media via tracking_number lookup` | INFO | Intentional deferral documented in SUMMARY.md — media linking when ticket_id is unavailable (ManagerCrew creates tickets internally). Not a blocker for this phase's goal |

No blocker or warning anti-patterns found. The single TODO is a known, documented deferral.

---

## Test Results

```
25 passed, 1 warning in 4.98s
```

- `tests/test_messages_api.py`: 8 tests passed (MockManagerCrew replaces MockIntakeFlow)
- `tests/test_whatsapp_service.py`: 17 tests passed (including 6 GBV confirmation async tests + 1 sync test)
- Warning: `test_gbv_confirmation_messages_have_emergency_numbers` is sync but marked with module-level `pytestmark=asyncio` — harmless, test passes correctly

---

## Human Verification Required

### 1. GBV Webhook End-to-End Flow via Real Twilio

**Test:** Send a WhatsApp message with GBV content from a registered test phone number via Twilio sandbox, then reply "yes" and verify SAPS notification fires.
**Expected:** First message gets confirmation prompt with 10111/0800 150 150. Reply "yes" routes to GBVCrew. SAPS notification logged.
**Why human:** Requires live Twilio webhook + Redis session persistence in staging environment.

### 2. Multi-Turn Session Persistence Across Messages

**Test:** Send two sequential WhatsApp messages from the same phone number. Verify the second message reuses the same session state (not a fresh session).
**Expected:** `session_id = wa-{phone}` ensures both messages load the same ConversationState from Redis.
**Why human:** Requires live Redis connection and real Twilio webhook delivery.

---

## Gaps Summary

No gaps. All 12 must-haves verified. The phase goal is achieved:

- The three broken IntakeFlow call sites (messages.py, reports.py, whatsapp_service.py) now call `ManagerCrew.kickoff()` directly, matching the working crew_server.py reference pattern.
- WhatsApp session_id uses stable phone-based key (`wa-{phone}`) instead of per-message (`wa-{MessageSid}`).
- GBV confirmation gate (`gbv_pending_confirm` state) prevents immediate SAPS routing until citizen explicitly confirms with YES/yebo/ja.
- All confirmation messages include SAPS 10111 and GBV Helpline 0800 150 150 in EN/ZU/AF.
- Test suite passes 25/25 tests with no IntakeFlow references remaining.
- Commits verified: 9ba0099, 458efc6, 5da9523, 3eb3e67.

---

_Verified: 2026-02-22_
_Verifier: Claude (gsd-verifier)_
