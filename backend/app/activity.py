"""Activity logging utilities: helper functions and request middleware."""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware

from app.models.activity_log import ActivityLog

logger = logging.getLogger(__name__)


def log_activity(
    db: Session,
    user_id: str | None,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    metadata: dict | None = None,
    request: Request | None = None,
) -> ActivityLog:
    """Log a user activity to the database.

    Args:
        db: Database session
        user_id: ID of the user performing the action (None for anonymous)
        action: Action identifier (e.g., 'user.login', 'project.created')
        resource_type: Type of resource affected (e.g., 'project', 'meeting')
        resource_id: ID of the affected resource
        metadata: Additional context about the action
        request: FastAPI request object (for IP, user-agent, request_id)
    """
    ip_address = None
    user_agent = None
    request_id = None

    if request:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent", "")[:500]
        request_id = getattr(request.state, "request_id", None)

    entry = ActivityLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata_=metadata,
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=request_id,
    )
    db.add(entry)
    db.commit()
    return entry


def log_activity_safe(
    db: Session,
    user_id: str | None,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    metadata: dict | None = None,
    request: Request | None = None,
) -> None:
    """Fire-and-forget activity logging. Never raises exceptions."""
    try:
        log_activity(db, user_id, action, resource_type, resource_id, metadata, request)
    except Exception as e:
        logger.error(f"Failed to log activity: {e}")


async def purge_old_activity_logs(db: Session, retention_days: int = 90) -> int:
    """Delete activity logs older than retention_days. Returns count deleted."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    total_deleted = 0
    while True:
        # Batch delete to avoid long locks
        deleted = db.query(ActivityLog).filter(
            ActivityLog.created_at < cutoff
        ).limit(1000).delete(synchronize_session=False)
        db.commit()
        total_deleted += deleted
        if deleted < 1000:
            break
    if total_deleted > 0:
        logger.info(f"Purged {total_deleted} activity logs older than {retention_days} days")
    return total_deleted


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Middleware that generates a unique request_id for each request.

    Also captures IP and user-agent in request.state for use by activity logging.
    """

    async def dispatch(self, request: Request, call_next):
        request.state.request_id = str(uuid.uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response
