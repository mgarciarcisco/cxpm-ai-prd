"""API routers package."""

from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.routers.jira_epic import router as jira_epic_router
from app.routers.jira_stories import router as jira_stories_router
from app.routers.meeting_items import router as meeting_items_router
from app.routers.meetings import router as meetings_router
from app.routers.projects import router as projects_router
from app.routers.requirements import router as requirements_router
__all__ = [
    "admin_router",
    "auth_router",
    "projects_router",
    "meetings_router",
    "meeting_items_router",
    "requirements_router",
    "jira_epic_router",
    "jira_stories_router",
]
