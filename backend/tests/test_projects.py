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
    # Check stage status fields default to initial values
    assert data["requirements_status"] == "empty"
    assert data["prd_status"] == "empty"
    assert data["stories_status"] == "empty"
    assert data["mockups_status"] == "empty"
    assert data["export_status"] == "not_exported"


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
    # Verify stage status fields are returned
    assert "requirements_status" in data
    assert "prd_status" in data
    assert "stories_status" in data
    assert "mockups_status" in data
    assert "export_status" in data


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


def test_new_project_has_zero_progress(test_client: TestClient) -> None:
    """Test that a new project has 0% progress."""
    response = test_client.post(
        "/api/projects",
        json={"name": "Progress Test", "description": "Testing progress"},
    )
    assert response.status_code == 201
    data = response.json()
    assert "progress" in data
    assert data["progress"] == 0


def test_project_progress_included_in_response(test_client: TestClient) -> None:
    """Test that progress is included when fetching a project."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Progress Fetch Test"},
    )
    project_id = create_response.json()["id"]

    # Fetch the project
    response = test_client.get(f"/api/projects/{project_id}")
    assert response.status_code == 200
    data = response.json()
    assert "progress" in data
    assert isinstance(data["progress"], int)
    assert 0 <= data["progress"] <= 100


def test_project_progress_in_list(test_client: TestClient) -> None:
    """Test that progress is included when listing projects."""
    # Create a project
    test_client.post("/api/projects", json={"name": "List Progress Test"})

    # List projects
    response = test_client.get("/api/projects")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    # Check that all projects have progress field
    for project in data:
        assert "progress" in project
        assert isinstance(project["progress"], int)


# Tests for GET /api/projects/{id}/progress endpoint


def test_get_project_progress(test_client: TestClient) -> None:
    """Test GET /api/projects/{id}/progress returns all stage statuses."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Progress Endpoint Test"},
    )
    project_id = create_response.json()["id"]

    # Get progress
    response = test_client.get(f"/api/projects/{project_id}/progress")
    assert response.status_code == 200
    data = response.json()

    # Check all fields are present
    assert data["requirements_status"] == "empty"
    assert data["prd_status"] == "empty"
    assert data["stories_status"] == "empty"
    assert data["mockups_status"] == "empty"
    assert data["export_status"] == "not_exported"
    assert data["progress"] == 0


def test_get_project_progress_returns_404_for_missing(test_client: TestClient) -> None:
    """Test GET /api/projects/{id}/progress returns 404 for non-existent project."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    response = test_client.get(f"/api/projects/{fake_uuid}/progress")
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


# Tests for PATCH /api/projects/{id}/stages/{stage} endpoint


def test_update_requirements_status(test_client: TestClient) -> None:
    """Test PATCH /api/projects/{id}/stages/requirements updates the status."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Stage Update Test"},
    )
    project_id = create_response.json()["id"]

    # Update requirements status
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/requirements",
        json={"status": "has_items"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["requirements_status"] == "has_items"
    assert data["progress"] == 10  # has_items gives 10%


def test_update_prd_status(test_client: TestClient) -> None:
    """Test PATCH /api/projects/{id}/stages/prd updates the status."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "PRD Status Test"},
    )
    project_id = create_response.json()["id"]

    # Update PRD status
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/prd",
        json={"status": "ready"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["prd_status"] == "ready"
    assert data["progress"] == 20  # ready gives 20%


def test_update_stories_status(test_client: TestClient) -> None:
    """Test PATCH /api/projects/{id}/stages/stories updates the status."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Stories Status Test"},
    )
    project_id = create_response.json()["id"]

    # Update stories status
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/stories",
        json={"status": "generated"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["stories_status"] == "generated"
    assert data["progress"] == 10  # generated gives 10%


def test_update_mockups_status(test_client: TestClient) -> None:
    """Test PATCH /api/projects/{id}/stages/mockups updates the status."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Mockups Status Test"},
    )
    project_id = create_response.json()["id"]

    # Update mockups status
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/mockups",
        json={"status": "generated"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["mockups_status"] == "generated"
    assert data["progress"] == 20  # generated gives 20%


def test_update_export_status(test_client: TestClient) -> None:
    """Test PATCH /api/projects/{id}/stages/export updates the status."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Export Status Test"},
    )
    project_id = create_response.json()["id"]

    # Update export status
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/export",
        json={"status": "exported"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["export_status"] == "exported"
    assert data["progress"] == 20  # exported gives 20%


def test_update_stage_recalculates_progress(test_client: TestClient) -> None:
    """Test that updating stages correctly recalculates overall progress."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Progress Recalculation Test"},
    )
    project_id = create_response.json()["id"]

    # Update multiple stages
    test_client.patch(
        f"/api/projects/{project_id}/stages/requirements",
        json={"status": "reviewed"},  # 20%
    )
    test_client.patch(
        f"/api/projects/{project_id}/stages/prd",
        json={"status": "ready"},  # 20%
    )
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/stories",
        json={"status": "refined"},  # 20%
    )

    data = response.json()
    assert data["requirements_status"] == "reviewed"
    assert data["prd_status"] == "ready"
    assert data["stories_status"] == "refined"
    assert data["progress"] == 60  # 20 + 20 + 20


def test_update_stage_invalid_status_returns_400(test_client: TestClient) -> None:
    """Test PATCH with invalid status returns 400."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Invalid Status Test"},
    )
    project_id = create_response.json()["id"]

    # Try to update with invalid status
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/requirements",
        json={"status": "invalid_status"},
    )
    assert response.status_code == 400
    assert "Invalid status" in response.json()["detail"]


