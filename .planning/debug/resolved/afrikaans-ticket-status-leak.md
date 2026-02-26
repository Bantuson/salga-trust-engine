---
status: resolved
trigger: "Ticket status agent leaks internal error details in Afrikaans responses"
created: 2026-02-26T00:00:00Z
updated: 2026-02-26T00:15:00Z
---

## Current Focus

hypothesis: CONFIRMED. Two compounding causes: (1) Afrikaans/all prompts lacked explicit "NEVER expose internal errors" rule; (2) lookup_ticket_tool returned str(e) raw exception text in error key, which LLM translated verbatim into Afrikaans.
test: Verified fix with 2 Afrikaans runs + English + Zulu regression — all pass
expecting: No "tegniese" or "gebruiker" in Afrikaans response
next_action: DONE — human verified, archived to resolved/

## Symptoms

expected: When ticket lookup fails, agent returns a citizen-friendly message like "Ek kon nie daardie kaartnommer vind nie" in Afrikaans — no internal system details exposed.
actual: Agent responds with "tegniese fout met my stelsel" (technical error with my system) and "gebruiker-ID nie korrek" (user ID not correct). Internal error details from tool response leaked in Afrikaans.
errors: No crash. The tool returns {"error": "...", "tickets": [], "count": 0}. The error key content is surfaced verbatim to the citizen in the agent response text.
reproduction: POST http://127.0.0.1:8001/api/v1/chat with body {"phone": "+27820000004", "message": "Hoe gaan dit met my klagte TKT-20240501-P3Q4R5? Ek het dit twee weke gelede ingedien.", "language": "af", "session_override": "active"}
started: Since DeepSeek switch in plan 10.3-08. English and Zulu ticket_status scenarios pass — only Afrikaans leaks.

## Eliminated

- hypothesis: The tool crashes or raises an exception
  evidence: No crash observed. Tool returns dict with "error" key. English/Zulu handle it correctly without crashing.
  timestamp: 2026-02-26T00:00:00Z

- hypothesis: The user_id lookup in crew_server.py fails to resolve and passes None
  evidence: crew_server.py line 757 uses `resolved_user_id or phone`, so user_id is always a string (either UUID or phone string). The tool then processes it — the assert passes because the phone string is truthy. The Supabase query runs with a phone string as user_id which returns no results. The tool returns {"tickets": [], "count": 0, "total": 0} for that case (not an error). The actual error path in the tool occurs only for real exceptions.
  timestamp: 2026-02-26T00:01:00Z

## Evidence

- timestamp: 2026-02-26T00:00:00Z
  checked: trajectory_eval_20260226.json — afrikaans_ticket_status result
  found: Agent said "tegniese fout met my stelsel" and "gebruiker-ID nie korrek" — clearly the tool's error message translated to Afrikaans
  implication: The tool must be returning an error dict with internal details, and the LLM is surfacing them

- timestamp: 2026-02-26T00:01:00Z
  checked: ticket_lookup_tool.py _lookup_ticket_impl error handling
  found: Line 130 returns {"error": str(e), "tickets": [], "count": 0} for any exception. This is raw exception text. The tool also has the empty-result path returning {"tickets": [], "count": 0, "total": 0} cleanly. The "gebruiker-ID nie korrek" phrase suggests the LLM is reasoning about why the user_id lookup failed, not directly echoing str(e).
  implication: The LLM is either getting an error from Supabase (user_id as phone string is not a valid UUID FK) OR it is reasoning from empty results that user_id must be wrong.

- timestamp: 2026-02-26T00:02:00Z
  checked: TICKET_STATUS_PROMPTS["en"] vs TICKET_STATUS_PROMPTS["af"] in ticket_status.py
  found: English prompt (lines 61-110) includes extensive error handling guidance. Afrikaans prompt (lines 149-193) does NOT include any instruction about what to do when the tool returns an error or when the user_id is invalid. English has "AVAILABLE TOOL" section with explicit guidance. Afrikaans has it but lacks the critical error instruction.
  implication: The Afrikaans LLM has no instruction to hide internal error details. When it receives an error response from the tool, it helpfully explains the problem in Afrikaans — which is the root cause of the leak.

