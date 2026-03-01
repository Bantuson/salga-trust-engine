"""Celery application configuration for SALGA Trust Engine.

Configures Celery with Redis broker/backend and beat schedule for:
- Periodic SLA monitoring (every 5 minutes)
- Daily SDBIP actuals auto-population (01:00 SAST)
- Quarterly PA evaluator notifications (Q-start: 1st Jan/Apr/Jul/Oct at 08:00 SAST)

Uses Africa/Johannesburg timezone for all time-based calculations.
"""
from celery import Celery
from celery.schedules import crontab

from src.core.config import settings

app = Celery(
    "salga_trust_engine",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "src.tasks.sla_monitor",
        "src.tasks.status_notify",
        "src.tasks.pms_auto_populate_task",
        "src.tasks.pa_notify_task",
        "src.tasks.report_generation_task",
    ]
)

# Configuration
app.conf.update(
    timezone="Africa/Johannesburg",
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    result_expires=86400,  # Results expire after 24 hours
    task_track_started=True,
    task_acks_late=True,  # Acknowledge after task completes (not before)
    worker_prefetch_multiplier=1,  # One task at a time per worker
)

# Beat schedule for periodic tasks
app.conf.beat_schedule = {
    "check-sla-breaches": {
        "task": "src.tasks.sla_monitor.check_sla_breaches",
        "schedule": settings.SLA_CHECK_INTERVAL_SECONDS,
    },
    "populate-sdbip-actuals": {
        # Run daily at 01:00 SAST to auto-populate SDBIP actuals from resolved tickets.
        # SEC-05: AutoPopulationEngine unconditionally excludes GBV tickets (is_sensitive=FALSE).
        "task": "src.tasks.pms_auto_populate_task.populate_sdbip_actuals",
        "schedule": crontab(minute=0, hour=1),  # 01:00 SAST daily
    },
    "notify-pa-evaluators-q-start": {
        # Run at 08:00 SAST on the 1st of each quarter-start month (Jan/Apr/Jul/Oct).
        # Notifies PA evaluators that the new scoring quarter has begun.
        # Actual email/in-app delivery implemented in Phase 30.
        "task": "src.tasks.pa_notify_task.notify_pa_evaluators",
        "schedule": crontab(day_of_month="1", month_of_year="1,4,7,10", hour=8, minute=0),
    },
}
