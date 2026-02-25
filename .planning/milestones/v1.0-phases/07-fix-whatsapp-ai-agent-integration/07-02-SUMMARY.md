---
phase: 07-fix-whatsapp-ai-agent-integration
plan: 02
subsystem: agent-routing
tags: [gbv-safety, confirmation-gate, crewai, whatsapp, tests]
dependency_graph:
  requires: [07-01]
  provides: [gbv-confirmation-state-machine, updated-test-suite-for-manager-crew]
  affects: [src/api/v1/crew_server.py, src/services/whatsapp_service.py, tests/test_messages_api.py, tests/test_whatsapp_service.py]
tech_stack:
  added: []
  patterns: [gbv_pending_confirm two-turn state machine, GBV_CONFIRMATION_MESSAGES module-level constant, _handled sentinel routing_phase]
key_files:
  created: []
  modified:
    - src/api/v1/crew_server.py
    - src/services/whatsapp_service.py
    - tests/test_messages_api.py
    - tests/test_whatsapp_service.py
decisions:
  - "GBV confirmation gate uses '_handled' sentinel routing_phase to prevent double-routing after YES/NO response"
  - "GBV_CONFIRMATION_MESSAGES defined at crew_server module level so whatsapp_service can import it"
  - "whatsapp_service GBV gate checks current_routing != 'gbv' before entering confirm state to prevent re-triggering on already-confirmed sessions"
  - "Ambiguous responses resend the same confirmation message (routing_phase stays gbv_pending_confirm)"
  - "Module-level pytestmark=asyncio in test_whatsapp_service.py causes a harmless warning on sync test_gbv_confirmation_messages_have_emergency_numbers — test still passes"
metrics:
  duration: 10.7m (643s)
  completed: 2026-02-22
  tasks: 2
  files: 4
---

# Phase 07 Plan 02: GBV Confirmation State Machine Summary

## One-liner

Two-turn GBV confirmation gate (gbv_pending_confirm intermediate state) prevents immediate SAPS routing until citizen explicitly confirms with YES/yebo/ja, plus updated test suite replacing removed IntakeFlow mocks with ManagerCrew mocks.

## What Was Built

### Task 1: GBV Confirmation State Machine

**crew_server.py changes:**

Added `GBV_CONFIRMATION_MESSAGES` dict at module level with trilingual confirmation messages (EN/ZU/AF). Each message includes both emergency numbers (SAPS 10111 and GBV Command Centre 0800 150 150).

Added two confirmation gate locations in the `chat()` function:

1. **Start-of-turn gate** (before specialist short-circuit): If `routing_phase == "gbv_pending_confirm"`, handle YES/NO/ambiguous and set `routing_phase = "_handled"` or advance to `"gbv"`. The `_handled` sentinel prevents the short-circuit and manager path from re-routing.

2. **After-ManagerCrew interception**: If ManagerCrew returns `routing_phase == "gbv"` on a `"manager"` turn (first detection), intercept by setting `new_routing_phase = "gbv_pending_confirm"` and replacing agent reply with the trilingual confirmation message.

Also updated the specialist short-circuit guard from `if routing_phase != "manager"` to `if routing_phase not in ("manager", "_handled")` so the handled confirmation responses bypass crew routing entirely.

**whatsapp_service.py changes:**

Imported `GBV_CONFIRMATION_MESSAGES` from `crew_server`.

Added two confirmation gate locations in `process_incoming_message()`:

1. **Start-of-turn gate**: After getting conversation state, checks `current_routing == "gbv_pending_confirm"`. YES advances state to `"gbv"` and continues. NO changes state to `"municipal"` and returns early. Ambiguous resends confirmation and returns early.

2. **After-ManagerCrew interception**: After `manager_crew.kickoff()`, checks if `routing_phase == "gbv"` and `current_after_crew != "gbv"`. If so, sets `conversation_state.routing_phase = "gbv_pending_confirm"` and returns the confirmation message early.

### Task 2: Test File Updates

**test_messages_api.py:**

- Removed `MockIntakeFlow` class entirely (IntakeFlow removed in Plan 01, no longer referenced in messages.py)
- Added `MockManagerCrew` class with `async kickoff()` matching ManagerCrew output format
- Replaced `mock_intake_flow` fixture with `mock_manager_crew` fixture that patches `ManagerCrew` and `sanitize_reply`
- Updated all test methods to use `mock_manager_crew` fixture
- All 8 existing tests pass

**test_whatsapp_service.py:**

