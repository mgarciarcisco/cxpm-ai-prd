"""Pydantic schemas for Project API request/response validation."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class RequirementsStatusSchema(str, Enum):
    """Status for the Requirements stage."""
    empty = "empty"
    has_items = "has_items"
    reviewed = "reviewed"


class PRDStageStatusSchema(str, Enum):
    """Status for the PRD stage."""
    empty = "empty"
    draft = "draft"
    ready = "ready"


class StoriesStatusSchema(str, Enum):
    """Status for the User Stories stage."""
    empty = "empty"
    generated = "generated"
    refined = "refined"


class MockupsStatusSchema(str, Enum):
    """Status for the Mockups stage."""
    empty = "empty"
    generated = "generated"


class ExportStatusSchema(str, Enum):
    """Status for the Export stage."""
    not_exported = "not_exported"
    exported = "exported"


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
    requirements_status: RequirementsStatusSchema
    prd_status: PRDStageStatusSchema
    stories_status: StoriesStatusSchema
    mockups_status: MockupsStatusSchema
    export_status: ExportStatusSchema

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
