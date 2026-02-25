# Phase 10: Render Staging Deployment Fixes - Research

**Researched:** 2026-02-22
**Domain:** Render.com Blueprint YAML deployment configuration
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TKT-01 | Citizen receives automated status updates via WhatsApp as ticket progresses | Celery worker must start correctly via `src.tasks.celery_app` path; wrong path means no Celery tasks run, so status notifications via `send_status_notification` task are never dispatched |
| SEC-01 | All data encrypted at rest and in transit (TLS 1.3, AES-256) | `SUPABASE_JWT_SECRET` is required by `verify_supabase_token()` to validate auth tokens; without it, JWT verification returns `None` and security.py falls back to no-auth mode, violating SEC-01 enforcement |
| SEC-04 | Role-based access control (citizen, field worker, manager, admin, SAPS liaison) | `SUPABASE_JWT_SECRET` is required to decode `app_metadata.role` from JWT tokens; without the secret, RBAC cannot be enforced at the API layer in staging |
| RPT-01 | Citizen can report service issues via WhatsApp using hybrid bot | `TWILIO_WHATSAPP_NUMBER` is the env var read by `settings` in config.py; `render.yaml` declares `TWILIO_WHATSAPP_FROM` which is an unknown key, so `settings.TWILIO_WHATSAPP_NUMBER` is always empty string, causing silent notification failures |
</phase_requirements>

---

## Summary

Phase 10 is a pure configuration fix to `render.yaml` — the Render Blueprint file that defines all staging services. The audit (`v1.0-MILESTONE-AUDIT.md`) identified three concrete bugs in the file that collectively break three staging flows: Celery background tasks, JWT authentication, and Twilio WhatsApp notifications.

The three bugs are all in `render.yaml` at the repository root. No application code is broken — the code itself is correct. The deployment configuration simply declares the wrong module path for Celery, omits a required env var, and uses a wrong env var name for Twilio. Each fix is a one-line change.

This phase also requires a unit test that validates the render.yaml configuration matches the actual code, so that configuration drift of this type is caught by CI automatically in the future.

**Primary recommendation:** Fix the three specific lines in `render.yaml` and add a `tests/test_render_config.py` unit test that parses render.yaml and asserts correct values — this prevents future configuration drift.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PyYAML | already in project deps | Parse render.yaml in tests | Standard library for YAML parsing in Python |
| pytest | already in project deps | Test harness | Existing test framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | — | — | No new dependencies required |

**Installation:** No new packages needed. PyYAML is available via `pip install pyyaml` but is already a transitive dependency of the project.

---

## Architecture Patterns

### render.yaml Worker Service Pattern

Render uses `type: worker` for Celery background workers. The `startCommand` must reference the correct Python module path using `-A` (app) flag:

```yaml
# WRONG — no module named src.celery_app at root level
startCommand: celery -A src.celery_app worker --loglevel=info --concurrency=2

# CORRECT — Celery app is defined in src/tasks/celery_app.py
startCommand: celery -A src.tasks.celery_app worker --loglevel=info --concurrency=2
```

Verified by: `src/tasks/celery_app.py` defines `app = Celery(...)`. Tasks `sla_monitor.py` and `status_notify.py` both import from `src.tasks.celery_app`. The CLAUDE.md command reference also confirms: `celery -A src.celery_app worker` (dev shorthand that works when cwd is repo root) vs. the full module path needed in Render's deployment context.

**Important:** On Render, the working directory is the repo root and the Python path includes the repo root, so `src.tasks.celery_app` is the correct dotted module path.

### render.yaml Environment Variable Pattern

```yaml
# For secrets set manually in Render Dashboard (not in repo):
envVars:
  - key: SUPABASE_JWT_SECRET
    sync: false   # Render prompts for value during initial Blueprint creation

# For static values:
  - key: ENVIRONMENT
    value: staging

# For values pulled from other Render services:
  - key: REDIS_URL
    fromService:
      name: salga-redis
      type: redis
      property: connectionURI
```

`sync: false` means: "this env var is secret; do not commit its value to the repo; prompt the operator to enter the value in the Render Dashboard during Blueprint creation." This is the correct pattern for all secrets.

### How SUPABASE_JWT_SECRET Is Used

The secret is consumed by `src/core/security.py:verify_supabase_token()`:

