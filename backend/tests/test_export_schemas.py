"""Tests for export schema conformance.

This file verifies that the export endpoints produce data that conforms to
the documented schemas in app/schemas/prd.py and app/schemas/user_story.py.

Schema Documentation:
- PRDExportJSON: Defines the structure of PRD JSON exports
- StoriesExportJSON: Defines the structure of Stories JSON exports
- STORIES_CSV_COLUMNS: Documents the CSV column names and order
"""

import csv
import io
from typing import cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import PRD, Project, Requirement, StoryBatch, UserStory
from app.models.meeting_item import Section
from app.models.prd import PRDMode, PRDStatus
from app.models.story_batch import StoryBatchStatus
from app.models.user_story import StoryFormat, StorySize, StoryStatus
from app.schemas import (
    STORIES_CSV_COLUMNS,
    PRDExportJSON,
    StoriesExportJSON,
)

# =============================================================================
# Helper Functions
# =============================================================================


def _create_test_project(db: Session, name: str = "Test Project") -> Project:
    """Create a test project."""
    project = Project(name=name, description="For export schema tests")
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _get_project_id(project: Project) -> str:
    """Get project ID as string for type safety."""
    return cast(str, project.id)


def _create_test_requirement(
    db: Session,
    project_id: str,
    section: Section = Section.problems,
    content: str = "Test requirement content",
) -> Requirement:
    """Create a test requirement."""
    requirement = Requirement(
        project_id=project_id,
        section=section,
        content=content,
        order=0,
        is_active=True,
    )
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return requirement


def _create_test_prd(
    db: Session,
    project_id: str,
    version: int = 1,
    mode: PRDMode = PRDMode.DETAILED,
    status: PRDStatus = PRDStatus.READY,
    title: str = "Test PRD",
    sections: list[dict] | None = None,
    raw_markdown: str | None = None,
) -> PRD:
    """Create a test PRD with all required fields."""
    if sections is None:
        sections = [
            {"title": "Executive Summary", "content": "This is the executive summary."},
            {"title": "Problem Statement", "content": "This describes the problem."},
            {"title": "Goals", "content": "These are the project goals."},
        ]
    if raw_markdown is None:
        raw_markdown = f"# {title}\n\n## Executive Summary\n\nThis is the executive summary.\n"

    prd = PRD(
        project_id=project_id,
        version=version,
        mode=mode,
        status=status,
        title=title,
        sections=sections,
        raw_markdown=raw_markdown,
    )
    db.add(prd)
    db.commit()
    db.refresh(prd)
    return prd


