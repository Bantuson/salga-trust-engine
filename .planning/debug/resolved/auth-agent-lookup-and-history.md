---
status: resolved
trigger: "Investigate and fix two issues: lookup-phone-mismatch and auth-agent-no-history"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED both root causes — fixes applied and verified by reading output
test: Read fixed files and confirmed changes appear correctly in context
expecting: both bugs resolved
next_action: archive

## Symptoms

expected: (1) lookup_user_tool("+27821001001") finds the user created by create_supabase_user_tool. (2) On turn 2+, the auth agent reads conversation_history and continues from where it left off
actual: (1) Returns "No user found with phone: +27821001001" — Supabase stores "27821001001" (no + prefix) but lookup searched "+27821001001" (with prefix). (2) Agent always responds with welcome message ignoring history
errors: No errors — both were silent logic failures
reproduction: (1) create_supabase_user_tool("+27821001001", ...) then lookup_user_impl("+27821001001"). (2) Send "Register with phone +27821001001", get welcome, send "phone" — agent re-asked phone/email choice
started: Always been this way

## Eliminated

- hypothesis: create_supabase_user_tool strips the '+' prefix before storing
  evidence: Line 148-150 of auth_tool.py passes "+27821001001" unchanged. Supabase itself strips the + internally.
  timestamp: 2026-02-17T00:01:00Z

- hypothesis: Both create and lookup use same comparison so they'd match
  evidence: create passes "+27821001001" to Supabase which stores "27821001001". lookup compared user.phone == "+27821001001" but user.phone from list_users is "27821001001". Never matched.
  timestamp: 2026-02-17T00:01:00Z

- hypothesis: conversation_history is not passed to the agent at all
  evidence: AUTH_TASK_TEMPLATE line 58 includes {conversation_history} and build_auth_task_description fills it. Data IS in the task description. The problem was _NEW_USER_INSTRUCTION gave no directive to read it.
  timestamp: 2026-02-17T00:01:00Z

## Evidence

- timestamp: 2026-02-17T00:01:00Z
  checked: auth_tool.py _lookup_user_impl lines 193-196
  found: Comparison `getattr(user, "phone", None) == phone_or_email` where phone_or_email is "+27821001001". Supabase admin list_users() returns user.phone as "27821001001" (no + prefix).
  implication: Lookup always missed phone users because of the + prefix mismatch.

- timestamp: 2026-02-17T00:01:00Z
  checked: auth_tool.py _create_supabase_user_impl line 148-150
  found: `user_data["phone"] = phone_or_email` passes "+27821001001" to Supabase. Supabase stores without the + prefix. Mismatch invisible at creation time.
  implication: Fix normalizes by stripping "+" from both sides before comparison.

- timestamp: 2026-02-17T00:01:00Z
  checked: auth.py _NEW_USER_INSTRUCTION (lines 70-80) and AUTH_TASK_TEMPLATE (lines 49-67)
  found: _NEW_USER_INSTRUCTION unconditionally started at STEP 1 with no instruction to read conversation_history first. The template included conversation_history as a data field but task_instruction gave no guidance on using it.
  implication: LLM followed explicit step-by-step instructions over the passive data field. Fix added RESUME CHECK block at top.

## Resolution

root_cause: |
  BUG 1 (phone mismatch): _lookup_user_impl compared user.phone (Supabase-stored, no + prefix,
  e.g. "27821001001") to phone_or_email (E.164 with + prefix, e.g. "+27821001001").
  Supabase's auth.admin.list_users() returns phone numbers without the leading "+".
  The string comparison always returned False.

  BUG 2 (history ignored): _NEW_USER_INSTRUCTION gave unconditional step-by-step
  instructions starting at STEP 1, with no directive to check conversation_history first.
  The LLM followed the explicit instructions and ignored the history field.

fix: |
  BUG 1 (src/agents/tools/auth_tool.py): Replaced exact phone comparison with
  normalized comparison. Both stored_phone and lookup phone are stripped of leading "+"
  before comparing (lstrip("+")). This handles both "27821001001" and "+27821001001"
  from either side symmetrically.

  BUG 2 (src/agents/prompts/auth.py): Added RESUME CHECK block at the top of
  _NEW_USER_INSTRUCTION that explicitly instructs the agent to read conversation_history
  first. If history is "(none)" or empty → start at STEP 1. If not empty → determine
  which step is complete and CONTINUE from the NEXT step with concrete examples.

verification: |
  Read both files after changes — confirmed:
  - auth_tool.py: stored_normalized = stored_phone.lstrip("+"), lookup_normalized =
    phone_or_email.lstrip("+"), comparison is stored_normalized == lookup_normalized
  - auth.py: RESUME CHECK block appears before STEP 1 with conditional logic for
    fresh vs. resumed conversations

files_changed:
  - src/agents/tools/auth_tool.py
  - src/agents/prompts/auth.py
