"""Make meeting_recaps.project_id nullable for unified flow.

Revision ID: i6j7k8l9m0n1
Revises: h5i6j7k8l9m0
Create Date: 2026-01-30

This migration makes project_id nullable in meeting_recaps table to support
the unified meeting flow where users can create meetings without a project
context and select the project later.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "i6j7k8l9m0n1"
down_revision = "h5i6j7k8l9m0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "meeting_recaps",
        "project_id",
        existing_type=sa.CHAR(36),
        nullable=True,
    )


def downgrade() -> None:
    # Note: This will fail if there are any NULL project_id values
    op.alter_column(
        "meeting_recaps",
        "project_id",
        existing_type=sa.CHAR(36),
        nullable=False,
    )
