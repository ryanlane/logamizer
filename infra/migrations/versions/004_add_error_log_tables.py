"""Add error_groups and error_occurrences tables for error tracking.

Revision ID: 004_add_error_log_tables
Revises: 003_add_log_sources
Create Date: 2026-01-22

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "004_add_error_log_tables"
down_revision = "003_add_log_sources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add error_groups and error_occurrences tables."""
    # Create error_groups table
    op.create_table(
        "error_groups",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("error_type", sa.String(length=255), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=False),
        sa.Column(
            "first_seen",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_seen",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("occurrence_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="unresolved"),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deployment_id", sa.String(length=100), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for error_groups
    op.create_index("ix_error_groups_site_id", "error_groups", ["site_id"])
    op.create_index("ix_error_groups_fingerprint", "error_groups", ["fingerprint"])
    op.create_index("ix_error_groups_deployment_id", "error_groups", ["deployment_id"])
    op.create_index(
        "ix_error_groups_site_fingerprint",
        "error_groups",
        ["site_id", "fingerprint"],
        unique=True,
    )

    # Create error_occurrences table
    op.create_table(
        "error_occurrences",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("error_group_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("log_file_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("error_type", sa.String(length=255), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=False),
        sa.Column("stack_trace", sa.Text(), nullable=True),
        sa.Column("file_path", sa.String(length=500), nullable=True),
        sa.Column("line_number", sa.Integer(), nullable=True),
        sa.Column("function_name", sa.String(length=255), nullable=True),
        sa.Column("request_url", sa.String(length=2048), nullable=True),
        sa.Column("request_method", sa.String(length=10), nullable=True),
        sa.Column("user_id", sa.String(length=255), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("context", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["error_group_id"],
            ["error_groups.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["log_file_id"],
            ["log_files.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for error_occurrences
    op.create_index("ix_error_occurrences_error_group_id", "error_occurrences", ["error_group_id"])
    op.create_index("ix_error_occurrences_log_file_id", "error_occurrences", ["log_file_id"])
    op.create_index("ix_error_occurrences_timestamp", "error_occurrences", ["timestamp"])


def downgrade() -> None:
    """Remove error_groups and error_occurrences tables."""
    op.drop_table("error_occurrences")
    op.drop_table("error_groups")
