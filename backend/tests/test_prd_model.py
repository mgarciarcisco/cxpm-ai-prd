"""Unit tests for PRD model section progress tracking fields.

These tests verify the new fields added to support staged parallel PRD generation:
- PRDStatus.PARTIAL enum value
- current_stage field
- sections_completed field
- sections_total field
- Section metadata in sections JSON (status, error, generated_at)
"""

from datetime import datetime
from typing import cast

import pytest
from sqlalchemy.orm import Session

from app.models import PRD, Project
from app.models.prd import PRDMode, PRDStatus


# =============================================================================
# Helper Functions
# =============================================================================


def _create_test_project(db: Session, name: str = "Test Project") -> Project:
    """Create a test project."""
    project = Project(
        name=name,
        description="For PRD model tests"
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _get_project_id(project: Project) -> str:
    """Get project ID as string for type safety."""
    return cast(str, project.id)


# =============================================================================
# Test: PRDStatus.PARTIAL enum value
# =============================================================================


def test_prd_status_partial_exists() -> None:
    """Test that PRDStatus.PARTIAL enum value exists."""
    assert hasattr(PRDStatus, 'PARTIAL')
    assert PRDStatus.PARTIAL.value == "partial"


def test_prd_can_be_created_with_partial_status(test_db: Session) -> None:
    """Test that PRD can be created with PARTIAL status."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    prd = PRD(
        project_id=project_id,
        version=1,
        mode=PRDMode.DRAFT,
        status=PRDStatus.PARTIAL,
    )
    test_db.add(prd)
    test_db.commit()
    test_db.refresh(prd)

    assert prd.status == PRDStatus.PARTIAL


# =============================================================================
# Test: current_stage field
# =============================================================================


def test_prd_has_current_stage_field(test_db: Session) -> None:
    """Test that PRD has current_stage field."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    prd = PRD(
        project_id=project_id,
        version=1,
        mode=PRDMode.DRAFT,
        status=PRDStatus.GENERATING,
        current_stage=2,
    )
    test_db.add(prd)
    test_db.commit()
    test_db.refresh(prd)

    assert prd.current_stage == 2


def test_prd_current_stage_is_nullable(test_db: Session) -> None:
    """Test that current_stage can be None."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    prd = PRD(
        project_id=project_id,
        version=1,
        mode=PRDMode.DRAFT,
        status=PRDStatus.QUEUED,
    )
    test_db.add(prd)
    test_db.commit()
    test_db.refresh(prd)

    assert prd.current_stage is None


def test_prd_current_stage_can_be_updated(test_db: Session) -> None:
    """Test that current_stage can be updated during generation."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    prd = PRD(
        project_id=project_id,
        version=1,
        mode=PRDMode.DRAFT,
        status=PRDStatus.GENERATING,
        current_stage=1,
    )
    test_db.add(prd)
    test_db.commit()

    # Update stage
    prd.current_stage = 2
    test_db.commit()
    test_db.refresh(prd)

    assert prd.current_stage == 2


# =============================================================================
# Test: sections_completed field
# =============================================================================


def test_prd_has_sections_completed_field(test_db: Session) -> None:
    """Test that PRD has sections_completed field."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    prd = PRD(
        project_id=project_id,
        version=1,
        mode=PRDMode.DRAFT,
        status=PRDStatus.GENERATING,
        sections_completed=3,
    )
    test_db.add(prd)
    test_db.commit()
    test_db.refresh(prd)

    assert prd.sections_completed == 3


def test_prd_sections_completed_defaults_to_zero(test_db: Session) -> None:
    """Test that sections_completed defaults to 0."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    prd = PRD(
        project_id=project_id,
        version=1,
        mode=PRDMode.DRAFT,
        status=PRDStatus.QUEUED,
    )
    test_db.add(prd)
    test_db.commit()
    test_db.refresh(prd)

    assert prd.sections_completed == 0


# =============================================================================
# Test: sections_total field
# =============================================================================


