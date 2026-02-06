"""Add user_id to projects and meeting_recaps for user isolation.

Revision ID: k8l9m0n1o2p3a
Revises: k8l9m0n1o2p3
Create Date: 2026-02-05

Creates a default 'system' user, assigns all existing rows to it,
then makes user_id NOT NULL.
"""
from alembic import op


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

    # Add user_id to projects (idempotent: skip if column/constraint/index exist)
    op.execute(f"ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id CHAR(36)")
    op.execute(f"UPDATE projects SET user_id = '{SYSTEM_USER_ID}' WHERE user_id IS NULL")
    op.execute("ALTER TABLE projects ALTER COLUMN user_id SET NOT NULL")
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_user_id') THEN
                ALTER TABLE projects ADD CONSTRAINT fk_projects_user_id
                FOREIGN KEY (user_id) REFERENCES users(id);
            END IF;
        END $$
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_projects_user_id ON projects (user_id)")

    # Add user_id to meeting_recaps (idempotent)
    op.execute(f"ALTER TABLE meeting_recaps ADD COLUMN IF NOT EXISTS user_id CHAR(36)")
    op.execute(f"UPDATE meeting_recaps SET user_id = '{SYSTEM_USER_ID}' WHERE user_id IS NULL")
    op.execute("ALTER TABLE meeting_recaps ALTER COLUMN user_id SET NOT NULL")
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_meeting_recaps_user_id') THEN
                ALTER TABLE meeting_recaps ADD CONSTRAINT fk_meeting_recaps_user_id
                FOREIGN KEY (user_id) REFERENCES users(id);
            END IF;
        END $$
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_meeting_recaps_user_id ON meeting_recaps (user_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_meeting_recaps_user_id")
    op.execute("ALTER TABLE meeting_recaps DROP CONSTRAINT IF EXISTS fk_meeting_recaps_user_id")
    op.execute("ALTER TABLE meeting_recaps DROP COLUMN IF EXISTS user_id")

    op.execute("DROP INDEX IF EXISTS ix_projects_user_id")
    op.execute("ALTER TABLE projects DROP CONSTRAINT IF EXISTS fk_projects_user_id")
    op.execute("ALTER TABLE projects DROP COLUMN IF EXISTS user_id")

    op.execute(f"DELETE FROM users WHERE id = '{SYSTEM_USER_ID}'")
