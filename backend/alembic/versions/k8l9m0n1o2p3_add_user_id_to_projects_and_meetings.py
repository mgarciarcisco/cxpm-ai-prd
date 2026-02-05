"""Add user_id to projects and meeting_recaps for user isolation.

Revision ID: k8l9m0n1o2p3
Revises: j7k8l9m0n1o2
Create Date: 2026-02-05

Creates a default 'system' user, assigns all existing rows to it,
then makes user_id NOT NULL.
"""
from alembic import op
import sqlalchemy as sa
import uuid


# revision identifiers, used by Alembic.
revision = "k8l9m0n1o2p3"
down_revision = "j7k8l9m0n1o2"
branch_labels = None
depends_on = None

SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"


def upgrade() -> None:
    # Create system user for existing data
    users_table = sa.table(
        "users",
        sa.column("id", sa.CHAR(36)),
        sa.column("email", sa.String(255)),
        sa.column("name", sa.String(255)),
        sa.column("hashed_password", sa.String(255)),
        sa.column("is_active", sa.Boolean()),
        sa.column("is_admin", sa.Boolean()),
        sa.column("created_at", sa.DateTime()),
        sa.column("updated_at", sa.DateTime()),
    )
    op.bulk_insert(users_table, [{
        "id": SYSTEM_USER_ID,
        "email": "system@localhost",
        "name": "System",
        "hashed_password": "!not-a-valid-hash",
        "is_active": False,
        "is_admin": False,
        "created_at": sa.func.now(),
        "updated_at": sa.func.now(),
    }])

    # Add user_id to projects (nullable first)
    op.add_column("projects", sa.Column("user_id", sa.CHAR(36), nullable=True))
    op.execute(f"UPDATE projects SET user_id = '{SYSTEM_USER_ID}'")
    op.alter_column("projects", "user_id", nullable=False)
    op.create_foreign_key("fk_projects_user_id", "projects", "users", ["user_id"], ["id"])
    op.create_index("ix_projects_user_id", "projects", ["user_id"])

    # Add user_id to meeting_recaps (nullable first)
    op.add_column("meeting_recaps", sa.Column("user_id", sa.CHAR(36), nullable=True))
    op.execute(f"UPDATE meeting_recaps SET user_id = '{SYSTEM_USER_ID}'")
    op.alter_column("meeting_recaps", "user_id", nullable=False)
    op.create_foreign_key("fk_meeting_recaps_user_id", "meeting_recaps", "users", ["user_id"], ["id"])
    op.create_index("ix_meeting_recaps_user_id", "meeting_recaps", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_meeting_recaps_user_id", table_name="meeting_recaps")
    op.drop_constraint("fk_meeting_recaps_user_id", "meeting_recaps", type_="foreignkey")
    op.drop_column("meeting_recaps", "user_id")

    op.drop_index("ix_projects_user_id", table_name="projects")
    op.drop_constraint("fk_projects_user_id", "projects", type_="foreignkey")
    op.drop_column("projects", "user_id")

    op.execute(f"DELETE FROM users WHERE id = '{SYSTEM_USER_ID}'")
