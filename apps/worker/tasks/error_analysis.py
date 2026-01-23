"""Error analysis tasks for processing and grouping errors."""

import asyncio
import os
from datetime import datetime

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from apps.api.config import get_settings
from apps.api.models.error_log import ErrorGroup, ErrorOccurrence
from apps.api.models.log_file import LogFile
from apps.api.services.storage import get_storage_service
from apps.worker.parsers.error_parser import ErrorLogParser

settings = get_settings()

_engine = None
_engine_pid: int | None = None
_async_session_maker = None


def _get_session_maker() -> sessionmaker:
    """Create a session maker tied to the current process."""
    global _engine, _engine_pid, _async_session_maker
    pid = os.getpid()
    if _engine is None or _engine_pid != pid:
        _engine = create_async_engine(settings.database_url)
        _async_session_maker = sessionmaker(
            _engine, class_=AsyncSession, expire_on_commit=False
        )
        _engine_pid = pid
    return _async_session_maker


def _get_session() -> AsyncSession:
    """Create a new async session."""
    return _get_session_maker()()


@shared_task(bind=True, name="analyze_errors_in_log_file")
def analyze_errors_in_log_file(self, log_file_id: str, log_format: str = "auto") -> dict:
    """Analyze errors in a log file and group them.

    Args:
        log_file_id: ID of the LogFile to analyze
        log_format: Log format (auto, python, javascript, java, http)

    Returns:
        Dictionary with analysis results
    """
    return asyncio.run(_analyze_errors_async(log_file_id, log_format))


async def _analyze_errors_async(log_file_id: str, log_format: str = "auto") -> dict:
    """Async implementation of error analysis."""
    async with _get_session() as db:
        # Get log file
        result = await db.execute(select(LogFile).where(LogFile.id == log_file_id))
        log_file = result.scalar_one_or_none()

        if not log_file:
            return {
                "success": False,
                "error": f"Log file {log_file_id} not found",
            }

        # Download log content from storage
        storage = get_storage_service()
        try:
            content_bytes = storage.get_object(log_file.storage_key)
            content = content_bytes.decode("utf-8", errors="ignore")
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to download log file: {str(e)}",
            }

        # Parse errors from content
        parser = ErrorLogParser()
        parsed_errors = parser.parse_log_content(content, log_format)

        if not parsed_errors:
            return {
                "success": True,
                "errors_found": 0,
                "message": "No errors found in log file",
            }

        # Group errors by fingerprint
        error_groups_map: dict[str, ErrorGroup] = {}
        new_occurrences = 0
        new_groups = 0

        for parsed_error in parsed_errors:
            fingerprint = parsed_error.get_fingerprint()

            # Find or create error group
            if fingerprint not in error_groups_map:
                # Check if group exists in database
                result = await db.execute(
                    select(ErrorGroup).where(
                        ErrorGroup.site_id == log_file.site_id,
                        ErrorGroup.fingerprint == fingerprint,
                    )
                )
                error_group = result.scalar_one_or_none()

                if not error_group:
                    # Create new error group
                    error_group = ErrorGroup(
                        site_id=log_file.site_id,
                        fingerprint=fingerprint,
                        error_type=parsed_error.error_type,
                        error_message=parsed_error.error_message,
                        first_seen=parsed_error.timestamp,
                        last_seen=parsed_error.timestamp,
                        occurrence_count=0,
                        status="unresolved",
                    )
                    db.add(error_group)
                    await db.flush()
                    new_groups += 1

                error_groups_map[fingerprint] = error_group

            error_group = error_groups_map[fingerprint]

            # Update group stats without triggering lazy loads
            current_last_seen = error_group.__dict__.get("last_seen")
            if current_last_seen is None or parsed_error.timestamp > current_last_seen:
                error_group.last_seen = parsed_error.timestamp

            current_count = error_group.__dict__.get("occurrence_count") or 0
            error_group.occurrence_count = current_count + 1

            # Create error occurrence
            occurrence = ErrorOccurrence(
                error_group_id=error_group.id,
                log_file_id=log_file_id,
                timestamp=parsed_error.timestamp,
                error_type=parsed_error.error_type,
                error_message=parsed_error.error_message,
                stack_trace=parsed_error.stack_trace,
                file_path=parsed_error.file_path,
                line_number=parsed_error.line_number,
                function_name=parsed_error.function_name,
                request_url=parsed_error.request_url,
                request_method=parsed_error.request_method,
                user_id=parsed_error.user_id,
                ip_address=parsed_error.ip_address,
                user_agent=parsed_error.user_agent,
                context=parsed_error.context,
            )
            db.add(occurrence)
            new_occurrences += 1

        await db.commit()

        return {
            "success": True,
            "errors_found": len(parsed_errors),
            "new_groups": new_groups,
            "new_occurrences": new_occurrences,
            "unique_error_types": len(set(e.error_type for e in parsed_errors)),
        }


@shared_task(name="update_error_rates")
def update_error_rates(site_id: str, time_window_hours: int = 24) -> dict:
    """Calculate error rates over time for a site.

    Args:
        site_id: Site ID
        time_window_hours: Time window for rate calculation

    Returns:
        Dictionary with rate statistics
    """
    return asyncio.run(_update_error_rates_async(site_id, time_window_hours))


async def _update_error_rates_async(site_id: str, time_window_hours: int = 24) -> dict:
    """Async implementation of error rate calculation."""
    async with _get_session() as db:
        from datetime import timedelta

        cutoff_time = datetime.utcnow() - timedelta(hours=time_window_hours)

        # Get all error groups for site
        result = await db.execute(select(ErrorGroup).where(ErrorGroup.site_id == site_id))
        error_groups = result.scalars().all()

        if not error_groups:
            return {
                "success": True,
                "total_groups": 0,
                "active_groups": 0,
            }

        # Count recent occurrences per group
        active_groups = 0
        total_recent_occurrences = 0

        for group in error_groups:
            # Count occurrences in time window
            result = await db.execute(
                select(ErrorOccurrence)
                .where(
                    ErrorOccurrence.error_group_id == group.id,
                    ErrorOccurrence.timestamp >= cutoff_time,
                )
            )
            recent_occurrences = result.scalars().all()

            if recent_occurrences:
                active_groups += 1
                total_recent_occurrences += len(recent_occurrences)

        return {
            "success": True,
            "total_groups": len(error_groups),
            "active_groups": active_groups,
            "total_recent_occurrences": total_recent_occurrences,
            "time_window_hours": time_window_hours,
        }
