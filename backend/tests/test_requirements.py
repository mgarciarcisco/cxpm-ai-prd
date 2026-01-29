"""Tests for Requirements endpoints."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import MeetingRecap, Project, Requirement, RequirementHistory, RequirementSource, RequirementsStatus
from app.models.meeting_item import Section
from app.models.meeting_recap import MeetingStatus
from app.models.requirement_history import Action, Actor


def _create_project(test_client: TestClient) -> str:
    """Helper to create a project and return its ID."""
    response = test_client.post(
        "/api/projects",
        json={"name": "Test Project", "description": "For requirements tests"},
    )
    return response.json()["id"]


def _create_requirement(
    test_db: Session,
    project_id: str,
    section: Section,
    content: str,
    order: int = 1,
    is_active: bool = True,
) -> str:
    """Helper to create a requirement directly in the database and return its ID."""
    requirement = Requirement(
        project_id=project_id,
        section=section,
        content=content,
        order=order,
        is_active=is_active,
    )
    test_db.add(requirement)
    test_db.commit()
    test_db.refresh(requirement)
    return str(requirement.id)


def _create_meeting(test_db: Session, project_id: str, title: str, status: MeetingStatus = MeetingStatus.applied) -> str:
    """Helper to create a meeting directly in the database and return its ID."""
    import datetime
    meeting = MeetingRecap(
        project_id=project_id,
        title=title,
        meeting_date=datetime.date.today(),
        raw_input="Meeting content",
        input_type="txt",
        status=status,
    )
    test_db.add(meeting)
    test_db.commit()
    test_db.refresh(meeting)
    return str(meeting.id)


def _create_requirement_source(
    test_db: Session, requirement_id: str, meeting_id: str, source_quote: str | None = None
) -> str:
    """Helper to create a requirement source in the database and return its ID."""
    source = RequirementSource(
        requirement_id=requirement_id,
        meeting_id=meeting_id,
        source_quote=source_quote,
    )
    test_db.add(source)
    test_db.commit()
    test_db.refresh(source)
    return str(source.id)


# =============================================================================
# LIST REQUIREMENTS TESTS
# =============================================================================

class TestListRequirements:
    """Tests for GET /api/projects/{id}/requirements."""

    def test_list_requirements_by_section(self, test_client: TestClient, test_db: Session) -> None:
        """Test that requirements are returned grouped by section."""
        project_id = _create_project(test_client)

        # Create requirements in different sections
        _create_requirement(test_db, project_id, Section.problems, "Problem 1", order=1)
        _create_requirement(test_db, project_id, Section.problems, "Problem 2", order=2)
        _create_requirement(test_db, project_id, Section.user_goals, "Goal 1", order=1)
        _create_requirement(test_db, project_id, Section.functional_requirements, "Req 1", order=1)

        response = test_client.get(f"/api/projects/{project_id}/requirements")

        assert response.status_code == 200
        data = response.json()

        # Check problems section
        assert len(data["problems"]) == 2
        assert data["problems"][0]["content"] == "Problem 1"
        assert data["problems"][1]["content"] == "Problem 2"

        # Check user_goals section
        assert len(data["user_goals"]) == 1
        assert data["user_goals"][0]["content"] == "Goal 1"

        # Check functional_requirements section
        assert len(data["functional_requirements"]) == 1
        assert data["functional_requirements"][0]["content"] == "Req 1"

        # Check empty sections
        assert len(data["constraints"]) == 0
        assert len(data["non_goals"]) == 0

    def test_list_requirements_excludes_inactive(self, test_client: TestClient, test_db: Session) -> None:
        """Test that inactive (soft-deleted) requirements are excluded."""
        project_id = _create_project(test_client)

        _create_requirement(test_db, project_id, Section.problems, "Active", is_active=True)
        _create_requirement(test_db, project_id, Section.problems, "Inactive", is_active=False, order=2)

        response = test_client.get(f"/api/projects/{project_id}/requirements")

        assert response.status_code == 200
        data = response.json()
        assert len(data["problems"]) == 1
        assert data["problems"][0]["content"] == "Active"

    def test_list_requirements_includes_sources(self, test_client: TestClient, test_db: Session) -> None:
        """Test that requirements include source meeting links."""
        project_id = _create_project(test_client)
        meeting_id = _create_meeting(test_db, project_id, "Test Meeting")
        req_id = _create_requirement(test_db, project_id, Section.problems, "Problem with source")
        _create_requirement_source(test_db, req_id, meeting_id, "quoted from meeting")

        response = test_client.get(f"/api/projects/{project_id}/requirements")

        assert response.status_code == 200
        data = response.json()
        assert len(data["problems"]) == 1
        assert len(data["problems"][0]["sources"]) == 1
        assert data["problems"][0]["sources"][0]["meeting_id"] == meeting_id
        assert data["problems"][0]["sources"][0]["source_quote"] == "quoted from meeting"

    def test_list_requirements_404_project_not_found(self, test_client: TestClient) -> None:
        """Test listing requirements for non-existent project returns 404."""
        fake_project_id = "00000000-0000-0000-0000-000000000000"

        response = test_client.get(f"/api/projects/{fake_project_id}/requirements")

        assert response.status_code == 404
        assert response.json()["detail"] == "Project not found"

    def test_list_requirements_empty_project(self, test_client: TestClient) -> None:
        """Test listing requirements for project with no requirements."""
        project_id = _create_project(test_client)

        response = test_client.get(f"/api/projects/{project_id}/requirements")

        assert response.status_code == 200
        data = response.json()
        # All sections should be empty arrays
        for section in ["problems", "user_goals", "functional_requirements", "data_needs",
                        "constraints", "non_goals", "risks_assumptions", "open_questions", "action_items"]:
            assert data[section] == []


# =============================================================================
# CREATE REQUIREMENT TESTS
# =============================================================================

class TestCreateRequirement:
    """Tests for POST /api/projects/{id}/requirements."""

    def test_create_requirement_success(self, test_client: TestClient, test_db: Session) -> None:
        """Test creating a new requirement manually."""
        project_id = _create_project(test_client)

        response = test_client.post(
            f"/api/projects/{project_id}/requirements",
            json={"section": "problems", "content": "New problem requirement"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["section"] == "problems"
        assert data["content"] == "New problem requirement"
        assert data["order"] == 1
        assert data["sources"] == []
        assert data["history_count"] == 1  # Creation is recorded in history

    def test_create_requirement_records_history(self, test_client: TestClient, test_db: Session) -> None:
        """Test that creating a requirement records the creation in history."""
        project_id = _create_project(test_client)

        response = test_client.post(
            f"/api/projects/{project_id}/requirements",
            json={"section": "user_goals", "content": "User goal content"},
        )

        req_id = response.json()["id"]

        # Check history was recorded
        history = test_db.query(RequirementHistory).filter(
            RequirementHistory.requirement_id == req_id
        ).all()
        assert len(history) == 1
        assert history[0].actor == Actor.user
        assert history[0].action == Action.created
        assert history[0].old_content is None
        assert history[0].new_content == "User goal content"

    def test_create_requirement_appends_to_section(self, test_client: TestClient, test_db: Session) -> None:
        """Test that new requirements are appended at the end of their section."""
        project_id = _create_project(test_client)

        # Create first requirement in section
        _create_requirement(test_db, project_id, Section.functional_requirements, "First", order=1)

        # Create second via API
        response = test_client.post(
            f"/api/projects/{project_id}/requirements",
            json={"section": "functional_requirements", "content": "Second"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["order"] == 2  # Should be appended

    def test_create_requirement_different_section_starts_at_1(self, test_client: TestClient, test_db: Session) -> None:
        """Test that new requirements in different section start at order 1."""
        project_id = _create_project(test_client)

        # Create requirement in problems section
        _create_requirement(test_db, project_id, Section.problems, "Problem", order=5)

        # Create requirement in different section (user_goals)
        response = test_client.post(
            f"/api/projects/{project_id}/requirements",
            json={"section": "user_goals", "content": "Goal"},
        )

        assert response.status_code == 201
        assert response.json()["order"] == 1

    def test_create_requirement_all_sections(self, test_client: TestClient, test_db: Session) -> None:
        """Test creating requirements in all 9 sections."""
        project_id = _create_project(test_client)

        sections = [
            "problems",
            "user_goals",
            "functional_requirements",
            "data_needs",
            "constraints",
            "non_goals",
            "risks_assumptions",
            "open_questions",
            "action_items",
        ]

        for section in sections:
            response = test_client.post(
                f"/api/projects/{project_id}/requirements",
                json={"section": section, "content": f"Content for {section}"},
            )
            assert response.status_code == 201, f"Failed to create requirement in {section}"
            assert response.json()["section"] == section

    def test_create_requirement_404_project_not_found(self, test_client: TestClient) -> None:
        """Test creating requirement for non-existent project returns 404."""
        fake_project_id = "00000000-0000-0000-0000-000000000000"

        response = test_client.post(
            f"/api/projects/{fake_project_id}/requirements",
            json={"section": "problems", "content": "Test content"},
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Project not found"

    def test_create_requirement_invalid_section(self, test_client: TestClient, test_db: Session) -> None:
        """Test creating requirement with invalid section returns 422."""
        project_id = _create_project(test_client)

        response = test_client.post(
            f"/api/projects/{project_id}/requirements",
            json={"section": "invalid_section", "content": "Test content"},
        )

        assert response.status_code == 422

    def test_create_requirement_missing_content(self, test_client: TestClient, test_db: Session) -> None:
        """Test creating requirement without content returns 422."""
        project_id = _create_project(test_client)

        response = test_client.post(
            f"/api/projects/{project_id}/requirements",
            json={"section": "problems"},
        )

        assert response.status_code == 422

    def test_create_requirement_missing_section(self, test_client: TestClient, test_db: Session) -> None:
        """Test creating requirement without section returns 422."""
        project_id = _create_project(test_client)

        response = test_client.post(
            f"/api/projects/{project_id}/requirements",
            json={"content": "Test content"},
        )

        assert response.status_code == 422


# =============================================================================
# REQUIREMENTS STATUS TRANSITION TESTS
# =============================================================================

class TestRequirementsStatusTransitions:
    """Tests for automatic requirements_status updates via API."""

    def test_create_requirement_updates_status_to_has_items(self, test_client: TestClient, test_db: Session) -> None:
        """Test that creating a requirement updates project status from empty to has_items."""
        project_id = _create_project(test_client)

        # Verify initial status is empty
        project = test_db.query(Project).filter(Project.id == project_id).first()
        assert project.requirements_status == RequirementsStatus.empty

        # Create a requirement
        test_client.post(
            f"/api/projects/{project_id}/requirements",
            json={"section": "problems", "content": "A problem"},
        )

        # Refresh and check status updated
        test_db.refresh(project)
        assert project.requirements_status == RequirementsStatus.has_items

    def test_delete_last_requirement_updates_status_to_empty(self, test_client: TestClient, test_db: Session) -> None:
        """Test that deleting the last requirement updates project status to empty."""
        project_id = _create_project(test_client)

        # Create a requirement directly
        req_id = _create_requirement(test_db, project_id, Section.problems, "Only item")

        # Set status to has_items to simulate normal flow
        project = test_db.query(Project).filter(Project.id == project_id).first()
        project.requirements_status = RequirementsStatus.has_items
        test_db.commit()

        # Delete the requirement
        test_client.delete(f"/api/requirements/{req_id}")

        # Refresh and check status is empty
        test_db.refresh(project)
        assert project.requirements_status == RequirementsStatus.empty

    def test_delete_does_not_change_status_if_items_remain(self, test_client: TestClient, test_db: Session) -> None:
        """Test that deleting a requirement keeps has_items status if other items exist."""
        project_id = _create_project(test_client)

        # Create two requirements
        req1_id = _create_requirement(test_db, project_id, Section.problems, "First")
        _create_requirement(test_db, project_id, Section.problems, "Second", order=2)

        # Set status to has_items
        project = test_db.query(Project).filter(Project.id == project_id).first()
        project.requirements_status = RequirementsStatus.has_items
        test_db.commit()

        # Delete one requirement
        test_client.delete(f"/api/requirements/{req1_id}")

        # Status should remain has_items
        test_db.refresh(project)
        assert project.requirements_status == RequirementsStatus.has_items

    def test_create_does_not_downgrade_reviewed_status(self, test_client: TestClient, test_db: Session) -> None:
        """Test that creating a requirement does not downgrade reviewed status."""
        project_id = _create_project(test_client)

        # Create initial requirement and set to reviewed
        _create_requirement(test_db, project_id, Section.problems, "Initial")
        project = test_db.query(Project).filter(Project.id == project_id).first()
        project.requirements_status = RequirementsStatus.reviewed
        test_db.commit()

        # Create another requirement via API
        test_client.post(
            f"/api/projects/{project_id}/requirements",
            json={"section": "user_goals", "content": "New goal"},
        )

        # Status should remain reviewed
        test_db.refresh(project)
        assert project.requirements_status == RequirementsStatus.reviewed

    def test_delete_reviewed_with_remaining_items_keeps_reviewed(self, test_client: TestClient, test_db: Session) -> None:
        """Test that deleting a requirement from reviewed project keeps reviewed status if items remain."""
        project_id = _create_project(test_client)

        # Create two requirements
        req1_id = _create_requirement(test_db, project_id, Section.problems, "First")
        _create_requirement(test_db, project_id, Section.problems, "Second", order=2)

        # Set status to reviewed
        project = test_db.query(Project).filter(Project.id == project_id).first()
        project.requirements_status = RequirementsStatus.reviewed
        test_db.commit()

        # Delete one requirement
        test_client.delete(f"/api/requirements/{req1_id}")

        # Status should remain reviewed
        test_db.refresh(project)
        assert project.requirements_status == RequirementsStatus.reviewed


# =============================================================================
# UPDATE REQUIREMENT TESTS
# =============================================================================

class TestUpdateRequirement:
    """Tests for PUT /api/requirements/{id}."""

    def test_update_requirement_success(self, test_client: TestClient, test_db: Session) -> None:
        """Test updating a requirement's content."""
        project_id = _create_project(test_client)
        req_id = _create_requirement(test_db, project_id, Section.problems, "Original content")

        response = test_client.put(
            f"/api/requirements/{req_id}",
            json={"content": "Updated content"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Updated content"
        assert data["id"] == req_id

    def test_update_requirement_records_history(self, test_client: TestClient, test_db: Session) -> None:
        """Test that updating a requirement records the change in history."""
        project_id = _create_project(test_client)
        req_id = _create_requirement(test_db, project_id, Section.problems, "Original content")

        test_client.put(
            f"/api/requirements/{req_id}",
            json={"content": "Updated content"},
        )

        # Check history was recorded
        history = test_db.query(RequirementHistory).filter(
            RequirementHistory.requirement_id == req_id
        ).all()
        assert len(history) == 1
        assert history[0].actor == Actor.user
        assert history[0].action == Action.modified
        assert history[0].old_content == "Original content"
        assert history[0].new_content == "Updated content"

    def test_update_requirement_increments_history_count(self, test_client: TestClient, test_db: Session) -> None:
        """Test that updating multiple times increments history_count."""
        project_id = _create_project(test_client)
        req_id = _create_requirement(test_db, project_id, Section.problems, "v1")

        # First update
        test_client.put(f"/api/requirements/{req_id}", json={"content": "v2"})
        # Second update
        response = test_client.put(f"/api/requirements/{req_id}", json={"content": "v3"})

        data = response.json()
        assert data["history_count"] == 2

    def test_update_requirement_404_not_found(self, test_client: TestClient) -> None:
        """Test updating a non-existent requirement returns 404."""
        fake_req_id = "00000000-0000-0000-0000-000000000000"

        response = test_client.put(
            f"/api/requirements/{fake_req_id}",
            json={"content": "New content"},
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Requirement not found"


# =============================================================================
# DELETE (SOFT-DELETE) REQUIREMENT TESTS
# =============================================================================

class TestDeleteRequirement:
    """Tests for DELETE /api/requirements/{id}."""

    def test_delete_requirement_success(self, test_client: TestClient, test_db: Session) -> None:
        """Test soft-deleting a requirement."""
        project_id = _create_project(test_client)
        req_id = _create_requirement(test_db, project_id, Section.problems, "To be deleted")

        response = test_client.delete(f"/api/requirements/{req_id}")

        assert response.status_code == 204

        # Verify requirement is soft-deleted (is_active=False)
        req = test_db.query(Requirement).filter(Requirement.id == req_id).first()
        assert req is not None
        assert req.is_active is False

    def test_delete_requirement_records_history(self, test_client: TestClient, test_db: Session) -> None:
        """Test that deleting a requirement records the change in history."""
        project_id = _create_project(test_client)
        req_id = _create_requirement(test_db, project_id, Section.problems, "To be deleted")

        test_client.delete(f"/api/requirements/{req_id}")

        # Check history was recorded
        history = test_db.query(RequirementHistory).filter(
            RequirementHistory.requirement_id == req_id
        ).all()
        assert len(history) == 1
        assert history[0].actor == Actor.user
        assert history[0].action == Action.deactivated
        assert history[0].old_content == "To be deleted"
        assert history[0].new_content is None

    def test_delete_requirement_excludes_from_list(self, test_client: TestClient, test_db: Session) -> None:
        """Test that deleted requirement is excluded from list."""
        project_id = _create_project(test_client)
        _create_requirement(test_db, project_id, Section.problems, "Kept")
        req_id = _create_requirement(test_db, project_id, Section.problems, "To be deleted", order=2)

        test_client.delete(f"/api/requirements/{req_id}")

        response = test_client.get(f"/api/projects/{project_id}/requirements")
        data = response.json()
        assert len(data["problems"]) == 1
        assert data["problems"][0]["content"] == "Kept"

    def test_delete_requirement_404_not_found(self, test_client: TestClient) -> None:
        """Test deleting a non-existent requirement returns 404."""
        fake_req_id = "00000000-0000-0000-0000-000000000000"

        response = test_client.delete(f"/api/requirements/{fake_req_id}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Requirement not found"


# =============================================================================
# REORDER REQUIREMENTS TESTS
# =============================================================================

class TestReorderRequirements:
    """Tests for PUT /api/projects/{id}/requirements/reorder."""

    def test_reorder_requirements_success(self, test_client: TestClient, test_db: Session) -> None:
        """Test reordering requirements within a section."""
        project_id = _create_project(test_client)

        req1_id = _create_requirement(test_db, project_id, Section.problems, "First", order=1)
        req2_id = _create_requirement(test_db, project_id, Section.problems, "Second", order=2)
        req3_id = _create_requirement(test_db, project_id, Section.problems, "Third", order=3)

        # Reorder: Third, First, Second
        response = test_client.put(
            f"/api/projects/{project_id}/requirements/reorder",
            json={"section": "problems", "requirement_ids": [req3_id, req1_id, req2_id]},
        )

        assert response.status_code == 200
        assert response.json()["success"] == "true"

        # Verify order in database
        reqs = test_db.query(Requirement).filter(
            Requirement.project_id == project_id,
            Requirement.section == Section.problems,
        ).order_by(Requirement.order).all()

        assert reqs[0].content == "Third"
        assert reqs[0].order == 1
        assert reqs[1].content == "First"
        assert reqs[1].order == 2
        assert reqs[2].content == "Second"
        assert reqs[2].order == 3

    def test_reorder_requirements_persists_in_list(self, test_client: TestClient, test_db: Session) -> None:
        """Test that reordering is reflected in the list endpoint."""
        project_id = _create_project(test_client)

        req1_id = _create_requirement(test_db, project_id, Section.problems, "A", order=1)
        req2_id = _create_requirement(test_db, project_id, Section.problems, "B", order=2)

        # Swap order: B, A
        test_client.put(
            f"/api/projects/{project_id}/requirements/reorder",
            json={"section": "problems", "requirement_ids": [req2_id, req1_id]},
        )

        # Check list endpoint shows new order
        response = test_client.get(f"/api/projects/{project_id}/requirements")
        data = response.json()
        assert data["problems"][0]["content"] == "B"
        assert data["problems"][1]["content"] == "A"

    def test_reorder_requirements_only_affects_section(self, test_client: TestClient, test_db: Session) -> None:
        """Test that reordering only affects items in the specified section."""
        project_id = _create_project(test_client)

        req1_id = _create_requirement(test_db, project_id, Section.problems, "P1", order=1)
        req2_id = _create_requirement(test_db, project_id, Section.problems, "P2", order=2)
        _create_requirement(test_db, project_id, Section.constraints, "C1", order=1)

        # Reorder problems only
        test_client.put(
            f"/api/projects/{project_id}/requirements/reorder",
            json={"section": "problems", "requirement_ids": [req2_id, req1_id]},
        )

        # Check constraints section is unchanged
        response = test_client.get(f"/api/projects/{project_id}/requirements")
        data = response.json()
        assert len(data["constraints"]) == 1
        assert data["constraints"][0]["content"] == "C1"

    def test_reorder_requirements_404_project_not_found(self, test_client: TestClient) -> None:
        """Test reordering requirements in non-existent project returns 404."""
        fake_project_id = "00000000-0000-0000-0000-000000000000"

        response = test_client.put(
            f"/api/projects/{fake_project_id}/requirements/reorder",
            json={"section": "problems", "requirement_ids": []},
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Project not found"


# =============================================================================
# EXPORT REQUIREMENTS TESTS
# =============================================================================

class TestExportRequirements:
    """Tests for GET /api/projects/{id}/requirements/export."""

    def test_export_format_header(self, test_client: TestClient, test_db: Session) -> None:
        """Test that export contains proper header with project name."""
        project_id = _create_project(test_client)
        _create_requirement(test_db, project_id, Section.problems, "A problem")

        response = test_client.get(f"/api/projects/{project_id}/requirements/export")

        assert response.status_code == 200
        content = response.text
        assert "# Test Project - Working Requirements" in content
        assert "*Generated on" in content

    def test_export_format_sections(self, test_client: TestClient, test_db: Session) -> None:
        """Test that export contains all 9 sections in correct order."""
        project_id = _create_project(test_client)
        _create_requirement(test_db, project_id, Section.problems, "Problem 1")
        _create_requirement(test_db, project_id, Section.user_goals, "Goal 1")

        response = test_client.get(f"/api/projects/{project_id}/requirements/export")
        content = response.text

        # Check all section headers present
        assert "## Problems" in content
        assert "## User Goals" in content
        assert "## Functional Requirements" in content
        assert "## Data Needs" in content
        assert "## Constraints" in content
        assert "## Non-Goals" in content
        assert "## Risks & Assumptions" in content
        assert "## Open Questions" in content
        assert "## Action Items" in content

        # Check requirement content
        assert "- Problem 1" in content
        assert "- Goal 1" in content

    def test_export_format_empty_section(self, test_client: TestClient, test_db: Session) -> None:
        """Test that empty sections show 'No items in this section.'"""
        project_id = _create_project(test_client)
        _create_requirement(test_db, project_id, Section.problems, "Problem 1")

        response = test_client.get(f"/api/projects/{project_id}/requirements/export")
        content = response.text

        # Empty sections should have placeholder
        assert "*No items in this section.*" in content

    def test_export_format_sources_table(self, test_client: TestClient, test_db: Session) -> None:
        """Test that export contains sources table with applied meetings."""
        project_id = _create_project(test_client)
        _create_meeting(test_db, project_id, "Sprint Planning", MeetingStatus.applied)
        _create_meeting(test_db, project_id, "Kickoff", MeetingStatus.applied)

        response = test_client.get(f"/api/projects/{project_id}/requirements/export")
        content = response.text

        # Check sources section
        assert "## Sources" in content
        assert "| Meeting | Date |" in content
        assert "|---------|------|" in content
        assert "Sprint Planning" in content
        assert "Kickoff" in content

    def test_export_format_no_sources(self, test_client: TestClient, test_db: Session) -> None:
        """Test that export handles no applied meetings gracefully."""
        project_id = _create_project(test_client)
        _create_requirement(test_db, project_id, Section.problems, "A problem")

        response = test_client.get(f"/api/projects/{project_id}/requirements/export")
        content = response.text

        assert "*No meetings have been applied yet.*" in content

    def test_export_content_type(self, test_client: TestClient, test_db: Session) -> None:
        """Test that export returns text/markdown content type."""
        project_id = _create_project(test_client)

        response = test_client.get(f"/api/projects/{project_id}/requirements/export")

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/markdown; charset=utf-8"

    def test_export_content_disposition(self, test_client: TestClient, test_db: Session) -> None:
        """Test that export suggests filename based on project name."""
        project_id = _create_project(test_client)

        response = test_client.get(f"/api/projects/{project_id}/requirements/export")

        assert response.status_code == 200
        assert "attachment" in response.headers["content-disposition"]
        assert "test-project-requirements.md" in response.headers["content-disposition"]

    def test_export_404_project_not_found(self, test_client: TestClient) -> None:
        """Test exporting requirements for non-existent project returns 404."""
        fake_project_id = "00000000-0000-0000-0000-000000000000"

        response = test_client.get(f"/api/projects/{fake_project_id}/requirements/export")

        assert response.status_code == 404
        assert response.json()["detail"] == "Project not found"


# =============================================================================
# HISTORY ENDPOINT TESTS
# =============================================================================

class TestRequirementHistory:
    """Tests for GET /api/requirements/{id}/history."""

    def test_get_history_success(self, test_client: TestClient, test_db: Session) -> None:
        """Test getting requirement history."""
        project_id = _create_project(test_client)
        req_id = _create_requirement(test_db, project_id, Section.problems, "Original")

        # Create some history
        test_client.put(f"/api/requirements/{req_id}", json={"content": "Updated"})

        response = test_client.get(f"/api/requirements/{req_id}/history")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["actor"] == "user"
        assert data[0]["action"] == "modified"
        assert data[0]["old_content"] == "Original"
        assert data[0]["new_content"] == "Updated"

    def test_get_history_ordered_desc(self, test_client: TestClient, test_db: Session) -> None:
        """Test that history is ordered by created_at descending (newest first)."""
        project_id = _create_project(test_client)
        req_id = _create_requirement(test_db, project_id, Section.problems, "v1")

        # Create multiple history entries
        test_client.put(f"/api/requirements/{req_id}", json={"content": "v2"})
        test_client.put(f"/api/requirements/{req_id}", json={"content": "v3"})

        response = test_client.get(f"/api/requirements/{req_id}/history")
        data = response.json()

        assert len(data) == 2
        # Newest first
        assert data[0]["new_content"] == "v3"
        assert data[1]["new_content"] == "v2"

    def test_get_history_404_not_found(self, test_client: TestClient) -> None:
        """Test getting history for non-existent requirement returns 404."""
        fake_req_id = "00000000-0000-0000-0000-000000000000"

        response = test_client.get(f"/api/requirements/{fake_req_id}/history")

        assert response.status_code == 404
        assert response.json()["detail"] == "Requirement not found"

    def test_get_history_empty(self, test_client: TestClient, test_db: Session) -> None:
        """Test getting history for requirement with no changes."""
        project_id = _create_project(test_client)
        req_id = _create_requirement(test_db, project_id, Section.problems, "No changes")

        response = test_client.get(f"/api/requirements/{req_id}/history")

        assert response.status_code == 200
        assert response.json() == []