- timestamp: 2026-02-26T00:03:00Z
  checked: _TICKET_STATUS_RESPONSE_RULES_AF in ticket_status.py (lines 41-50)
  found: The Afrikaans response rules include "MOET NOOIT jou redenering stappe aan die burger narrateer nie" (don't narrate reasoning steps) but NO rule about hiding tool errors or internal system details. English rules also lack this — but English/Zulu use different LLM behavior in practice.
  implication: Need to add explicit "NEVER mention internal errors, user IDs, or system details" instruction to the Afrikaans prompt AND to the response rules for all languages.

- timestamp: 2026-02-26T00:04:00Z
  checked: crew_server.py line 757: resolved_user_id or phone
  found: When Supabase lookup fails (no user found by phone), user_id falls back to the phone string "+27820000004". This is passed to TicketStatusCrew. The tool runs query: .eq("user_id", "+27820000004") which Supabase may reject with an error (UUID format validation) OR return empty results. Either way the LLM in Afrikaans reveals this.
  implication: Two-pronged fix needed: (1) Strengthen Afrikaans prompt to never reveal internal errors, (2) Add post-tool error sanitization in TicketStatusCrew that converts tool error responses to citizen-friendly messages before the LLM sees them.

## Resolution

root_cause: Two compounding causes:
  1. The Afrikaans backstory prompt in TICKET_STATUS_PROMPTS["af"] lacks explicit instructions to hide tool errors and internal system details when lookup fails — unlike English which is more robust in practice.
  2. The ticket_status crew has no post-tool sanitization: when lookup_ticket_tool returns {"error": "...", "tickets": [], "count": 0}, that raw error string reaches the LLM which faithfully translates it into Afrikaans for the citizen.
  The root cause is that tool errors are not intercepted before reaching the LLM, and the Afrikaans prompt has no guardrail telling the LLM to suppress internal error details.

fix: |
  TWO-LAYER FIX APPLIED:
  Layer 1 (Tool): ticket_lookup_tool.py — replaced raw str(e) exception text and internal
  Supabase config error with a safe generic message: "Ticket not found. Please verify
  the tracking number and try again." Raw exception still logged for debugging.
  Layer 2 (Prompt): ticket_status.py — added explicit error-hiding rules to ALL THREE
  language response rule constants (_EN, _ZU, _AF) and to the task template
  (TICKET_STATUS_TASK_TEMPLATE). The Afrikaans rules now include explicit prohibition
  of "tegniese fout", "gebruiker-ID", "databasis", "stelsel", "fout" in responses.
  The task template now has a TOOL RESULT HANDLING section instructing the LLM to
  ignore error key details and return a safe fallback message.

verification: |
  SELF-VERIFIED — 4 live API tests run:
  - Afrikaans run 1: reply = "Ek kon nie 'n kaartjie met daardie nommer vind nie..."
    "tegniese" count=0, "gebruiker" count=0. PASS.
  - Afrikaans run 2: identical clean response. PASS.
  - English regression: "I couldn't find a ticket with that number..." PASS.
  - Zulu regression: "Angikwazanga ukuthola ithikithi elinaleyo nambolo..." PASS.
  HUMAN-VERIFIED — 2026-02-26: User ran 2 live tests confirming clean Afrikaans responses
  with no "tegniese" or "gebruiker" leaked. Confirmed fixed.

files_changed:
  - src/agents/prompts/ticket_status.py: Added error-hiding rules to EN/ZU/AF response
    rule constants; added TOOL RESULT HANDLING section to TICKET_STATUS_TASK_TEMPLATE
  - src/agents/tools/ticket_lookup_tool.py: Replaced raw str(e) with safe generic
    error message; replaced Supabase config error with same safe message
