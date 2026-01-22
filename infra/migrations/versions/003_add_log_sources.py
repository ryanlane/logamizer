"""Add log_sources table for scheduled fetching.

Revision ID: 003_add_log_sources
Revises: 002_site_anomaly_config
Create Date: 2026-01-22

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "003_add_log_sources"
down_revision = "002_site_anomaly_config"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add log_sources table."""
    op.create_table(
        "log_sources",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("source_type", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("connection_config", sa.JSON(), nullable=False),
        sa.Column("schedule_type", sa.String(length=20), nullable=False),
        sa.Column("schedule_config", sa.JSON(), nullable=False),
        sa.Column("last_fetch_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_fetch_status", sa.String(length=20), nullable=True),
        sa.Column("last_fetch_error", sa.Text(), nullable=True),
        sa.Column("last_fetched_bytes", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Remove log_sources table."""
    op.drop_table("log_sources")
