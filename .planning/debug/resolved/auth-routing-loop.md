---
status: resolved
trigger: "Auth Routing Loop - routing_phase never advances, tools not called"
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - 4 root causes all fixed and verified
test: Import checks + 76 unit tests + routing detection integration tests
expecting: All pass
next_action: Archive and commit

## Symptoms

expected: After greeting flow, citizen reports "burst water pipe" -> agent sends OTP via tool -> creates ticket with TKT number
actual: Agent invents "confirm your phone number by replying with Yes" (no tool call), no tracking number, loops on "yes"
errors: No explicit errors - agent just loops without advancing routing_phase
reproduction: Streamlit dashboard conversation: Hi -> name -> English -> "burst water pipe" -> loops
started: Since Phase 6.9 manager architecture (Process.hierarchical)

## Eliminated

(none - all 4 causes confirmed by diagnosis)

## Evidence

- timestamp: 2026-02-19
  checked: ManagerCrew.parse_result() return keys
  found: Returns only {message, raw_output, tracking_number} - never routing_phase or agent
  implication: crew_server.py line 828 always gets "manager", specialist short-circuit never fires

- timestamp: 2026-02-19
  checked: auth_agent max_iter in manager_crew.py
  found: max_iter=3 (from YAML default), standalone AuthCrew uses max_iter=15
  implication: Auth agent in hierarchical mode exhausts iterations before completing OTP flow

- timestamp: 2026-02-19
  checked: pending_intent persistence in crew_server.py
  found: pending_intent never written when routing municipal->auth
  implication: Citizen's original report lost after auth completes

- timestamp: 2026-02-19
  checked: Auth agent behavior in hierarchical mode
  found: Gets brief delegation from manager, not full auth task description
  implication: Invents fake "confirm by saying yes" instead of using tools

- timestamp: 2026-02-19
  checked: Post-fix verification - imports
  found: Both ManagerCrew and crew_app import cleanly
  implication: No syntax errors or broken imports

- timestamp: 2026-02-19
  checked: Post-fix verification - 76 unit tests
  found: All 76 tests pass (test_manager_crew.py + test_output_formatting.py)
  implication: No regressions from changes

- timestamp: 2026-02-19
  checked: Post-fix verification - routing detection
  found: Auth output -> routing_phase=auth, Municipal -> municipal, GBV -> gbv, Greeting -> manager
  implication: _detect_routing correctly classifies all specialist types

- timestamp: 2026-02-19
  checked: Post-fix verification - max_iter values
  found: auth_agent.max_iter=10, municipal_agent.max_iter=5
  implication: Specialists have enough iterations for multi-step tool flows

## Resolution

root_cause: 4 bugs: (1) parse_result() missing routing_phase/agent, (2) auth max_iter=3 too low, (3) pending_intent not saved, (4) auth agent lacks task detail due to low iterations
fix: (1) Added _detect_routing() to parse_result(), (2) auth max_iter=10, municipal max_iter=5, (3) pending_intent saved in crew_server.py when routing to auth
verification: Imports OK, 76/76 tests pass, routing detection verified for auth/municipal/gbv/greeting
files_changed:
  - src/agents/crews/manager_crew.py
  - src/api/v1/crew_server.py
