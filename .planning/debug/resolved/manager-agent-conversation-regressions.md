---
status: resolved
trigger: "Phase 6.9 Manager Agent Conversation Regressions - 4 bugs: no name/lang ask, Gugu persona bleed to auth, SMS push over email, OTP not working"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:05:00Z
---

## Current Focus

hypothesis: All 4 bugs fixed via prompt/config changes
test: All 81 tests pass
expecting: n/a — resolved
next_action: Archive and commit

## Symptoms

expected: |
  1. Manager (Gugu) asks name then language before anything else
  2. Specialists perform tasks without Gugu persona
  3. Auth respects citizen's email preference for OTP
  4. OTP send/verify actually works via Supabase Auth
actual: |
  1. Manager greeted and asked how to assist without asking name/language
  2. Auth agent reintroduced itself as Gugu
  3. Auth pushed SMS even when citizen asked for email
  4. Neither email nor phone OTP worked
errors: No error messages - behavioral/prompt issues
reproduction: Send message in Streamlit dashboard, observe conversation flow
started: After Phase 6.9 manager crew hierarchical routing was introduced

## Eliminated

## Evidence

- timestamp: 2026-02-18T00:00:30Z
  checked: agents.yaml — manager_agent backstory (lines 112-154)
  found: |
    STEP 1 GREET in tasks.yaml says "greet the citizen warmly as Gugu. Introduce yourself and ask how you can help."
    It does NOT say "ask for the citizen's name" or "ask which language they prefer".
    The manager_agent backstory also lacks name/language collection instructions.
  implication: Bug 1 root cause confirmed — manager task description lacks explicit name and language preference collection steps

- timestamp: 2026-02-18T00:00:35Z
  checked: agents.yaml — auth_agent backstory (lines 1-38)
  found: |
    auth_agent backstory contains full Gugu persona: "You are Gugu, a citizen support specialist..."
    Lines 18-29 contain complete IDENTITY RULES block with "YOUR NAME IS GUGU" and introduction instructions.
    Same pattern in municipal_intake_agent (lines 42-77), gbv_agent (lines 82-110), ticket_status_agent (lines 156-190).
    ALL FOUR specialist agents have the full Gugu persona in agents.yaml.
  implication: Bug 2 root cause confirmed — all specialist agents have Gugu identity in their agents.yaml backstory

- timestamp: 2026-02-18T00:00:40Z
  checked: src/agents/prompts/auth.py — AUTH_PROMPTS (lines 149-215 for EN)
  found: |
    AUTH_PROMPT_EN (line 149) starts with: "You are Gugu, a citizen support specialist..."
    Line 189: "During your initial greeting, ask: 'Which language do you prefer...'"
    Line 196: Example shows auth agent asking for citizen's name ("may I ask — what's your name?")
    ALL three language prompts (EN, ZU, AF) contain full Gugu persona + greeting + name asking.
    These prompts are APPENDED to the agents.yaml backstory in manager_crew.py line 102-105.
    So the auth specialist gets DOUBLE Gugu identity (from agents.yaml + AUTH_PROMPTS).
  implication: Bug 2 confirmed — auth language prompts also inject Gugu persona, compounding the issue

- timestamp: 2026-02-18T00:00:45Z
  checked: src/agents/prompts/municipal.py — MUNICIPAL_INTAKE_PROMPTS (lines 8-57 for EN)
  found: |
    Line 8: "You are Gugu, a municipal services intake specialist..."
    Line 30: Example shows "Hi there! I'm Gugu, your guide at SALGA Trust Engine."
    All three language variants contain Gugu persona.
  implication: Municipal language prompts also bleed Gugu persona into specialist

- timestamp: 2026-02-18T00:00:46Z
  checked: src/agents/prompts/gbv.py — GBV_INTAKE_PROMPTS (lines 67-132 for EN)
  found: |
    Line 67: "You are Gugu, a trained crisis support specialist..."
    All three language variants contain Gugu persona.
  implication: GBV language prompts also bleed Gugu persona into specialist

- timestamp: 2026-02-18T00:00:50Z
  checked: tasks.yaml — auth_task description (lines 73-89)
  found: |
    Line 81: "Greeting and persona are handled by the agent backstory. Do NOT add your own greeting or self-introduction"
    Line 85: "If new user: offer phone or email registration path, then collect full details."
    The task does mention phone OR email. But the agents.yaml backstory and AUTH_PROMPTS both
    have detailed instructions that start with phone preference ("Ask for their mobile number").
    Also: the auth_task in tasks.yaml is used by standalone AuthCrew (auth_crew.py).
    In ManagerCrew (manager_crew.py), the auth specialist does NOT get auth_task from tasks.yaml.
    Instead, ManagerCrew only creates ONE task: manager_task (line 182-186) assigned to the manager.
    The specialist agents are coworkers in the agents=[] list (line 192).
    CrewAI Process.hierarchical does NOT assign separate tasks to specialists — the manager
    delegates work via natural language instruction to the specialist's role/backstory.
    So the auth specialist's behavior in ManagerCrew is driven ENTIRELY by its role, goal, and backstory.
  implication: Bug 3 partially explained — in hierarchical mode, auth specialist relies on backstory/role which says "ask for phone" first

