"""Add project sharing values to notificationtype enum.

Revision ID: o3p4q5r6s7t8
Revises: n1o2p3q4r5s6
Create Date: 2026-02-18
"""

from alembic import op


revision = "o3p4q5r6s7t8"
down_revision = "n1o2p3q4r5s6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'project_member_added'")
        op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'project_member_removed'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be dropped safely in a simple downgrade.
    pass

