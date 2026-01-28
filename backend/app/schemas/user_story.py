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
    priority: str | None = None


class StoryCreateRequest(BaseModel):
    """Schema for creating a new user story manually."""
    title: str
    description: str | None = None
    acceptance_criteria: list[str] | None = None
    labels: list[str] | None = None
    size: StorySize | None = StorySize.M
    priority: str | None = "medium"
    status: StoryStatus | None = StoryStatus.DRAFT


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


# =============================================================================
# Export Schemas
# =============================================================================
# These schemas define the exact structure of exported Stories data.
# They serve as documentation and can be used for validation in tests.


class StoryExportItem(BaseModel):
    """Schema for a single story in JSON export.
    
    Fields (in order):
    - story_id: Human-readable story ID (e.g., "US-001", "US-042")
    - story_number: Numeric story number (1, 42, etc.)
    - title: Story title
    - description: Full story description (user story format text)
    - acceptance_criteria: Array of acceptance criteria strings
    - size: Story size estimate ("xs", "s", "m", "l", "xl") or null
    - labels: Array of label strings
    - status: Story status ("draft", "ready", "exported")
    - format: Story format ("classic" or "job_story")
    - requirement_ids: Array of source requirement UUIDs for traceability
    - created_at: ISO 8601 timestamp of creation
    - updated_at: ISO 8601 timestamp of last update
    """
    story_id: str  # e.g., "US-001"
    story_number: int
    title: str
    description: str | None
    acceptance_criteria: list[str]
    size: str | None  # "xs", "s", "m", "l", "xl"
    labels: list[str]
    status: str | None  # "draft", "ready", "exported"
    format: str | None  # "classic" or "job_story"
    requirement_ids: list[str]
    created_at: str | None  # ISO 8601 format
    updated_at: str | None  # ISO 8601 format


class StoriesExportJSON(BaseModel):
    """Schema for Stories JSON export format.
    
    This schema documents the exact structure of the JSON export.
    Use this for validation in tests and as API documentation.
    
    Fields:
    - stories: Array of story objects
    
    Example JSON output:
    ```json
    {
      "stories": [
        {
          "story_id": "US-001",
          "story_number": 1,
          "title": "User authentication",
          "description": "As a user, I want to log in...",
          "acceptance_criteria": ["Given...", "When...", "Then..."],
          "size": "m",
          "labels": ["auth", "mvp"],
          "status": "ready",
          "format": "classic",
          "requirement_ids": ["uuid-1", "uuid-2"],
          "created_at": "2026-01-26T12:00:00",
          "updated_at": "2026-01-26T12:30:00"
        }
      ]
    }
    ```
    """
    stories: list[StoryExportItem]


# =============================================================================
# CSV Export Schema Documentation
# =============================================================================
# The CSV export uses the following column structure:
#
# | Column Name          | Description                                           | Format                          |
# |----------------------|-------------------------------------------------------|---------------------------------|
# | Story ID             | Human-readable ID                                     | "US-001", "US-042"              |
# | Title                | Story title                                           | Plain text                      |
# | Description          | Full story description                                | Plain text                      |
# | Acceptance Criteria  | All acceptance criteria                               | Pipe-separated: "AC1 | AC2"     |
# | Size                 | Story size estimate                                   | "XS", "S", "M", "L", "XL" or "" |
# | Labels               | Story labels                                          | Comma-separated: "auth, mvp"    |
# | Status               | Story status                                          | "draft", "ready", "exported"    |
# | Format               | Story format                                          | "classic" or "job_story"        |
#
# Example CSV row:
# US-001,"User authentication","As a user, I want...","Given... | When... | Then...","M","auth, mvp","ready","classic"
#
# Note: Acceptance criteria uses pipe (|) separator to avoid conflicts with
# comma separators in the CSV format.


# Constant defining CSV column names for programmatic access
STORIES_CSV_COLUMNS = [
    "Story ID",
    "Title",
    "Description",
    "Acceptance Criteria",
    "Size",
    "Labels",
    "Status",
    "Format",
]
