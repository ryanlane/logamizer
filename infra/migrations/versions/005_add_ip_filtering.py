"""Add IP filtering settings to sites table.

Revision ID: 005_add_ip_filtering
Revises: 004_add_error_log_tables
Create Date: 2026-01-22

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "005_add_ip_filtering"
down_revision = "004_add_error_log_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add filtered_ips column to sites table."""
    # Add filtered_ips as JSONB array, defaulting to empty array
    op.add_column(
        "sites",
        sa.Column(
            "filtered_ips",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    """Remove filtered_ips column from sites table."""
    op.drop_column("sites", "filtered_ips")
