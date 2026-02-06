"""remove_date_cr_from_jira_story

Revision ID: k8l9m0n1o2p3
Revises: j7k8l9m0n1o2
Create Date: 2026-01-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'k8l9m0n1o2p3'
down_revision: Union[str, Sequence[str], None] = 'j7k8l9m0n1o2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - remove date_cr column and its index, add created_at index."""
    # Drop the date_cr index
    op.drop_index('ix_jira_story_date_cr', table_name='jira_story')
    
    # Drop the date_cr column
    # Note: SQLite requires special handling for dropping columns
    # We need to recreate the table without the date_cr column
    with op.batch_alter_table('jira_story', schema=None) as batch_op:
        batch_op.drop_column('date_cr')
    
    # Create index on created_at
    op.create_index('ix_jira_story_created_at', 'jira_story', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema - restore date_cr column and its index."""
    # Drop the created_at index
    op.drop_index('ix_jira_story_created_at', table_name='jira_story')
    
    # Add back the date_cr column
    with op.batch_alter_table('jira_story', schema=None) as batch_op:
        batch_op.add_column(sa.Column('date_cr', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')))
    
    # Create index on date_cr
    op.create_index('ix_jira_story_date_cr', 'jira_story', ['date_cr'], unique=False)