```python
# src/core/security.py line 43-53
if not settings.SUPABASE_JWT_SECRET:
    # Graceful degradation for tests without Supabase
    return None   # <-- ALWAYS returns None without this env var

payload = jwt.decode(
    token,
    settings.SUPABASE_JWT_SECRET,
    algorithms=["HS256"],
    audience="authenticated"
)
```

Without `SUPABASE_JWT_SECRET` in staging, every JWT verification returns `None`, meaning all authenticated API endpoints return 401 or unauthenticated behavior. The municipal dashboard becomes inaccessible to all roles.

### How TWILIO_WHATSAPP_NUMBER Is Used

The env var name in `src/core/config.py` is `TWILIO_WHATSAPP_NUMBER` (not `TWILIO_WHATSAPP_FROM`):

```python
# src/core/config.py line 90
TWILIO_WHATSAPP_NUMBER: str = Field(default="", description="Twilio WhatsApp sender number (whatsapp:+14155238886)")
```

Both `notification_service.py` and `whatsapp_service.py` read `settings.TWILIO_WHATSAPP_NUMBER`. Because Pydantic Settings uses `case_sensitive=False` and `extra="ignore"`, an env var named `TWILIO_WHATSAPP_FROM` is silently ignored. The setting defaults to `""`, so Twilio calls are made with an empty `from_` field — they fail silently or with Twilio API errors.

The fix: rename `TWILIO_WHATSAPP_FROM` to `TWILIO_WHATSAPP_NUMBER` in both places in `render.yaml` (lines 43 and 114).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Validate render.yaml syntax | Custom YAML schema validator | Parse with PyYAML and assert specific values | Sufficient for 3 targeted assertions; full schema validation is overkill |
| Celery module path discovery | Dynamic import scanner | Hardcode the assertion in test | Path is stable and confirmed by existing code |

**Key insight:** This is a configuration fix, not a code problem. Automated tests should use the simplest approach — parse the YAML file and assert the specific values that the audit found to be wrong. There is no need for a full Blueprint schema validator.

---

## Common Pitfalls

### Pitfall 1: TWILIO_WHATSAPP_FROM vs TWILIO_WHATSAPP_NUMBER confusion
**What goes wrong:** `render.yaml` uses `TWILIO_WHATSAPP_FROM` but code reads `TWILIO_WHATSAPP_NUMBER`. Pydantic `extra="ignore"` silently drops the wrong-named env var.
**Why it happens:** Developer used the Twilio parameter name (`from_=`) as the env var name instead of the config.py field name.
**How to avoid:** Always derive env var names from `src/core/config.py` Settings field names — those are the canonical names.
**Warning signs:** `settings.TWILIO_WHATSAPP_NUMBER` returns empty string in staging even though Twilio is configured.

### Pitfall 2: Celery `-A` argument must be full dotted module path
**What goes wrong:** `celery -A src.celery_app` fails because there is no `src/celery_app.py` at the repo root; the app is at `src/tasks/celery_app.py`.
**Why it happens:** CLAUDE.md's dev shorthand `celery -A src.celery_app` works locally because Python path resolution differs; in Render's container the full path is required.
**How to avoid:** Use `celery -A src.tasks.celery_app` — the full dotted module path matching the file's location.
**Warning signs:** Celery worker exits immediately with `ModuleNotFoundError` or `AttributeError: module 'src' has no attribute 'celery_app'`.

### Pitfall 3: SUPABASE_JWT_SECRET omission causes silent auth failure
**What goes wrong:** Without `SUPABASE_JWT_SECRET`, `verify_supabase_token()` returns `None` for every token, making all authenticated endpoints fail.
**Why it happens:** The env var wasn't listed in `render.yaml` — it was added to Supabase integration in Phase 6.1 but the render.yaml was not updated.
**How to avoid:** Any env var in `src/core/config.py` Settings that has no default (or an empty default `""`) that is required for production behavior must be listed in `render.yaml` with `sync: false`.
**Warning signs:** All dashboard API calls return 401/403 in staging; `verify_supabase_token` always returns None in staging logs.

### Pitfall 4: `sync: false` only works at initial Blueprint creation
**What goes wrong:** If you add a `sync: false` env var to render.yaml and re-deploy an existing Blueprint, Render does NOT prompt for the new value — the env var is missing from the service.
**Why it happens:** Render's Blueprint sync only prompts for `sync: false` vars during initial Blueprint creation, not on updates.
**How to avoid:** After fixing render.yaml and pushing, manually set `SUPABASE_JWT_SECRET` in the Render Dashboard under the service's Environment tab. The render.yaml fix documents the requirement; the manual step populates the value.
**Warning signs:** Deploy succeeds but auth still fails; check Render Dashboard → service → Environment to verify the var is present.

