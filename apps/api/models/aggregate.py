"""Aggregate model for hourly metrics."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.database import Base


class Aggregate(Base):
    """Hourly aggregated metrics model."""

    __tablename__ = "aggregates"

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
    log_file_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("log_files.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    hour_bucket: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    # Request counts
    requests_count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    status_2xx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status_3xx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status_4xx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status_5xx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Unique counts
    unique_ips: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unique_paths: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Bytes
    total_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    # Top items (JSON arrays)
    top_paths: Mapped[list | None] = mapped_column(JSON, nullable=True)
    top_ips: Mapped[list | None] = mapped_column(JSON, nullable=True)
    top_user_agents: Mapped[list | None] = mapped_column(JSON, nullable=True)
    top_status_codes: Mapped[list | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    site: Mapped["Site"] = relationship("Site", back_populates="aggregates")  # noqa: F821
    log_file: Mapped["LogFile | None"] = relationship(  # noqa: F821
        "LogFile",
        back_populates="aggregates",
    )

    def __repr__(self) -> str:
        return f"<Aggregate {self.hour_bucket}>"
