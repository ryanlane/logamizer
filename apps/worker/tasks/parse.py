"""Log file parsing task."""

import json
import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import boto3
from botocore.config import Config
from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from apps.worker.celery_app import celery_app
from apps.worker.parsers import ApacheCombinedParser, NginxCombinedParser, Parser
from apps.worker.utils.aggregator import Aggregator
from apps.worker.utils.anomaly import AggregateSnapshot, detect_anomalies
from apps.worker.utils.security import detect_security_findings
from packages.shared.enums import JobStatus, LogFileStatus

# Sync database URL (Celery doesn't use async)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://logamizer:logamizer@localhost:5432/logamizer",
).replace("+asyncpg", "")

# S3/MinIO configuration
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "http://localhost:9000")
S3_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY_ID", "minioadmin")
S3_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_ACCESS_KEY", "minioadmin")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "logamizer-logs")
S3_REGION = os.getenv("S3_REGION", "us-east-1")

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


class Site(Base):
    """Site model for worker."""

    __tablename__ = "sites"

    id = Column(UUID(as_uuid=False), primary_key=True)
    user_id = Column(UUID(as_uuid=False), nullable=False)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=True)
    log_format = Column(String(50), nullable=False)


class Aggregate(Base):
    """Aggregate model for worker."""

    __tablename__ = "aggregates"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    site_id = Column(UUID(as_uuid=False), nullable=False)
    log_file_id = Column(UUID(as_uuid=False), nullable=True)
    hour_bucket = Column(DateTime(timezone=True), nullable=False)
    requests_count = Column(BigInteger, nullable=False, default=0)
    status_2xx = Column(Integer, nullable=False, default=0)
    status_3xx = Column(Integer, nullable=False, default=0)
    status_4xx = Column(Integer, nullable=False, default=0)
    status_5xx = Column(Integer, nullable=False, default=0)
    unique_ips = Column(Integer, nullable=False, default=0)
    unique_paths = Column(Integer, nullable=False, default=0)
    total_bytes = Column(BigInteger, nullable=False, default=0)
    top_paths = Column(JSON, nullable=True)
    top_ips = Column(JSON, nullable=True)
    top_user_agents = Column(JSON, nullable=True)
    top_status_codes = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Finding(Base):
    """Finding model for worker."""

    __tablename__ = "findings"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    site_id = Column(UUID(as_uuid=False), nullable=False)
    log_file_id = Column(UUID(as_uuid=False), nullable=True)
    finding_type = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    evidence = Column(JSON, nullable=True)
    suggested_action = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


def get_s3_client():
    """Get S3 client for MinIO."""
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=S3_ACCESS_KEY_ID,
        aws_secret_access_key=S3_SECRET_ACCESS_KEY,
        region_name=S3_REGION,
        config=Config(signature_version="s3v4"),
    )


def get_parser(log_format: str) -> Parser:
    """Get the appropriate parser for the log format."""
    if log_format == "nginx_combined":
        return NginxCombinedParser()
    elif log_format == "apache_combined":
        return ApacheCombinedParser()
    else:
        raise ValueError(f"Unsupported log format: {log_format}")