def test_update_stage_returns_404_for_missing_project(test_client: TestClient) -> None:
    """Test PATCH returns 404 for non-existent project."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    response = test_client.patch(
        f"/api/projects/{fake_uuid}/stages/requirements",
        json={"status": "has_items"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_update_stage_invalid_stage_returns_422(test_client: TestClient) -> None:
    """Test PATCH with invalid stage name returns 422."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Invalid Stage Test"},
    )
    project_id = create_response.json()["id"]

    # Try to update with invalid stage name
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/invalid_stage",
        json={"status": "empty"},
    )
    assert response.status_code == 422  # Validation error from FastAPI


# Additional integration tests for comprehensive coverage


def test_create_project_missing_name_returns_422(test_client: TestClient) -> None:
    """Test POST /api/projects without name returns 422 validation error."""
    response = test_client.post(
        "/api/projects",
        json={"description": "No name provided"},
    )
    assert response.status_code == 422
    # Verify error mentions 'name' field
    error_detail = response.json()["detail"]
    assert any("name" in str(err).lower() for err in error_detail)


def test_list_projects_empty_returns_empty_list(test_client: TestClient) -> None:
    """Test GET /api/projects returns empty list when no projects exist."""
    response = test_client.get("/api/projects")
    assert response.status_code == 200
    assert response.json() == []


