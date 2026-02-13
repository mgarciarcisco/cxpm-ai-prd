"""Pydantic schemas for notification endpoints."""

import enum
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationTypeSchema(str, enum.Enum):
    bug_status_change = "bug_status_change"
    feature_status_change = "feature_status_change"
    feature_comment = "feature_comment"


class NotificationResponse(BaseModel):
    """Response schema for a notification."""
    id: str
    user_id: str
    type: NotificationTypeSchema
    title: str
    message: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """Paginated list of notifications."""
    items: list[NotificationResponse]
    total: int
    page: int
    per_page: int


class UnreadCountResponse(BaseModel):
    """Response for unread notification count."""
    count: int
