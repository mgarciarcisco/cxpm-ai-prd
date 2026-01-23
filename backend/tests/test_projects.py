"""Tests for Project CRUD endpoints."""

from fastapi.testclient import TestClient


def test_create_project(test_client: TestClient) -> None:
    """Test POST /api/projects creates a project and returns 201."""
    response = test_client.post(
        "/api/projects",
        json={"name": "Test Project", "description": "A test project"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["description"] == "A test project"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_project_without_description(test_client: TestClient) -> None:
    """Test POST /api/projects creates a project without description."""
    response = test_client.post(
        "/api/projects",
        json={"name": "Minimal Project"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Minimal Project"
    assert data["description"] is None


def test_list_projects_returns_created_projects(test_client: TestClient) -> None:
    """Test GET /api/projects returns list of created projects."""
    # Create some projects
    test_client.post("/api/projects", json={"name": "Project 1"})
    test_client.post("/api/projects", json={"name": "Project 2"})
    test_client.post("/api/projects", json={"name": "Project 3"})

    response = test_client.get("/api/projects")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    names = [p["name"] for p in data]
    assert "Project 1" in names
    assert "Project 2" in names
    assert "Project 3" in names


def test_get_project_by_id(test_client: TestClient) -> None:
    """Test GET /api/projects/{id} returns the project."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Get Test", "description": "Test retrieval"},
    )
    project_id = create_response.json()["id"]

    response = test_client.get(f"/api/projects/{project_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == project_id
    assert data["name"] == "Get Test"
    assert data["description"] == "Test retrieval"


def test_get_project_returns_404_for_missing(test_client: TestClient) -> None:
    """Test GET /api/projects/{id} returns 404 for non-existent project."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    response = test_client.get(f"/api/projects/{fake_uuid}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_update_project_name(test_client: TestClient) -> None:
    """Test PUT /api/projects/{id} updates project name."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Original Name", "description": "Original description"},
    )
    project_id = create_response.json()["id"]

    # Update the name
    response = test_client.put(
        f"/api/projects/{project_id}",
        json={"name": "Updated Name"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["description"] == "Original description"


def test_update_project_description(test_client: TestClient) -> None:
    """Test PUT /api/projects/{id} updates project description."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Test Project", "description": "Old description"},
    )
    project_id = create_response.json()["id"]

    # Update the description
    response = test_client.put(
        f"/api/projects/{project_id}",
        json={"description": "New description"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["description"] == "New description"


def test_update_project_returns_404_for_missing(test_client: TestClient) -> None:
    """Test PUT /api/projects/{id} returns 404 for non-existent project."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    response = test_client.put(
        f"/api/projects/{fake_uuid}",
        json={"name": "Won't Work"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_delete_project(test_client: TestClient) -> None:
    """Test DELETE /api/projects/{id} removes the project."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "To Delete"},
    )
    project_id = create_response.json()["id"]

    # Delete the project
    delete_response = test_client.delete(f"/api/projects/{project_id}")
    assert delete_response.status_code == 204

    # Verify it's gone
    get_response = test_client.get(f"/api/projects/{project_id}")
    assert get_response.status_code == 404


def test_delete_project_returns_404_for_missing(test_client: TestClient) -> None:
    """Test DELETE /api/projects/{id} returns 404 for non-existent project."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    response = test_client.delete(f"/api/projects/{fake_uuid}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_get_project_stats_empty_project(test_client: TestClient) -> None:
    """Test GET /api/projects/{id}/stats returns zeros for empty project."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Stats Test Project"},
    )
    project_id = create_response.json()["id"]

    # Get stats
    response = test_client.get(f"/api/projects/{project_id}/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["meeting_count"] == 0
    assert data["requirement_count"] == 0
    assert data["requirement_counts_by_section"] == []
    assert data["last_activity"] is not None  # Falls back to project created_at


def test_get_project_stats_returns_404_for_missing(test_client: TestClient) -> None:
    """Test GET /api/projects/{id}/stats returns 404 for non-existent project."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    response = test_client.get(f"/api/projects/{fake_uuid}/stats")
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"
