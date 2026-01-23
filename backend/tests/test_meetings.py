"""Tests for Meeting endpoints."""

from io import BytesIO

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import MeetingRecap
from app.models.meeting_recap import MeetingStatus


def _create_project(test_client: TestClient) -> str:
    """Helper to create a project and return its ID."""
    response = test_client.post(
        "/api/projects",
        json={"name": "Test Project", "description": "For meeting tests"},
    )
    return response.json()["id"]


def test_upload_meeting_with_text(test_client: TestClient) -> None:
    """Test POST /api/meetings/upload with text content."""
    project_id = _create_project(test_client)

    response = test_client.post(
        "/api/meetings/upload",
        data={
            "project_id": project_id,
            "title": "Sprint Planning",
            "meeting_date": "2026-01-22",
            "text": "We discussed the new feature requirements.",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "job_id" in data
    assert "meeting_id" in data
    assert data["job_id"] == data["meeting_id"]


def test_upload_meeting_with_file(test_client: TestClient) -> None:
    """Test POST /api/meetings/upload with file upload."""
    project_id = _create_project(test_client)

    # Create a simple text file
    file_content = b"Meeting notes from the planning session."
    file = BytesIO(file_content)

    response = test_client.post(
        "/api/meetings/upload",
        data={
            "project_id": project_id,
            "title": "File Upload Test",
            "meeting_date": "2026-01-22",
        },
        files={"file": ("notes.txt", file, "text/plain")},
    )
    assert response.status_code == 201
    data = response.json()
    assert "job_id" in data
    assert "meeting_id" in data


def test_upload_meeting_with_md_file(test_client: TestClient) -> None:
    """Test POST /api/meetings/upload with markdown file."""
    project_id = _create_project(test_client)

    # Create a markdown file
    file_content = b"# Meeting Notes\n\n- First item\n- Second item"
    file = BytesIO(file_content)

    response = test_client.post(
        "/api/meetings/upload",
        data={
            "project_id": project_id,
            "title": "Markdown Upload Test",
            "meeting_date": "2026-01-22",
        },
        files={"file": ("notes.md", file, "text/markdown")},
    )
    assert response.status_code == 201


def test_upload_meeting_requires_file_or_text(test_client: TestClient) -> None:
    """Test POST /api/meetings/upload returns 400 when neither file nor text provided."""
    project_id = _create_project(test_client)

    response = test_client.post(
        "/api/meetings/upload",
        data={
            "project_id": project_id,
            "title": "Missing Content",
            "meeting_date": "2026-01-22",
        },
    )
    assert response.status_code == 400
    assert "Either file or text must be provided" in response.json()["detail"]


def test_upload_meeting_404_on_missing_project(test_client: TestClient) -> None:
    """Test POST /api/meetings/upload returns 404 for non-existent project."""
    fake_project_id = "00000000-0000-0000-0000-000000000000"

    response = test_client.post(
        "/api/meetings/upload",
        data={
            "project_id": fake_project_id,
            "title": "Orphan Meeting",
            "meeting_date": "2026-01-22",
            "text": "This should fail.",
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_list_meetings_by_project(test_client: TestClient) -> None:
    """Test GET /api/projects/{id}/meetings returns meetings for the project."""
    project_id = _create_project(test_client)

    # Create some meetings
    for i in range(3):
        test_client.post(
            "/api/meetings/upload",
            data={
                "project_id": project_id,
                "title": f"Meeting {i + 1}",
                "meeting_date": f"2026-01-{20 + i}",
                "text": f"Content for meeting {i + 1}",
            },
        )

    response = test_client.get(f"/api/projects/{project_id}/meetings")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    titles = [m["title"] for m in data]
    assert "Meeting 1" in titles
    assert "Meeting 2" in titles
    assert "Meeting 3" in titles


def test_list_meetings_empty_for_new_project(test_client: TestClient) -> None:
    """Test GET /api/projects/{id}/meetings returns empty list for new project."""
    project_id = _create_project(test_client)

    response = test_client.get(f"/api/projects/{project_id}/meetings")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0


def test_list_meetings_404_on_missing_project(test_client: TestClient) -> None:
    """Test GET /api/projects/{id}/meetings returns 404 for non-existent project."""
    fake_project_id = "00000000-0000-0000-0000-000000000000"

    response = test_client.get(f"/api/projects/{fake_project_id}/meetings")
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_get_meeting_with_items(test_client: TestClient) -> None:
    """Test GET /api/meetings/{id} returns meeting with items list."""
    project_id = _create_project(test_client)

    # Create a meeting
    upload_response = test_client.post(
        "/api/meetings/upload",
        data={
            "project_id": project_id,
            "title": "Sprint Review",
            "meeting_date": "2026-01-22",
            "text": "Reviewed completed features.",
        },
    )
    meeting_id = upload_response.json()["meeting_id"]

    response = test_client.get(f"/api/meetings/{meeting_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == meeting_id
    assert data["title"] == "Sprint Review"
    assert data["project_id"] == project_id
    assert data["raw_input"] == "Reviewed completed features."
    assert data["status"] == "pending"
    assert "items" in data
    assert isinstance(data["items"], list)


def test_get_meeting_404_on_missing(test_client: TestClient) -> None:
    """Test GET /api/meetings/{id} returns 404 for non-existent meeting."""
    fake_meeting_id = "00000000-0000-0000-0000-000000000000"

    response = test_client.get(f"/api/meetings/{fake_meeting_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Meeting not found"


def test_delete_meeting(test_client: TestClient) -> None:
    """Test DELETE /api/meetings/{id} removes the meeting."""
    project_id = _create_project(test_client)

    # Create a meeting
    upload_response = test_client.post(
        "/api/meetings/upload",
        data={
            "project_id": project_id,
            "title": "To Delete",
            "meeting_date": "2026-01-22",
            "text": "This meeting will be deleted.",
        },
    )
    meeting_id = upload_response.json()["meeting_id"]

    # Delete the meeting
    delete_response = test_client.delete(f"/api/meetings/{meeting_id}")
    assert delete_response.status_code == 204

    # Verify it's gone
    get_response = test_client.get(f"/api/meetings/{meeting_id}")
    assert get_response.status_code == 404


def test_delete_meeting_404_on_missing(test_client: TestClient) -> None:
    """Test DELETE /api/meetings/{id} returns 404 for non-existent meeting."""
    fake_meeting_id = "00000000-0000-0000-0000-000000000000"

    response = test_client.delete(f"/api/meetings/{fake_meeting_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Meeting not found"


def test_delete_meeting_removes_from_project_list(test_client: TestClient) -> None:
    """Test that deleted meeting is removed from project meetings list."""
    project_id = _create_project(test_client)

    # Create two meetings
    test_client.post(
        "/api/meetings/upload",
        data={
            "project_id": project_id,
            "title": "Keep This",
            "meeting_date": "2026-01-22",
            "text": "Content 1",
        },
    )
    upload2 = test_client.post(
        "/api/meetings/upload",
        data={
            "project_id": project_id,
            "title": "Delete This",
            "meeting_date": "2026-01-23",
            "text": "Content 2",
        },
    )
    meeting_to_delete = upload2.json()["meeting_id"]

    # Delete one meeting
    test_client.delete(f"/api/meetings/{meeting_to_delete}")

    # Verify only one remains in project list
    response = test_client.get(f"/api/projects/{project_id}/meetings")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Keep This"


def test_retry_meeting_resets_status(test_client: TestClient, test_db: Session) -> None:
    """Test POST /api/meetings/{id}/retry resets a failed meeting to pending."""
    project_id = _create_project(test_client)

    # Create a meeting
    upload_response = test_client.post(
        "/api/meetings/upload",
        data={
            "project_id": project_id,
            "title": "Failed Meeting",
            "meeting_date": "2026-01-22",
            "text": "This will fail and be retried.",
        },
    )
    meeting_id = upload_response.json()["meeting_id"]

    # Manually set the meeting to failed status with an error
    meeting = test_db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id).first()
    meeting.status = MeetingStatus.failed  # type: ignore[assignment]
    meeting.error_message = "Test error message"  # type: ignore[assignment]
    test_db.commit()

    # Retry the meeting
    retry_response = test_client.post(f"/api/meetings/{meeting_id}/retry")
    assert retry_response.status_code == 200
    data = retry_response.json()
    assert data["status"] == "pending"
    assert data["error_message"] is None


def test_retry_meeting_clears_error_message(test_client: TestClient, test_db: Session) -> None:
    """Test POST /api/meetings/{id}/retry clears the error_message field."""
    project_id = _create_project(test_client)

    # Create a meeting
    upload_response = test_client.post(
        "/api/meetings/upload",
        data={
            "project_id": project_id,
            "title": "Error Meeting",
            "meeting_date": "2026-01-22",
            "text": "Error will be cleared.",
        },
    )
    meeting_id = upload_response.json()["meeting_id"]

    # Set meeting to failed with error message
    meeting = test_db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id).first()
    meeting.status = MeetingStatus.failed  # type: ignore[assignment]
    meeting.error_message = "Extraction failed: invalid format"  # type: ignore[assignment]
    test_db.commit()

    # Retry the meeting
    test_client.post(f"/api/meetings/{meeting_id}/retry")

    # Verify error_message is cleared in database
    test_db.refresh(meeting)
    assert meeting.error_message is None


def test_retry_meeting_404_on_missing(test_client: TestClient) -> None:
    """Test POST /api/meetings/{id}/retry returns 404 for non-existent meeting."""
    fake_meeting_id = "00000000-0000-0000-0000-000000000000"

    response = test_client.post(f"/api/meetings/{fake_meeting_id}/retry")
    assert response.status_code == 404
    assert response.json()["detail"] == "Meeting not found"


def test_retry_meeting_400_on_non_failed_status(test_client: TestClient) -> None:
    """Test POST /api/meetings/{id}/retry returns 400 if meeting status is not failed."""
    project_id = _create_project(test_client)

    # Create a meeting (status will be pending)
    upload_response = test_client.post(
        "/api/meetings/upload",
        data={
            "project_id": project_id,
            "title": "Pending Meeting",
            "meeting_date": "2026-01-22",
            "text": "This is still pending.",
        },
    )
    meeting_id = upload_response.json()["meeting_id"]

    # Try to retry a pending meeting (should fail)
    response = test_client.post(f"/api/meetings/{meeting_id}/retry")
    assert response.status_code == 400
    assert "Can only retry meetings with failed status" in response.json()["detail"]


def test_retry_meeting_returns_meeting_response(test_client: TestClient, test_db: Session) -> None:
    """Test POST /api/meetings/{id}/retry returns a full MeetingResponse."""
    project_id = _create_project(test_client)

    # Create a meeting
    upload_response = test_client.post(
        "/api/meetings/upload",
        data={
            "project_id": project_id,
            "title": "Full Response Test",
            "meeting_date": "2026-01-22",
            "text": "Check all response fields.",
        },
    )
    meeting_id = upload_response.json()["meeting_id"]

    # Set meeting to failed
    meeting = test_db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id).first()
    meeting.status = MeetingStatus.failed  # type: ignore[assignment]
    meeting.error_message = "Test error"  # type: ignore[assignment]
    test_db.commit()

    # Retry and check response has all expected fields
    response = test_client.post(f"/api/meetings/{meeting_id}/retry")
    assert response.status_code == 200
    data = response.json()

    # Verify all MeetingResponse fields are present
    assert data["id"] == meeting_id
    assert data["project_id"] == project_id
    assert data["title"] == "Full Response Test"
    assert data["meeting_date"] == "2026-01-22"
    assert data["raw_input"] == "Check all response fields."
    assert data["input_type"] == "txt"
    assert data["status"] == "pending"
    assert "created_at" in data
    assert "items" in data
    assert isinstance(data["items"], list)
