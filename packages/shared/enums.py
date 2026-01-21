"""Enumerations for Logamizer."""

from enum import StrEnum


class LogFormat(StrEnum):
    """Supported log formats."""

    NGINX_COMBINED = "nginx_combined"
    APACHE_COMBINED = "apache_combined"


class JobType(StrEnum):
    """Types of background jobs."""

    PARSE = "parse"
    DETECT = "detect"
    ANOMALY = "anomaly"
    EXPLAIN = "explain"


class JobStatus(StrEnum):
    """Job processing status."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Severity(StrEnum):
    """Finding severity levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class LogFileStatus(StrEnum):
    """Status of uploaded log file."""

    PENDING_UPLOAD = "pending_upload"
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"
