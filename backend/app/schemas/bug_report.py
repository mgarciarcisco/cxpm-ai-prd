"""Pydantic schemas for bug report endpoints."""

import enum
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class BugSeveritySchema(str, enum.Enum):
    blocker = "blocker"
    major = "major"
    minor = "minor"


class BugStatusSchema(str, enum.Enum):
    open = "open"
    investigating = "investigating"
    fixed = "fixed"
    closed = "closed"


class BugReportResponse(BaseModel):
    """Response schema for a bug report."""
    id: str
    title: str
    description: str
    severity: BugSeveritySchema
    status: BugStatusSchema
    steps_to_reproduce: Optional[str] = None
    has_screenshot: bool = False
    page_url: Optional[str] = None
    browser_info: Optional[str] = None
    reporter_id: str
    reporter_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BugReportListResponse(BaseModel):
    """Paginated list of bug reports."""
    items: list[BugReportResponse]
    total: int
    page: int
    per_page: int


class BugStatusUpdate(BaseModel):
    """Schema for updating bug report status."""
    status: BugStatusSchema