### Pitfall 5: Both `salga-api` and `salga-celery` need TWILIO_WHATSAPP_NUMBER fix
**What goes wrong:** `TWILIO_WHATSAPP_FROM` appears in two services in render.yaml (lines 43 for `salga-api` and 114 for `salga-celery`). Fixing only one service leaves the other broken.
**Why it happens:** `salga-api` sends notifications inline; `salga-celery` sends them via the `NotificationService` in Celery tasks.
**How to avoid:** Fix both occurrences. Search for all instances of `TWILIO_WHATSAPP_FROM` before closing the PR.

---

## Code Examples

### Bug 1: Celery startCommand (render.yaml line 91)

```yaml
# CURRENT (broken):
startCommand: celery -A src.celery_app worker --loglevel=info --concurrency=2

# FIX:
startCommand: celery -A src.tasks.celery_app worker --loglevel=info --concurrency=2
```

**Evidence:** `src/tasks/celery_app.py` is the correct module. `src/tasks/sla_monitor.py:16` and `src/tasks/status_notify.py:16` both import `from src.tasks.celery_app import app`.

### Bug 2: Missing SUPABASE_JWT_SECRET (render.yaml — salga-api envVars block)

```yaml
# ADD after SUPABASE_SERVICE_ROLE_KEY block:
      - key: SUPABASE_JWT_SECRET
        sync: false
```

**Evidence:** `src/core/config.py:26` declares `SUPABASE_JWT_SECRET: str = Field(default="", ...)`. `src/core/security.py:43` checks `if not settings.SUPABASE_JWT_SECRET: return None`. It must also be added to `salga-celery` if that worker performs any JWT verification (currently it does not — but adding it defensively is correct practice).

### Bug 3: TWILIO_WHATSAPP_FROM → TWILIO_WHATSAPP_NUMBER (two locations)

```yaml
# CURRENT in salga-api (line 43) and salga-celery (line 114):
      - key: TWILIO_WHATSAPP_FROM
        sync: false

# FIX (both occurrences):
      - key: TWILIO_WHATSAPP_NUMBER
        sync: false
```

**Evidence:** `src/core/config.py:90` field is named `TWILIO_WHATSAPP_NUMBER`. Pydantic `extra="ignore"` means `TWILIO_WHATSAPP_FROM` is silently dropped.

### Test Pattern: render.yaml Configuration Validation

