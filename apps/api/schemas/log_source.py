"""Log source schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class SSHConfig(BaseModel):
    """SSH/SFTP connection configuration."""

    host: str
    port: int = 22
    username: str
    password: str | None = None
    private_key: str | None = None
    remote_path: str
    pattern: str = "*.log"


class S3Config(BaseModel):
    """S3-compatible storage configuration."""

    bucket: str
    prefix: str = ""
    access_key_id: str
    secret_access_key: str
    region: str = "us-east-1"
    endpoint_url: str | None = None  # For MinIO, DigitalOcean Spaces, etc.


class IntervalSchedule(BaseModel):
    """Interval-based schedule."""

    interval_minutes: int = Field(ge=5, le=10080)  # 5 minutes to 7 days


class CronSchedule(BaseModel):
    """Cron-based schedule."""

    cron: str  # Standard cron expression


class LogSourceCreate(BaseModel):
    """Create a new log source."""

    name: str
    source_type: str  # "ssh", "sftp", "s3", "gcs", "http"
    connection_config: dict  # SSHConfig or S3Config serialized
    schedule_type: str  # "interval" or "cron"
    schedule_config: dict  # IntervalSchedule or CronSchedule serialized


class LogSourceUpdate(BaseModel):
    """Update an existing log source."""

    name: str | None = None
    status: str | None = None  # "active", "paused", "error"
    connection_config: dict | None = None
    schedule_type: str | None = None
    schedule_config: dict | None = None


class LogSourceResponse(BaseModel):
    """Log source response."""

    id: str
    site_id: str
    name: str
    source_type: str
    status: str
    connection_config: dict  # Redacted sensitive fields
    schedule_type: str
    schedule_config: dict
    last_fetch_at: datetime | None
    last_fetch_status: str | None
    last_fetch_error: str | None
    last_fetched_bytes: int | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LogSourceListResponse(BaseModel):
    """List of log sources."""

    log_sources: list[LogSourceResponse]
    total: int
