"""Site model."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.database import Base
from packages.shared.enums import LogFormat


class Site(Base):
    """Site (website/application) model for log analysis."""

    __tablename__ = "sites"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    log_format: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=LogFormat.NGINX_COMBINED,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sites")  # noqa: F821
    log_files: Mapped[list["LogFile"]] = relationship(  # noqa: F821
        "LogFile",
        back_populates="site",
        cascade="all, delete-orphan",
    )
    findings: Mapped[list["Finding"]] = relationship(  # noqa: F821
        "Finding",
        back_populates="site",
        cascade="all, delete-orphan",
    )
    aggregates: Mapped[list["Aggregate"]] = relationship(  # noqa: F821
        "Aggregate",
        back_populates="site",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Site {self.name}>"
