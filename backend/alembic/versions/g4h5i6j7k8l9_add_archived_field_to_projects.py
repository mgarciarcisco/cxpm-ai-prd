"""Add archived field to projects table.

Revision ID: g4h5i6j7k8l9
Revises: a1b2c3d4e5f6
Create Date: 2026-01-28
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "g4h5i6j7k8l9"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add archived column to projects table."""
    op.add_column(
        "projects",
        sa.Column("archived", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    """Remove archived column from projects table."""
    op.drop_column("projects", "archived")
