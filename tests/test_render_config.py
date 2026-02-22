"""Render Blueprint configuration validation tests.

These tests parse render.yaml and assert that configuration values match what the
application code actually expects. They act as a CI guard against configuration drift
between render.yaml and the Python source code.

Run: pytest tests/test_render_config.py -v
"""
from pathlib import Path

import yaml


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_render_yaml() -> dict:
    """Load and parse render.yaml from the repository root."""
    render_path = Path(__file__).parent.parent / "render.yaml"
    with render_path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _get_service(config: dict, name: str) -> dict:
    """Find a service by name in config['services']."""
    for service in config["services"]:
        if service.get("name") == name:
            return service
    raise KeyError(f"Service '{name}' not found in render.yaml services list")


def _get_env_keys(service: dict) -> set[str]:
    """Return the set of env var key names declared in a service's envVars list."""
    return {entry["key"] for entry in service.get("envVars", [])}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestCeleryModulePath:
    """Validate that the Celery worker uses the correct module import path."""

    def test_celery_startcommand_uses_tasks_module(self):
        """Celery startCommand must reference src.tasks.celery_app, not src.celery_app.

        The Celery application object lives in src/tasks/celery_app.py.
        Using `celery -A src.celery_app` (without the tasks sub-package) causes
        a ModuleNotFoundError on startup, stopping ALL background jobs:
          - SLA breach checks (check_sla_breaches beat task)
          - WhatsApp status notifications (notify_citizen_status task)
        """
        config = _load_render_yaml()
        celery_service = _get_service(config, "salga-celery")

        start_command = celery_service.get("startCommand", "")
        assert "src.tasks.celery_app" in start_command, (
            f"salga-celery startCommand must use 'src.tasks.celery_app' (the actual "
            f"module path in src/tasks/celery_app.py), but got: {start_command!r}"
        )


class TestSupabaseJwtSecret:
    """Validate that SUPABASE_JWT_SECRET is declared for services that need it."""

    def test_supabase_jwt_secret_in_api(self):
        """SUPABASE_JWT_SECRET must be in salga-api envVars.

        src/core/security.py:verify_supabase_token() uses settings.SUPABASE_JWT_SECRET
        to verify Supabase JWTs. If this env var is absent, the function receives an
        empty string, short-circuits at the `if not settings.SUPABASE_JWT_SECRET` guard,
        and returns None for EVERY token — making all authenticated API endpoints return
        401 Unauthorized and breaking the entire municipal operations dashboard.
        """
        config = _load_render_yaml()
        api_service = _get_service(config, "salga-api")
        env_keys = _get_env_keys(api_service)

        assert "SUPABASE_JWT_SECRET" in env_keys, (
            "salga-api is missing SUPABASE_JWT_SECRET in envVars. "
            "verify_supabase_token() in src/core/security.py will always return None "
            "without this secret, causing all authenticated endpoints to return 401."
        )

    def test_supabase_jwt_secret_in_celery(self):
        """SUPABASE_JWT_SECRET must be in salga-celery envVars (defensive consistency).

        Even though the current Celery tasks (SLA monitor, status notify) do not verify
        JWTs directly, they share the same settings object. Keeping SUPABASE_JWT_SECRET
        present in salga-celery prevents subtle failures if future tasks add JWT
        verification and ensures configuration parity between services.
        """
        config = _load_render_yaml()
        celery_service = _get_service(config, "salga-celery")
        env_keys = _get_env_keys(celery_service)

        assert "SUPABASE_JWT_SECRET" in env_keys, (
            "salga-celery is missing SUPABASE_JWT_SECRET in envVars. "
            "Add it for defensive consistency — future Celery tasks may need JWT "
            "verification and the settings object already declares this field."
        )


class TestTwilioEnvVarName:
    """Validate that the Twilio WhatsApp env var uses the correct name."""

    def test_twilio_whatsapp_number_in_api(self):
        """salga-api must declare TWILIO_WHATSAPP_NUMBER (not TWILIO_WHATSAPP_FROM).

        src/core/config.py defines the field as:
            TWILIO_WHATSAPP_NUMBER: str = Field(default="", ...)

        Pydantic Settings is configured with extra="ignore". If the env var is named
        TWILIO_WHATSAPP_FROM (wrong name), Pydantic silently drops it and
        settings.TWILIO_WHATSAPP_NUMBER remains empty string — causing WhatsApp
        notifications to fail silently with no error log.
        """
        config = _load_render_yaml()
        api_service = _get_service(config, "salga-api")
        env_keys = _get_env_keys(api_service)

        assert "TWILIO_WHATSAPP_NUMBER" in env_keys, (
            "salga-api is missing TWILIO_WHATSAPP_NUMBER in envVars. "
            "config.py field is TWILIO_WHATSAPP_NUMBER — Pydantic extra='ignore' "
            "silently drops TWILIO_WHATSAPP_FROM, leaving the field as empty string."
        )
        assert "TWILIO_WHATSAPP_FROM" not in env_keys, (
            "salga-api contains the old TWILIO_WHATSAPP_FROM env var — this must be "
            "renamed to TWILIO_WHATSAPP_NUMBER to match the config.py field name."
        )

    def test_twilio_whatsapp_number_in_celery(self):
        """salga-celery must declare TWILIO_WHATSAPP_NUMBER (not TWILIO_WHATSAPP_FROM).

        Same constraint as salga-api — src/tasks/status_notify.py uses
        settings.TWILIO_WHATSAPP_NUMBER when sending WhatsApp status updates to
        citizens via Twilio. The wrong env var name causes silent failures with
        no citizen notification delivered.
        """
        config = _load_render_yaml()
        celery_service = _get_service(config, "salga-celery")
        env_keys = _get_env_keys(celery_service)

        assert "TWILIO_WHATSAPP_NUMBER" in env_keys, (
            "salga-celery is missing TWILIO_WHATSAPP_NUMBER in envVars. "
            "config.py field is TWILIO_WHATSAPP_NUMBER — Pydantic extra='ignore' "
            "silently drops TWILIO_WHATSAPP_FROM, leaving the field as empty string."
        )
        assert "TWILIO_WHATSAPP_FROM" not in env_keys, (
            "salga-celery contains the old TWILIO_WHATSAPP_FROM env var — this must be "
            "renamed to TWILIO_WHATSAPP_NUMBER to match the config.py field name."
        )
