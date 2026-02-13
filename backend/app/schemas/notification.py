"""Pydantic schemas for notification endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.notification import NotificationType


class NotificationResponse(BaseModel):
    """Response schema for a notification."""
    id: str
    user_id: str
    type: NotificationType
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
