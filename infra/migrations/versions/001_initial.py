"""Initial migration - create all tables.

Revision ID: 001_initial
Revises:
Create Date: 2026-01-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # Sites table
    op.create_table(
        "sites",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("domain", sa.String(255), nullable=True),
        sa.Column("log_format", sa.String(50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sites_user_id"), "sites", ["user_id"], unique=False)

    # Log files table
    op.create_table(
        "log_files",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("hash_sha256", sa.String(64), nullable=True),
        sa.Column("storage_key", sa.String(512), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_log_files_site_id"), "log_files", ["site_id"], unique=False)

    # Jobs table
    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("log_file_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("job_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("progress", sa.Float(), nullable=False, default=0.0),
        sa.Column("result_summary", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["log_file_id"], ["log_files.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_jobs_log_file_id"), "jobs", ["log_file_id"], unique=False)
    op.create_index(op.f("ix_jobs_status"), "jobs", ["status"], unique=False)

    # Findings table
    op.create_table(
        "findings",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("log_file_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("finding_type", sa.String(100), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("evidence", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("suggested_action", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["log_file_id"], ["log_files.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_findings_site_id"), "findings", ["site_id"], unique=False)
    op.create_index(op.f("ix_findings_log_file_id"), "findings", ["log_file_id"], unique=False)
    op.create_index(op.f("ix_findings_finding_type"), "findings", ["finding_type"], unique=False)
    op.create_index(op.f("ix_findings_severity"), "findings", ["severity"], unique=False)

    # Aggregates table
    op.create_table(
        "aggregates",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("log_file_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("hour_bucket", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requests_count", sa.BigInteger(), nullable=False, default=0),
        sa.Column("status_2xx", sa.Integer(), nullable=False, default=0),
        sa.Column("status_3xx", sa.Integer(), nullable=False, default=0),
        sa.Column("status_4xx", sa.Integer(), nullable=False, default=0),
        sa.Column("status_5xx", sa.Integer(), nullable=False, default=0),
        sa.Column("unique_ips", sa.Integer(), nullable=False, default=0),
        sa.Column("unique_paths", sa.Integer(), nullable=False, default=0),
        sa.Column("total_bytes", sa.BigInteger(), nullable=False, default=0),
        sa.Column("top_paths", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("top_ips", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("top_user_agents", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("top_status_codes", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["log_file_id"], ["log_files.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_aggregates_site_id"), "aggregates", ["site_id"], unique=False)
    op.create_index(op.f("ix_aggregates_log_file_id"), "aggregates", ["log_file_id"], unique=False)
    op.create_index(op.f("ix_aggregates_hour_bucket"), "aggregates", ["hour_bucket"], unique=False)


def downgrade() -> None:
    op.drop_table("aggregates")
    op.drop_table("findings")
    op.drop_table("jobs")
    op.drop_table("log_files")
    op.drop_table("sites")
    op.drop_table("users")