def _create_test_batch(
    db: Session,
    project_id: str,
    format: StoryFormat = StoryFormat.CLASSIC,
    status: StoryBatchStatus = StoryBatchStatus.READY,
) -> StoryBatch:
    """Create a test story batch."""
    batch = StoryBatch(
        project_id=project_id,
        format=format,
        status=status,
        story_count=0,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def _create_test_story(
    db: Session,
    project_id: str,
    batch_id: str,
    story_number: int = 1,
    title: str = "Test Story",
    description: str = "As a user, I want to test things.",
    acceptance_criteria: list[str] | None = None,
    format: StoryFormat = StoryFormat.CLASSIC,
    size: StorySize = StorySize.M,
    labels: list[str] | None = None,
    status: StoryStatus = StoryStatus.READY,
    requirement_ids: list[str] | None = None,
) -> UserStory:
    """Create a test user story."""
    if acceptance_criteria is None:
        acceptance_criteria = ["Given X", "When Y", "Then Z"]
    if labels is None:
        labels = ["mvp", "testing"]
    if requirement_ids is None:
        requirement_ids = []

    story = UserStory(
        project_id=project_id,
        batch_id=batch_id,
        story_number=story_number,
        title=title,
        description=description,
        acceptance_criteria=acceptance_criteria,
        format=format,
        size=size,
        labels=labels,
        status=status,
        requirement_ids=requirement_ids,
        order=story_number,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return story


# =============================================================================
# Test: PRD Export JSON Schema Conformance
# =============================================================================


def test_prd_export_json_matches_schema(test_client: TestClient, test_db: Session) -> None:
    """Test that PRD JSON export exactly matches the PRDExportJSON schema.
    
    Schema fields (in order):
    - title: str | None
    - version: int
    - mode: str ('draft' or 'detailed')
    - sections: list of {title: str, content: str}
    - created_at: str (ISO 8601) | None
    - updated_at: str (ISO 8601) | None
    """
    project = _create_test_project(test_db, name="Schema Test Project")
    project_id = _get_project_id(project)

    prd = _create_test_prd(
        test_db, project_id,
        title="Schema Conformance Test",
        mode=PRDMode.DETAILED,
        sections=[
            {"title": "Section A", "content": "Content A"},
            {"title": "Section B", "content": "Content B"},
        ],
    )
    prd_id = cast(str, prd.id)

    response = test_client.get(f"/api/prds/{prd_id}/export?format=json")

    assert response.status_code == 200
    data = response.json()

    # Validate against the schema - raises ValidationError if non-conformant
    export_model = PRDExportJSON.model_validate(data)

    # Verify field types and values
    assert isinstance(export_model.title, str)
    assert export_model.title == "Schema Conformance Test"

    assert isinstance(export_model.version, int)
    assert export_model.version == 1

    assert isinstance(export_model.mode, str)
    assert export_model.mode in ("draft", "detailed")
    assert export_model.mode == "detailed"

    assert isinstance(export_model.sections, list)
    assert len(export_model.sections) == 2
    for section in export_model.sections:
        assert isinstance(section.title, str)
        assert isinstance(section.content, str)

    # Timestamps should be ISO 8601 format strings
    assert export_model.created_at is None or isinstance(export_model.created_at, str)
    assert export_model.updated_at is None or isinstance(export_model.updated_at, str)


def test_prd_export_json_has_required_fields(test_client: TestClient, test_db: Session) -> None:
    """Test that PRD JSON export contains all required fields."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    prd = _create_test_prd(test_db, project_id, mode=PRDMode.DRAFT)
    prd_id = cast(str, prd.id)

    response = test_client.get(f"/api/prds/{prd_id}/export?format=json")
    data = response.json()

    # Required fields per PRDExportJSON schema
    required_fields = {"title", "version", "mode", "sections", "created_at", "updated_at"}
    assert required_fields <= set(data.keys()), f"Missing fields: {required_fields - set(data.keys())}"


def test_prd_export_json_sections_structure(test_client: TestClient, test_db: Session) -> None:
    """Test that PRD sections have correct structure per PRDExportSection schema."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    prd = _create_test_prd(
        test_db, project_id,
        sections=[
            {"title": "First Section", "content": "First content with **markdown**."},
            {"title": "Second Section", "content": "Second content."},
        ],
    )
    prd_id = cast(str, prd.id)

    response = test_client.get(f"/api/prds/{prd_id}/export?format=json")
    data = response.json()

    sections = data["sections"]
    for section in sections:
        # Each section must have exactly title and content
        assert "title" in section
        assert "content" in section
        assert isinstance(section["title"], str)
        assert isinstance(section["content"], str)


# =============================================================================
# Test: Stories Export JSON Schema Conformance
# =============================================================================


def test_stories_export_json_matches_schema(test_client: TestClient, test_db: Session) -> None:
    """Test that Stories JSON export matches the StoriesExportJSON schema.
    
    Schema fields for each story (StoryExportItem):
    - story_id: str (e.g., "US-001")
    - story_number: int
    - title: str
    - description: str | None
    - acceptance_criteria: list[str]
    - size: str | None ("xs", "s", "m", "l", "xl")
    - labels: list[str]
    - status: str | None ("draft", "ready", "exported")
    - format: str | None ("classic" or "job_story")
    - requirement_ids: list[str]
    - created_at: str (ISO 8601) | None
    - updated_at: str (ISO 8601) | None
    """
    project = _create_test_project(test_db, name="Stories Schema Test")
    project_id = _get_project_id(project)

    batch = _create_test_batch(test_db, project_id)
    batch_id = cast(str, batch.id)

    # Create multiple stories to test array structure
    _create_test_story(
        test_db, project_id, batch_id,
        story_number=1,
        title="First Story",
        description="As a user, I want to do X.",
        acceptance_criteria=["Given A", "When B", "Then C"],
        size=StorySize.S,
        labels=["feature", "mvp"],
    )
    _create_test_story(
        test_db, project_id, batch_id,
        story_number=2,
        title="Second Story",
        description="As an admin, I want to manage users.",
        acceptance_criteria=["Admin can view users", "Admin can edit users"],
        size=StorySize.L,
        labels=["admin"],
    )

    # Update batch story_count
    batch.story_count = 2
    test_db.commit()

    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=json")

    assert response.status_code == 200
    data = response.json()

    # Validate against the schema
    export_model = StoriesExportJSON.model_validate(data)

    assert isinstance(export_model.stories, list)
    assert len(export_model.stories) == 2

    # Verify first story structure
    story1 = export_model.stories[0]
    assert story1.story_id == "US-001"
    assert story1.story_number == 1
    assert story1.title == "First Story"
    assert story1.description == "As a user, I want to do X."
    assert story1.acceptance_criteria == ["Given A", "When B", "Then C"]
    assert story1.size == "s"
    assert story1.labels == ["feature", "mvp"]
    assert story1.status == "ready"
    assert story1.format == "classic"


def test_stories_export_json_has_required_fields(test_client: TestClient, test_db: Session) -> None:
    """Test that Stories JSON export contains all required fields per story."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    batch = _create_test_batch(test_db, project_id)
    batch_id = cast(str, batch.id)

    _create_test_story(test_db, project_id, batch_id)
    batch.story_count = 1
    test_db.commit()

    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=json")
    data = response.json()

    assert "stories" in data
    story = data["stories"][0]

    # Required fields per StoryExportItem schema
    required_fields = {
        "story_id", "story_number", "title", "description",
        "acceptance_criteria", "size", "labels", "status",
        "format", "requirement_ids", "created_at", "updated_at"
    }
    assert required_fields <= set(story.keys()), f"Missing fields: {required_fields - set(story.keys())}"


# =============================================================================
# Test: Stories Export CSV Schema Conformance
# =============================================================================


def test_stories_export_csv_has_correct_columns(test_client: TestClient, test_db: Session) -> None:
    """Test that Stories CSV export has the documented column headers.
    
    Column order per STORIES_CSV_COLUMNS:
    1. Story ID
    2. Title
    3. Description
    4. Acceptance Criteria (pipe-separated)
    5. Size
    6. Labels (comma-separated)
    7. Status
    8. Format
    """
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    batch = _create_test_batch(test_db, project_id)
    batch_id = cast(str, batch.id)

    _create_test_story(test_db, project_id, batch_id)
    batch.story_count = 1
    test_db.commit()

    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=csv")

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"

    content = response.content.decode()
    reader = csv.reader(io.StringIO(content))
    headers = next(reader)

    # Verify headers match documented schema
    assert headers == STORIES_CSV_COLUMNS


def test_stories_export_csv_acceptance_criteria_format(test_client: TestClient, test_db: Session) -> None:
    """Test that acceptance criteria in CSV are pipe-separated as documented."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    batch = _create_test_batch(test_db, project_id)
    batch_id = cast(str, batch.id)

    _create_test_story(
        test_db, project_id, batch_id,
        acceptance_criteria=["First criterion", "Second criterion", "Third criterion"],
    )
    batch.story_count = 1
    test_db.commit()

    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=csv")

    content = response.content.decode()
    reader = csv.reader(io.StringIO(content))
    next(reader)  # Skip header
    row = next(reader)

    # Acceptance Criteria is column index 3 (0-indexed)
    ac_column = row[3]

    # Should be pipe-separated
    assert " | " in ac_column
    assert ac_column == "First criterion | Second criterion | Third criterion"


def test_stories_export_csv_labels_format(test_client: TestClient, test_db: Session) -> None:
    """Test that labels in CSV are comma-separated as documented."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    batch = _create_test_batch(test_db, project_id)
    batch_id = cast(str, batch.id)

    _create_test_story(
        test_db, project_id, batch_id,
        labels=["feature", "backend", "api"],
    )
    batch.story_count = 1
    test_db.commit()

    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=csv")

    content = response.content.decode()
    reader = csv.reader(io.StringIO(content))
    next(reader)  # Skip header
    row = next(reader)

    # Labels is column index 5 (0-indexed)
    labels_column = row[5]

    # Should be comma-separated
    assert labels_column == "feature, backend, api"


def test_stories_export_csv_size_uppercase(test_client: TestClient, test_db: Session) -> None:
    """Test that size in CSV is uppercase as documented."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    batch = _create_test_batch(test_db, project_id)
    batch_id = cast(str, batch.id)

    _create_test_story(test_db, project_id, batch_id, size=StorySize.XL)
    batch.story_count = 1
    test_db.commit()

    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=csv")

    content = response.content.decode()
    reader = csv.reader(io.StringIO(content))
    next(reader)  # Skip header
    row = next(reader)

    # Size is column index 4 (0-indexed)
    size_column = row[4]
    assert size_column == "XL"


def test_stories_export_csv_column_order(test_client: TestClient, test_db: Session) -> None:
    """Test that CSV columns are in the documented order."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    batch = _create_test_batch(test_db, project_id)
    batch_id = cast(str, batch.id)

    _create_test_story(
        test_db, project_id, batch_id,
        story_number=42,
        title="Test Story Title",
        description="Story description here",
        acceptance_criteria=["AC1", "AC2"],
        size=StorySize.M,
        labels=["label1"],
        status=StoryStatus.DRAFT,
        format=StoryFormat.JOB_STORY,
    )
    batch.story_count = 1
    test_db.commit()

    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=csv")

    content = response.content.decode()
    reader = csv.reader(io.StringIO(content))
    next(reader)  # Skip header
    row = next(reader)

    # Verify column values are in correct positions
    assert row[0] == "US-042"  # Story ID
    assert row[1] == "Test Story Title"  # Title
    assert row[2] == "Story description here"  # Description
    assert row[3] == "AC1 | AC2"  # Acceptance Criteria (pipe-separated)
    assert row[4] == "M"  # Size (uppercase)
    assert row[5] == "label1"  # Labels
    assert row[6] == "draft"  # Status
    assert row[7] == "job_story"  # Format
