"""Notification model for in-app notifications."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import CHAR, Boolean, Column, DateTime, Enum, Index, String, Text, ForeignKey

from app.database import Base


class NotificationType(str, enum.Enum):
    bug_status_change = "bug_status_change"
    feature_status_change = "feature_status_change"
    feature_comment = "feature_comment"


class Notification(Base):
    """In-app notification for a user."""

    __tablename__ = "notifications"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(CHAR(36), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("ix_notifications_user_id", "user_id"),
        Index("ix_notifications_user_read", "user_id", "is_read"),
        Index("ix_notifications_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, type={self.type})>"
