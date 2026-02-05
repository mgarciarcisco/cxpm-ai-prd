"""Pydantic schemas for Project API request/response validation."""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from pydantic import BaseModel, computed_field

if TYPE_CHECKING:
    pass


def calculate_progress(
    requirements_status: str,
    prd_status: str,
    stories_status: str,
    mockups_status: str,
    export_status: str,
) -> int:
    """Calculate overall progress percentage from stage statuses.

    Each stage contributes 20% when complete.
    Partial credit:
    - Requirements: empty=0%, has_items=10%, reviewed=20%
    - PRD: empty=0%, draft=10%, ready=20%
    - Stories: empty=0%, generated=10%, refined=20%
    - Mockups: empty=0%, generated=20%
    - Export: not_exported=0%, exported=20%

    Returns:
        Progress percentage (0-100)
    """
    progress = 0

    # Requirements stage (max 20%)
    if requirements_status == "reviewed":
        progress += 20
    elif requirements_status == "has_items":
        progress += 10

    # PRD stage (max 20%)
    if prd_status == "ready":
        progress += 20
    elif prd_status == "draft":
        progress += 10

    # Stories stage (max 20%)
    if stories_status == "refined":
        progress += 20
    elif stories_status == "generated":
        progress += 10

    # Mockups stage (max 20%)
    if mockups_status == "generated":
        progress += 20

    # Export stage (max 20%)
    if export_status == "exported":
        progress += 20

    return progress


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
    archived: bool | None = None


class ProjectResponse(BaseModel):
    """Schema for project response with all fields."""

    id: str
    name: str
    description: str | None = None
    archived: bool = False
    created_at: datetime
    updated_at: datetime
    requirements_status: RequirementsStatusSchema
    prd_status: PRDStageStatusSchema
    stories_status: StoriesStatusSchema
    mockups_status: MockupsStatusSchema
    export_status: ExportStatusSchema
    requirements_count: int = 0

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def progress(self) -> int:
        """Calculate overall progress percentage from stage statuses."""
        return calculate_progress(
            requirements_status=self.requirements_status.value,
            prd_status=self.prd_status.value,
            stories_status=self.stories_status.value,
            mockups_status=self.mockups_status.value,
            export_status=self.export_status.value,
        )


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


class StageStatusEnum(str, Enum):
    """Valid stage names for status updates."""
    requirements = "requirements"
    prd = "prd"
    stories = "stories"
    mockups = "mockups"
    export = "export"


class StageUpdateRequest(BaseModel):
    """Schema for updating an individual stage status."""
    status: str


class ProgressResponse(BaseModel):
    """Schema for project progress response with all stage statuses."""
    requirements_status: RequirementsStatusSchema
    prd_status: PRDStageStatusSchema
    stories_status: StoriesStatusSchema
    mockups_status: MockupsStatusSchema
    export_status: ExportStatusSchema
    progress: int
