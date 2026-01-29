"""add priority column to user_stories

Revision ID: h5i6j7k8l9m0
Revises: g4h5i6j7k8l9
Create Date: 2026-01-29 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h5i6j7k8l9m0'
down_revision: Union[str, Sequence[str], None] = 'g4h5i6j7k8l9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add priority column to user_stories table."""
    op.add_column(
        'user_stories',
        sa.Column('priority', sa.Enum('p1', 'p2', 'p3', name='storypriority'), nullable=True)
    )


def downgrade() -> None:
    """Remove priority column from user_stories table."""
    op.drop_column('user_stories', 'priority')
