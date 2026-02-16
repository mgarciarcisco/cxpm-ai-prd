"""Create project_members table for project sharing.

Revision ID: n1o2p3q4r5s6
Revises: c1d2e3f4g5h6
Create Date: 2026-02-16
"""
from alembic import op
import sqlalchemy as sa


revision = "n1o2p3q4r5s6"
down_revision = "c1d2e3f4g5h6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_members",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column(
            "project_id",
            sa.CHAR(36),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.CHAR(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "role",
            sa.Enum("editor", "viewer", name="projectrole"),
            nullable=False,
        ),
        sa.Column(
            "added_by",
            sa.CHAR(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
    )
    op.create_index("ix_project_members_project_id", "project_members", ["project_id"])
    op.create_index("ix_project_members_user_id", "project_members", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_project_members_user_id", table_name="project_members")
    op.drop_index("ix_project_members_project_id", table_name="project_members")
    op.drop_table("project_members")
    op.execute("DROP TYPE IF EXISTS projectrole")
