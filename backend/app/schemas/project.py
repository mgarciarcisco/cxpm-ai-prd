"""Pydantic schemas for Project API request/response validation."""

from datetime import datetime

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    """Schema for creating a new project."""

    name: str
    description: str | None = None


class ProjectUpdate(BaseModel):
    """Schema for updating an existing project."""

    name: str | None = None
    description: str | None = None


class ProjectResponse(BaseModel):
    """Schema for project response with all fields."""

    id: str
    name: str
    description: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectList(BaseModel):
    """Schema for list of projects."""

    projects: list[ProjectResponse]


class SectionCount(BaseModel):
    """Schema for requirement count per section."""

    section: str
    count: int


class ProjectStatsResponse(BaseModel):
    """Schema for project statistics response."""

    meeting_count: int
    requirement_count: int
    requirement_counts_by_section: list[SectionCount]
    last_activity: datetime | None = None
