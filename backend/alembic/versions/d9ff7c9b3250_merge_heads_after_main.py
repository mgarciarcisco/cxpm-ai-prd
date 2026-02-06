"""merge_heads_after_main

Revision ID: d9ff7c9b3250
Revises: k8l9m0n1o2p3a, m0n1o2p3q4r5
Create Date: 2026-02-06 12:03:34.365271

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9ff7c9b3250'
down_revision: Union[str, Sequence[str], None] = ('k8l9m0n1o2p3a', 'm0n1o2p3q4r5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
