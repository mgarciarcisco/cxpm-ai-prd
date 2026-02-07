"""drop user_stories and story_batches tables

Revision ID: e0a1b2c3d4e5
Revises: d9ff7c9b3250
Create Date: 2026-01-29

Remove UserStory and StoryBatch models: drop user_stories and story_batches tables (PostgreSQL).
"""
from alembic import op


revision = "e0a1b2c3d4e5"
down_revision = "d9ff7c9b3250"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Drop user_stories and story_batches tables."""
    op.execute("DROP TABLE IF EXISTS user_stories")
    op.execute("DROP TABLE IF EXISTS story_batches")


def downgrade() -> None:
    """Recreate tables is not supported; schema was defined in e8a5f2b3c1d0."""
    pass
