"""Tests for Meeting endpoints."""

from io import BytesIO

from fastapi.testclient import TestClient


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
    upload1 = test_client.post(
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
