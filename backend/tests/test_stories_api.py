"""Integration tests for Stories API endpoints.

This file contains:
- Project access enforcement tests (US-034)
- Full Stories API coverage tests (US-036)
"""

import csv
import io
from typing import cast

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Project, Requirement, StoryBatch, UserStory
from app.models.meeting_item import Section
from app.models.story_batch import StoryBatchStatus
from app.models.user_story import StoryFormat, StorySize, StoryStatus


# =============================================================================
# Helper Functions
# =============================================================================


def _create_test_project(db: Session, name: str = "Test Project") -> Project:
    """Create a test project."""
    project = Project(
        name=name,
        description="For Stories API tests"
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
    section: Section = Section.functional_requirements,
    content: str = "Test requirement",
    order: int = 0,
) -> Requirement:
    """Create a test requirement."""
    requirement = Requirement(
        project_id=project_id,
        section=section,
        content=content,
        order=order,
        is_active=True,
    )
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return requirement


def _create_test_batch(
    db: Session,
    project_id: str,
    format: StoryFormat = StoryFormat.CLASSIC,
    status: StoryBatchStatus = StoryBatchStatus.READY,
    story_count: int = 0,
) -> StoryBatch:
    """Create a test story batch."""
    batch = StoryBatch(
        project_id=project_id,
        format=format,
        status=status,
        story_count=story_count,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def _get_batch_id(batch: StoryBatch) -> str:
    """Get batch ID as string for type safety."""
    return cast(str, batch.id)


def _create_test_story(
    db: Session,
    project_id: str,
    batch_id: str | None = None,
    story_number: int = 1,
    title: str = "Test Story",
    description: str = "Test description",
    acceptance_criteria: list[str] | None = None,
    labels: list[str] | None = None,
    size: StorySize = StorySize.M,
    status: StoryStatus = StoryStatus.DRAFT,
    format: StoryFormat = StoryFormat.CLASSIC,
    order: int = 0,
) -> UserStory:
    """Create a test user story."""
    story = UserStory(
        project_id=project_id,
        batch_id=batch_id,
        story_number=story_number,
        format=format,
        title=title,
        description=description,
        acceptance_criteria=acceptance_criteria or ["Given...", "When...", "Then..."],
        order=order,
        labels=labels or ["test"],
        size=size,
        status=status,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return story


def _get_story_id(story: UserStory) -> str:
    """Get story ID as string for type safety."""
    return cast(str, story.id)


# =============================================================================
# Test: Project Access Enforcement for Stories (US-034)
# =============================================================================


def test_get_story_returns_404_when_project_deleted(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /stories/{story_id} returns 404 when the story's project has been deleted.
    
    This verifies project access is enforced even when accessing a story by its ID.
    """
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    story = _create_test_story(test_db, project_id)
    story_id = _get_story_id(story)
    
    # Delete the project (this should make the story inaccessible)
    test_db.delete(project)
    test_db.commit()
    
    # Now try to access the story - should get 404 because project access check fails
    response = test_client.get(f"/api/stories/{story_id}")
    
    assert response.status_code == 404
    assert "Story not found" in response.json()["detail"]


def test_update_story_returns_404_when_project_deleted(test_client: TestClient, test_db: Session) -> None:
    """Test that PUT /stories/{story_id} returns 404 when the story's project has been deleted."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    story = _create_test_story(test_db, project_id)
    story_id = _get_story_id(story)
    
    # Delete the project
    test_db.delete(project)
    test_db.commit()
    
    # Try to update the story
    response = test_client.put(
        f"/api/stories/{story_id}",
        json={"title": "New Title"}
    )
    
    assert response.status_code == 404


def test_delete_story_returns_404_when_project_deleted(test_client: TestClient, test_db: Session) -> None:
    """Test that DELETE /stories/{story_id} returns 404 when the story's project has been deleted."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    story = _create_test_story(test_db, project_id)
    story_id = _get_story_id(story)
    
    # Delete the project
    test_db.delete(project)
    test_db.commit()
    
    # Try to delete the story
    response = test_client.delete(f"/api/stories/{story_id}")
    
    assert response.status_code == 404


def test_batch_status_returns_404_when_project_deleted(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /stories/batches/{batch_id}/status returns 404 when project is deleted."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.GENERATING)
    batch_id = _get_batch_id(batch)
    
    # Delete the project
    test_db.delete(project)
    test_db.commit()
    
    # Try to get batch status
    response = test_client.get(f"/api/stories/batches/{batch_id}/status")
    
    assert response.status_code == 404


def test_cancel_batch_returns_404_when_project_deleted(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /stories/batches/{batch_id}/cancel returns 404 when project is deleted."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.GENERATING)
    batch_id = _get_batch_id(batch)
    
    # Delete the project
    test_db.delete(project)
    test_db.commit()
    
    # Try to cancel batch
    response = test_client.post(f"/api/stories/batches/{batch_id}/cancel")
    
    assert response.status_code == 404


def test_story_accessible_when_project_exists(test_client: TestClient, test_db: Session) -> None:
    """Test that story is accessible when its project exists (positive case)."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    story = _create_test_story(test_db, project_id, title="Accessible Story")
    story_id = _get_story_id(story)
    
    # Story should be accessible
    response = test_client.get(f"/api/stories/{story_id}")
    
    assert response.status_code == 200
    assert response.json()["title"] == "Accessible Story"


def test_batch_accessible_when_project_exists(test_client: TestClient, test_db: Session) -> None:
    """Test that batch is accessible when its project exists (positive case)."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.READY)
    batch_id = _get_batch_id(batch)
    
    # Batch status should be accessible
    response = test_client.get(f"/api/stories/batches/{batch_id}/status")
    
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


# =============================================================================
# Test: Story Generation Endpoints (US-036)
# =============================================================================


def test_generate_returns_queued_status(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /projects/{project_id}/stories/generate returns batch with status=queued."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    # Create a requirement so generation can proceed
    _create_test_requirement(test_db, project_id)
    
    response = test_client.post(
        f"/api/projects/{project_id}/stories/generate",
        json={"format": "classic"}
    )
    
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "queued"
    assert "id" in data
    assert data["story_count"] == 0
    assert data["error_message"] is None


def test_generate_returns_404_for_missing_project(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /generate returns 404 for non-existent project."""
    response = test_client.post(
        "/api/projects/00000000-0000-0000-0000-000000000000/stories/generate",
        json={"format": "classic"}
    )
    
    assert response.status_code == 404
    assert "Project not found" in response.json()["detail"]


def test_generate_validates_format(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /generate validates the format field."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    response = test_client.post(
        f"/api/projects/{project_id}/stories/generate",
        json={"format": "invalid_format"}
    )
    
    assert response.status_code == 422


def test_generate_with_section_filter(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /generate accepts section_filter parameter."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id, section=Section.functional_requirements)
    
    response = test_client.post(
        f"/api/projects/{project_id}/stories/generate",
        json={"format": "classic", "section_filter": ["functional"]}
    )
    
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "queued"


def test_generate_with_job_story_format(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /generate accepts job_story format."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)
    
    response = test_client.post(
        f"/api/projects/{project_id}/stories/generate",
        json={"format": "job_story"}
    )
    
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "queued"


# =============================================================================
# Test: Batch Status Polling (US-036)
# =============================================================================


def test_batch_status_polling_returns_queued(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /batches/{batch_id}/status returns correct queued status."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.QUEUED)
    batch_id = _get_batch_id(batch)
    
    response = test_client.get(f"/api/stories/batches/{batch_id}/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "queued"
    assert data["id"] == batch_id


def test_batch_status_polling_returns_generating(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /batches/{batch_id}/status returns correct generating status."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.GENERATING)
    batch_id = _get_batch_id(batch)
    
    response = test_client.get(f"/api/stories/batches/{batch_id}/status")
    
    assert response.status_code == 200
    assert response.json()["status"] == "generating"


def test_batch_status_polling_returns_ready_with_story_count(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /batches/{batch_id}/status returns ready status with story count."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.READY, story_count=5)
    batch_id = _get_batch_id(batch)
    
    response = test_client.get(f"/api/stories/batches/{batch_id}/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["story_count"] == 5


def test_batch_status_polling_returns_failed_with_error(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /batches/{batch_id}/status returns failed status with error message."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.FAILED)
    batch.error_message = "LLM timeout"
    test_db.commit()
    batch_id = _get_batch_id(batch)
    
    response = test_client.get(f"/api/stories/batches/{batch_id}/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert data["error_message"] == "LLM timeout"


def test_batch_status_returns_404_for_missing_batch(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /batches/{batch_id}/status returns 404 for non-existent batch."""
    response = test_client.get("/api/stories/batches/00000000-0000-0000-0000-000000000000/status")
    
    assert response.status_code == 404


# =============================================================================
# Test: Cancel Batch Generation (US-036)
# =============================================================================


def test_cancel_batch_from_queued(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /batches/{batch_id}/cancel sets status=cancelled from queued."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.QUEUED)
    batch_id = _get_batch_id(batch)
    
    response = test_client.post(f"/api/stories/batches/{batch_id}/cancel")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"


def test_cancel_batch_from_generating(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /batches/{batch_id}/cancel sets status=cancelled from generating."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.GENERATING)
    batch_id = _get_batch_id(batch)
    
    response = test_client.post(f"/api/stories/batches/{batch_id}/cancel")
    
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


def test_cancel_batch_fails_for_ready(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /batches/{batch_id}/cancel fails for already-ready batch."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.READY)
    batch_id = _get_batch_id(batch)
    
    response = test_client.post(f"/api/stories/batches/{batch_id}/cancel")
    
    assert response.status_code == 400
    assert "Cannot cancel" in response.json()["detail"]


def test_cancel_batch_fails_for_cancelled(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /batches/{batch_id}/cancel fails for already-cancelled batch."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.CANCELLED)
    batch_id = _get_batch_id(batch)
    
    response = test_client.post(f"/api/stories/batches/{batch_id}/cancel")
    
    assert response.status_code == 400
    assert "Cannot cancel" in response.json()["detail"]


def test_cancel_batch_fails_for_failed(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /batches/{batch_id}/cancel fails for already-failed batch."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.FAILED)
    batch_id = _get_batch_id(batch)
    
    response = test_client.post(f"/api/stories/batches/{batch_id}/cancel")
    
    assert response.status_code == 400
    assert "Cannot cancel" in response.json()["detail"]


# =============================================================================
# Test: List Stories with Pagination (US-036)
# =============================================================================


def test_list_stories_pagination_default(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /projects/{project_id}/stories returns paginated results."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    # Create 5 stories
    for i in range(5):
        _create_test_story(test_db, project_id, story_number=i+1, title=f"Story {i+1}")
    
    response = test_client.get(f"/api/projects/{project_id}/stories")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 5
    assert len(data["items"]) == 5
    assert data["skip"] == 0
    assert data["limit"] == 20  # default limit


def test_list_stories_pagination_skip(test_client: TestClient, test_db: Session) -> None:
    """Test that skip parameter works correctly."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    # Create 10 stories
    for i in range(10):
        _create_test_story(test_db, project_id, story_number=i+1, title=f"Story {i+1}")
    
    response = test_client.get(f"/api/projects/{project_id}/stories?skip=5")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 10
    assert len(data["items"]) == 5
    assert data["skip"] == 5


def test_list_stories_pagination_limit(test_client: TestClient, test_db: Session) -> None:
    """Test that limit parameter works correctly."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    # Create 10 stories
    for i in range(10):
        _create_test_story(test_db, project_id, story_number=i+1, title=f"Story {i+1}")
    
    response = test_client.get(f"/api/projects/{project_id}/stories?limit=3")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 10
    assert len(data["items"]) == 3
    assert data["limit"] == 3


def test_list_stories_pagination_skip_and_limit(test_client: TestClient, test_db: Session) -> None:
    """Test that skip and limit work together correctly."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    # Create 10 stories
    for i in range(10):
        _create_test_story(test_db, project_id, story_number=i+1, title=f"Story {i+1}", order=i)
    
    response = test_client.get(f"/api/projects/{project_id}/stories?skip=2&limit=3")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 10
    assert len(data["items"]) == 3
    assert data["skip"] == 2
    assert data["limit"] == 3
    # Check we got the right stories (ordered by order, then story_number)
    assert data["items"][0]["title"] == "Story 3"
    assert data["items"][1]["title"] == "Story 4"
    assert data["items"][2]["title"] == "Story 5"


# =============================================================================
# Test: List Stories with Filters (US-036)
# =============================================================================


def test_list_stories_filter_by_batch_id(test_client: TestClient, test_db: Session) -> None:
    """Test that batch_id filter works correctly."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch1 = _create_test_batch(test_db, project_id)
    batch2 = _create_test_batch(test_db, project_id)
    batch1_id = _get_batch_id(batch1)
    batch2_id = _get_batch_id(batch2)
    
    # Create stories in different batches
    _create_test_story(test_db, project_id, batch_id=batch1_id, story_number=1, title="Batch1 Story 1")
    _create_test_story(test_db, project_id, batch_id=batch1_id, story_number=2, title="Batch1 Story 2")
    _create_test_story(test_db, project_id, batch_id=batch2_id, story_number=3, title="Batch2 Story 1")
    
    response = test_client.get(f"/api/projects/{project_id}/stories?batch_id={batch1_id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    assert all("Batch1" in item["title"] for item in data["items"])


def test_list_stories_filter_by_status(test_client: TestClient, test_db: Session) -> None:
    """Test that status filter works correctly."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    _create_test_story(test_db, project_id, story_number=1, title="Draft Story", status=StoryStatus.DRAFT)
    _create_test_story(test_db, project_id, story_number=2, title="Ready Story", status=StoryStatus.READY)
    _create_test_story(test_db, project_id, story_number=3, title="Another Draft", status=StoryStatus.DRAFT)
    
    response = test_client.get(f"/api/projects/{project_id}/stories?status=ready")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Ready Story"
    assert data["items"][0]["status"] == "ready"


def test_list_stories_filter_by_labels(test_client: TestClient, test_db: Session) -> None:
    """Test that labels filter works correctly."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    _create_test_story(test_db, project_id, story_number=1, title="Bug Story", labels=["bug", "urgent"])
    _create_test_story(test_db, project_id, story_number=2, title="Feature Story", labels=["feature"])
    _create_test_story(test_db, project_id, story_number=3, title="Urgent Feature", labels=["feature", "urgent"])
    
    response = test_client.get(f"/api/projects/{project_id}/stories?labels=urgent")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    titles = [item["title"] for item in data["items"]]
    assert "Bug Story" in titles
    assert "Urgent Feature" in titles


def test_list_stories_filter_by_multiple_labels(test_client: TestClient, test_db: Session) -> None:
    """Test that multiple labels filter requires ALL labels to match."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    _create_test_story(test_db, project_id, story_number=1, title="Bug Story", labels=["bug", "urgent"])
    _create_test_story(test_db, project_id, story_number=2, title="Feature Story", labels=["feature"])
    _create_test_story(test_db, project_id, story_number=3, title="Urgent Feature", labels=["feature", "urgent"])
    
    response = test_client.get(f"/api/projects/{project_id}/stories?labels=feature,urgent")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Urgent Feature"


def test_list_stories_combined_filters(test_client: TestClient, test_db: Session) -> None:
    """Test that multiple filters work together correctly."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id)
    batch_id = _get_batch_id(batch)
    
    _create_test_story(test_db, project_id, batch_id=batch_id, story_number=1, 
                      title="S1", status=StoryStatus.DRAFT, labels=["bug"])
    _create_test_story(test_db, project_id, batch_id=batch_id, story_number=2, 
                      title="S2", status=StoryStatus.READY, labels=["bug"])
    _create_test_story(test_db, project_id, batch_id=None, story_number=3, 
                      title="S3", status=StoryStatus.READY, labels=["bug"])
    
    response = test_client.get(
        f"/api/projects/{project_id}/stories?batch_id={batch_id}&status=ready&labels=bug"
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "S2"


# =============================================================================
# Test: Labels Filter Exact Matching (US-039)
# =============================================================================


def test_labels_filter_does_not_match_partial_prefix(test_client: TestClient, test_db: Session) -> None:
    """Test that filtering by 'frontend' does NOT match 'not-frontend'.
    
    US-039: Labels filter must use exact array element matching, not partial string matching.
    """
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    # Story with label 'not-frontend' should NOT be matched by filter 'frontend'
    _create_test_story(test_db, project_id, story_number=1, title="Wrong Match", labels=["not-frontend", "backend"])
    # Story with exact label 'frontend' SHOULD be matched
    _create_test_story(test_db, project_id, story_number=2, title="Correct Match", labels=["frontend", "api"])
    
    response = test_client.get(f"/api/projects/{project_id}/stories?labels=frontend")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Correct Match"


def test_labels_filter_does_not_match_partial_suffix(test_client: TestClient, test_db: Session) -> None:
    """Test that filtering by 'api' does NOT match 'api-v2' or 'legacy-api'.
    
    US-039: Labels filter must match exact label values, not substrings.
    """
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    # Stories with partial matches should NOT be returned
    _create_test_story(test_db, project_id, story_number=1, title="API v2 Story", labels=["api-v2"])
    _create_test_story(test_db, project_id, story_number=2, title="Legacy Story", labels=["legacy-api"])
    # Story with exact label 'api' SHOULD be matched
    _create_test_story(test_db, project_id, story_number=3, title="API Story", labels=["api", "backend"])
    
    response = test_client.get(f"/api/projects/{project_id}/stories?labels=api")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "API Story"


def test_labels_filter_matches_single_element_array(test_client: TestClient, test_db: Session) -> None:
    """Test that labels filter matches a single-element array correctly.
    
    US-039: Verifies the pattern '["label"]' is matched.
    """
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    _create_test_story(test_db, project_id, story_number=1, title="Solo Label", labels=["frontend"])
    
    response = test_client.get(f"/api/projects/{project_id}/stories?labels=frontend")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Solo Label"


def test_labels_filter_matches_first_element_in_array(test_client: TestClient, test_db: Session) -> None:
    """Test that labels filter matches first element in multi-element array.
    
    US-039: Verifies the pattern '["label",' is matched.
    """
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    _create_test_story(test_db, project_id, story_number=1, title="First Position", labels=["frontend", "api", "ui"])
    
    response = test_client.get(f"/api/projects/{project_id}/stories?labels=frontend")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "First Position"


def test_labels_filter_matches_middle_element_in_array(test_client: TestClient, test_db: Session) -> None:
    """Test that labels filter matches middle element in multi-element array.
    
    US-039: Verifies the pattern ',"label",' is matched.
    """
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    _create_test_story(test_db, project_id, story_number=1, title="Middle Position", labels=["backend", "frontend", "ui"])
    
    response = test_client.get(f"/api/projects/{project_id}/stories?labels=frontend")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Middle Position"


def test_labels_filter_matches_last_element_in_array(test_client: TestClient, test_db: Session) -> None:
    """Test that labels filter matches last element in multi-element array.
    
    US-039: Verifies the pattern ',"label"]' is matched.
    """
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    _create_test_story(test_db, project_id, story_number=1, title="Last Position", labels=["backend", "api", "frontend"])
    
    response = test_client.get(f"/api/projects/{project_id}/stories?labels=frontend")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Last Position"


def test_labels_filter_with_multiple_labels_all_exact(test_client: TestClient, test_db: Session) -> None:
    """Test that filtering by multiple labels requires ALL to match exactly.
    
    US-039: Combined with existing multi-label behavior, ensures exact matching for each.
    """
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    # This story should NOT match because it has 'not-frontend' not 'frontend'
    _create_test_story(test_db, project_id, story_number=1, title="Wrong Match", labels=["not-frontend", "api"])
    # This story SHOULD match - has both exact labels
    _create_test_story(test_db, project_id, story_number=2, title="Correct Match", labels=["frontend", "api"])
    
    response = test_client.get(f"/api/projects/{project_id}/stories?labels=frontend,api")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Correct Match"


def test_labels_filter_no_match_for_similar_labels(test_client: TestClient, test_db: Session) -> None:
    """Test that no stories are returned when only partial matches exist.
    
    US-039: Ensures substring matching doesn't produce false positives.
    """
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    # Create stories with similar but not exact labels
    _create_test_story(test_db, project_id, story_number=1, title="Story 1", labels=["frontend-v2"])
    _create_test_story(test_db, project_id, story_number=2, title="Story 2", labels=["my-frontend"])
    _create_test_story(test_db, project_id, story_number=3, title="Story 3", labels=["frontend-legacy"])
    
    response = test_client.get(f"/api/projects/{project_id}/stories?labels=frontend")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0


# =============================================================================
# Test: Soft Delete Story (US-036)
# =============================================================================


def test_soft_delete_story_sets_deleted_at(test_client: TestClient, test_db: Session) -> None:
    """Test that DELETE /stories/{story_id} sets deleted_at timestamp."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    story = _create_test_story(test_db, project_id)
    story_id = _get_story_id(story)
    
    response = test_client.delete(f"/api/stories/{story_id}")
    
    assert response.status_code == 204
    
    # Verify deleted_at is set in database
    test_db.refresh(story)
    assert story.deleted_at is not None


def test_soft_deleted_story_excluded_from_list(test_client: TestClient, test_db: Session) -> None:
    """Test that soft-deleted stories don't appear in list results."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    story1 = _create_test_story(test_db, project_id, story_number=1, title="Story 1")
    story2 = _create_test_story(test_db, project_id, story_number=2, title="Story 2")
    story1_id = _get_story_id(story1)
    
    # Delete story1
    test_client.delete(f"/api/stories/{story1_id}")
    
    # List should only show story2
    response = test_client.get(f"/api/projects/{project_id}/stories")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Story 2"


def test_soft_deleted_story_not_accessible_by_id(test_client: TestClient, test_db: Session) -> None:
    """Test that soft-deleted stories return 404 when accessed by ID."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    story = _create_test_story(test_db, project_id)
    story_id = _get_story_id(story)
    
    # Delete the story
    test_client.delete(f"/api/stories/{story_id}")
    
    # Try to access the deleted story
    response = test_client.get(f"/api/stories/{story_id}")
    
    assert response.status_code == 404


# =============================================================================
# Test: Delete Batch (US-036)
# =============================================================================


def test_delete_batch_deletes_all_stories_in_batch(test_client: TestClient, test_db: Session) -> None:
    """Test that DELETE /projects/{project_id}/stories/batch/{batch_id} deletes all stories in batch."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id)
    batch_id = _get_batch_id(batch)
    
    # Create stories in the batch
    story1 = _create_test_story(test_db, project_id, batch_id=batch_id, story_number=1)
    story1_id = cast(str, story1.id)
    story2 = _create_test_story(test_db, project_id, batch_id=batch_id, story_number=2)
    story2_id = cast(str, story2.id)
    # Create a story not in the batch
    story3 = _create_test_story(test_db, project_id, batch_id=None, story_number=3, title="Unbatched")
    story3_id = cast(str, story3.id)
    
    response = test_client.delete(f"/api/projects/{project_id}/stories/batch/{batch_id}")
    
    assert response.status_code == 204
    
    # Expire session cache to get fresh data from database
    test_db.expire_all()
    
    # Re-query stories to verify soft-deletion
    story1_after = test_db.query(UserStory).filter(UserStory.id == story1_id).first()
    story2_after = test_db.query(UserStory).filter(UserStory.id == story2_id).first()
    story3_after = test_db.query(UserStory).filter(UserStory.id == story3_id).first()
    
    assert story1_after is not None and story1_after.deleted_at is not None
    assert story2_after is not None and story2_after.deleted_at is not None
    assert story3_after is not None and story3_after.deleted_at is None  # unbatched story should not be deleted
    
    # Verify only unbatched story appears in list
    list_response = test_client.get(f"/api/projects/{project_id}/stories")
    assert list_response.json()["total"] == 1
    assert list_response.json()["items"][0]["title"] == "Unbatched"


def test_delete_batch_also_deletes_batch_record(test_client: TestClient, test_db: Session) -> None:
    """Test that DELETE /batch/{batch_id} also removes the batch record."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id)
    batch_id = _get_batch_id(batch)
    _create_test_story(test_db, project_id, batch_id=batch_id, story_number=1)
    
    test_client.delete(f"/api/projects/{project_id}/stories/batch/{batch_id}")
    
    # Verify batch is deleted from database
    remaining_batch = test_db.query(StoryBatch).filter(StoryBatch.id == batch_id).first()
    assert remaining_batch is None
    
    # Verify batch doesn't appear in list
    batches_response = test_client.get(f"/api/projects/{project_id}/stories/batches")
    assert len(batches_response.json()) == 0


def test_delete_batch_returns_404_for_wrong_project(test_client: TestClient, test_db: Session) -> None:
    """Test that DELETE /batch returns 404 if batch doesn't belong to project."""
    project1 = _create_test_project(test_db, name="Project 1")
    project2 = _create_test_project(test_db, name="Project 2")
    project1_id = _get_project_id(project1)
    project2_id = _get_project_id(project2)
    
    batch = _create_test_batch(test_db, project1_id)
    batch_id = _get_batch_id(batch)
    
    # Try to delete batch using wrong project ID
    response = test_client.delete(f"/api/projects/{project2_id}/stories/batch/{batch_id}")
    
    assert response.status_code == 404


# =============================================================================
# Test: Reorder Stories (US-036)
# =============================================================================


def test_reorder_stories_updates_order(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /projects/{project_id}/stories/reorder updates story order."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    story1 = _create_test_story(test_db, project_id, story_number=1, title="Story 1", order=0)
    story2 = _create_test_story(test_db, project_id, story_number=2, title="Story 2", order=1)
    story3 = _create_test_story(test_db, project_id, story_number=3, title="Story 3", order=2)
    
    story1_id = _get_story_id(story1)
    story2_id = _get_story_id(story2)
    story3_id = _get_story_id(story3)
    
    # Reorder: 3, 1, 2
    response = test_client.post(
        f"/api/projects/{project_id}/stories/reorder",
        json={"story_ids": [story3_id, story1_id, story2_id]}
    )
    
    assert response.status_code == 200
    assert response.json()["count"] == 3
    
    # Verify orders are updated
    test_db.refresh(story1)
    test_db.refresh(story2)
    test_db.refresh(story3)
    assert story3.order == 0
    assert story1.order == 1
    assert story2.order == 2


def test_reorder_stories_respects_new_order_in_list(test_client: TestClient, test_db: Session) -> None:
    """Test that reordered stories appear in correct order in list."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    story1 = _create_test_story(test_db, project_id, story_number=1, title="First", order=0)
    story2 = _create_test_story(test_db, project_id, story_number=2, title="Second", order=1)
    story3 = _create_test_story(test_db, project_id, story_number=3, title="Third", order=2)
    
    story1_id = _get_story_id(story1)
    story2_id = _get_story_id(story2)
    story3_id = _get_story_id(story3)
    
    # Reorder: Third, First, Second
    test_client.post(
        f"/api/projects/{project_id}/stories/reorder",
        json={"story_ids": [story3_id, story1_id, story2_id]}
    )
    
    # List should respect new order
    response = test_client.get(f"/api/projects/{project_id}/stories")
    data = response.json()
    
    assert data["items"][0]["title"] == "Third"
    assert data["items"][1]["title"] == "First"
    assert data["items"][2]["title"] == "Second"


def test_reorder_stories_fails_for_invalid_story_id(test_client: TestClient, test_db: Session) -> None:
    """Test that reorder fails if a story ID is invalid."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    story1 = _create_test_story(test_db, project_id, story_number=1)
    story1_id = _get_story_id(story1)
    
    response = test_client.post(
        f"/api/projects/{project_id}/stories/reorder",
        json={"story_ids": [story1_id, "00000000-0000-0000-0000-000000000000"]}
    )
    
    assert response.status_code == 400
    assert "not found" in response.json()["detail"]


def test_reorder_stories_fails_for_story_from_different_project(test_client: TestClient, test_db: Session) -> None:
    """Test that reorder fails if story belongs to different project."""
    project1 = _create_test_project(test_db, name="Project 1")
    project2 = _create_test_project(test_db, name="Project 2")
    project1_id = _get_project_id(project1)
    project2_id = _get_project_id(project2)
    
    story1 = _create_test_story(test_db, project1_id, story_number=1)
    story2 = _create_test_story(test_db, project2_id, story_number=1)
    story1_id = _get_story_id(story1)
    story2_id = _get_story_id(story2)
    
    # Try to reorder with story from different project
    response = test_client.post(
        f"/api/projects/{project1_id}/stories/reorder",
        json={"story_ids": [story1_id, story2_id]}
    )
    
    assert response.status_code == 400


# =============================================================================
# Test: Export CSV (US-036)
# =============================================================================


def test_export_csv_has_correct_columns(test_client: TestClient, test_db: Session) -> None:
    """Test that CSV export has correct column headers."""
    project = _create_test_project(test_db, name="Export Test")
    project_id = _get_project_id(project)
    _create_test_story(test_db, project_id, story_number=1, title="Test Story")
    
    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=csv")
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    
    # Parse CSV content
    content = response.content.decode("utf-8")
    reader = csv.reader(io.StringIO(content))
    headers = next(reader)
    
    expected_headers = [
        "Story ID", "Title", "Description", "Acceptance Criteria",
        "Size", "Labels", "Status", "Format"
    ]
    assert headers == expected_headers


def test_export_csv_pipe_separated_acceptance_criteria(test_client: TestClient, test_db: Session) -> None:
    """Test that CSV export uses pipe-separated acceptance criteria."""
    project = _create_test_project(test_db, name="Export Test")
    project_id = _get_project_id(project)
    _create_test_story(
        test_db, project_id, story_number=1, title="Test Story",
        acceptance_criteria=["Given condition", "When action", "Then result"]
    )
    
    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=csv")
    
    content = response.content.decode("utf-8")
    reader = csv.reader(io.StringIO(content))
    next(reader)  # Skip headers
    row = next(reader)
    
    # Column 3 is Acceptance Criteria (0-indexed)
    ac_column = row[3]
    assert "Given condition | When action | Then result" == ac_column


def test_export_csv_content_disposition(test_client: TestClient, test_db: Session) -> None:
    """Test that CSV export has correct Content-Disposition header."""
    project = _create_test_project(test_db, name="My Test Project")
    project_id = _get_project_id(project)
    _create_test_story(test_db, project_id, story_number=1)
    
    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=csv")
    
    assert response.status_code == 200
    content_disposition = response.headers.get("content-disposition", "")
    assert "attachment" in content_disposition
    assert "my-test-project-stories.csv" in content_disposition


def test_export_csv_with_batch_filter(test_client: TestClient, test_db: Session) -> None:
    """Test that CSV export respects batch_id filter."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch1 = _create_test_batch(test_db, project_id)
    batch2 = _create_test_batch(test_db, project_id)
    batch1_id = _get_batch_id(batch1)
    
    _create_test_story(test_db, project_id, batch_id=batch1_id, story_number=1, title="Batch1 Story")
    _create_test_story(test_db, project_id, batch_id=_get_batch_id(batch2), story_number=2, title="Batch2 Story")
    
    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=csv&batch_id={batch1_id}")
    
    content = response.content.decode("utf-8")
    reader = csv.reader(io.StringIO(content))
    next(reader)  # Skip headers
    rows = list(reader)
    
    assert len(rows) == 1
    assert rows[0][1] == "Batch1 Story"  # Title column


# =============================================================================
# Test: Export JSON (US-036)
# =============================================================================


def test_export_json_matches_schema(test_client: TestClient, test_db: Session) -> None:
    """Test that JSON export matches the documented schema."""
    project = _create_test_project(test_db, name="Export Test")
    project_id = _get_project_id(project)
    _create_test_story(
        test_db, project_id, story_number=1, title="Test Story",
        description="A description",
        acceptance_criteria=["AC 1", "AC 2"],
        size=StorySize.L,
        labels=["bug", "urgent"],
        status=StoryStatus.READY,
        format=StoryFormat.CLASSIC
    )
    
    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=json")
    
    assert response.status_code == 200
    assert "application/json" in response.headers["content-type"]
    
    data = response.json()
    assert "stories" in data
    assert len(data["stories"]) == 1
    
    story = data["stories"][0]
    # Verify all expected fields are present
    assert story["story_id"] == "US-001"
    assert story["story_number"] == 1
    assert story["title"] == "Test Story"
    assert story["description"] == "A description"
    assert story["acceptance_criteria"] == ["AC 1", "AC 2"]
    assert story["size"] == "l"
    assert story["labels"] == ["bug", "urgent"]
    assert story["status"] == "ready"
    assert story["format"] == "classic"
    assert "created_at" in story
    assert "updated_at" in story


def test_export_json_multiple_stories(test_client: TestClient, test_db: Session) -> None:
    """Test that JSON export includes all stories in correct order."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    _create_test_story(test_db, project_id, story_number=1, title="Story 1", order=0)
    _create_test_story(test_db, project_id, story_number=2, title="Story 2", order=1)
    _create_test_story(test_db, project_id, story_number=3, title="Story 3", order=2)
    
    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=json")
    
    data = response.json()
    assert len(data["stories"]) == 3
    assert data["stories"][0]["title"] == "Story 1"
    assert data["stories"][1]["title"] == "Story 2"
    assert data["stories"][2]["title"] == "Story 3"


def test_export_json_content_disposition(test_client: TestClient, test_db: Session) -> None:
    """Test that JSON export has correct Content-Disposition header."""
    project = _create_test_project(test_db, name="My Project")
    project_id = _get_project_id(project)
    _create_test_story(test_db, project_id, story_number=1)
    
    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=json")
    
    content_disposition = response.headers.get("content-disposition", "")
    assert "attachment" in content_disposition
    assert "my-project-stories.json" in content_disposition


# =============================================================================
# Test: Export Markdown (US-036)
# =============================================================================


def test_export_markdown_format(test_client: TestClient, test_db: Session) -> None:
    """Test that Markdown export has correct format."""
    project = _create_test_project(test_db, name="Export Test")
    project_id = _get_project_id(project)
    _create_test_story(
        test_db, project_id, story_number=1, title="Test Story",
        description="Story description",
        acceptance_criteria=["AC 1", "AC 2"],
        size=StorySize.M,
        labels=["feature"]
    )
    
    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=markdown")
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/markdown; charset=utf-8"
    
    content = response.content.decode("utf-8")
    assert "# User Stories" in content
    assert "## US-001: Test Story" in content
    assert "Story description" in content
    assert "### Acceptance Criteria" in content
    assert "- [ ] AC 1" in content
    assert "- [ ] AC 2" in content
    assert "**Size:** M" in content
    assert "**Labels:** feature" in content


def test_export_default_format_is_markdown(test_client: TestClient, test_db: Session) -> None:
    """Test that default export format is Markdown."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_story(test_db, project_id, story_number=1)
    
    response = test_client.get(f"/api/projects/{project_id}/stories/export")
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/markdown; charset=utf-8"


def test_export_returns_404_when_no_stories(test_client: TestClient, test_db: Session) -> None:
    """Test that export returns 404 when there are no stories."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    response = test_client.get(f"/api/projects/{project_id}/stories/export")
    
    assert response.status_code == 404
    assert "No stories found" in response.json()["detail"]


# =============================================================================
# Test: Story Update (US-036)
# =============================================================================


def test_update_story_title(test_client: TestClient, test_db: Session) -> None:
    """Test that PUT /stories/{story_id} updates story title."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    story = _create_test_story(test_db, project_id, title="Original Title")
    story_id = _get_story_id(story)
    
    response = test_client.put(
        f"/api/stories/{story_id}",
        json={"title": "Updated Title"}
    )
    
    assert response.status_code == 200
    assert response.json()["title"] == "Updated Title"


def test_update_story_all_fields(test_client: TestClient, test_db: Session) -> None:
    """Test that PUT /stories/{story_id} can update all fields."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    story = _create_test_story(test_db, project_id)
    story_id = _get_story_id(story)
    
    update_data = {
        "title": "New Title",
        "description": "New description",
        "acceptance_criteria": ["New AC 1", "New AC 2"],
        "labels": ["new-label", "another"],
        "size": "xl",
        "status": "ready"
    }
    
    response = test_client.put(f"/api/stories/{story_id}", json=update_data)
    
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "New Title"
    assert data["description"] == "New description"
    assert data["acceptance_criteria"] == ["New AC 1", "New AC 2"]
    assert data["labels"] == ["new-label", "another"]
    assert data["size"] == "xl"
    assert data["status"] == "ready"


def test_update_story_partial(test_client: TestClient, test_db: Session) -> None:
    """Test that partial updates only change provided fields."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    story = _create_test_story(
        test_db, project_id, 
        title="Original Title",
        description="Original description"
    )
    story_id = _get_story_id(story)
    
    # Only update description
    response = test_client.put(
        f"/api/stories/{story_id}",
        json={"description": "Updated description"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Original Title"  # unchanged
    assert data["description"] == "Updated description"


# =============================================================================
# Test: List Batches (US-036)
# =============================================================================


def test_list_batches_returns_all_batches(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /projects/{project_id}/stories/batches lists all batches."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    _create_test_batch(test_db, project_id, format=StoryFormat.CLASSIC, story_count=5)
    _create_test_batch(test_db, project_id, format=StoryFormat.JOB_STORY, story_count=3)
    
    response = test_client.get(f"/api/projects/{project_id}/stories/batches")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_list_batches_sorted_by_date(test_client: TestClient, test_db: Session) -> None:
    """Test that batches are sorted by creation date descending."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    
    # Create batches (they'll have slightly different timestamps)
    batch1 = _create_test_batch(test_db, project_id)
    batch2 = _create_test_batch(test_db, project_id)
    batch3 = _create_test_batch(test_db, project_id)
    
    response = test_client.get(f"/api/projects/{project_id}/stories/batches")
    
    data = response.json()
    # Newest first
    assert data[0]["id"] == _get_batch_id(batch3)
    assert data[1]["id"] == _get_batch_id(batch2)
    assert data[2]["id"] == _get_batch_id(batch1)


def test_list_batches_isolated_between_projects(test_client: TestClient, test_db: Session) -> None:
    """Test that batches from other projects are not included."""
    project1 = _create_test_project(test_db, name="Project 1")
    project2 = _create_test_project(test_db, name="Project 2")
    project1_id = _get_project_id(project1)
    project2_id = _get_project_id(project2)
    
    _create_test_batch(test_db, project1_id)
    _create_test_batch(test_db, project1_id)
    _create_test_batch(test_db, project2_id)
    
    response = test_client.get(f"/api/projects/{project1_id}/stories/batches")
    
    assert len(response.json()) == 2
    
    response2 = test_client.get(f"/api/projects/{project2_id}/stories/batches")
    assert len(response2.json()) == 1


# =============================================================================
# Test: Stories Isolated Between Projects (US-036)
# =============================================================================


def test_stories_isolated_between_projects(test_client: TestClient, test_db: Session) -> None:
    """Test that stories from other projects are not included in list."""
    project1 = _create_test_project(test_db, name="Project 1")
    project2 = _create_test_project(test_db, name="Project 2")
    project1_id = _get_project_id(project1)
    project2_id = _get_project_id(project2)
    
    _create_test_story(test_db, project1_id, story_number=1, title="P1 Story 1")
    _create_test_story(test_db, project1_id, story_number=2, title="P1 Story 2")
    _create_test_story(test_db, project2_id, story_number=1, title="P2 Story 1")
    
    response1 = test_client.get(f"/api/projects/{project1_id}/stories")
    response2 = test_client.get(f"/api/projects/{project2_id}/stories")
    
    assert response1.json()["total"] == 2
    assert response2.json()["total"] == 1
    assert all("P1" in item["title"] for item in response1.json()["items"])
    assert response2.json()["items"][0]["title"] == "P2 Story 1"


# =============================================================================
# Test: Error Handling Edge Cases (US-037)
# =============================================================================


def test_failed_batch_includes_error_message_in_status(test_client: TestClient, test_db: Session) -> None:
    """Test that failed batch status includes helpful error message."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.FAILED)
    batch.error_message = "Project has no requirements to generate stories from"
    test_db.commit()
    batch_id = _get_batch_id(batch)
    
    response = test_client.get(f"/api/stories/batches/{batch_id}/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert "no requirements" in data["error_message"].lower()


def test_failed_batch_with_timeout_includes_specific_message(test_client: TestClient, test_db: Session) -> None:
    """Test that timeout errors include specific timeout message."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.FAILED)
    batch.error_message = "LLM error: Ollama request timed out"
    test_db.commit()
    batch_id = _get_batch_id(batch)
    
    response = test_client.get(f"/api/stories/batches/{batch_id}/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert "timed out" in data["error_message"].lower()


def test_failed_batch_with_parsing_error_includes_details(test_client: TestClient, test_db: Session) -> None:
    """Test that malformed LLM response includes parsing error details."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.FAILED)
    batch.error_message = "Failed to parse LLM response: Invalid JSON response from LLM"
    test_db.commit()
    batch_id = _get_batch_id(batch)
    
    response = test_client.get(f"/api/stories/batches/{batch_id}/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert "parse" in data["error_message"].lower() or "invalid json" in data["error_message"].lower()


def test_cancel_returns_400_not_500_for_completed_batch(test_client: TestClient, test_db: Session) -> None:
    """Test that cancelling completed batch returns user-friendly 400, not 500."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch = _create_test_batch(test_db, project_id, status=StoryBatchStatus.READY)
    batch_id = _get_batch_id(batch)
    
    response = test_client.post(f"/api/stories/batches/{batch_id}/cancel")
    
    # Should return 400 Bad Request, not 500 Internal Server Error
    assert response.status_code == 400
    assert "Cannot cancel" in response.json()["detail"]


def test_update_non_existent_story_returns_404(test_client: TestClient, test_db: Session) -> None:
    """Test that updating non-existent story returns 404."""
    response = test_client.put(
        "/api/stories/00000000-0000-0000-0000-000000000000",
        json={"title": "New Title"}
    )
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_delete_non_existent_story_returns_404(test_client: TestClient, test_db: Session) -> None:
    """Test that deleting non-existent story returns 404."""
    response = test_client.delete("/api/stories/00000000-0000-0000-0000-000000000000")
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_get_non_existent_batch_returns_404(test_client: TestClient, test_db: Session) -> None:
    """Test that getting non-existent batch status returns 404."""
    response = test_client.get("/api/stories/batches/00000000-0000-0000-0000-000000000000/status")
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_export_with_invalid_format_returns_422(test_client: TestClient, test_db: Session) -> None:
    """Test that invalid export format returns validation error."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_story(test_db, project_id, story_number=1)
    
    response = test_client.get(f"/api/projects/{project_id}/stories/export?format=invalid")
    
    # FastAPI returns 422 for validation errors
    assert response.status_code == 422


def test_list_stories_with_invalid_batch_id_returns_empty(test_client: TestClient, test_db: Session) -> None:
    """Test that filtering by non-existent batch returns empty results, not error."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_story(test_db, project_id, story_number=1)
    
    response = test_client.get(
        f"/api/projects/{project_id}/stories?batch_id=00000000-0000-0000-0000-000000000000"
    )
    
    # Should return empty results, not an error
    assert response.status_code == 200
    assert response.json()["total"] == 0


def test_reorder_with_empty_story_ids_returns_success(test_client: TestClient, test_db: Session) -> None:
    """Test that reorder with empty list returns success (no-op)."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    response = test_client.post(
        f"/api/projects/{project_id}/stories/reorder",
        json={"story_ids": []}
    )

    assert response.status_code == 200
    assert response.json()["count"] == 0


# =============================================================================
# Stories Streaming Endpoint Tests
# =============================================================================


import json
from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import patch


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
    format: StoryFormat,
    section_filter: list[str] | None = None,
    created_by: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Mock generate_stream that yields stories."""
    yield {
        "type": "story",
        "title": "User Authentication",
        "description": "As a user, I want to log in securely.",
        "acceptance_criteria": ["User can enter credentials", "Session is created"],
        "suggested_size": "M",
        "suggested_labels": ["auth"],
        "source_requirement_ids": ["req-1"],
    }
    yield {
        "type": "story",
        "title": "Password Reset",
        "description": "As a user, I want to reset my password.",
        "acceptance_criteria": ["User receives email", "Link expires"],
        "suggested_size": "S",
        "suggested_labels": ["auth"],
        "source_requirement_ids": ["req-2"],
    }
    yield {
        "type": "complete",
        "batch_id": "test-batch-id",
        "story_count": 2,
    }


async def _mock_generate_stream_no_requirements(
    project_id: str,
    format: StoryFormat,
    section_filter: list[str] | None = None,
    created_by: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Mock generate_stream that raises NoRequirementsError."""
    from app.exceptions import NoRequirementsError
    raise NoRequirementsError(project_id)
    yield {}  # Never reached, but makes this an async generator


async def _mock_generate_stream_llm_error(
    project_id: str,
    format: StoryFormat,
    section_filter: list[str] | None = None,
    created_by: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Mock generate_stream that raises LLMError."""
    from app.services.llm import LLMError
    raise LLMError("LLM connection failed")
    yield {}  # Never reached


def test_stream_stories_generation_returns_status_event(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint returns initial status event."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)

    with patch(
        "app.routers.stories.StoriesGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_success

        response = test_client.get(f"/api/projects/{project_id}/stories/stream?format=classic")

    assert response.status_code == 200
    events = _parse_sse_events(response.text)

    # First event should be status
    assert len(events) > 0
    assert events[0]["event"] == "status"
    assert events[0]["data"]["status"] == "generating"
    assert events[0]["data"]["format"] == "classic"


def test_stream_stories_generation_returns_story_events(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint returns story events."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)

    with patch(
        "app.routers.stories.StoriesGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_success

        response = test_client.get(f"/api/projects/{project_id}/stories/stream")

    events = _parse_sse_events(response.text)

    # Should have story events
    story_events = [e for e in events if e.get("event") == "story"]
    assert len(story_events) == 2

    assert story_events[0]["data"]["title"] == "User Authentication"
    assert story_events[0]["data"]["description"] == "As a user, I want to log in securely."
    assert story_events[0]["data"]["suggested_size"] == "M"
    assert "auth" in story_events[0]["data"]["suggested_labels"]

    assert story_events[1]["data"]["title"] == "Password Reset"


def test_stream_stories_generation_returns_complete_event(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint returns complete event."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)

    with patch(
        "app.routers.stories.StoriesGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_success

        response = test_client.get(f"/api/projects/{project_id}/stories/stream")

    events = _parse_sse_events(response.text)

    # Last event should be complete
    complete_events = [e for e in events if e.get("event") == "complete"]
    assert len(complete_events) == 1
    assert complete_events[0]["data"]["batch_id"] == "test-batch-id"
    assert complete_events[0]["data"]["story_count"] == 2


def test_stream_stories_generation_returns_error_for_no_requirements(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint returns error when no requirements."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    # Don't create any requirements

    with patch(
        "app.routers.stories.StoriesGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_no_requirements

        response = test_client.get(f"/api/projects/{project_id}/stories/stream")

    events = _parse_sse_events(response.text)

    # Should have error event
    error_events = [e for e in events if e.get("event") == "error"]
    assert len(error_events) == 1
    assert "no requirements" in error_events[0]["data"]["message"].lower()


def test_stream_stories_generation_returns_404_for_missing_project(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint returns 404 for non-existent project."""
    fake_project_id = "00000000-0000-0000-0000-000000000000"

    response = test_client.get(f"/api/projects/{fake_project_id}/stories/stream")

    assert response.status_code == 404


def test_stream_stories_generation_accepts_format_parameter(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint accepts format parameter."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)

    with patch(
        "app.routers.stories.StoriesGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_success

        response = test_client.get(f"/api/projects/{project_id}/stories/stream?format=job_story")

    events = _parse_sse_events(response.text)

    # Status event should include the format
    status_events = [e for e in events if e.get("event") == "status"]
    assert len(status_events) == 1
    assert status_events[0]["data"]["format"] == "job_story"


def test_stream_stories_generation_returns_error_for_llm_failure(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint returns error on LLM failure."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)

    with patch(
        "app.routers.stories.StoriesGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_llm_error

        response = test_client.get(f"/api/projects/{project_id}/stories/stream")

    events = _parse_sse_events(response.text)

    # Should have error event
    error_events = [e for e in events if e.get("event") == "error"]
    assert len(error_events) == 1
    assert "LLM" in error_events[0]["data"]["message"]


# =============================================================================
# Test: Create Story Manually (US-036)
# =============================================================================


def test_create_story_manually(test_client: TestClient, test_db: Session) -> None:
    """Test that POST /projects/{project_id}/stories creates a manual story."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    response = test_client.post(
        f"/api/projects/{project_id}/stories",
        json={
            "title": "Manual Story",
            "description": "As a user, I want to do something.",
            "acceptance_criteria": ["AC 1", "AC 2"],
            "labels": ["manual"],
            "size": "m",
            "priority": "p1",
        }
    )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Manual Story"
    assert data["description"] == "As a user, I want to do something."
    assert data["story_id"] == "US-001"
    assert data["story_number"] == 1
    assert data["acceptance_criteria"] == ["AC 1", "AC 2"]
    assert data["labels"] == ["manual"]
    assert data["size"] == "m"
    assert data["status"] == "draft"
    assert data["batch_id"] is None  # Manual stories have no batch


def test_create_story_assigns_incremental_story_number(test_client: TestClient, test_db: Session) -> None:
    """Test that creating stories assigns incremental story numbers."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create first story
    response1 = test_client.post(
        f"/api/projects/{project_id}/stories",
        json={"title": "Story 1", "description": "First story"}
    )
    assert response1.status_code == 201
    assert response1.json()["story_id"] == "US-001"

    # Create second story
    response2 = test_client.post(
        f"/api/projects/{project_id}/stories",
        json={"title": "Story 2", "description": "Second story"}
    )
    assert response2.status_code == 201
    assert response2.json()["story_id"] == "US-002"

    # Create third story
    response3 = test_client.post(
        f"/api/projects/{project_id}/stories",
        json={"title": "Story 3", "description": "Third story"}
    )
    assert response3.status_code == 201
    assert response3.json()["story_id"] == "US-003"


def test_create_story_assigns_order_at_end(test_client: TestClient, test_db: Session) -> None:
    """Test that new stories are added at the end of the list."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create a few stories
    _create_test_story(test_db, project_id, story_number=1, title="Existing 1", order=0)
    _create_test_story(test_db, project_id, story_number=2, title="Existing 2", order=1)

    # Create new story via API
    response = test_client.post(
        f"/api/projects/{project_id}/stories",
        json={"title": "New Story", "description": "New"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["order"] == 2  # After existing stories


def test_create_story_with_custom_status(test_client: TestClient, test_db: Session) -> None:
    """Test that creating a story with custom status works."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    response = test_client.post(
        f"/api/projects/{project_id}/stories",
        json={
            "title": "Ready Story",
            "description": "Already ready",
            "status": "ready"
        }
    )

    assert response.status_code == 201
    assert response.json()["status"] == "ready"


def test_create_story_returns_404_for_missing_project(test_client: TestClient, test_db: Session) -> None:
    """Test that creating story for non-existent project returns 404."""
    fake_project_id = "00000000-0000-0000-0000-000000000000"

    response = test_client.post(
        f"/api/projects/{fake_project_id}/stories",
        json={"title": "Test", "description": "Test"}
    )

    assert response.status_code == 404


def test_create_story_validates_size_enum(test_client: TestClient, test_db: Session) -> None:
    """Test that invalid size value is rejected."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    response = test_client.post(
        f"/api/projects/{project_id}/stories",
        json={"title": "Test", "description": "Test", "size": "invalid"}
    )

    assert response.status_code == 422


def test_create_story_validates_status_enum(test_client: TestClient, test_db: Session) -> None:
    """Test that invalid status value is rejected."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    response = test_client.post(
        f"/api/projects/{project_id}/stories",
        json={"title": "Test", "description": "Test", "status": "invalid"}
    )

    assert response.status_code == 422


# =============================================================================
# Test: Get Single Story (US-036)
# =============================================================================


def test_get_story_returns_full_details(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /stories/{story_id} returns full story details."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    story = _create_test_story(
        test_db, project_id,
        story_number=1,
        title="Full Details Story",
        description="Detailed description",
        acceptance_criteria=["AC 1", "AC 2", "AC 3"],
        labels=["label1", "label2"],
        size=StorySize.L,
        status=StoryStatus.READY,
    )
    story_id = _get_story_id(story)

    response = test_client.get(f"/api/stories/{story_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == story_id
    assert data["title"] == "Full Details Story"
    assert data["description"] == "Detailed description"
    assert data["story_id"] == "US-001"
    assert data["acceptance_criteria"] == ["AC 1", "AC 2", "AC 3"]
    assert data["labels"] == ["label1", "label2"]
    assert data["size"] == "l"
    assert data["status"] == "ready"
    assert "created_at" in data
    assert "updated_at" in data


def test_get_story_returns_404_for_missing(test_client: TestClient, test_db: Session) -> None:
    """Test that GET /stories/{story_id} returns 404 for non-existent story."""
    response = test_client.get("/api/stories/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


# =============================================================================
# Test: Generate More Stories (Multiple Batches)
# =============================================================================


def test_multiple_generation_batches_work_independently(test_client: TestClient, test_db: Session) -> None:
    """Test that generating stories multiple times creates independent batches."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)

    # Start first generation
    response1 = test_client.post(
        f"/api/projects/{project_id}/stories/generate",
        json={"format": "classic"}
    )
    assert response1.status_code == 202
    batch1_id = response1.json()["id"]

    # Start second generation (generates more stories)
    response2 = test_client.post(
        f"/api/projects/{project_id}/stories/generate",
        json={"format": "job_story"}
    )
    assert response2.status_code == 202
    batch2_id = response2.json()["id"]

    # Batches should be different
    assert batch1_id != batch2_id

    # List batches should show both
    batches_response = test_client.get(f"/api/projects/{project_id}/stories/batches")
    assert len(batches_response.json()) == 2


def test_delete_single_batch_preserves_other_batches(test_client: TestClient, test_db: Session) -> None:
    """Test that deleting one batch doesn't affect stories from other batches."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    batch1 = _create_test_batch(test_db, project_id)
    batch2 = _create_test_batch(test_db, project_id)
    batch1_id = _get_batch_id(batch1)
    batch2_id = _get_batch_id(batch2)

    # Create stories in both batches
    _create_test_story(test_db, project_id, batch_id=batch1_id, story_number=1, title="Batch1 Story")
    _create_test_story(test_db, project_id, batch_id=batch2_id, story_number=2, title="Batch2 Story")

    # Delete batch1
    test_client.delete(f"/api/projects/{project_id}/stories/batch/{batch1_id}")

    # Batch2 stories should remain
    list_response = test_client.get(f"/api/projects/{project_id}/stories")
    assert list_response.json()["total"] == 1
    assert list_response.json()["items"][0]["title"] == "Batch2 Story"


# =============================================================================
# Test: Story Priority (US-036)
# =============================================================================


def test_create_story_with_priority(test_client: TestClient, test_db: Session) -> None:
    """Test that stories can be created with priority."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    response = test_client.post(
        f"/api/projects/{project_id}/stories",
        json={"title": "Priority Story", "description": "High priority", "priority": "p1"}
    )

    assert response.status_code == 201
    assert response.json()["priority"] == "p1"


def test_update_story_priority(test_client: TestClient, test_db: Session) -> None:
    """Test that story priority can be updated."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    story = _create_test_story(test_db, project_id, story_number=1)
    story_id = _get_story_id(story)

    response = test_client.put(f"/api/stories/{story_id}", json={"priority": "p3"})

    assert response.status_code == 200
    assert response.json()["priority"] == "p3"


# =============================================================================
# Test: Stream Generation with Section Filter (US-036)
# =============================================================================


async def _mock_generate_stream_with_filter(
    project_id: str,
    format: StoryFormat,
    section_filter: list[str] | None = None,
    created_by: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Mock generate_stream that uses section_filter."""
    # Yield based on filter
    sections_used = section_filter or ["all"]
    yield {
        "type": "story",
        "title": f"Story from {', '.join(sections_used)}",
        "description": "Filtered story",
        "acceptance_criteria": ["AC"],
        "suggested_size": "M",
        "suggested_labels": sections_used,
        "source_requirement_ids": [],
    }
    yield {
        "type": "complete",
        "batch_id": "filtered-batch-id",
        "story_count": 1,
    }


def test_stream_stories_with_section_filter(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming endpoint accepts and uses section_filter."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)

    with patch(
        "app.routers.stories.StoriesGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_with_filter

        response = test_client.get(
            f"/api/projects/{project_id}/stories/stream?section_filter=functional&section_filter=non_functional"
        )

    events = _parse_sse_events(response.text)

    # Should have story event
    story_events = [e for e in events if e.get("event") == "story"]
    assert len(story_events) == 1


# =============================================================================
# Test: LLM Response Parsing Errors (US-037)
# =============================================================================


async def _mock_generate_stream_parsing_error(
    project_id: str,
    format: StoryFormat,
    section_filter: list[str] | None = None,
    created_by: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Mock generate_stream that raises LLMResponseError."""
    from app.exceptions import LLMResponseError
    raise LLMResponseError("Invalid JSON in LLM response")
    yield {}  # Never reached


def test_stream_stories_handles_parsing_error(test_client: TestClient, test_db: Session) -> None:
    """Test that streaming handles LLM response parsing errors."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)
    _create_test_requirement(test_db, project_id)

    with patch(
        "app.routers.stories.StoriesGenerator"
    ) as mock_generator_class:
        mock_instance = mock_generator_class.return_value
        mock_instance.generate_stream = _mock_generate_stream_parsing_error

        response = test_client.get(f"/api/projects/{project_id}/stories/stream")

    events = _parse_sse_events(response.text)

    # Should have error event
    error_events = [e for e in events if e.get("event") == "error"]
    assert len(error_events) == 1
    assert "parse" in error_events[0]["data"]["message"].lower()