def test_prd_has_sections_total_field(test_db: Session) -> None:
    """Test that PRD has sections_total field."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    prd = PRD(
        project_id=project_id,
        version=1,
        mode=PRDMode.DRAFT,
        status=PRDStatus.GENERATING,
        sections_total=10,
    )
    test_db.add(prd)
    test_db.commit()
    test_db.refresh(prd)

    assert prd.sections_total == 10


def test_prd_sections_total_defaults_to_zero(test_db: Session) -> None:
    """Test that sections_total defaults to 0."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    prd = PRD(
        project_id=project_id,
        version=1,
        mode=PRDMode.DRAFT,
        status=PRDStatus.QUEUED,
    )
    test_db.add(prd)
    test_db.commit()
    test_db.refresh(prd)

    assert prd.sections_total == 0


# =============================================================================
# Test: Section metadata in sections JSON
# =============================================================================


def test_prd_sections_can_include_status(test_db: Session) -> None:
    """Test that sections JSON can include status field."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    sections = [
        {"title": "Executive Summary", "content": "Summary", "status": "completed"},
        {"title": "Problem Statement", "content": "Problem", "status": "completed"},
        {"title": "Goals", "content": None, "status": "failed"},
    ]

    prd = PRD(
        project_id=project_id,
        version=1,
        mode=PRDMode.DRAFT,
        status=PRDStatus.PARTIAL,
        sections=sections,
    )
    test_db.add(prd)
    test_db.commit()
    test_db.refresh(prd)

    assert prd.sections[0]["status"] == "completed"
    assert prd.sections[2]["status"] == "failed"


def test_prd_sections_can_include_error(test_db: Session) -> None:
    """Test that sections JSON can include error field."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    sections = [
        {"title": "Executive Summary", "content": "Summary", "status": "completed"},
        {"title": "Goals", "content": None, "status": "failed", "error": "LLM timeout"},
    ]

    prd = PRD(
        project_id=project_id,
        version=1,
        mode=PRDMode.DRAFT,
        status=PRDStatus.PARTIAL,
        sections=sections,
    )
    test_db.add(prd)
    test_db.commit()
    test_db.refresh(prd)

    assert prd.sections[1]["error"] == "LLM timeout"


def test_prd_sections_can_include_generated_at(test_db: Session) -> None:
    """Test that sections JSON can include generated_at field."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    generated_time = datetime.utcnow().isoformat()
    sections = [
        {
            "title": "Executive Summary",
            "content": "Summary",
            "status": "completed",
            "generated_at": generated_time,
        },
    ]

    prd = PRD(
        project_id=project_id,
        version=1,
        mode=PRDMode.DRAFT,
        status=PRDStatus.GENERATING,
        sections=sections,
    )
    test_db.add(prd)
    test_db.commit()
    test_db.refresh(prd)

    assert prd.sections[0]["generated_at"] == generated_time


def test_prd_section_metadata_full_example(test_db: Session) -> None:
    """Test full example of section metadata for staged generation."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Simulate a PRD mid-generation with some sections complete, some pending
    sections = [
        {
            "title": "Executive Summary",
            "content": "Full summary content here...",
            "status": "completed",
            "generated_at": "2026-01-26T10:00:00",
        },
        {
            "title": "Problem Statement",
            "content": "Problem description...",
            "status": "completed",
            "generated_at": "2026-01-26T10:00:01",
        },
        {
            "title": "Goals",
            "content": None,
            "status": "pending",
        },
        {
            "title": "User Personas",
            "content": None,
            "status": "failed",
            "error": "LLM rate limit exceeded",
        },
    ]

    prd = PRD(
        project_id=project_id,
        version=1,
        mode=PRDMode.DETAILED,
        status=PRDStatus.PARTIAL,
        current_stage=2,
        sections_completed=2,
        sections_total=4,
        sections=sections,
    )
    test_db.add(prd)
    test_db.commit()
    test_db.refresh(prd)

    # Verify all fields work together
    assert prd.status == PRDStatus.PARTIAL
    assert prd.current_stage == 2
    assert prd.sections_completed == 2
    assert prd.sections_total == 4

    # Verify section metadata
    completed_sections = [s for s in prd.sections if s["status"] == "completed"]
    failed_sections = [s for s in prd.sections if s["status"] == "failed"]
    pending_sections = [s for s in prd.sections if s["status"] == "pending"]

    assert len(completed_sections) == 2
    assert len(failed_sections) == 1
    assert len(pending_sections) == 1
    assert failed_sections[0]["error"] == "LLM rate limit exceeded"
