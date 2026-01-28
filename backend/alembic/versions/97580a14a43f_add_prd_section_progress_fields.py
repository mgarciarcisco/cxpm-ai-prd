"""add prd section progress fields

Revision ID: 97580a14a43f
Revises: f3a2b5c8d9e1
Create Date: 2026-01-26 23:00:00.000000

This migration adds fields to the PRD model for tracking section-level
generation progress in staged parallel PRD generation:
- current_stage: which stage (1, 2, or 3) is being generated
- sections_completed: count of completed sections
- sections_total: total expected sections
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '97580a14a43f'
down_revision: Union[str, Sequence[str], None] = 'f3a2b5c8d9e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add section progress tracking fields to prds table."""
    # Add current_stage column (nullable)
    op.add_column('prds', sa.Column('current_stage', sa.Integer(), nullable=True))

    # Add sections_completed column with default 0
    op.add_column('prds', sa.Column('sections_completed', sa.Integer(), nullable=False, server_default='0'))

    # Add sections_total column with default 0
    op.add_column('prds', sa.Column('sections_total', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    """Remove section progress tracking fields from prds table."""
    op.drop_column('prds', 'sections_total')
    op.drop_column('prds', 'sections_completed')
    op.drop_column('prds', 'current_stage')
