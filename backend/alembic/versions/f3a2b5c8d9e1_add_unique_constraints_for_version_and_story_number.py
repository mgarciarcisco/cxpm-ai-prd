"""add unique constraints for version and story number

Revision ID: f3a2b5c8d9e1
Revises: e8a5f2b3c1d0
Create Date: 2026-01-26 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f3a2b5c8d9e1'
down_revision: Union[str, Sequence[str], None] = 'e8a5f2b3c1d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add unique constraints for PRD version and story number.
    
    These constraints provide defense-in-depth against race conditions.
    Application logic handles uniqueness via row-level locking, but these
    database constraints are the safety net.
    """
    # Drop existing non-unique index on prds (project_id, version)
    op.drop_index('ix_prds_project_version', table_name='prds')
    
    # Create unique index on prds (project_id, version)
    op.create_index(
        'uq_prds_project_version',
        'prds',
        ['project_id', 'version'],
        unique=True
    )
    
    # Drop existing non-unique index on user_stories (project_id, story_number)
    op.drop_index('ix_user_stories_project_story_number', table_name='user_stories')
    
    # Create unique index on user_stories (project_id, story_number)
    op.create_index(
        'uq_user_stories_project_story_number',
        'user_stories',
        ['project_id', 'story_number'],
        unique=True
    )


def downgrade() -> None:
    """Remove unique constraints and restore non-unique indexes."""
    # Drop unique index on user_stories
    op.drop_index('uq_user_stories_project_story_number', table_name='user_stories')
    
    # Restore non-unique index on user_stories
    op.create_index(
        'ix_user_stories_project_story_number',
        'user_stories',
        ['project_id', 'story_number'],
        unique=False
    )
    
    # Drop unique index on prds
    op.drop_index('uq_prds_project_version', table_name='prds')
    
    # Restore non-unique index on prds
    op.create_index(
        'ix_prds_project_version',
        'prds',
        ['project_id', 'version'],
        unique=False
    )
