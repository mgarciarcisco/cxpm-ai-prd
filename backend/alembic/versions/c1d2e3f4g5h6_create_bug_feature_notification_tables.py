"""Create bug_reports, feature_requests, feature_request_upvotes,
feature_request_comments, and notifications tables.

Revision ID: c1d2e3f4g5h6
Revises: b3c4d5e6f7a8
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa


revision = "c1d2e3f4g5h6"
down_revision = "b3c4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- bug_reports ---
    op.create_table(
        "bug_reports",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity", sa.Enum("blocker", "major", "minor", name="bugseverity"), nullable=False),
        sa.Column("status", sa.Enum("open", "investigating", "fixed", "closed", name="bugstatus"), nullable=False),
        sa.Column("steps_to_reproduce", sa.Text(), nullable=True),
        sa.Column("screenshot_path", sa.String(500), nullable=True),
        sa.Column("page_url", sa.String(500), nullable=True),
        sa.Column("browser_info", sa.String(500), nullable=True),
        sa.Column("reporter_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_bug_reports_reporter_id", "bug_reports", ["reporter_id"])
    op.create_index("ix_bug_reports_status", "bug_reports", ["status"])
    op.create_index("ix_bug_reports_created_at", "bug_reports", ["created_at"])

    # --- feature_requests ---
    op.create_table(
        "feature_requests",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "category",
            sa.Enum("requirements", "jira_integration", "export", "ui_ux", "new_capability", name="featurecategory"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("submitted", "under_review", "planned", "in_progress", "shipped", "declined", name="featurestatus"),
            nullable=False,
        ),
        sa.Column("admin_response", sa.Text(), nullable=True),
        sa.Column("submitter_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_feature_requests_submitter_id", "feature_requests", ["submitter_id"])
    op.create_index("ix_feature_requests_status", "feature_requests", ["status"])
    op.create_index("ix_feature_requests_category", "feature_requests", ["category"])
    op.create_index("ix_feature_requests_created_at", "feature_requests", ["created_at"])

    # --- feature_request_upvotes ---
    op.create_table(
        "feature_request_upvotes",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("feature_request_id", sa.CHAR(36), sa.ForeignKey("feature_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("feature_request_id", "user_id", name="uq_feature_request_user_upvote"),
    )

    # --- feature_request_comments ---
    op.create_table(
        "feature_request_comments",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("feature_request_id", sa.CHAR(36), sa.ForeignKey("feature_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_feature_request_comments_feature_request_id", "feature_request_comments", ["feature_request_id"])
    op.create_index("ix_feature_request_comments_user_id", "feature_request_comments", ["user_id"])

    # --- notifications ---
    op.create_table(
        "notifications",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("user_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "type",
            sa.Enum("bug_status_change", "feature_status_change", "feature_comment", name="notificationtype"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.CHAR(36), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_user_read", "notifications", ["user_id", "is_read"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_notifications_created_at", table_name="notifications")
    op.drop_index("ix_notifications_user_read", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")

    op.drop_index("ix_feature_request_comments_user_id", table_name="feature_request_comments")
    op.drop_index("ix_feature_request_comments_feature_request_id", table_name="feature_request_comments")
    op.drop_table("feature_request_comments")

    op.drop_table("feature_request_upvotes")

    op.drop_index("ix_feature_requests_created_at", table_name="feature_requests")
    op.drop_index("ix_feature_requests_category", table_name="feature_requests")
    op.drop_index("ix_feature_requests_status", table_name="feature_requests")
    op.drop_index("ix_feature_requests_submitter_id", table_name="feature_requests")
    op.drop_table("feature_requests")

    op.drop_index("ix_bug_reports_created_at", table_name="bug_reports")
    op.drop_index("ix_bug_reports_status", table_name="bug_reports")
    op.drop_index("ix_bug_reports_reporter_id", table_name="bug_reports")
    op.drop_table("bug_reports")

    # Drop PostgreSQL enum types (SQLite ignores these)
    op.execute("DROP TYPE IF EXISTS notificationtype")
    op.execute("DROP TYPE IF EXISTS featurestatus")
    op.execute("DROP TYPE IF EXISTS featurecategory")
    op.execute("DROP TYPE IF EXISTS bugstatus")
    op.execute("DROP TYPE IF EXISTS bugseverity")
