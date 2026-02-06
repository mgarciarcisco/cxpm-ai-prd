"""Pydantic schemas for admin API endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# -- User Management Schemas --

class AdminUserResponse(BaseModel):
    """User info for admin views."""
    id: str
    email: str
    name: str
    is_active: bool
    is_admin: bool
    is_approved: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    last_active_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    deactivated_at: Optional[datetime] = None
    failed_login_attempts: int = 0
    locked_until: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminUserListResponse(BaseModel):
    """Paginated user list for admin."""
    users: list[AdminUserResponse]
    total: int
    page: int
    per_page: int


class BulkUserRequest(BaseModel):
    """Request body for bulk user operations."""
    user_ids: list[str]


class BulkOperationResponse(BaseModel):
    """Response for bulk operations."""
    success_count: int
    failed_count: int
    errors: list[str]


class PasswordResetResponse(BaseModel):
    """Response for admin password reset."""
    temporary_password: str


# -- Activity Log Schemas --

class ActivityLogResponse(BaseModel):
    """Activity log entry for admin views."""
    id: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    metadata: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_id: Optional[str] = None
    created_at: datetime


class ActivityLogListResponse(BaseModel):
    """Paginated activity log list."""
    items: list[ActivityLogResponse]
    total: int
    page: int
    per_page: int


# -- Dashboard Stats Schemas --

class UserStats(BaseModel):
    total: int
    pending: int
    active: int
    deactivated: int
    active_today: int
    active_this_week: int


class ContentStats(BaseModel):
    total_projects: int
    total_prds: int
    total_stories: int
    total_meetings: int


class ExportStats(BaseModel):
    total: int
    markdown: int
    confluence: int
    jira: int


class EngagementStats(BaseModel):
    avg_projects_per_user: float
    prd_completion_rate: float
    story_generation_rate: float
    exports: ExportStats


class WeeklyChangeStats(BaseModel):
    users: int
    projects: int
    prds: int
    stories: int
    meetings: int


class DashboardStatsResponse(BaseModel):
    """Full dashboard statistics response."""
    users: UserStats
    content: ContentStats
    engagement: EngagementStats
    weekly_change: WeeklyChangeStats
    cached_at: datetime