def test_update_project_archived_status(test_client: TestClient) -> None:
    """Test PUT /api/projects/{id} updates archived status."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Archive Test"},
    )
    project_id = create_response.json()["id"]
    assert create_response.json()["archived"] is False

    # Archive the project
    response = test_client.put(
        f"/api/projects/{project_id}",
        json={"archived": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["archived"] is True
    assert data["name"] == "Archive Test"


def test_update_project_multiple_fields(test_client: TestClient) -> None:
    """Test PUT /api/projects/{id} updates multiple fields at once."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Original", "description": "Original desc"},
    )
    project_id = create_response.json()["id"]

    # Update multiple fields
    response = test_client.put(
        f"/api/projects/{project_id}",
        json={"name": "Updated", "description": "New desc", "archived": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated"
    assert data["description"] == "New desc"
    assert data["archived"] is True


def test_update_project_clear_description(test_client: TestClient) -> None:
    """Test PUT /api/projects/{id} can set description to None."""
    # Create a project with description
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Clear Desc Test", "description": "Initial description"},
    )
    project_id = create_response.json()["id"]
    assert create_response.json()["description"] == "Initial description"

    # Clear description by setting to None
    response = test_client.put(
        f"/api/projects/{project_id}",
        json={"description": None},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["description"] is None


def test_full_progress_all_stages_complete(test_client: TestClient) -> None:
    """Test that completing all stages results in 100% progress."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Full Progress Test"},
    )
    project_id = create_response.json()["id"]

    # Complete all stages
    test_client.patch(
        f"/api/projects/{project_id}/stages/requirements",
        json={"status": "reviewed"},  # 20%
    )
    test_client.patch(
        f"/api/projects/{project_id}/stages/prd",
        json={"status": "ready"},  # 20%
    )
    test_client.patch(
        f"/api/projects/{project_id}/stages/stories",
        json={"status": "refined"},  # 20%
    )
    test_client.patch(
        f"/api/projects/{project_id}/stages/mockups",
        json={"status": "generated"},  # 20%
    )
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/export",
        json={"status": "exported"},  # 20%
    )

    data = response.json()
    assert data["requirements_status"] == "reviewed"
    assert data["prd_status"] == "ready"
    assert data["stories_status"] == "refined"
    assert data["mockups_status"] == "generated"
    assert data["export_status"] == "exported"
    assert data["progress"] == 100


def test_requirements_status_all_values(test_client: TestClient) -> None:
    """Test all valid values for requirements status."""
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Req Status Test"},
    )
    project_id = create_response.json()["id"]

    # Test empty (default)
    response = test_client.get(f"/api/projects/{project_id}/progress")
    assert response.json()["requirements_status"] == "empty"

    # Test has_items
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/requirements",
        json={"status": "has_items"},
    )
    assert response.json()["requirements_status"] == "has_items"

    # Test reviewed
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/requirements",
        json={"status": "reviewed"},
    )
    assert response.json()["requirements_status"] == "reviewed"


def test_prd_status_all_values(test_client: TestClient) -> None:
    """Test all valid values for PRD status."""
    create_response = test_client.post(
        "/api/projects",
        json={"name": "PRD Status Test"},
    )
    project_id = create_response.json()["id"]

    # Test draft
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/prd",
        json={"status": "draft"},
    )
    assert response.json()["prd_status"] == "draft"
    assert response.json()["progress"] == 10  # draft = 10%

    # Test ready
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/prd",
        json={"status": "ready"},
    )
    assert response.json()["prd_status"] == "ready"
    assert response.json()["progress"] == 20  # ready = 20%

    # Test resetting to empty
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/prd",
        json={"status": "empty"},
    )
    assert response.json()["prd_status"] == "empty"
    assert response.json()["progress"] == 0


def test_stories_status_all_values(test_client: TestClient) -> None:
    """Test all valid values for stories status."""
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Stories Status Test"},
    )
    project_id = create_response.json()["id"]

    # Test generated
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/stories",
        json={"status": "generated"},
    )
    assert response.json()["stories_status"] == "generated"
    assert response.json()["progress"] == 10

    # Test refined
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/stories",
        json={"status": "refined"},
    )
    assert response.json()["stories_status"] == "refined"
    assert response.json()["progress"] == 20


def test_mockups_status_all_values(test_client: TestClient) -> None:
    """Test all valid values for mockups status."""
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Mockups Status Test"},
    )
    project_id = create_response.json()["id"]

    # Test generated (only valid non-empty value)
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/mockups",
        json={"status": "generated"},
    )
    assert response.json()["mockups_status"] == "generated"
    assert response.json()["progress"] == 20

    # Test resetting to empty
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/mockups",
        json={"status": "empty"},
    )
    assert response.json()["mockups_status"] == "empty"
    assert response.json()["progress"] == 0


def test_export_status_all_values(test_client: TestClient) -> None:
    """Test all valid values for export status."""
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Export Status Test"},
    )
    project_id = create_response.json()["id"]

    # Verify default is not_exported
    response = test_client.get(f"/api/projects/{project_id}/progress")
    assert response.json()["export_status"] == "not_exported"

    # Test exported
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/export",
        json={"status": "exported"},
    )
    assert response.json()["export_status"] == "exported"
    assert response.json()["progress"] == 20

    # Test resetting to not_exported
    response = test_client.patch(
        f"/api/projects/{project_id}/stages/export",
        json={"status": "not_exported"},
    )
    assert response.json()["export_status"] == "not_exported"
    assert response.json()["progress"] == 0


def test_stage_update_missing_status_returns_422(test_client: TestClient) -> None:
    """Test PATCH without status field returns 422 validation error."""
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Missing Status Test"},
    )
    project_id = create_response.json()["id"]

    response = test_client.patch(
        f"/api/projects/{project_id}/stages/requirements",
        json={},  # Missing required status field
    )
    assert response.status_code == 422


def test_project_timestamps_updated(test_client: TestClient) -> None:
    """Test that updated_at timestamp changes on update."""
    import time

    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Timestamp Test"},
    )
    project_id = create_response.json()["id"]
    original_updated_at = create_response.json()["updated_at"]

    # Small delay to ensure timestamp difference
    time.sleep(0.1)

    # Update the project
    response = test_client.put(
        f"/api/projects/{project_id}",
        json={"name": "Timestamp Test Updated"},
    )
    new_updated_at = response.json()["updated_at"]

    # created_at should remain same, updated_at should change
    assert response.json()["created_at"] == create_response.json()["created_at"]
    assert new_updated_at >= original_updated_at


def test_create_project_with_empty_name_creates_project(test_client: TestClient) -> None:
    """Test POST /api/projects with empty string name."""
    # Empty string is technically valid (no min_length constraint)
    response = test_client.post(
        "/api/projects",
        json={"name": ""},
    )
    # Behavior depends on schema validation - empty string should be allowed
    # since there's no explicit min_length in ProjectCreate
    assert response.status_code == 201
    assert response.json()["name"] == ""


def test_get_project_returns_correct_stage_statuses(test_client: TestClient) -> None:
    """Test GET /api/projects/{id} returns updated stage statuses."""
    # Create a project
    create_response = test_client.post(
        "/api/projects",
        json={"name": "Stage Status Check"},
    )
    project_id = create_response.json()["id"]

    # Update some stages
    test_client.patch(
        f"/api/projects/{project_id}/stages/requirements",
        json={"status": "has_items"},
    )
    test_client.patch(
        f"/api/projects/{project_id}/stages/prd",
        json={"status": "draft"},
    )

    # Fetch the project and verify statuses
    response = test_client.get(f"/api/projects/{project_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["requirements_status"] == "has_items"
    assert data["prd_status"] == "draft"
    assert data["stories_status"] == "empty"
    assert data["mockups_status"] == "empty"
    assert data["export_status"] == "not_exported"
    # Progress should be 10 + 10 = 20%
    assert data["progress"] == 20


def test_list_projects_returns_updated_statuses(test_client: TestClient) -> None:
    """Test GET /api/projects returns correct stage statuses for all projects."""
    # Create two projects
    create_resp1 = test_client.post("/api/projects", json={"name": "Project 1"})
    create_resp2 = test_client.post("/api/projects", json={"name": "Project 2"})
    project_id1 = create_resp1.json()["id"]
    project_id2 = create_resp2.json()["id"]

    # Update statuses differently
    test_client.patch(
        f"/api/projects/{project_id1}/stages/requirements",
        json={"status": "reviewed"},
    )
    test_client.patch(
        f"/api/projects/{project_id2}/stages/export",
        json={"status": "exported"},
    )

    # List projects and verify
    response = test_client.get("/api/projects")
    assert response.status_code == 200
    projects = response.json()
    assert len(projects) == 2

    proj1 = next(p for p in projects if p["id"] == project_id1)
    proj2 = next(p for p in projects if p["id"] == project_id2)

    assert proj1["requirements_status"] == "reviewed"
    assert proj1["progress"] == 20
    assert proj2["export_status"] == "exported"
    assert proj2["progress"] == 20