```python
# tests/test_render_config.py
import yaml
from pathlib import Path

RENDER_YAML_PATH = Path(__file__).parent.parent / "render.yaml"

def _load_render_yaml():
    with open(RENDER_YAML_PATH) as f:
        return yaml.safe_load(f)

def _get_service(config, name):
    return next(s for s in config["services"] if s["name"] == name)

def _get_env_keys(service):
    return {e["key"] for e in service.get("envVars", [])}

def test_celery_startcommand_module_path():
    """Celery -A flag must reference src.tasks.celery_app, not src.celery_app."""
    config = _load_render_yaml()
    celery = _get_service(config, "salga-celery")
    assert "src.tasks.celery_app" in celery["startCommand"], (
        "Celery startCommand must use 'src.tasks.celery_app' — "
        "no module exists at src.celery_app"
    )

def test_supabase_jwt_secret_present_in_api():
    """SUPABASE_JWT_SECRET must be declared in salga-api for JWT verification."""
    config = _load_render_yaml()
    api = _get_service(config, "salga-api")
    assert "SUPABASE_JWT_SECRET" in _get_env_keys(api), (
        "SUPABASE_JWT_SECRET missing from salga-api envVars — "
        "verify_supabase_token() will always return None without it"
    )

def test_twilio_whatsapp_number_not_from_in_api():
    """render.yaml must use TWILIO_WHATSAPP_NUMBER (not TWILIO_WHATSAPP_FROM)."""
    config = _load_render_yaml()
    api = _get_service(config, "salga-api")
    keys = _get_env_keys(api)
    assert "TWILIO_WHATSAPP_NUMBER" in keys, (
        "TWILIO_WHATSAPP_NUMBER missing from salga-api — "
        "config.py field is TWILIO_WHATSAPP_NUMBER"
    )
    assert "TWILIO_WHATSAPP_FROM" not in keys, (
        "TWILIO_WHATSAPP_FROM is wrong name — config.py uses TWILIO_WHATSAPP_NUMBER"
    )

def test_twilio_whatsapp_number_not_from_in_celery():
    """salga-celery must also use TWILIO_WHATSAPP_NUMBER."""
    config = _load_render_yaml()
    celery = _get_service(config, "salga-celery")
    keys = _get_env_keys(celery)
    assert "TWILIO_WHATSAPP_NUMBER" in keys
    assert "TWILIO_WHATSAPP_FROM" not in keys
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `src.celery_app` module path | `src.tasks.celery_app` full path | Phase 4 (Celery added in tasks subpackage) | Render worker fails to start without the correct path |
| `TWILIO_WHATSAPP_FROM` env var | `TWILIO_WHATSAPP_NUMBER` field name | Phase 4-03 (Twilio added to config.py) | Pydantic silently ignores wrong-named env var |
| No `SUPABASE_JWT_SECRET` in render.yaml | Required for Supabase Auth JWT verification | Phase 6.1 (Supabase Auth migration) | All staging auth fails without this var |

---

## Open Questions

1. **Should SUPABASE_JWT_SECRET also be added to `salga-celery`?**
   - What we know: The Celery worker currently does not verify JWTs directly — it receives primitive task parameters (ticket_id, user_phone, etc.)
   - What's unclear: Future tasks may need JWT verification if tenant context is added to tasks
   - Recommendation: Add it to `salga-celery` as well for defensive consistency. It costs nothing and prevents a future bug.

2. **Should SUPABASE_JWT_SECRET also be added to `salga-crew-server`?**
   - What we know: The crew server uses `CREW_SERVER_API_KEY` for its own auth (not Supabase JWT)
   - What's unclear: Whether the crew server calls any Supabase-authenticated endpoint that would benefit from having the JWT secret available
   - Recommendation: Skip for now — the crew server has its own API key auth. Revisit only if crew server needs to verify user JWTs.

3. **Is `sync: false` sufficient or should a Render env group be used?**
   - What we know: Render env groups allow sharing secrets across services. `sync: false` is per-service.
   - What's unclear: Whether the project is at a scale where env group management is worth the overhead
   - Recommendation: Keep `sync: false` per-service for now. The project has 3 services; env groups add overhead without meaningful benefit at this stage.

---

## Sources

### Primary (HIGH confidence)
- `C:/Users/Bantu/mzansi-agentive/salga-trust-engine/render.yaml` — Current broken state: lines 43, 91, 114
- `C:/Users/Bantu/mzansi-agentive/salga-trust-engine/src/tasks/celery_app.py` — Correct module path confirmed
- `C:/Users/Bantu/mzansi-agentive/salga-trust-engine/src/core/config.py:90` — `TWILIO_WHATSAPP_NUMBER` is the canonical field name
- `C:/Users/Bantu/mzansi-agentive/salga-trust-engine/src/core/security.py:43-53` — `SUPABASE_JWT_SECRET` usage confirmed
- `C:/Users/Bantu/mzansi-agentive/salga-trust-engine/.planning/v1.0-MILESTONE-AUDIT.md` — Root cause analysis of all 3 deployment bugs
- `C:/Users/Bantu/mzansi-agentive/salga-trust-engine/src/tasks/sla_monitor.py:16` — Imports from `src.tasks.celery_app`
- `C:/Users/Bantu/mzansi-agentive/salga-trust-engine/src/tasks/status_notify.py:16` — Imports from `src.tasks.celery_app`

### Secondary (MEDIUM confidence)
- [Render Blueprint YAML Reference](https://render.com/docs/blueprint-spec) — `sync: false` env var pattern confirmed
- [Render Celery Example](https://github.com/render-examples/celery/blob/master/render.yaml) — Worker `startCommand` pattern confirmed: `celery --app tasks worker`
- [Render Environment Variables Docs](https://docs.render.com/configure-environment-variables) — `sync: false` applies only at Blueprint creation; must set manually in Dashboard for existing services

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries needed; PyYAML is a standard transitive dep
- Architecture: HIGH — all three bugs verified by direct code inspection against the audit report
- Pitfalls: HIGH — all pitfalls derived from direct code analysis and verified Render docs
- Test pattern: HIGH — standard PyYAML file parsing, confirmed pattern used in project test suite

**Research date:** 2026-02-22
**Valid until:** 2026-05-22 (Render Blueprint syntax is stable; 90 days validity)
