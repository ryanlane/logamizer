"""Add per-site anomaly configuration.

Revision ID: 002_site_anomaly_config
Revises: 001_initial
Create Date: 2026-01-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_site_anomaly_config"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sites",
        sa.Column("anomaly_baseline_days", sa.Integer(), nullable=False, server_default="7"),
    )
    op.add_column(
        "sites",
        sa.Column(
            "anomaly_min_baseline_hours",
            sa.Integer(),
            nullable=False,
            server_default="24",
        ),
    )
    op.add_column(
        "sites",
        sa.Column("anomaly_z_threshold", sa.Float(), nullable=False, server_default="3.0"),
    )
    op.add_column(
        "sites",
        sa.Column(
            "anomaly_new_path_min_count",
            sa.Integer(),
            nullable=False,
            server_default="20",
        ),
    )


def downgrade() -> None:
    op.drop_column("sites", "anomaly_new_path_min_count")
    op.drop_column("sites", "anomaly_z_threshold")
    op.drop_column("sites", "anomaly_min_baseline_hours")
    op.drop_column("sites", "anomaly_baseline_days")
