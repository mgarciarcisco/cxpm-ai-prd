"""API routers package."""

from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.routers.jira_epic import router as jira_epic_router
from app.routers.jira_stories import router as jira_stories_router
from app.routers.meeting_items import router as meeting_items_router
from app.routers.meetings import router as meetings_router
from app.routers.projects import router as projects_router
from app.routers.bug_reports import router as bug_reports_router
from app.routers.feature_requests import router as feature_requests_router
from app.routers.notifications import router as notifications_router
from app.routers.project_members import router as project_members_router
from app.routers.project_members import users_router as users_search_router
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
    "bug_reports_router",
    "feature_requests_router",
    "notifications_router",
    "project_members_router",
    "users_search_router",
]
