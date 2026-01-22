"""API routers package."""

from app.routers.projects import router as projects_router
from app.routers.meetings import router as meetings_router

__all__ = ["projects_router", "meetings_router"]
