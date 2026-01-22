"""Log source model for scheduled fetching."""

from datetime import datetime
from enum import Enum
from uuid import uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.database import Base


class LogSourceType(str, Enum):
    """Types of log sources."""

    SSH = "ssh"
    SFTP = "sftp"
    S3 = "s3"
    GCS = "gcs"
    HTTP = "http"


class LogSourceStatus(str, Enum):
    """Status of a log source."""

    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"


class LogSource(Base):
    """Scheduled log source configuration."""

    __tablename__ = "log_sources"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    site_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("sites.id", ondelete="CASCADE"))

    # Source configuration
    name: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[LogSourceType] = mapped_column(String(20))
    status: Mapped[LogSourceStatus] = mapped_column(String(20), default=LogSourceStatus.ACTIVE)

    # Connection details (encrypted in production)
    connection_config: Mapped[dict] = mapped_column(JSON)
    # Example for SSH/SFTP:
    # {
    #   "host": "example.com",
    #   "port": 22,
    #   "username": "user",
    #   "password": "encrypted_password",  # or use SSH key
    #   "private_key": "encrypted_key",
    #   "remote_path": "/var/log/nginx/access.log",
    #   "pattern": "*.log"  # for glob matching
    # }
    # Example for S3:
    # {
    #   "bucket": "my-logs",
    #   "prefix": "nginx/",
    #   "access_key_id": "encrypted_key",
    #   "secret_access_key": "encrypted_secret",
    #   "region": "us-east-1",
    #   "endpoint_url": "https://s3.amazonaws.com"  # optional for S3-compatible
    # }

    # Scheduling
    schedule_type: Mapped[str] = mapped_column(String(20))  # interval, cron
    schedule_config: Mapped[dict] = mapped_column(JSON)
    # Example for interval:
    # {"interval_minutes": 60}
    # Example for cron:
    # {"cron": "0 */6 * * *"}  # every 6 hours

    # Tracking
    last_fetch_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_fetch_status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # success, error
    last_fetch_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_fetched_bytes: Mapped[int | None] = mapped_column(nullable=True, default=0)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    site: Mapped["Site"] = relationship("Site", back_populates="log_sources")  # type: ignore
