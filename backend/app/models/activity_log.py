"""Activity log model for tracking user actions."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import CHAR, Column, DateTime, ForeignKey, Index, Integer, JSON, String

from app.database import Base


class ActivityLog(Base):
    """Tracks user activity for security, audit, and debugging."""

    __tablename__ = "activity_logs"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(50), nullable=False, index=True)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(CHAR(36), nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    request_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    __table_args__ = (
        Index('ix_activity_logs_user_action', 'user_id', 'action'),
        Index('ix_activity_logs_created_action', 'created_at', 'action'),
    )

    def __repr__(self) -> str:
        return f"<ActivityLog(id={self.id}, action={self.action})>"
