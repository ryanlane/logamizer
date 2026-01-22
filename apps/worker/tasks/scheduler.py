"""Scheduler tasks for periodic log fetching."""

from datetime import datetime

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from apps.api.config import get_settings
from apps.api.models.log_source import LogSource, LogSourceStatus
from apps.worker.tasks.fetch import fetch_logs_from_source

settings = get_settings()

# Create async database session for scheduler
engine = create_async_engine(settings.database_url)
async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@shared_task(name="schedule_log_fetches")
def schedule_log_fetches() -> dict:
    """Check all active log sources and schedule fetches based on their schedules.

    This task runs periodically (e.g., every minute) and checks if any log sources
    are due for fetching based on their schedule configuration.
    """
    import asyncio

    return asyncio.run(_schedule_fetches_async())


async def _schedule_fetches_async() -> dict:
    """Async implementation of fetch scheduling."""
    async with async_session_maker() as db:
        # Get all active log sources
        result = await db.execute(
            select(LogSource).where(LogSource.status == LogSourceStatus.ACTIVE)
        )
        log_sources = result.scalars().all()

        scheduled_count = 0
        skipped_count = 0

        for log_source in log_sources:
            # Check if fetch is due based on schedule
            if _is_fetch_due(log_source):
                # Enqueue fetch task
                fetch_logs_from_source.delay(str(log_source.id))
                scheduled_count += 1
            else:
                skipped_count += 1

        return {
            "total_sources": len(log_sources),
            "scheduled": scheduled_count,
            "skipped": skipped_count,
        }


def _is_fetch_due(log_source: LogSource) -> bool:
    """Check if a log source is due for fetching.

    Args:
        log_source: The LogSource to check

    Returns:
        True if fetch should be triggered
    """
    # If never fetched, fetch now
    if log_source.last_fetch_at is None:
        return True

    schedule_type = log_source.schedule_type
    schedule_config = log_source.schedule_config

    if schedule_type == "interval":
        # Interval-based scheduling
        interval_minutes = schedule_config.get("interval_minutes", 60)
        minutes_since_last = (datetime.utcnow() - log_source.last_fetch_at).total_seconds() / 60

        return minutes_since_last >= interval_minutes

    elif schedule_type == "cron":
        # Cron-based scheduling (simplified implementation)
        # For a full cron implementation, use python-crontab or similar
        # For now, just use a simple interval as fallback
        return (datetime.utcnow() - log_source.last_fetch_at).total_seconds() >= 3600  # 1 hour

    return False
