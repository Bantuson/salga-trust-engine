---
status: resolved
trigger: "Auth agent tools fail because Supabase admin client returns None — env var names in .env don't match what config.py expects."
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED. .env has SUPABASE_PUBLISHABLE_KEY (line 24) and SUPABASE_SECRET_KEY (line 25). config.py declares SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY. pydantic-settings case_sensitive=False matches on field name, so SUPABASE_ANON_KEY picks up nothing (field name != SUPABASE_PUBLISHABLE_KEY), and SUPABASE_SERVICE_ROLE_KEY picks up nothing — both stay "". get_supabase_admin() guard fails. Root cause confirmed.
test: fix is to add validation_alias entries (or rename .env keys) so the fields read the actual .env names. Adding validation_alias to config.py is safer than changing .env — no secret rotation needed.
expecting: after adding validation_alias, settings.SUPABASE_SERVICE_ROLE_KEY will hold the value from SUPABASE_SECRET_KEY, settings.SUPABASE_ANON_KEY will hold the value from SUPABASE_PUBLISHABLE_KEY
next_action: edit src/core/config.py to add AliasChoices for both fields

## Symptoms

expected: Auth agent tools (send_otp_tool, verify_otp_tool, create_supabase_user_tool, lookup_user_tool) should connect to Supabase and perform auth operations. get_supabase_admin() should return a valid Supabase Client.
actual: get_supabase_admin() returns None. All auth tools return "Error: Supabase admin client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
errors: "Supabase admin client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." — returned by every auth tool in src/agents/tools/auth_tool.py
reproduction: 1) Start crew server (uvicorn src.api.v1.crew_server:crew_app --port 8001), 2) Send a chat message with session_override="new", 3) Auth agent routes correctly but tools fail on Supabase client initialization.
timeline: Has never worked — the .env was created with different key names than config.py expects. .env has SUPABASE_SECRET_KEY, config expects SUPABASE_SERVICE_ROLE_KEY. .env has SUPABASE_PUBLISHABLE_KEY, config expects SUPABASE_ANON_KEY.

## Eliminated

(none — root cause confirmed on first hypothesis)

## Evidence

- timestamp: 2026-02-17T00:00:00Z
  checked: pre-supplied symptoms
  found: .env has SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY; config.py expects SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY
  implication: pydantic-settings field SUPABASE_SERVICE_ROLE_KEY defaults to "" so get_supabase_admin() guard is falsy and returns None

- timestamp: 2026-02-17T00:01:00Z
  checked: .env lines 23-28 via grep -n redacted output
  found: .env contains SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_JWT_SECRET, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY — no SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY at the Python layer
  implication: Both pydantic fields fall through to default="" every startup

- timestamp: 2026-02-17T00:02:00Z
  checked: src/core/config.py field definitions
  found: SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY declared with no alias, model_config case_sensitive=False, no env_alias defined
  implication: pydantic-settings does case-insensitive match on the Python field name only; SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY are never read

- timestamp: 2026-02-17T00:03:00Z
  checked: fix applied — added AliasChoices to both fields; ran python verification
  found: SUPABASE_ANON_KEY populated=True, SUPABASE_SERVICE_ROLE_KEY populated=True, get_supabase_admin() returns SyncClient (not None)
  implication: Fix confirmed correct

## Resolution

root_cause: src/core/config.py declared SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY as plain Field() entries. pydantic-settings resolves fields by their Python attribute name. The .env was created with different names (SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY) — the standard Supabase dashboard naming. Because no aliases were defined, both fields defaulted to "". The get_supabase_admin() guard `settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY` evaluated falsy on SUPABASE_SERVICE_ROLE_KEY="", so None was always returned.
fix: Added `validation_alias=AliasChoices("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY")` and `AliasChoices("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY")` to the two fields in src/core/config.py. The canonical name is listed first so that when a future .env is updated to use the standard names the field continues to work without another change.
verification: python -c confirmed SUPABASE_ANON_KEY populated=True, SUPABASE_SERVICE_ROLE_KEY populated=True, get_supabase_admin() returns SyncClient not None.
files_changed:
  - src/core/config.py
