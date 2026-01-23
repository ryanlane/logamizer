"""Scheduler tasks for periodic log fetching."""

import os
from datetime import datetime, timezone

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from apps.api.config import get_settings
from apps.api.models.log_source import LogSource, LogSourceStatus
from apps.worker.tasks.fetch import fetch_logs_from_source

settings = get_settings()

_engine = None
_engine_pid: int | None = None
_async_session_maker = None


def _get_session_maker() -> sessionmaker:
    """Create a session maker tied to the current process."""
    global _engine, _engine_pid, _async_session_maker
    pid = os.getpid()
    if _engine is None or _engine_pid != pid:
        _engine = create_async_engine(settings.database_url, poolclass=NullPool)
        _async_session_maker = sessionmaker(
            _engine, class_=AsyncSession, expire_on_commit=False
        )
        _engine_pid = pid
    return _async_session_maker


def _get_session() -> AsyncSession:
    """Create a new async session."""
    return _get_session_maker()()


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
    async with _get_session() as db:
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

    last_fetch_at = log_source.last_fetch_at
    if last_fetch_at.tzinfo is None:
        last_fetch_at = last_fetch_at.replace(tzinfo=timezone.utc)
    else:
        last_fetch_at = last_fetch_at.astimezone(timezone.utc)

    now = datetime.now(timezone.utc)

    schedule_type = log_source.schedule_type
    schedule_config = log_source.schedule_config

    if schedule_type == "interval":
        # Interval-based scheduling
        interval_minutes = schedule_config.get("interval_minutes", 60)
        minutes_since_last = (now - last_fetch_at).total_seconds() / 60

        return minutes_since_last >= interval_minutes

    elif schedule_type == "cron":
        # Cron-based scheduling (simplified implementation)
        # For a full cron implementation, use python-crontab or similar
        # For now, just use a simple interval as fallback
        return (now - last_fetch_at).total_seconds() >= 3600  # 1 hour

    return False