@celery_app.task(bind=True, name="apps.worker.tasks.parse.parse_log_file")
def parse_log_file(self, job_id: str) -> dict:
    """
    Parse a log file and generate aggregates.

    This task:
    1. Downloads the log file from S3/MinIO
    2. Parses it using the appropriate parser
    3. Aggregates the events into hourly buckets
    4. Stores the aggregates in the database
    5. Updates job status with results
    """
    db: Session = SessionLocal()
    job = None
    log_file = None

    try:
        # Get job
        job = db.query(Job).filter(Job.id == job_id).first()
        if job is None:
            return {"error": "Job not found"}

        # Update job status
        job.status = JobStatus.PROCESSING
        job.started_at = datetime.now(UTC)
        job.progress = 5.0
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

        # Get site for log format
        site = db.query(Site).filter(Site.id == log_file.site_id).first()
        if site is None:
            raise ValueError("Site not found")

        job.progress = 10.0
        db.commit()

        # Download file from S3
        s3_client = get_s3_client()
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=log_file.storage_key)
        file_content = response["Body"].read()

        job.progress = 20.0
        db.commit()

        # Get parser for the log format
        parser = get_parser(site.log_format)

        # Parse the log file
        parse_result = parser.parse_bytes(file_content)

        job.progress = 60.0
        db.commit()

        # Aggregate the events
        aggregator = Aggregator()
        aggregation = aggregator.aggregate_events(parse_result.events)

        job.progress = 80.0
        db.commit()

        # Store aggregates in database
        created_aggregates: list[Aggregate] = []
        for bucket in aggregation.hourly_buckets:
            bucket_data = bucket.to_dict()
            aggregate = Aggregate(
                site_id=site.id,
                log_file_id=log_file.id,
                hour_bucket=bucket.hour,
                requests_count=bucket.requests_count,
                status_2xx=bucket.status_2xx,
                status_3xx=bucket.status_3xx,
                status_4xx=bucket.status_4xx,
                status_5xx=bucket.status_5xx,
                unique_ips=len(bucket.ips),
                unique_paths=len(bucket.paths),
                total_bytes=bucket.total_bytes,
                top_paths=bucket_data["top_paths"],
                top_ips=bucket_data["top_ips"],
                top_user_agents=bucket_data["top_user_agents"],
                top_status_codes=bucket_data["top_status_codes"],
            )
            db.add(aggregate)
            created_aggregates.append(aggregate)

        db.commit()

        # Detect and store security findings
        findings = detect_security_findings(parse_result.events)
        for finding in findings:
            db.add(
                Finding(
                    site_id=site.id,
                    log_file_id=log_file.id,
                    finding_type=finding.finding_type,
                    severity=finding.severity,
                    title=finding.title,
                    description=finding.description,
                    evidence=finding.evidence,
                    suggested_action=finding.suggested_action,
                    metadata_json=finding.metadata,
                )
            )

        db.commit()

        # Detect and store anomaly findings based on aggregates
        if created_aggregates:
            earliest_hour = min(a.hour_bucket for a in created_aggregates)
            baseline_start = earliest_hour - timedelta(days=7)

            baseline_query = (
                db.query(Aggregate)
                .filter(
                    Aggregate.site_id == site.id,
                    Aggregate.hour_bucket >= baseline_start,
                )
                .order_by(Aggregate.hour_bucket.asc())
            )
            baseline_aggregates = baseline_query.all()

            site_snapshots = [
                AggregateSnapshot(
                    hour_bucket=a.hour_bucket,
                    requests_count=a.requests_count,
                    status_5xx=a.status_5xx,
                    unique_ips=a.unique_ips,
                    top_paths=a.top_paths,
                )
                for a in baseline_aggregates
            ]

            target_snapshots = [
                AggregateSnapshot(
                    hour_bucket=a.hour_bucket,
                    requests_count=a.requests_count,
                    status_5xx=a.status_5xx,
                    unique_ips=a.unique_ips,
                    top_paths=a.top_paths,
                )
                for a in created_aggregates
            ]

            anomaly_findings = detect_anomalies(
                site_snapshots,
                target_snapshots,
            )

            for finding in anomaly_findings:
                db.add(
                    Finding(
                        site_id=site.id,
                        log_file_id=log_file.id,
                        finding_type=finding.finding_type,
                        severity=finding.severity,
                        title=finding.title,
                        description=finding.description,
                        evidence=finding.evidence,
                        suggested_action=finding.suggested_action,
                        metadata_json=finding.metadata,
                    )
                )

            db.commit()
        else:
            anomaly_findings = []

        job.progress = 90.0
        db.commit()

        # Build result summary
        result_summary = {
            "status": "completed",
            "log_file_id": log_file.id,
            "filename": log_file.filename,
            "size_bytes": log_file.size_bytes,
            "parse_stats": parse_result.to_dict(),
            "aggregation": aggregation.to_dict(),
            "findings": [finding.to_dict() for finding in findings],
            "anomalies": [finding.to_dict() for finding in anomaly_findings],
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
        db.rollback()
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
