"""Add user_id to projects and meeting_recaps for user isolation.

Revision ID: k8l9m0n1o2p3a
Revises: k8l9m0n1o2p3
Create Date: 2026-02-05

Creates a default 'system' user, assigns all existing rows to it,
then makes user_id NOT NULL.
"""
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "k8l9m0n1o2p3a"
down_revision = "k8l9m0n1o2p3"
branch_labels = None
depends_on = None

SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"


def upgrade() -> None:
    # Create system user for existing data
    now = datetime.now(timezone.utc)
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
        "created_at": now,
        "updated_at": now,
    }])

    # Add user_id to projects (nullable first, then backfill, then make NOT NULL)
    op.add_column("projects", sa.Column("user_id", sa.CHAR(36), nullable=True))
    op.execute(f"UPDATE projects SET user_id = '{SYSTEM_USER_ID}'")
    with op.batch_alter_table("projects") as batch_op:
        batch_op.alter_column("user_id", nullable=False)
        batch_op.create_foreign_key("fk_projects_user_id", "users", ["user_id"], ["id"])
    op.create_index("ix_projects_user_id", "projects", ["user_id"])

    # Add user_id to meeting_recaps (nullable first, then backfill, then make NOT NULL)
    op.add_column("meeting_recaps", sa.Column("user_id", sa.CHAR(36), nullable=True))
    op.execute(f"UPDATE meeting_recaps SET user_id = '{SYSTEM_USER_ID}'")
    with op.batch_alter_table("meeting_recaps") as batch_op:
        batch_op.alter_column("user_id", nullable=False)
        batch_op.create_foreign_key("fk_meeting_recaps_user_id", "users", ["user_id"], ["id"])
    op.create_index("ix_meeting_recaps_user_id", "meeting_recaps", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_meeting_recaps_user_id", table_name="meeting_recaps")
    op.drop_constraint("fk_meeting_recaps_user_id", "meeting_recaps", type_="foreignkey")
    op.drop_column("meeting_recaps", "user_id")

    op.drop_index("ix_projects_user_id", table_name="projects")
    op.drop_constraint("fk_projects_user_id", "projects", type_="foreignkey")
    op.drop_column("projects", "user_id")

    op.execute(f"DELETE FROM users WHERE id = '{SYSTEM_USER_ID}'")
