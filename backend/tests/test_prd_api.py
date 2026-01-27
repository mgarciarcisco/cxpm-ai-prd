"""Integration tests for PRD API endpoints."""

import json
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any, cast
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import PRD, Project, Requirement
from app.models.meeting_item import Section
from app.models.prd import PRDMode, PRDStatus


# =============================================================================
# Helper Functions
# =============================================================================


def _create_test_project(db: Session, name: str = "Test Project") -> Project:
    """Create a test project."""
    project = Project(
        name=name,
        description="For PRD API tests"
    )
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
    is_active: bool = True,
) -> Requirement:
    """Create a test requirement."""
    requirement = Requirement(
        project_id=project_id,
        section=section,
        content=content,
        order=0,
        is_active=is_active,
    )
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return requirement


def _create_test_prd(
    db: Session,
    project_id: str,
    version: int = 1,
    mode: PRDMode = PRDMode.DRAFT,
    status: PRDStatus = PRDStatus.READY,
    title: str = "Test PRD",
    sections: list[dict] | None = None,
    raw_markdown: str | None = None,
) -> PRD:
    """Create a test PRD."""
    if sections is None:
        sections = [
            {"title": "Executive Summary", "content": "Test summary content."},
            {"title": "Problem Statement", "content": "Test problem content."},
        ]
    if raw_markdown is None:
        raw_markdown = f"# {title}\n\n## Executive Summary\n\nTest summary content.\n\n## Problem Statement\n\nTest problem content.\n"
    
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


def _get_prd_id(prd: PRD) -> str:
    """Get PRD ID as string for type safety."""
    return cast(str, prd.id)


# =============================================================================
# Test: POST /projects/{project_id}/prds/generate
# =============================================================================


