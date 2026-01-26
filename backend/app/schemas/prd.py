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


# Generic paginated response for reuse across schemas
T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response schema."""
    items: list[T]
    total: int
    skip: int
    limit: int
