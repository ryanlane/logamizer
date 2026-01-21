"""Log file parsing task."""

import json
import os
from datetime import UTC, datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from apps.api.models.job import Job
from apps.api.models.log_file import LogFile
from apps.worker.celery_app import celery_app
from packages.shared.enums import JobStatus, LogFileStatus

# Sync database URL (Celery doesn't use async)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://logamizer:logamizer@localhost:5432/logamizer",
).replace("+asyncpg", "")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


@celery_app.task(bind=True, name="apps.worker.tasks.parse.parse_log_file")
def parse_log_file(self, job_id: str) -> dict:
    """
    Parse a log file and generate aggregates.

    This is a placeholder implementation for Phase 1.
    Full parsing logic will be implemented in Phase 2.
    """
    db: Session = SessionLocal()

    try:
        # Get job
        job = db.query(Job).filter(Job.id == job_id).first()
        if job is None:
            return {"error": "Job not found"}

        # Update job status
        job.status = JobStatus.PROCESSING
        job.started_at = datetime.now(UTC)
        db.commit()

        # Get log file
        log_file = db.query(LogFile).filter(LogFile.id == job.log_file_id).first()
        if log_file is None:
            job.status = JobStatus.FAILED
            job.error_message = "Log file not found"
            job.completed_at = datetime.now(UTC)
            db.commit()
            return {"error": "Log file not found"}

        # Update log file status
        log_file.status = LogFileStatus.PROCESSING
        db.commit()

        # TODO: Phase 2 - Implement actual parsing
        # For now, just mark as completed with placeholder results
        result_summary = {
            "status": "completed",
            "message": "Parsing will be implemented in Phase 2",
            "log_file_id": log_file.id,
            "filename": log_file.filename,
            "size_bytes": log_file.size_bytes,
        }

        # Update job as completed
        job.status = JobStatus.COMPLETED
        job.progress = 100.0
        job.result_summary = json.dumps(result_summary)
        job.completed_at = datetime.now(UTC)

        # Update log file status
        log_file.status = LogFileStatus.PROCESSED
        db.commit()

        return result_summary

    except Exception as e:
        # Handle errors
        if job:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.now(UTC)
        if log_file:
            log_file.status = LogFileStatus.FAILED
        db.commit()
        raise

    finally:
        db.close()