def test_generate_returns_queued_status(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /generate creates PRD with status=queued and returns it."""
    # Create a project with requirements
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)
    
    response = test_client.post(
        f"/api/projects/{project_id}/prds/generate",
        json={"mode": "draft"},
    )
    
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "queued"
    assert "id" in data
    assert data["error_message"] is None
    # Version is None while queued (assigned during generation)
    assert data["version"] is None


def test_generate_returns_404_for_missing_project(test_client: TestClient) -> None:
    """Test that POST /generate returns 404 for non-existent project."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    
    response = test_client.post(
        f"/api/projects/{fake_uuid}/prds/generate",
        json={"mode": "draft"},
    )
    
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_generate_validates_mode(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /generate validates the mode field."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    response = test_client.post(
        f"/api/projects/{project_id}/prds/generate",
        json={"mode": "invalid_mode"},
    )
    
    assert response.status_code == 422  # Validation error


def test_generate_accepts_detailed_mode(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /generate accepts detailed mode."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)
    
    response = test_client.post(
        f"/api/projects/{project_id}/prds/generate",
        json={"mode": "detailed"},
    )
    
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "queued"


# =============================================================================
# Test: GET /prds/{prd_id}/status
# =============================================================================


def test_status_polling_returns_queued(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /status returns queued status for new PRD."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.QUEUED)
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == prd_id
    assert data["status"] == "queued"
    assert data["error_message"] is None
    assert data["version"] is None  # Not assigned until ready


def test_status_polling_returns_generating(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /status returns generating status."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.GENERATING)
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "generating"


def test_status_polling_returns_ready_with_version(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /status returns ready status with version."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, version=3, status=PRDStatus.READY)
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["version"] == 3


def test_status_polling_returns_failed_with_error(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /status returns failed status with error message."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.FAILED)
    prd.error_message = "LLM connection failed"
    test_db.commit()
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert data["error_message"] == "LLM connection failed"


def test_status_polling_returns_404_for_missing_prd(test_client: TestClient) -> None:
    """Test that GET /status returns 404 for non-existent PRD."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    
    response = test_client.get(f"/api/prds/{fake_uuid}/status")
    
    assert response.status_code == 404
    assert response.json()["detail"] == "PRD not found"


# =============================================================================
# Test: POST /prds/{prd_id}/cancel
# =============================================================================


def test_cancel_generation_from_queued(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /cancel sets status=cancelled when queued."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.QUEUED)
    prd_id = _get_prd_id(prd)
    
    response = test_client.post(f"/api/prds/{prd_id}/cancel")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"
    
    # Verify in database
    test_db.refresh(prd)
    assert prd.status == PRDStatus.CANCELLED


def test_cancel_generation_from_generating(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /cancel sets status=cancelled when generating."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.GENERATING)
    prd_id = _get_prd_id(prd)
    
    response = test_client.post(f"/api/prds/{prd_id}/cancel")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"


def test_cancel_fails_for_ready_prd(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /cancel returns 400 for already ready PRD."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.READY)
    prd_id = _get_prd_id(prd)
    
    response = test_client.post(f"/api/prds/{prd_id}/cancel")
    
    assert response.status_code == 400
    assert "Cannot cancel PRD with status 'ready'" in response.json()["detail"]


def test_cancel_fails_for_already_cancelled_prd(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /cancel returns 400 for already cancelled PRD."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.CANCELLED)
    prd_id = _get_prd_id(prd)
    
    response = test_client.post(f"/api/prds/{prd_id}/cancel")
    
    assert response.status_code == 400


def test_cancel_returns_404_for_missing_prd(test_client: TestClient) -> None:
    """Test that POST /cancel returns 404 for non-existent PRD."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    
    response = test_client.post(f"/api/prds/{fake_uuid}/cancel")
    
    assert response.status_code == 404


# =============================================================================
# Test: GET /projects/{project_id}/prds (list with pagination)
# =============================================================================


def test_list_prds_returns_empty_for_new_project(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /prds returns empty list for project with no PRDs."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    response = test_client.get(f"/api/projects/{project_id}/prds")
    
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0


def test_list_prds_returns_prds(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /prds returns PRDs for project."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_prd(test_db, project_id, version=1, title="PRD v1")
    _create_test_prd(test_db, project_id, version=2, title="PRD v2")
    
    response = test_client.get(f"/api/projects/{project_id}/prds")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert data["total"] == 2
    # Should be ordered by version descending
    assert data["items"][0]["version"] == 2
    assert data["items"][1]["version"] == 1


def test_list_prds_pagination_skip(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /prds respects skip parameter."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    for i in range(5):
        _create_test_prd(test_db, project_id, version=i + 1, title=f"PRD v{i + 1}")
    
    response = test_client.get(f"/api/projects/{project_id}/prds?skip=2")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 3
    assert data["total"] == 5
    assert data["skip"] == 2


def test_list_prds_pagination_limit(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /prds respects limit parameter."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    for i in range(5):
        _create_test_prd(test_db, project_id, version=i + 1, title=f"PRD v{i + 1}")
    
    response = test_client.get(f"/api/projects/{project_id}/prds?limit=2")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert data["total"] == 5
    assert data["limit"] == 2


def test_list_prds_pagination_skip_and_limit(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /prds respects both skip and limit parameters."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    for i in range(10):
        _create_test_prd(test_db, project_id, version=i + 1, title=f"PRD v{i + 1}")
    
    response = test_client.get(f"/api/projects/{project_id}/prds?skip=3&limit=4")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 4
    assert data["total"] == 10
    assert data["skip"] == 3
    assert data["limit"] == 4


def test_list_prds_excludes_archived_by_default(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /prds excludes archived PRDs by default."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_prd(test_db, project_id, version=1, status=PRDStatus.READY)
    _create_test_prd(test_db, project_id, version=2, status=PRDStatus.ARCHIVED)
    
    response = test_client.get(f"/api/projects/{project_id}/prds")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["version"] == 1


def test_list_prds_includes_archived_when_requested(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /prds includes archived PRDs when include_archived=true."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_prd(test_db, project_id, version=1, status=PRDStatus.READY)
    _create_test_prd(test_db, project_id, version=2, status=PRDStatus.ARCHIVED)
    
    response = test_client.get(f"/api/projects/{project_id}/prds?include_archived=true")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2


def test_list_prds_returns_404_for_missing_project(test_client: TestClient) -> None:
    """Test that GET /prds returns 404 for non-existent project."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    
    response = test_client.get(f"/api/projects/{fake_uuid}/prds")
    
    assert response.status_code == 404


# =============================================================================
# Test: GET /prds/{prd_id}
# =============================================================================


def test_get_prd_returns_prd(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /prds/{id} returns the PRD with all sections."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    sections = [
        {"title": "Executive Summary", "content": "Summary content"},
        {"title": "Problem Statement", "content": "Problem content"},
    ]
    prd = _create_test_prd(
        test_db, project_id, 
        version=2, 
        title="Detailed PRD",
        sections=sections,
    )
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == prd_id
    assert data["title"] == "Detailed PRD"
    assert data["version"] == 2
    assert len(data["sections"]) == 2
    assert data["sections"][0]["title"] == "Executive Summary"


def test_get_prd_returns_404_for_missing(test_client: TestClient) -> None:
    """Test that GET /prds/{id} returns 404 for non-existent PRD."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    
    response = test_client.get(f"/api/prds/{fake_uuid}")
    
    assert response.status_code == 404


# =============================================================================
# Test: PUT /prds/{prd_id}
# =============================================================================


def test_update_prd_title(test_client: TestClient, test_db: Session) -> None:
    """Test that PUT /prds/{id} updates the title."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, title="Original Title")
    prd_id = _get_prd_id(prd)
    
    response = test_client.put(
        f"/api/prds/{prd_id}",
        json={"title": "Updated Title"},
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"


def test_update_prd_sections(test_client: TestClient, test_db: Session) -> None:
    """Test that PUT /prds/{id} updates sections and regenerates markdown."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id)
    prd_id = _get_prd_id(prd)
    
    new_sections = [
        {"title": "New Section 1", "content": "New content 1"},
        {"title": "New Section 2", "content": "New content 2"},
    ]
    
    response = test_client.put(
        f"/api/prds/{prd_id}",
        json={"sections": new_sections},
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["sections"]) == 2
    assert data["sections"][0]["title"] == "New Section 1"
    # raw_markdown should be regenerated
    assert "New Section 1" in data["raw_markdown"]


def test_update_prd_fails_for_queued_status(test_client: TestClient, test_db: Session) -> None:
    """Test that PUT /prds/{id} fails for PRD with queued status."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.QUEUED)
    prd_id = _get_prd_id(prd)
    
    response = test_client.put(
        f"/api/prds/{prd_id}",
        json={"title": "Won't Work"},
    )
    
    assert response.status_code == 400
    assert "Cannot update PRD with status 'queued'" in response.json()["detail"]


# =============================================================================
# Test: DELETE /prds/{prd_id} (soft delete)
# =============================================================================


def test_soft_delete_prd(test_client: TestClient, test_db: Session) -> None:
    """Test that DELETE /prds/{id} soft deletes the PRD."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id)
    prd_id = _get_prd_id(prd)
    
    response = test_client.delete(f"/api/prds/{prd_id}")
    
    assert response.status_code == 204
    
    # Verify deleted_at is set
    test_db.refresh(prd)
    assert prd.deleted_at is not None


def test_soft_deleted_prd_excluded_from_list(test_client: TestClient, test_db: Session) -> None:
    """Test that soft-deleted PRDs are excluded from list."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd1 = _create_test_prd(test_db, project_id, version=1)
    prd2 = _create_test_prd(test_db, project_id, version=2)
    
    # Delete one PRD
    test_client.delete(f"/api/prds/{_get_prd_id(prd1)}")
    
    # List should only show the non-deleted one
    response = test_client.get(f"/api/projects/{project_id}/prds")
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["version"] == 2


def test_soft_deleted_prd_not_accessible_by_id(test_client: TestClient, test_db: Session) -> None:
    """Test that soft-deleted PRDs return 404 when accessed by ID."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id)
    prd_id = _get_prd_id(prd)
    
    # Delete the PRD
    test_client.delete(f"/api/prds/{prd_id}")
    
    # Try to get it
    response = test_client.get(f"/api/prds/{prd_id}")
    assert response.status_code == 404


def test_delete_returns_404_for_missing_prd(test_client: TestClient) -> None:
    """Test that DELETE /prds/{id} returns 404 for non-existent PRD."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    
    response = test_client.delete(f"/api/prds/{fake_uuid}")
    
    assert response.status_code == 404


# =============================================================================
# Test: POST /prds/{prd_id}/archive
# =============================================================================


def test_archive_prd(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /archive sets status to archived."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.READY)
    prd_id = _get_prd_id(prd)
    
    response = test_client.post(f"/api/prds/{prd_id}/archive")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "archived"
    
    # Verify in database
    test_db.refresh(prd)
    assert prd.status == PRDStatus.ARCHIVED


def test_archive_fails_for_non_ready_prd(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /archive fails for non-ready PRD."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.QUEUED)
    prd_id = _get_prd_id(prd)
    
    response = test_client.post(f"/api/prds/{prd_id}/archive")
    
    assert response.status_code == 400
    assert "Cannot archive PRD with status 'queued'" in response.json()["detail"]


# =============================================================================
# Test: GET /prds/{prd_id}/export
# =============================================================================


def test_export_markdown(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /export?format=markdown returns valid markdown."""
    project = _create_test_project(test_db, name="Export Test Project")
    project_id = _get_project_id(project)
    prd = _create_test_prd(
        test_db, project_id,
        title="Export Test PRD",
        raw_markdown="# Export Test PRD\n\n## Summary\n\nTest content.",
    )
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}/export?format=markdown")
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/markdown; charset=utf-8"
    assert "attachment" in response.headers["content-disposition"]
    assert ".md" in response.headers["content-disposition"]
    
    content = response.content.decode()
    assert "# Export Test PRD" in content
    assert "## Summary" in content


def test_export_json(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /export?format=json returns valid JSON."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    sections = [
        {"title": "Section 1", "content": "Content 1"},
        {"title": "Section 2", "content": "Content 2"},
    ]
    prd = _create_test_prd(
        test_db, project_id,
        title="JSON Export Test",
        sections=sections,
    )
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}/export?format=json")
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert ".json" in response.headers["content-disposition"]
    
    data = response.json()
    assert data["title"] == "JSON Export Test"
    assert len(data["sections"]) == 2


def test_export_json_conforms_to_schema(test_client: TestClient, test_db: Session) -> None:
    """Test that JSON export conforms to the documented PRDExportJSON schema.
    
    Validates that the export endpoint produces data matching the schema defined
    in app/schemas/prd.py (PRDExportJSON).
    """
    from app.schemas import PRDExportJSON
    
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    sections = [
        {"title": "Executive Summary", "content": "Summary content here."},
        {"title": "Problem Statement", "content": "Problem description."},
        {"title": "Goals", "content": "Project goals."},
    ]
    prd = _create_test_prd(
        test_db, project_id,
        title="Schema Validation PRD",
        mode=PRDMode.DETAILED,
        sections=sections,
    )
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}/export?format=json")
    
    assert response.status_code == 200
    data = response.json()
    
    # Validate against the documented schema
    # This will raise ValidationError if the structure doesn't match
    export_model = PRDExportJSON.model_validate(data)
    
    # Verify specific field values
    assert export_model.title == "Schema Validation PRD"
    assert export_model.version == 1
    assert export_model.mode == "detailed"
    assert len(export_model.sections) == 3
    
    # Verify section structure
    assert export_model.sections[0].title == "Executive Summary"
    assert export_model.sections[0].content == "Summary content here."
    
    # Verify timestamps are ISO format strings
    assert export_model.created_at is not None
    assert export_model.updated_at is not None
    # ISO 8601 format check: should contain 'T' for datetime separator
    assert "T" in export_model.created_at


def test_export_default_format_is_markdown(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /export without format parameter defaults to markdown."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id)
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}/export")
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/markdown; charset=utf-8"


def test_export_fails_for_queued_prd(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /export fails for PRD that is not ready."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.QUEUED)
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}/export")
    
    assert response.status_code == 400
    assert "Cannot export PRD with status 'queued'" in response.json()["detail"]


def test_export_works_for_archived_prd(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /export works for archived PRDs."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.ARCHIVED)
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}/export?format=markdown")
    
    assert response.status_code == 200


def test_export_returns_404_for_missing_prd(test_client: TestClient) -> None:
    """Test that GET /export returns 404 for non-existent PRD."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    
    response = test_client.get(f"/api/prds/{fake_uuid}/export")
    
    assert response.status_code == 404


# =============================================================================
# Test: Isolation between projects
# =============================================================================


def test_prds_isolated_between_projects(test_client: TestClient, test_db: Session) -> None:
    """Test that PRDs from one project don't appear in another project's list."""
    project1 = _create_test_project(test_db, name="Project 1")
    project2 = _create_test_project(test_db, name="Project 2")
    
    _create_test_prd(test_db, _get_project_id(project1), version=1, title="PRD for Project 1")
    _create_test_prd(test_db, _get_project_id(project2), version=1, title="PRD for Project 2")
    _create_test_prd(test_db, _get_project_id(project2), version=2, title="Another PRD for Project 2")
    
    response1 = test_client.get(f"/api/projects/{_get_project_id(project1)}/prds")
    response2 = test_client.get(f"/api/projects/{_get_project_id(project2)}/prds")
    
    assert len(response1.json()["items"]) == 1
    assert response1.json()["items"][0]["title"] == "PRD for Project 1"
    
    assert len(response2.json()["items"]) == 2


# =============================================================================
# Test: Project Access Enforcement (US-034)
# =============================================================================


def test_get_prd_returns_404_when_project_deleted(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /prds/{prd_id} returns 404 when the PRD's project has been deleted.
    
    This verifies project access is enforced even when accessing a PRD by its ID.
    """
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id)
    prd_id = _get_prd_id(prd)
    
    # Delete the project (this should make the PRD inaccessible)
    test_db.delete(project)
    test_db.commit()
    
    # Now try to access the PRD - should get 404 because project access check fails
    response = test_client.get(f"/api/prds/{prd_id}")
    
    assert response.status_code == 404
    assert "PRD not found" in response.json()["detail"]


def test_update_prd_returns_404_when_project_deleted(test_client: TestClient, test_db: Session) -> None:
    """Test that PUT /prds/{prd_id} returns 404 when the PRD's project has been deleted."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id)
    prd_id = _get_prd_id(prd)
    
    # Delete the project
    test_db.delete(project)
    test_db.commit()
    
    # Try to update the PRD
    response = test_client.put(
        f"/api/prds/{prd_id}",
        json={"title": "New Title"}
    )
    
    assert response.status_code == 404


def test_delete_prd_returns_404_when_project_deleted(test_client: TestClient, test_db: Session) -> None:
    """Test that DELETE /prds/{prd_id} returns 404 when the PRD's project has been deleted."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id)
    prd_id = _get_prd_id(prd)
    
    # Delete the project
    test_db.delete(project)
    test_db.commit()
    
    # Try to delete the PRD
    response = test_client.delete(f"/api/prds/{prd_id}")
    
    assert response.status_code == 404


def test_prd_status_returns_404_when_project_deleted(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /prds/{prd_id}/status returns 404 when project is deleted."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.GENERATING)
    prd_id = _get_prd_id(prd)
    
    # Delete the project
    test_db.delete(project)
    test_db.commit()
    
    # Try to get status
    response = test_client.get(f"/api/prds/{prd_id}/status")
    
    assert response.status_code == 404


def test_cancel_prd_returns_404_when_project_deleted(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /prds/{prd_id}/cancel returns 404 when project is deleted."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.GENERATING)
    prd_id = _get_prd_id(prd)
    
    # Delete the project
    test_db.delete(project)
    test_db.commit()
    
    # Try to cancel
    response = test_client.post(f"/api/prds/{prd_id}/cancel")
    
    assert response.status_code == 404


def test_archive_prd_returns_404_when_project_deleted(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /prds/{prd_id}/archive returns 404 when project is deleted."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.READY)
    prd_id = _get_prd_id(prd)
    
    # Delete the project
    test_db.delete(project)
    test_db.commit()
    
    # Try to archive
    response = test_client.post(f"/api/prds/{prd_id}/archive")
    
    assert response.status_code == 404


def test_export_prd_returns_404_when_project_deleted(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /prds/{prd_id}/export returns 404 when project is deleted."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.READY)
    prd_id = _get_prd_id(prd)
    
    # Delete the project
    test_db.delete(project)
    test_db.commit()
    
    # Try to export
    response = test_client.get(f"/api/prds/{prd_id}/export")
    
    assert response.status_code == 404


def test_prd_accessible_when_project_exists(test_client: TestClient, test_db: Session) -> None:
    """Test that PRD is accessible when its project exists (positive case)."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, title="Accessible PRD")
    prd_id = _get_prd_id(prd)
    
    # PRD should be accessible
    response = test_client.get(f"/api/prds/{prd_id}")
    
    assert response.status_code == 200
    assert response.json()["title"] == "Accessible PRD"


# =============================================================================
# Test: Error Handling Edge Cases (US-037)
# =============================================================================


def test_failed_prd_includes_error_message_in_status(test_client: TestClient, test_db: Session) -> None:
    """Test that failed PRD status includes helpful error message."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.FAILED)
    prd.error_message = "Project has no requirements to generate PRD from"
    test_db.commit()
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert "no requirements" in data["error_message"].lower()


def test_failed_prd_with_timeout_includes_specific_message(test_client: TestClient, test_db: Session) -> None:
    """Test that timeout errors include specific timeout message."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.FAILED)
    prd.error_message = "LLM error: Ollama request timed out"
    test_db.commit()
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert "timed out" in data["error_message"].lower()


def test_failed_prd_with_parsing_error_includes_details(test_client: TestClient, test_db: Session) -> None:
    """Test that malformed LLM response includes parsing error details."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.FAILED)
    prd.error_message = "Failed to parse LLM response: Invalid JSON response from LLM"
    test_db.commit()
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert "parse" in data["error_message"].lower() or "invalid json" in data["error_message"].lower()


def test_cancel_returns_400_not_500_for_failed_prd(test_client: TestClient, test_db: Session) -> None:
    """Test that cancelling failed PRD returns user-friendly 400, not 500."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id, status=PRDStatus.FAILED)
    prd_id = _get_prd_id(prd)
    
    response = test_client.post(f"/api/prds/{prd_id}/cancel")
    
    # Should return 400 Bad Request, not 500 Internal Server Error
    assert response.status_code == 400
    assert "Cannot cancel" in response.json()["detail"]


def test_update_non_existent_prd_returns_404(test_client: TestClient, test_db: Session) -> None:
    """Test that updating non-existent PRD returns 404."""
    response = test_client.put(
        "/api/prds/00000000-0000-0000-0000-000000000000",
        json={"title": "New Title"}
    )
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_archive_non_existent_prd_returns_404(test_client: TestClient, test_db: Session) -> None:
    """Test that archiving non-existent PRD returns 404."""
    response = test_client.post("/api/prds/00000000-0000-0000-0000-000000000000/archive")
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_export_with_invalid_format_returns_422(test_client: TestClient, test_db: Session) -> None:
    """Test that invalid export format returns validation error."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    prd = _create_test_prd(test_db, project_id)
    prd_id = _get_prd_id(prd)
    
    response = test_client.get(f"/api/prds/{prd_id}/export?format=invalid")
    
    # FastAPI returns 422 for validation errors
    assert response.status_code == 422


def test_list_prds_with_invalid_skip_returns_422(test_client: TestClient, test_db: Session) -> None:
    """Test that invalid skip parameter returns validation error."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    response = test_client.get(f"/api/projects/{project_id}/prds?skip=-1")
    
    # FastAPI returns 422 for validation errors (negative skip)
    assert response.status_code == 422


def test_list_prds_with_invalid_limit_returns_422(test_client: TestClient, test_db: Session) -> None:
    """Test that invalid limit parameter returns validation error."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    response = test_client.get(f"/api/projects/{project_id}/prds?limit=0")

    # FastAPI returns 422 for validation errors (limit too low)
    assert response.status_code == 422


# =============================================================================
# PRD Streaming Endpoint Tests
# =============================================================================


def _parse_sse_events(response_text: str) -> list[dict[str, Any]]:
    """Parse SSE events from response text.

    SSE format:
    event: event_name
    data: json_data

    Events are separated by double newlines.
    """
    events = []
    current_event: dict[str, str] = {}

    for line in response_text.split('\n'):
        line = line.strip()
        if not line:
            if current_event:
                # Parse the data field as JSON
                if 'data' in current_event:
                    try:
                        current_event['data'] = json.loads(current_event['data'])
                    except json.JSONDecodeError:
                        pass  # Keep as string if not valid JSON
                events.append(current_event)
                current_event = {}
            continue

        if line.startswith('event:'):
            current_event['event'] = line[6:].strip()
        elif line.startswith('data:'):
            current_event['data'] = line[5:].strip()

    # Don't forget the last event if no trailing newline
    if current_event:
        if 'data' in current_event:
            try:
                current_event['data'] = json.loads(current_event['data'])
            except json.JSONDecodeError:
                pass
        events.append(current_event)

    return events


async def _mock_generate_stream_success(
    project_id: str,
    mode: PRDMode,
    created_by: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Mock generate_stream that yields title and sections."""
    yield {"type": "title", "title": "PRD: Test Feature"}
    yield {
        "type": "section",
        "id": "executive_summary",
        "title": "Executive Summary",
        "content": "This is the executive summary.",
        "order": 1,
    }
    yield {
        "type": "section",
        "id": "problem_statement",
        "title": "Problem Statement",
        "content": "This is the problem statement.",
        "order": 2,
    }
    yield {
        "type": "complete",
        "prd_id": "test-prd-id",
        "version": 1,
        "section_count": 2,
    }


async def _mock_generate_stream_no_requirements(
    project_id: str,
    mode: PRDMode,
    created_by: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Mock generate_stream that raises NoRequirementsError."""
    from app.exceptions import NoRequirementsError
    raise NoRequirementsError(project_id)
    yield {}  # Never reached, but makes this an async generator


async def _mock_generate_stream_llm_error(
    project_id: str,
    mode: PRDMode,
    created_by: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Mock generate_stream that raises LLMError."""
    from app.services.llm import LLMError
    raise LLMError("LLM connection failed")
    yield {}  # Never reached


def test_stream_prd_generation_returns_status_event(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint returns initial status event."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)

    with patch(
        "app.routers.prds.PRDGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_success

        response = test_client.get(f"/api/projects/{project_id}/prds/stream?mode=draft")

    assert response.status_code == 200
    events = _parse_sse_events(response.text)

    # First event should be status
    assert len(events) > 0
    assert events[0]["event"] == "status"
    assert events[0]["data"]["status"] == "generating"
    assert events[0]["data"]["mode"] == "draft"


def test_stream_prd_generation_returns_title_event(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint returns title event."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)

    with patch(
        "app.routers.prds.PRDGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_success

        response = test_client.get(f"/api/projects/{project_id}/prds/stream")

    events = _parse_sse_events(response.text)

    # Should have a title event
    title_events = [e for e in events if e.get("event") == "title"]
    assert len(title_events) == 1
    assert title_events[0]["data"]["title"] == "PRD: Test Feature"


def test_stream_prd_generation_returns_section_events(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint returns section events."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)

    with patch(
        "app.routers.prds.PRDGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_success

        response = test_client.get(f"/api/projects/{project_id}/prds/stream")

    events = _parse_sse_events(response.text)

    # Should have section events
    section_events = [e for e in events if e.get("event") == "section"]
    assert len(section_events) == 2

    assert section_events[0]["data"]["id"] == "executive_summary"
    assert section_events[0]["data"]["title"] == "Executive Summary"
    assert section_events[0]["data"]["order"] == 1

    assert section_events[1]["data"]["id"] == "problem_statement"


def test_stream_prd_generation_returns_complete_event(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint returns complete event."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)

    with patch(
        "app.routers.prds.PRDGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_success

        response = test_client.get(f"/api/projects/{project_id}/prds/stream")

    events = _parse_sse_events(response.text)

    # Last event should be complete
    complete_events = [e for e in events if e.get("event") == "complete"]
    assert len(complete_events) == 1
    assert complete_events[0]["data"]["prd_id"] == "test-prd-id"
    assert complete_events[0]["data"]["version"] == 1
    assert complete_events[0]["data"]["section_count"] == 2


def test_stream_prd_generation_returns_error_for_no_requirements(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint returns error when no requirements."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    # Don't create any requirements

    with patch(
        "app.routers.prds.PRDGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_no_requirements

        response = test_client.get(f"/api/projects/{project_id}/prds/stream")

    events = _parse_sse_events(response.text)

    # Should have error event
    error_events = [e for e in events if e.get("event") == "error"]
    assert len(error_events) == 1
    assert "no requirements" in error_events[0]["data"]["message"].lower()


def test_stream_prd_generation_returns_error_for_llm_failure(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint returns error on LLM failure."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)

    with patch(
        "app.routers.prds.PRDGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_llm_error

        response = test_client.get(f"/api/projects/{project_id}/prds/stream")

    events = _parse_sse_events(response.text)

    # Should have error event
    error_events = [e for e in events if e.get("event") == "error"]
    assert len(error_events) == 1
    assert "LLM" in error_events[0]["data"]["message"]


def test_stream_prd_generation_returns_404_for_missing_project(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint returns 404 for non-existent project."""
    fake_project_id = "00000000-0000-0000-0000-000000000000"

    response = test_client.get(f"/api/projects/{fake_project_id}/prds/stream")

    assert response.status_code == 404


def test_stream_prd_generation_accepts_mode_parameter(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint accepts mode parameter."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)

    with patch(
        "app.routers.prds.PRDGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_success

        response = test_client.get(f"/api/projects/{project_id}/prds/stream?mode=detailed")

    events = _parse_sse_events(response.text)

    # Status event should include the mode
    status_events = [e for e in events if e.get("event") == "status"]
    assert len(status_events) == 1
    assert status_events[0]["data"]["mode"] == "detailed"
