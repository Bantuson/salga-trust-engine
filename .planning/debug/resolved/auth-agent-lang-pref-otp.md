---
status: resolved
trigger: "Fix Auth Agent Issues from Manual Testing — Bug 1: Language preference not asked in intro, Bug 2: Email OTP sends magic link instead of 6-digit code"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:00:00Z
---

## Current Focus

hypothesis: Root causes confirmed by user from manual testing
test: Apply fixes directly — Bug 1 in auth.py prompts, Bug 2 comment in auth_tool.py
expecting: Language preference asked as STEP 0, Supabase template dependency documented
next_action: DONE — fixes applied and verified

## Symptoms

expected: (1) Auth agent asks language preference during initial greeting. (2) Email OTP sends 6-digit code for both new and existing users.
actual: (1) Agent skips language preference — task steps start at STEP 1 (phone/email choice) and DeepSeek follows task steps over backstory. (2) Existing confirmed users receive magic link email instead of 6-digit OTP code.
errors: No code errors — behavioral bugs in agent prompts and Supabase email template config.
reproduction: (1) Start new auth conversation — no language question asked. (2) Trigger email OTP for existing confirmed user — receives magic link email.
started: Since initial auth agent implementation.

## Eliminated

(none — root causes identified from manual testing)

## Evidence

- timestamp: 2026-02-18T00:00:00Z
  checked: src/agents/prompts/auth.py — _NEW_USER_INSTRUCTION
  found: Backstory says "ask language preference" but task steps start at STEP 1 (phone/email). DeepSeek follows task steps more strictly than backstory.
  implication: Need explicit STEP 0 for language preference in task instructions.

- timestamp: 2026-02-18T00:00:00Z
  checked: Supabase auth logs for email OTP flow
  found: New users get "confirmation" email (uses Confirm Signup template with {{ .Token }}). Existing users get "magic_link" email (uses default Magic Link template showing clickable link, not OTP code).
  implication: Magic Link template in Supabase Dashboard must be updated to match the OTP template. Code comment needed to document this dependency.

- timestamp: 2026-02-18T00:00:00Z
  checked: Post-fix verification — Python imports, build_auth_task_description output, test suite
  found: Both files import cleanly. build_auth_task_description produces STEP 0 for new users and LANGUAGE CHECK for returning users. All related tests pass (31 passed, 9 skipped, pre-existing failures unrelated).
  implication: Fixes are syntactically correct and functionally integrated.

## Resolution

root_cause: (1) Task steps lack STEP 0 for language preference — DeepSeek ignores backstory instruction. (2) Supabase Magic Link email template not configured with {{ .Token }} OTP display.
fix: (1) Added STEP 0 for language preference in _NEW_USER_INSTRUCTION with resume-check support. Added LANGUAGE CHECK before STEP 1 in _RETURNING_USER_INSTRUCTION. (2) Added comprehensive docstring in auth_tool.py _send_otp_impl explaining Supabase dual-template dependency. Added should_create_user option to email OTP call.
verification: Python import checks pass. build_auth_task_description produces correct output for both new-user and returning-user paths. Existing test suite shows no regressions from changes.
files_changed:
  - src/agents/prompts/auth.py
  - src/agents/tools/auth_tool.py
