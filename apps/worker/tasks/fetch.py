"""Log fetching tasks."""

import os
from datetime import datetime
from io import BytesIO
from uuid import uuid4

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from apps.api.config import get_settings
from apps.api.models.log_file import LogFile
from apps.api.models.log_source import LogSource
from apps.api.services.storage import get_storage_service
from apps.worker.celery_app import app
from apps.worker.fetchers import SSHLogFetcher, S3LogFetcher
from apps.worker.tasks.parse import parse_log_file

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


async def get_fetcher(source_type: str, config: dict):
    """Get the appropriate fetcher for the source type."""
    if source_type in ["ssh", "sftp"]:
        return SSHLogFetcher(config)
    elif source_type in ["s3", "gcs"]:
        return S3LogFetcher(config)
    else:
        raise ValueError(f"Unsupported source type: {source_type}")


@shared_task(bind=True, name="fetch_logs_from_source")
def fetch_logs_from_source(self, log_source_id: str) -> dict:
    """Fetch logs from a configured source.

    Args:
        log_source_id: ID of the LogSource to fetch from

    Returns:
        Dictionary with fetch results
    """
    import asyncio

    return asyncio.run(_fetch_logs_async(log_source_id))


async def _fetch_logs_async(log_source_id: str) -> dict:
    """Async implementation of log fetching."""
    async with _get_session() as db:
        # Get log source
        result = await db.execute(
            select(LogSource).where(LogSource.id == log_source_id)
        )
        log_source = result.scalar_one_or_none()

        if not log_source:
            return {
                "success": False,
                "error": f"Log source {log_source_id} not found",
            }

        # Update fetch start time
        log_source.last_fetch_at = datetime.utcnow()
        await db.commit()

        fetcher = None
        total_bytes = 0
        fetched_files = []

        try:
            # Get appropriate fetcher
            fetcher = await get_fetcher(log_source.source_type, log_source.connection_config)

            # Fetch log files
            files = await fetcher.fetch_logs()

            if not files:
                log_source.last_fetch_status = "success"
                log_source.last_fetch_error = None
                log_source.last_fetched_bytes = 0
                await db.commit()

                return {
                    "success": True,
                    "files_fetched": 0,
                    "total_bytes": 0,
                    "message": "No new log files found",
                }

            # Upload each file to storage and create log file records
            storage = get_storage_service()

            for filename, file_content, size_bytes in files:
                # Generate storage key
                storage_key = f"sites/{log_source.site_id}/logs/{log_source_id}/{uuid4()}/{filename}"

                # Calculate hash
                file_content.seek(0)
                content = file_content.read()
                import hashlib

                file_hash = hashlib.sha256(content).hexdigest()

                # Upload to storage
                file_content.seek(0)
                storage.upload_file(file_content, storage_key)

                # Create LogFile record
                log_file = LogFile(
                    site_id=log_source.site_id,
                    filename=filename,
                    size_bytes=size_bytes,
                    hash_sha256=file_hash,
                    storage_key=storage_key,
                    status="pending",
                )
                db.add(log_file)
                await db.flush()  # Get the log_file.id

                # Enqueue parsing task
                parse_log_file.delay(str(log_file.id))

                total_bytes += size_bytes
                fetched_files.append(filename)

            # Update log source status
            log_source.last_fetch_status = "success"
            log_source.last_fetch_error = None
            log_source.last_fetched_bytes = total_bytes
            await db.commit()

            return {
                "success": True,
                "files_fetched": len(fetched_files),
                "total_bytes": total_bytes,
                "files": fetched_files,
            }

        except Exception as e:
            # Update error status
            log_source.last_fetch_status = "error"
            log_source.last_fetch_error = str(e)
            log_source.last_fetched_bytes = total_bytes
            await db.commit()

            return {
                "success": False,
                "error": str(e),
                "files_fetched": len(fetched_files),
                "total_bytes": total_bytes,
            }

        finally:
            # Cleanup fetcher resources
            if fetcher:
                await fetcher.cleanup()


@shared_task(name="test_log_source_connection")
def test_log_source_connection(log_source_id: str) -> dict:
    """Test connection to a log source.

    Args:
        log_source_id: ID of the LogSource to test

    Returns:
        Dictionary with test results
    """
    import asyncio

    return asyncio.run(_test_connection_async(log_source_id))


async def _test_connection_async(log_source_id: str) -> dict:
    """Async implementation of connection testing."""
    async with _get_session() as db:
        # Get log source
        result = await db.execute(
            select(LogSource).where(LogSource.id == log_source_id)
        )
        log_source = result.scalar_one_or_none()

        if not log_source:
            return {
                "success": False,
                "message": f"Log source {log_source_id} not found",
            }

        fetcher = None
        try:
            # Get appropriate fetcher
            fetcher = await get_fetcher(log_source.source_type, log_source.connection_config)

            # Test connection
            success, message = await fetcher.test_connection()

            return {
                "success": success,
                "message": message,
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Connection test failed: {str(e)}",
            }

        finally:
            # Cleanup fetcher resources
            if fetcher:
                await fetcher.cleanup()
