import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.activity import RequestIdMiddleware, purge_old_activity_logs
from app.notifications import purge_old_notifications
from app.config import settings
from app.database import SessionLocal
from app.routers import (
    admin_router,
    auth_router,
    bug_reports_router,
    feature_requests_router,
    jira_epic_router,
    jira_stories_router,
    meeting_items_router,
    meetings_router,
    notifications_router,
    projects_router,
    requirements_router,
)

app = FastAPI(
    title="CX AI Assistant for Product Managers",
    description="Meeting Notes to Requirements API",
    version="1.0.0",
)

# Configure CORS
_default_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:5173",
]
_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()] if settings.CORS_ORIGINS else _default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RequestIdMiddleware)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_purge_activity_logs():
    """Purge activity logs older than 90 days on startup."""
    try:
        db = SessionLocal()
        try:
            await purge_old_activity_logs(db)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to purge activity logs on startup: {e}")


@app.on_event("startup")
async def startup_purge_old_notifications():
    """Purge notifications older than 90 days on startup."""
    try:
        db = SessionLocal()
        try:
            purge_old_notifications(db)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to purge notifications on startup: {e}")


# Register routers
app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(meetings_router)
app.include_router(meeting_items_router)
app.include_router(requirements_router)
app.include_router(jira_epic_router)
app.include_router(jira_stories_router)
app.include_router(bug_reports_router)
app.include_router(feature_requests_router)
app.include_router(notifications_router)
