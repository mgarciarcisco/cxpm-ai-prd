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
    # On PostgreSQL, enum types used in add_column must be created explicitly first.
    # The create_type=False flag tells SQLAlchemy not to auto-create (we do it manually).
    bind = op.get_bind()
    is_pg = bind.dialect.name == 'postgresql'

    requirements_enum = sa.Enum('empty', 'has_items', 'reviewed', name='requirementsstatus')
    prd_enum = sa.Enum('empty', 'draft', 'ready', name='prdstagestatus')
    stories_enum = sa.Enum('empty', 'generated', 'refined', name='storiesstatus')
    mockups_enum = sa.Enum('empty', 'generated', name='mockupsstatus')
    export_enum = sa.Enum('not_exported', 'exported', name='exportstatus')

    if is_pg:
        requirements_enum.create(bind)
        prd_enum.create(bind)
        stories_enum.create(bind)
        mockups_enum.create(bind)
        export_enum.create(bind)

    # Add requirements_status column
    op.add_column('projects', sa.Column(
        'requirements_status',
        requirements_enum,
        nullable=False,
        server_default='empty'
    ))

    # Add prd_status column
    op.add_column('projects', sa.Column(
        'prd_status',
        prd_enum,
        nullable=False,
        server_default='empty'
    ))

    # Add stories_status column
    op.add_column('projects', sa.Column(
        'stories_status',
        stories_enum,
        nullable=False,
        server_default='empty'
    ))

    # Add mockups_status column
    op.add_column('projects', sa.Column(
        'mockups_status',
        mockups_enum,
        nullable=False,
        server_default='empty'
    ))

    # Add export_status column
    op.add_column('projects', sa.Column(
        'export_status',
        export_enum,
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

    # Drop enum types on PostgreSQL
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        sa.Enum(name='exportstatus').drop(bind)
        sa.Enum(name='mockupsstatus').drop(bind)
        sa.Enum(name='storiesstatus').drop(bind)
        sa.Enum(name='prdstagestatus').drop(bind)
        sa.Enum(name='requirementsstatus').drop(bind)
