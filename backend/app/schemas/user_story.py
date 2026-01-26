"""Pydantic schemas for User Stories API request/response validation."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel

from app.models.story_batch import StoryBatchStatus
from app.models.user_story import StoryFormat, StorySize, StoryStatus


class StoryExportFormat(str, Enum):
    """Enum for stories export format options."""
    MARKDOWN = "markdown"
    CSV = "csv"
    JSON = "json"


class StoriesGenerateRequest(BaseModel):
    """Schema for requesting user stories generation."""
    format: StoryFormat = StoryFormat.CLASSIC
    section_filter: list[str] | None = None


class StoryBatchStatusResponse(BaseModel):
    """Schema for story batch generation status polling response."""
    id: str
    status: StoryBatchStatus
    story_count: int
    error_message: str | None = None

    model_config = {"from_attributes": True}


class UserStoryResponse(BaseModel):
    """Schema for full user story response with all fields."""
    id: str
    project_id: str
    batch_id: str | None = None
    story_id: str  # Computed property: 'US-001'
    story_number: int
    format: StoryFormat
    title: str
    description: str | None = None
    acceptance_criteria: list[str] | None = None
    order: int
    labels: list[str] | None = None
    size: StorySize | None = None
    requirement_ids: list[str] | None = None
    status: StoryStatus
    created_by: str | None = None
    updated_by: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StoryUpdateRequest(BaseModel):
    """Schema for updating a user story."""
    title: str | None = None
    description: str | None = None
    acceptance_criteria: list[str] | None = None
    labels: list[str] | None = None
    size: StorySize | None = None
    status: StoryStatus | None = None


class ReorderRequest(BaseModel):
    """Schema for reordering stories."""
    story_ids: list[str]


class StoryBatchResponse(BaseModel):
    """Schema for story batch response in list view."""
    id: str
    project_id: str
    format: StoryFormat
    section_filter: list[str] | None = None
    story_count: int
    status: StoryBatchStatus
    error_message: str | None = None
    created_by: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
