"""Pydantic schemas for PRD API request/response validation."""

from datetime import datetime
from enum import Enum
from typing import Generic, TypeVar

from pydantic import BaseModel

from app.models.prd import PRDMode, PRDStatus


class ExportFormat(str, Enum):
    """Enum for PRD export format options."""
    MARKDOWN = "markdown"
    JSON = "json"


class PRDGenerateRequest(BaseModel):
    """Schema for requesting PRD generation."""
    mode: PRDMode = PRDMode.DRAFT


class PRDSection(BaseModel):
    """Schema for a single PRD section."""
    title: str
    content: str


class PRDStatusResponse(BaseModel):
    """Schema for PRD generation status polling response."""
    id: str
    status: PRDStatus
    error_message: str | None = None
    version: int | None = None

    model_config = {"from_attributes": True}


class PRDResponse(BaseModel):
    """Schema for full PRD response with all fields."""
    id: str
    project_id: str
    version: int
    title: str | None = None
    mode: PRDMode
    sections: list[PRDSection] | None = None
    raw_markdown: str | None = None
    status: PRDStatus
    error_message: str | None = None
    created_by: str | None = None
    updated_by: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PRDSummary(BaseModel):
    """Schema for PRD in list view (without full content)."""
    id: str
    project_id: str
    version: int
    title: str | None = None
    mode: PRDMode
    status: PRDStatus
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PRDUpdateRequest(BaseModel):
    """Schema for updating PRD content."""
    title: str | None = None
    sections: list[PRDSection] | None = None


# =============================================================================
# Export Schemas
# =============================================================================
# These schemas define the exact structure of exported PRD data.
# They serve as documentation and can be used for validation in tests.


class PRDExportSection(BaseModel):
    """Schema for a PRD section in JSON export.
    
    Fields (in order):
    - title: Section title (e.g., "Executive Summary", "Problem Statement")
    - content: Section content as markdown text
    """
    title: str
    content: str


class PRDExportJSON(BaseModel):
    """Schema for PRD JSON export format.
    
    This schema documents the exact structure of the JSON export.
    Use this for validation in tests and as API documentation.
    
    Fields (in order):
    - title: PRD title
    - version: PRD version number (1, 2, 3, ...)
    - mode: Generation mode ('draft' or 'detailed')
    - sections: Array of section objects with title and content
    - created_at: ISO 8601 timestamp of creation
    - updated_at: ISO 8601 timestamp of last update
    
    Example JSON output:
    ```json
    {
      "title": "My Product PRD",
      "version": 1,
      "mode": "detailed",
      "sections": [
        {"title": "Executive Summary", "content": "..."},
        {"title": "Problem Statement", "content": "..."}
      ],
      "created_at": "2026-01-26T12:00:00",
      "updated_at": "2026-01-26T12:30:00"
    }
    ```
    """
    title: str | None
    version: int
    mode: str  # 'draft' or 'detailed'
    sections: list[PRDExportSection]
    created_at: str | None  # ISO 8601 format
    updated_at: str | None  # ISO 8601 format


# Generic paginated response for reuse across schemas
T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response schema."""
    items: list[T]
    total: int
    skip: int
    limit: int
