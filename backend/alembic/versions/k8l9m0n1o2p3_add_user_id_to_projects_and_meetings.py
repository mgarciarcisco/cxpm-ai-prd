"""Add user_id to projects and meeting_recaps for user isolation.

Revision ID: k8l9m0n1o2p3a
Revises: k8l9m0n1o2p3
Create Date: 2026-02-05

Creates a default 'system' user, assigns all existing rows to it,
then makes user_id NOT NULL.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "k8l9m0n1o2p3a"
down_revision = "k8l9m0n1o2p3"
branch_labels = None
depends_on = None

SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"


def upgrade() -> None:
    # Create system user for existing data (idempotent: skip if already exists)
    op.execute(
        f"""
        INSERT INTO users (id, email, name, hashed_password, is_active, is_admin, created_at, updated_at)
        VALUES (
            '{SYSTEM_USER_ID}',
            'system@localhost',
            'System',
            '!not-a-valid-hash',
            false,
            false,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO NOTHING
        """
    )

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
