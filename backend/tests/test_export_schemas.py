"""Tests for export schema conformance.

This file verifies that the export endpoints produce data that conforms to
the documented schemas in app/schemas/prd.py.

Schema Documentation:
- PRDExportJSON: Defines the structure of PRD JSON exports
"""

from typing import cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import PRD, Project, Requirement
from app.models.meeting_item import Section
from app.models.prd import PRDMode, PRDStatus
from app.schemas import PRDExportJSON

# =============================================================================
# Helper Functions
# =============================================================================


def _create_test_project(db: Session, name: str = "Test Project") -> Project:
    """Create a test project."""
    project = Project(name=name, user_id="test-user-0000-0000-000000000001", description="For export schema tests")
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


# =============================================================================
# Test: PRD Export JSON Schema Conformance
# =============================================================================


def test_prd_export_json_matches_schema(auth_client: TestClient, test_db: Session) -> None:
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

    response = auth_client.get(f"/api/prds/{prd_id}/export?format=json")

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


def test_prd_export_json_has_required_fields(auth_client: TestClient, test_db: Session) -> None:
    """Test that PRD JSON export contains all required fields."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    prd = _create_test_prd(test_db, project_id, mode=PRDMode.DRAFT)
    prd_id = cast(str, prd.id)

    response = auth_client.get(f"/api/prds/{prd_id}/export?format=json")
    data = response.json()

    # Required fields per PRDExportJSON schema
    required_fields = {"title", "version", "mode", "sections", "created_at", "updated_at"}
    assert required_fields <= set(data.keys()), f"Missing fields: {required_fields - set(data.keys())}"


def test_prd_export_json_sections_structure(auth_client: TestClient, test_db: Session) -> None:
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

    response = auth_client.get(f"/api/prds/{prd_id}/export?format=json")
    data = response.json()

    sections = data["sections"]
    for section in sections:
        # Each section must have exactly title and content
        assert "title" in section
        assert "content" in section
        assert isinstance(section["title"], str)
        assert isinstance(section["content"], str)
