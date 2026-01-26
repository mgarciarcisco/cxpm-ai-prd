"""add prd and user story tables

Revision ID: e8a5f2b3c1d0
Revises: d14d0c3d54db
Create Date: 2026-01-26 21:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8a5f2b3c1d0'
down_revision: Union[str, Sequence[str], None] = 'd14d0c3d54db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create prds table
    op.create_table('prds',
        sa.Column('id', sa.CHAR(length=36), nullable=False),
        sa.Column('project_id', sa.CHAR(length=36), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=True),
        sa.Column('mode', sa.Enum('draft', 'detailed', name='prdmode'), nullable=False),
        sa.Column('sections', sa.JSON(), nullable=True),
        sa.Column('raw_markdown', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('queued', 'generating', 'ready', 'failed', 'cancelled', 'archived', name='prdstatus'), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(length=255), nullable=True),
        sa.Column('updated_by', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_prds_project_id', 'prds', ['project_id'], unique=False)
    op.create_index('ix_prds_project_version', 'prds', ['project_id', 'version'], unique=False)
    op.create_index('ix_prds_status', 'prds', ['status'], unique=False)

    # Create story_batches table (must be before user_stories due to FK dependency)
    op.create_table('story_batches',
        sa.Column('id', sa.CHAR(length=36), nullable=False),
        sa.Column('project_id', sa.CHAR(length=36), nullable=False),
        sa.Column('format', sa.Enum('classic', 'job_story', name='storyformat'), nullable=False),
        sa.Column('section_filter', sa.JSON(), nullable=True),
        sa.Column('story_count', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('queued', 'generating', 'ready', 'failed', 'cancelled', name='storybatchstatus'), nullable=False),
        sa.Column('error_message', sa.String(length=2000), nullable=True),
        sa.Column('created_by', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_story_batches_project_id', 'story_batches', ['project_id'], unique=False)
    op.create_index('ix_story_batches_status', 'story_batches', ['status'], unique=False)

    # Create user_stories table
    op.create_table('user_stories',
        sa.Column('id', sa.CHAR(length=36), nullable=False),
        sa.Column('project_id', sa.CHAR(length=36), nullable=False),
        sa.Column('batch_id', sa.CHAR(length=36), nullable=True),
        sa.Column('story_number', sa.Integer(), nullable=False),
        sa.Column('format', sa.Enum('classic', 'job_story', name='storyformat'), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('acceptance_criteria', sa.JSON(), nullable=True),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('labels', sa.JSON(), nullable=True),
        sa.Column('size', sa.Enum('xs', 's', 'm', 'l', 'xl', name='storysize'), nullable=True),
        sa.Column('requirement_ids', sa.JSON(), nullable=True),
        sa.Column('status', sa.Enum('draft', 'ready', 'exported', name='storystatus'), nullable=False),
        sa.Column('created_by', sa.String(length=255), nullable=True),
        sa.Column('updated_by', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['batch_id'], ['story_batches.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_user_stories_project_id', 'user_stories', ['project_id'], unique=False)
    op.create_index('ix_user_stories_batch_id', 'user_stories', ['batch_id'], unique=False)
    op.create_index('ix_user_stories_status', 'user_stories', ['status'], unique=False)
    op.create_index('ix_user_stories_project_story_number', 'user_stories', ['project_id', 'story_number'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop user_stories table (must be before story_batches due to FK dependency)
    op.drop_index('ix_user_stories_project_story_number', table_name='user_stories')
    op.drop_index('ix_user_stories_status', table_name='user_stories')
    op.drop_index('ix_user_stories_batch_id', table_name='user_stories')
    op.drop_index('ix_user_stories_project_id', table_name='user_stories')
    op.drop_table('user_stories')

    # Drop story_batches table
    op.drop_index('ix_story_batches_status', table_name='story_batches')
    op.drop_index('ix_story_batches_project_id', table_name='story_batches')
    op.drop_table('story_batches')

    # Drop prds table
    op.drop_index('ix_prds_status', table_name='prds')
    op.drop_index('ix_prds_project_version', table_name='prds')
    op.drop_index('ix_prds_project_id', table_name='prds')
    op.drop_table('prds')
