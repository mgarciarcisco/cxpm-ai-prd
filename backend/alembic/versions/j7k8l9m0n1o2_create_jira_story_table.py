"""create_jira_story_table

Revision ID: j7k8l9m0n1o2
Revises: i6j7k8l9m0n1
Create Date: 2026-01-29 00:00:00.000000

PostgreSQL only. Idempotent: CREATE TABLE IF NOT EXISTS so the table is created when missing.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'j7k8l9m0n1o2'
down_revision: Union[str, Sequence[str], None] = 'i6j7k8l9m0n1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create jira_story table if it does not exist (PostgreSQL)."""
    op.execute("""
        CREATE TABLE IF NOT EXISTS jira_story (
            id CHAR(36) NOT NULL,
            project_id CHAR(36) NOT NULL,
            title VARCHAR(100) NOT NULL,
            description TEXT,
            problem_statement TEXT,
            target_user_roles TEXT,
            data_sources TEXT,
            business_rules TEXT,
            response_example TEXT,
            acceptance_criteria TEXT,
            reporter VARCHAR(100),
            notes TEXT,
            parent_jira_id INTEGER,
            date_cr TIMESTAMP NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            PRIMARY KEY (id),
            FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_jira_story_date_cr ON jira_story (date_cr)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_jira_story_parent_jira_id ON jira_story (parent_jira_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_jira_story_project_id ON jira_story (project_id)")


def downgrade() -> None:
    """Drop jira_story table (PostgreSQL)."""
    op.execute("DROP INDEX IF EXISTS ix_jira_story_project_id")
    op.execute("DROP INDEX IF EXISTS ix_jira_story_parent_jira_id")
    op.execute("DROP INDEX IF EXISTS ix_jira_story_date_cr")
    op.execute("DROP TABLE IF EXISTS jira_story")
