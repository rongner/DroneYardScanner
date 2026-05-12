"""initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
    )

    op.create_table(
        "missions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "status",
            sa.Enum("planned", "flying", "completed", "failed", name="missionstatus"),
            nullable=False,
            server_default="planned",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("yard_id", sa.Integer(), sa.ForeignKey("yards.id"), nullable=True),
    )

    op.create_table(
        "waypoints",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("mission_id", sa.Integer(), sa.ForeignKey("missions.id"), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("label", sa.String(100), nullable=True),
    )

    op.create_table(
        "plant_scans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("waypoint_id", sa.Integer(), sa.ForeignKey("waypoints.id"), nullable=False),
        sa.Column("photo_path", sa.String(500), nullable=False),
        sa.Column("scanned_at", sa.DateTime(), nullable=False),
        sa.Column("plant_name", sa.String(200), nullable=True),
        sa.Column("health_status", sa.String(50), nullable=True),
        sa.Column("diseases", sa.String(1000), nullable=True),
        sa.Column("probability", sa.Float(), nullable=True),
        sa.Column("raw_response", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("plant_scans")
    op.drop_table("waypoints")
    op.drop_table("missions")
    op.execute("DROP TYPE IF EXISTS missionstatus")
    op.drop_table("yards")