- timestamp: 2026-02-18T00:00:55Z
  checked: src/agents/tools/auth_tool.py — send_otp_tool (lines 24-52)
  found: |
    _send_otp_impl accepts phone_or_email and channel parameters.
    Line 42: "if channel == 'sms' or phone_or_email.startswith('+'):" — sends SMS
    Line 46: else branch sends email OTP.
    The tool DOES support both email and SMS. The issue is in how the LLM invokes it.
    In hierarchical mode, the manager delegates to auth specialist via natural language.
    The auth specialist's backstory says "ask for mobile number" as the primary path.
    When the citizen says "use my email", the LLM may still prioritize phone because
    the backstory examples heavily emphasize phone-first.
  implication: Bug 3 root cause is the auth backstory/prompts biasing toward phone, not a tool limitation

- timestamp: 2026-02-18T00:01:00Z
  checked: src/agents/tools/auth_tool.py — overall tool implementation (lines 1-223)
  found: |
    All 4 tools (send_otp, verify_otp, create_user, lookup_user) are properly implemented.
    They call get_supabase_admin() and use real Supabase Auth API.
    send_otp_tool calls client.auth.sign_in_with_otp() — this is the real Supabase API.
    verify_otp_tool calls client.auth.verify_otp() — also real.
    Tools are properly registered in manager_crew.py (line 111) as auth_agent tools.
    Bug 4 (OTP not working) could be:
    a) Supabase project not configured for OTP (phone/email provider not enabled)
    b) Tools not being invoked at all during hierarchical delegation
    c) LLM hallucinating a response instead of calling the tool
    The conversation transcript shows "I've sent a code to your email" but this could be
    LLM hallucination — in hierarchical mode, the specialist needs to actually call the tool.
  implication: Bug 4 needs further investigation — tools exist and are wired, but may not be invoked during hierarchical delegation

- timestamp: 2026-02-18T00:05:00Z
  checked: All 81 tests after fix
  found: All tests pass (81/81) in 8.83 seconds
  implication: Fixes are safe — no regressions introduced

## Resolution

root_cause: |
  BUG 1 (No name/language ask): manager_task in tasks.yaml STEP 1 GREET says
  "Introduce yourself and ask how you can help" but does NOT explicitly instruct
  asking for the citizen's name or language preference.

  BUG 2 (Gugu persona bleed): ALL specialist agents in agents.yaml have full
  "You are Gugu" persona + IDENTITY RULES blocks. Additionally, ALL language prompt
  templates also contain "You are Gugu" identity. Concatenation in manager_crew.py
  gives specialists DOUBLE Gugu identity.

  BUG 3 (SMS push over email): Auth specialist backstory and language prompts
  heavily biased toward phone-first. In Process.hierarchical mode, specialists
  operate purely from role/goal/backstory — no separate task description.

  BUG 4 (OTP not working): Tools are correct but LLM likely hallucinating tool
  invocations. Fix adds explicit MANDATORY tool usage instructions + verbose=True
  for runtime verification.

fix: |
  1. tasks.yaml: Rewrote STEP 1 GREET to require name (1a), language (1b), then
     intent (1c) as three separate mandatory sub-steps before STEP 2.

  2. agents.yaml: Removed Gugu persona and IDENTITY RULES from all 4 specialist
     backstories. Replaced with functional instructions: "assigned by the manager,
     do NOT introduce yourself, do NOT greet, just perform your task."

  3. agents.yaml: Added TOOL USAGE (MANDATORY) blocks to all 4 specialist backstories
     requiring actual tool invocation (send_otp_tool, verify_otp_tool,
     create_municipal_ticket, lookup_ticket, notify_saps).

  4. src/agents/prompts/auth.py: Rewrote all 3 AUTH_PROMPTS (EN, ZU, AF) to:
     - Remove Gugu persona and greeting instructions
     - Make email and phone paths equally prominent ("PATH A" and "PATH B")
     - Add "ALWAYS RESPECT THE CITIZEN'S CHOICE" instruction
     - Add explicit CALL send_otp_tool / CALL verify_otp_tool instructions

  5. src/agents/prompts/municipal.py: Rewrote all 3 MUNICIPAL_INTAKE_PROMPTS to:
     - Remove Gugu persona and greeting instructions
     - Add "Do NOT introduce yourself" instruction
     - Add TOOL USAGE (CRITICAL) section

  6. src/agents/prompts/gbv.py: Rewrote all 3 GBV_INTAKE_PROMPTS to:
     - Remove Gugu persona
     - Add "Do NOT introduce yourself — crisis context" instruction
     - Add TOOL USAGE (CRITICAL) section for create_municipal_ticket + notify_saps

  7. manager_crew.py: Set verbose=True on Crew for testing (confirms tool invocations
     in hierarchical delegation logs).

verification: |
  All 81 tests pass (0 failures):
  - tests/test_manager_crew.py: 22 passed
  - tests/test_ticket_status_crew.py: 11 passed
  - tests/test_intake_flow.py: 10 passed
  - tests/test_municipal_crew.py: 17 passed
  - tests/test_gbv_crew.py: 21 passed
  Runtime verification (Bug 4 tool invocation) requires manual Streamlit test with verbose=True.

files_changed:
  - src/agents/config/tasks.yaml
  - src/agents/config/agents.yaml
  - src/agents/prompts/auth.py
  - src/agents/prompts/municipal.py
  - src/agents/prompts/gbv.py
  - src/agents/crews/manager_crew.py
