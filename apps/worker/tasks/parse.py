"""Log file parsing task."""

import json
import os
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
    create_engine,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from apps.worker.celery_app import celery_app
from packages.shared.enums import JobStatus, LogFileStatus

# Sync database URL (Celery doesn't use async)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://logamizer:logamizer@localhost:5432/logamizer",
).replace("+asyncpg", "")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# Define minimal models for the worker (to avoid importing async API models)
Base = declarative_base()


class Job(Base):
    """Job model for worker."""

    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    log_file_id = Column(UUID(as_uuid=False), ForeignKey("log_files.id"), nullable=False)
    job_type = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False)
    progress = Column(Float, nullable=False, default=0.0)
    result_summary = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    celery_task_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class LogFile(Base):
    """LogFile model for worker."""

    __tablename__ = "log_files"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    site_id = Column(UUID(as_uuid=False), nullable=False)
    filename = Column(String(255), nullable=False)
    size_bytes = Column(BigInteger, nullable=True)
    hash_sha256 = Column(String(64), nullable=True)
    storage_key = Column(String(512), nullable=False)
    status = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    uploaded_at = Column(DateTime(timezone=True), nullable=True)


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
