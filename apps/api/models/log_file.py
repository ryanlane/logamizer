"""LogFile model."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.database import Base
from packages.shared.enums import LogFileStatus


class LogFile(Base):
    """Uploaded log file model."""

    __tablename__ = "log_files"

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
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    hash_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=LogFileStatus.PENDING_UPLOAD,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    uploaded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    site: Mapped["Site"] = relationship("Site", back_populates="log_files")  # noqa: F821
    jobs: Mapped[list["Job"]] = relationship(  # noqa: F821
        "Job",
        back_populates="log_file",
        cascade="all, delete-orphan",
    )
    findings: Mapped[list["Finding"]] = relationship(  # noqa: F821
        "Finding",
        back_populates="log_file",
        cascade="all, delete-orphan",
    )
    aggregates: Mapped[list["Aggregate"]] = relationship(  # noqa: F821
        "Aggregate",
        back_populates="log_file",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<LogFile {self.filename}>"
