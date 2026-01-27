"""add stage status fields to projects

Revision ID: a1b2c3d4e5f6
Revises: 97580a14a43f
Create Date: 2026-01-27 14:00:00.000000

This migration adds stage status tracking fields to the projects table:
- requirements_status: empty, has_items, reviewed
- prd_status: empty, draft, ready
- stories_status: empty, generated, refined
- mockups_status: empty, generated
- export_status: not_exported, exported
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '97580a14a43f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add stage status fields to projects table."""
    # Add requirements_status column
    op.add_column('projects', sa.Column(
        'requirements_status',
        sa.Enum('empty', 'has_items', 'reviewed', name='requirementsstatus'),
        nullable=False,
        server_default='empty'
    ))

    # Add prd_status column
    op.add_column('projects', sa.Column(
        'prd_status',
        sa.Enum('empty', 'draft', 'ready', name='prdstagestatus'),
        nullable=False,
        server_default='empty'
    ))

    # Add stories_status column
    op.add_column('projects', sa.Column(
        'stories_status',
        sa.Enum('empty', 'generated', 'refined', name='storiesstatus'),
        nullable=False,
        server_default='empty'
    ))

    # Add mockups_status column
    op.add_column('projects', sa.Column(
        'mockups_status',
        sa.Enum('empty', 'generated', name='mockupsstatus'),
        nullable=False,
        server_default='empty'
    ))

    # Add export_status column
    op.add_column('projects', sa.Column(
        'export_status',
        sa.Enum('not_exported', 'exported', name='exportstatus'),
        nullable=False,
        server_default='not_exported'
    ))


def downgrade() -> None:
    """Remove stage status fields from projects table."""
    op.drop_column('projects', 'export_status')
    op.drop_column('projects', 'mockups_status')
    op.drop_column('projects', 'stories_status')
    op.drop_column('projects', 'prd_status')
    op.drop_column('projects', 'requirements_status')
