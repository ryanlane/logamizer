"""Finding model for security signals and anomalies."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.database import Base
from packages.shared.enums import Severity


class Finding(Base):
    """Security finding or anomaly model."""

    __tablename__ = "findings"

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
    finding_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=Severity.INFO,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    suggested_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    site: Mapped["Site"] = relationship("Site", back_populates="findings")  # noqa: F821
    log_file: Mapped["LogFile | None"] = relationship(  # noqa: F821
        "LogFile",
        back_populates="findings",
    )

    def __repr__(self) -> str:
        return f"<Finding {self.finding_type} {self.severity}>"
