"""Error log model for application error tracking."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.database import Base


class ErrorGroup(Base):
    """Grouped errors by fingerprint."""

    __tablename__ = "error_groups"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    site_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("sites.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    fingerprint: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Hash of error signature for grouping",
    )
    error_type: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Exception class or error type",
    )
    error_message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Primary error message",
    )
    first_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    occurrence_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        comment="Total number of times this error occurred",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="unresolved",
        comment="Status: unresolved, resolved, ignored",
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    deployment_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Deployment/release identifier when error first appeared",
    )
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    site: Mapped["Site"] = relationship("Site", back_populates="error_groups")  # noqa: F821
    error_occurrences: Mapped[list["ErrorOccurrence"]] = relationship(
        "ErrorOccurrence",
        back_populates="error_group",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ErrorGroup {self.error_type}: {self.occurrence_count} occurrences>"


class ErrorOccurrence(Base):
    """Individual error occurrence with full context."""

    __tablename__ = "error_occurrences"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    error_group_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("error_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    log_file_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("log_files.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    error_type: Mapped[str] = mapped_column(String(255), nullable=False)
    error_message: Mapped[str] = mapped_column(Text, nullable=False)
    stack_trace: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="File where error occurred",
    )
    line_number: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Line number in file where error occurred",
    )
    function_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Function/method where error occurred",
    )
    request_url: Mapped[str | None] = mapped_column(
        String(2048),
        nullable=True,
        comment="Request URL if from web request",
    )
    request_method: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        comment="HTTP method if from web request",
    )
    user_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="User ID if authenticated",
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
        comment="Client IP address",
    )
    user_agent: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="User agent string",
    )
    context: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Additional context (vars, request data, etc)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    error_group: Mapped["ErrorGroup"] = relationship(
        "ErrorGroup",
        back_populates="error_occurrences",
    )
    log_file: Mapped["LogFile | None"] = relationship("LogFile")  # noqa: F821

    def __repr__(self) -> str:
        return f"<ErrorOccurrence {self.error_type} at {self.timestamp}>"
