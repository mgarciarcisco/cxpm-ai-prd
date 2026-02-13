"""Notification creation helper: fire-and-forget, never raises."""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType

logger = logging.getLogger(__name__)


def create_notification_safe(
    db: Session,
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
) -> None:
    """Create a notification. Fire-and-forget — never raises exceptions.

    Args:
        db: Database session
        user_id: ID of the user to notify
        notification_type: Type of notification
        title: Short notification title (e.g., "Bug Report Updated")
        message: Notification message (e.g., "Your bug 'Login fails' is now 'investigating'")
        resource_type: Type of related resource ("bug_report" or "feature_request")
        resource_id: ID of the related resource (for navigation links)
    """
    try:
        notification = Notification(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            resource_type=resource_type,
            resource_id=resource_id,
        )
        db.add(notification)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to create notification: {e}")
        try:
            db.rollback()
        except Exception:
            pass


async def purge_old_notifications(db: Session, retention_days: int = 90) -> int:
    """Delete notifications older than retention_days. Returns count deleted."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    total_deleted = 0
    while True:
        deleted = db.query(Notification).filter(
            Notification.created_at < cutoff
        ).limit(1000).delete(synchronize_session=False)
        db.commit()
        total_deleted += deleted
        if deleted < 1000:
            break
    if total_deleted > 0:
        logger.info(f"Purged {total_deleted} notifications older than {retention_days} days")
    return total_deleted
