"""Add admin approval and security fields to users table.

Revision ID: l9m0n1o2p3q4
Revises: k8l9m0n1o2p3
Create Date: 2026-02-05

Adds approval workflow columns (is_approved, approved_by, approved_at),
activity tracking (last_active_at, deactivated_at, deactivated_by),
and security columns (failed_login_attempts, locked_until, token_invalid_before).

Existing users with is_active=True are marked as is_approved=True.
System user (is_active=False) keeps is_approved=False (the default).
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "l9m0n1o2p3q4"
down_revision = "k8l9m0n1o2p3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- Approval workflow columns --
    op.add_column(
        "users",
        sa.Column("is_approved", sa.Boolean(), nullable=False, server_default="0"),
    )
    op.create_index("ix_users_is_approved", "users", ["is_approved"])

    # Backfill: all existing active users should be approved
    op.execute("UPDATE users SET is_approved = 1 WHERE is_active = 1")

    op.add_column(
        "users",
        sa.Column("approved_by", sa.CHAR(36), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_approved_by",
        "users",
        "users",
        ["approved_by"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "users",
        sa.Column("approved_at", sa.DateTime(), nullable=True),
    )

    # -- Activity tracking columns --
    op.add_column(
        "users",
        sa.Column("last_active_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_users_last_active_at", "users", ["last_active_at"])

    op.add_column(
        "users",
        sa.Column("deactivated_at", sa.DateTime(), nullable=True),
    )

    op.add_column(
        "users",
        sa.Column("deactivated_by", sa.CHAR(36), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_deactivated_by",
        "users",
        "users",
        ["deactivated_by"],
        ["id"],
        ondelete="SET NULL",
    )

    # -- Security columns --
    op.add_column(
        "users",
        sa.Column(
            "failed_login_attempts",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    op.add_column(
        "users",
        sa.Column("locked_until", sa.DateTime(), nullable=True),
    )

    op.add_column(
        "users",
        sa.Column("token_invalid_before", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    # Drop columns in reverse order
    op.drop_column("users", "token_invalid_before")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")

    op.drop_constraint("fk_users_deactivated_by", "users", type_="foreignkey")
    op.drop_column("users", "deactivated_by")
    op.drop_column("users", "deactivated_at")

    op.drop_index("ix_users_last_active_at", table_name="users")
    op.drop_column("users", "last_active_at")

    op.drop_column("users", "approved_at")

    op.drop_constraint("fk_users_approved_by", "users", type_="foreignkey")
    op.drop_column("users", "approved_by")

    op.drop_index("ix_users_is_approved", table_name="users")
    op.drop_column("users", "is_approved")
