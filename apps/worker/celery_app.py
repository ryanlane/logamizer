"""Celery application configuration."""

import os

from celery import Celery

# Get Redis URL from environment
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

celery_app = Celery(
    "logamizer",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=[
        "apps.worker.tasks.parse",
        "apps.worker.tasks.fetch",
        "apps.worker.tasks.scheduler",
        "apps.worker.tasks.error_analysis",
    ],
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max per task
    worker_prefetch_multiplier=1,  # One task at a time per worker
    task_acks_late=True,  # Ack after task completes
    task_reject_on_worker_lost=True,
)

# Celery Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    "schedule-log-fetches": {
        "task": "schedule_log_fetches",
        "schedule": 60.0,  # Run every 60 seconds
    },
}

app = celery_app