- Added `_make_mock_conv_manager()` helper for configurable state mocking
- Replaced all `IntakeFlow` patches with `ManagerCrew` patches matching the new service code
- Rewrote `test_process_incoming_message_text`, `test_process_incoming_message_with_media`, `test_process_message_flow_exception`, `test_process_message_with_ticket_and_tracking_number` to use `ManagerCrew` mock
- Added `TestGBVConfirmation` class with 6 new async tests + 1 sync test:
  - `test_gbv_first_signal_enters_confirmation`: ManagerCrew GBV -> gbv_pending_confirm state, response has emergency numbers
  - `test_gbv_confirmed_routes_to_gbv_crew`: YES -> routing_phase=gbv
  - `test_gbv_declined_routes_to_municipal`: NO -> routing_phase=municipal, helpful response
  - `test_gbv_ambiguous_resends_confirmation`: "maybe" -> emergency numbers resent, stays pending_confirm
  - `test_gbv_confirmation_zulu_language`: ZU language -> YEBO in response
  - `test_gbv_yebo_confirm_accepted`: "yebo" recognized as YES, routing_phase=gbv
  - `test_gbv_confirmation_messages_have_emergency_numbers`: static check, all 3 lang variants have 10111 + 0800 150 150

Total: 25 tests pass (8 messages_api + 17 whatsapp_service).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 5da9523 | feat(07-02): add GBV confirmation state machine to crew_server and whatsapp_service |
| Task 2 | 3eb3e67 | test(07-02): update test files for ManagerCrew pipeline and GBV confirmation |

## Decisions Made

1. **`_handled` sentinel for crew_server routing gate**: After a YES/NO/ambiguous confirmation response is generated in the `gbv_pending_confirm` gate, setting `routing_phase = "_handled"` prevents the specialist short-circuit and manager path from running again on the same turn. This keeps the gate logic clean and readable without adding boolean flags.

2. **`GBV_CONFIRMATION_MESSAGES` at module level in crew_server**: Both crew_server.py and whatsapp_service.py need the confirmation messages. Rather than duplicating the dict, whatsapp_service imports it from crew_server. This is the natural import direction since crew_server is the primary intake handler.

3. **`current_routing != "gbv"` check in whatsapp_service**: After ManagerCrew kickoff, the gate checks if the current state's routing_phase is not already "gbv" before entering pending_confirm. This prevents re-triggering the confirmation on already-confirmed GBV sessions where ManagerCrew might still return `routing_phase="gbv"`.

4. **Ambiguous responses stay in gbv_pending_confirm**: When a citizen responds ambiguously (not YES or NO), the state stays in `gbv_pending_confirm` and the confirmation message is resent. This ensures citizens have a clear opportunity to confirm or decline.

## Deviations from Plan

### Auto-fixed Issues

**[Rule 1 - Bug] whatsapp_service GBV gate uses `input_result.sanitized_message` not `message_body`**
- Found during: Task 1 (whatsapp_service.py)
- Issue: The plan pseudocode used `message_body` for the YES/NO check but by Step 4, the service is already past guardrails and using `input_result.sanitized_message`
- Fix: Used `input_result.sanitized_message` for the YES/NO word check (consistent with the rest of the function)
- Files modified: src/services/whatsapp_service.py
- Commit: 5da9523

**[Rule 1 - Bug] test_whatsapp_service.py IntakeFlow tests completely replaced (not just updated)**
- Found during: Task 2 (test_whatsapp_service.py)
- Issue: The old tests patched `src.services.whatsapp_service.IntakeFlow` which no longer exists in the service after Plan 01 changes. The tests would fail with AttributeError/ImportError at collection time.
- Fix: Rewrote all tests that used `IntakeFlow` to use `ManagerCrew` matching the current service implementation. Added `_make_mock_conv_manager()` helper for DRY state setup.
- Files modified: tests/test_whatsapp_service.py
- Commit: 3eb3e67

## Verification Results

All plan success criteria met:

1. `pytest tests/test_messages_api.py tests/test_whatsapp_service.py -x -q` — 25 passed, 1 warning
2. `grep -rn "gbv_pending_confirm" src/` — found in crew_server.py (6 matches) and whatsapp_service.py (3 matches)
3. `grep -rn "10111" src/api/v1/crew_server.py` — found in GBV_CONFIRMATION_MESSAGES (3 occurrences for EN/ZU/AF + 2 in fallback replies)
4. `grep -rn "IntakeFlow\|MockIntakeFlow" tests/test_messages_api.py` — 0 matches
5. GBV flow works: first GBV signal -> gbv_pending_confirm -> citizen YES -> GBVCrew (routing_phase=gbv) OR citizen NO -> municipal routing
6. All confirmation messages include both emergency numbers in all 3 languages verified by test

## Self-Check: PASSED

Files exist:
- FOUND: src/api/v1/crew_server.py
- FOUND: src/services/whatsapp_service.py
- FOUND: tests/test_messages_api.py
- FOUND: tests/test_whatsapp_service.py

Commits exist:
- FOUND: 5da9523
- FOUND: 3eb3e67
