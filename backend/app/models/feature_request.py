"""Feature request models: requests, upvotes, and comments."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import CHAR, Column, DateTime, Enum, Index, String, Text, ForeignKey, UniqueConstraint

from app.database import Base


class FeatureCategory(str, enum.Enum):
    requirements = "requirements"
    jira_integration = "jira_integration"
    export = "export"
    ui_ux = "ui_ux"
    new_capability = "new_capability"


class FeatureStatus(str, enum.Enum):
    submitted = "submitted"
    under_review = "under_review"
    planned = "planned"
    in_progress = "in_progress"
    shipped = "shipped"
    declined = "declined"


class FeatureRequest(Base):
    """Feature enhancement request submitted by a user."""

    __tablename__ = "feature_requests"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(Enum(FeatureCategory), nullable=False)
    status = Column(Enum(FeatureStatus), nullable=False, default=FeatureStatus.submitted)
    admin_response = Column(Text, nullable=True)
    submitter_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_feature_requests_submitter_id", "submitter_id"),
        Index("ix_feature_requests_status", "status"),
        Index("ix_feature_requests_category", "category"),
        Index("ix_feature_requests_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<FeatureRequest(id={self.id}, title={self.title})>"


class FeatureRequestUpvote(Base):
    """Upvote on a feature request (one per user per request)."""

    __tablename__ = "feature_request_upvotes"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    feature_request_id = Column(CHAR(36), ForeignKey("feature_requests.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("feature_request_id", "user_id", name="uq_feature_request_user_upvote"),
    )

    def __repr__(self) -> str:
        return f"<FeatureRequestUpvote(feature_request_id={self.feature_request_id}, user_id={self.user_id})>"


class FeatureRequestComment(Base):
    """Comment on a feature request."""

    __tablename__ = "feature_request_comments"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    feature_request_id = Column(CHAR(36), ForeignKey("feature_requests.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_feature_request_comments_feature_request_id", "feature_request_id"),
        Index("ix_feature_request_comments_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<FeatureRequestComment(id={self.id})>"
