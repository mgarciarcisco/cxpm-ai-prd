"""API routers package."""

from app.routers.auth import router as auth_router
from app.routers.jira_epic import router as jira_epic_router
from app.routers.jira_stories import router as jira_stories_router
from app.routers.meeting_items import router as meeting_items_router
from app.routers.meetings import router as meetings_router
from app.routers.prds import router as prds_router
from app.routers.projects import router as projects_router
from app.routers.requirements import router as requirements_router
from app.routers.stories import router as stories_router

__all__ = [
    "auth_router",
    "projects_router",
    "meetings_router",
    "meeting_items_router",
    "requirements_router",
    "prds_router",
    "stories_router",
    "jira_epic_router",
    "jira_stories_router",
]
