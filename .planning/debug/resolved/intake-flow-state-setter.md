---
status: resolved
trigger: "IntakeFlow.state property has no setter, so crew_server.py line ~465 `flow.state = IntakeState(...)` fails with 'property state of IntakeFlow object has no setter'"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:05:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: RESOLVED
test: All 35 affected unit tests pass after fix.
expecting: N/A
next_action: N/A — archived

## Symptoms

expected: When session_override=active, the crew server should create an IntakeFlow, set its state, and run it to process a municipal report via the intake agent pipeline.
actual: `flow.state = IntakeState(...)` raises AttributeError because state is a read-only property on IntakeFlow (a CrewAI Flow subclass).
errors: "property 'state' of 'IntakeFlow' object has no setter"
reproduction: POST to /api/v1/chat with session_override=active
started: First time testing this code path (active sessions weren't reachable before adding the override)

## Eliminated

- hypothesis: State might be writable via a subclass setter added in IntakeFlow
  evidence: IntakeFlow.__init__ has no state property or setter defined. The base class Flow has no setter either. Flow.state is purely @property returning self._state.
  timestamp: 2026-02-17T00:01:00Z

## Evidence

- timestamp: 2026-02-17T00:00:30Z
  checked: crewai.flow.flow.Flow source (crewai 1.8.1)
  found: `state` is a @property returning self._state with NO @state.setter defined (lines 489-491 of Flow class)
  implication: Any direct assignment `flow.state = ...` raises AttributeError

- timestamp: 2026-02-17T00:00:45Z
  checked: Flow.__init__ and _initialize_state
  found: Flow.__init__ accepts **kwargs and passes them to self._initialize_state(kwargs); _state is set in __init__ via self._state = self._create_initial_state()
  implication: Two valid approaches to set state post-construction: (1) assign flow._state directly, or (2) pass fields as kwargs to constructor

- timestamp: 2026-02-17T00:01:00Z
  checked: IntakeFlow.__init__ signature
  found: IntakeFlow.__init__ only accepts redis_url and llm — no **kwargs forwarding — so kwargs approach requires changes to IntakeFlow too
  implication: Safest minimal fix is flow._state = IntakeState(...)

- timestamp: 2026-02-17T00:02:00Z
  checked: grep for flow.state = across entire src/ tree
  found: Same broken pattern in 4 files: crew_server.py, whatsapp_service.py, reports.py, messages.py
  implication: All four must be fixed

- timestamp: 2026-02-17T00:04:00Z
  checked: tests/test_messages_api.py MockIntakeFlow
  found: MockIntakeFlow used self.state = None (plain attribute), so production's flow._state = intake_state was setting _state but kickoff() read self.state (which was None) causing 'NoneType has no attribute language'
  implication: MockIntakeFlow.state must be a @property returning _state to match real Flow behaviour

## Resolution

root_cause: CrewAI Flow.state is a @property with no setter (crewai 1.8.1). All four call sites used `flow.state = IntakeState(...)` which Python disallows on a read-only property. The underlying private attribute is flow._state.

fix: |
  1. In all four production files, replaced `flow.state = <state>` with `flow._state = <state>` (direct assignment to the private backing attribute).
  2. In tests/test_messages_api.py, updated MockIntakeFlow to store state in self._state and expose it via a @property state getter, matching the real Flow interface so that production-code assignments to _state are visible through the property.

verification: |
  - 35 unit tests pass across test_intake_flow, test_messages_api, test_reports_api, test_whatsapp_service
  - 0 failures introduced
  - Confirmed no remaining `flow.state =` assignments in src/ tree

files_changed:
  - src/api/v1/crew_server.py
  - src/api/v1/messages.py
  - src/api/v1/reports.py
  - src/services/whatsapp_service.py
  - tests/test_messages_api.py
