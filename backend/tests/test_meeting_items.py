"""Tests for MeetingItem endpoints."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import MeetingItem, MeetingRecap
from app.models.meeting_item import Section
from app.models.meeting_recap import MeetingStatus


def _create_project(auth_client: TestClient) -> str:
    """Helper to create a project and return its ID."""
    response = auth_client.post(
        "/api/projects",
        json={"name": "Test Project", "description": "For meeting item tests"},
    )
    return response.json()["id"]


def _create_meeting(auth_client: TestClient, project_id: str) -> str:
    """Helper to create a meeting and return its ID."""
    response = auth_client.post(
        "/api/meetings/upload",
        data={
            "project_id": project_id,
            "title": "Test Meeting",
            "meeting_date": "2026-01-22",
            "text": "Test meeting content",
        },
    )
    return response.json()["meeting_id"]


def _set_meeting_status(test_db: Session, meeting_id: str, status: MeetingStatus) -> None:
    """Helper to set meeting status directly in the database."""
    meeting = test_db.query(MeetingRecap).filter(MeetingRecap.id == meeting_id).first()
    if meeting:
        meeting.status = status  # type: ignore[assignment]
        test_db.commit()


def _create_meeting_item(
    test_db: Session, meeting_id: str, section: Section, content: str, order: int = 1
) -> str:
    """Helper to create a meeting item directly in the database and return its ID."""
    item = MeetingItem(
        meeting_id=meeting_id,
        section=section,
        content=content,
        order=order,
    )
    test_db.add(item)
    test_db.commit()
    test_db.refresh(item)
    return str(item.id)


# =============================================================================
# UPDATE ITEM TESTS
# =============================================================================

class TestUpdateMeetingItem:
    """Tests for PUT /api/meeting-items/{id}."""

    def test_update_item_success(self, auth_client: TestClient, test_db: Session) -> None:
        """Test updating a meeting item's content."""
        project_id = _create_project(auth_client)
        meeting_id = _create_meeting(auth_client, project_id)
        _set_meeting_status(test_db, meeting_id, MeetingStatus.processed)
        item_id = _create_meeting_item(test_db, meeting_id, Section.needs_and_goals, "Original content")

        response = auth_client.put(
            f"/api/meeting-items/{item_id}",
            json={"content": "Updated content"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Updated content"
        assert data["id"] == item_id
        assert data["section"] == "needs_and_goals"

    def test_update_item_404_not_found(self, auth_client: TestClient) -> None:
        """Test updating a non-existent meeting item returns 404."""
        fake_item_id = "00000000-0000-0000-0000-000000000000"

        response = auth_client.put(
            f"/api/meeting-items/{fake_item_id}",
            json={"content": "New content"},
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Meeting item not found"

    def test_update_item_400_meeting_not_processed(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test updating item when meeting status is not processed returns 400."""
        project_id = _create_project(auth_client)
        meeting_id = _create_meeting(auth_client, project_id)
        # Meeting is in pending status by default
        item_id = _create_meeting_item(test_db, meeting_id, Section.needs_and_goals, "Content")

        response = auth_client.put(
            f"/api/meeting-items/{item_id}",
            json={"content": "New content"},
        )

        assert response.status_code == 400
        assert "processed" in response.json()["detail"].lower()


# =============================================================================
# DELETE (SOFT-DELETE) ITEM TESTS
# =============================================================================

class TestDeleteMeetingItem:
    """Tests for DELETE /api/meeting-items/{id}."""

    def test_delete_item_success(self, auth_client: TestClient, test_db: Session) -> None:
        """Test soft-deleting a meeting item."""
        project_id = _create_project(auth_client)
        meeting_id = _create_meeting(auth_client, project_id)
        _set_meeting_status(test_db, meeting_id, MeetingStatus.processed)
        item_id = _create_meeting_item(test_db, meeting_id, Section.requirements, "Goal content")

        response = auth_client.delete(f"/api/meeting-items/{item_id}")

        assert response.status_code == 204

        # Verify item is soft-deleted in database
        item = test_db.query(MeetingItem).filter(MeetingItem.id == item_id).first()
        assert item is not None
        assert item.is_deleted is True

    def test_delete_item_removed_from_meeting_items(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that soft-deleted item is not returned in meeting items list."""
        project_id = _create_project(auth_client)
        meeting_id = _create_meeting(auth_client, project_id)
        _set_meeting_status(test_db, meeting_id, MeetingStatus.processed)
        item_id = _create_meeting_item(test_db, meeting_id, Section.needs_and_goals, "Deleted item")
        _create_meeting_item(test_db, meeting_id, Section.needs_and_goals, "Kept item", order=2)

        # Delete one item
        auth_client.delete(f"/api/meeting-items/{item_id}")

        # Get meeting and verify deleted item is excluded
        response = auth_client.get(f"/api/meetings/{meeting_id}")
        assert response.status_code == 200
        items = response.json()["items"]
        assert len(items) == 1
        assert items[0]["content"] == "Kept item"

    def test_delete_item_404_not_found(self, auth_client: TestClient) -> None:
        """Test deleting a non-existent meeting item returns 404."""
        fake_item_id = "00000000-0000-0000-0000-000000000000"

        response = auth_client.delete(f"/api/meeting-items/{fake_item_id}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Meeting item not found"

    def test_delete_item_400_meeting_not_processed(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test deleting item when meeting status is not processed returns 400."""
        project_id = _create_project(auth_client)
        meeting_id = _create_meeting(auth_client, project_id)
        # Meeting is in pending status by default
        item_id = _create_meeting_item(test_db, meeting_id, Section.scope_and_constraints, "Content")

        response = auth_client.delete(f"/api/meeting-items/{item_id}")

        assert response.status_code == 400
        assert "processed" in response.json()["detail"].lower()


# =============================================================================
# ADD ITEM TESTS
# =============================================================================

class TestAddMeetingItem:
    """Tests for POST /api/meetings/{id}/items."""

    def test_add_item_success(self, auth_client: TestClient, test_db: Session) -> None:
        """Test adding a new item to a meeting."""
        project_id = _create_project(auth_client)
        meeting_id = _create_meeting(auth_client, project_id)
        _set_meeting_status(test_db, meeting_id, MeetingStatus.processed)

        response = auth_client.post(
            f"/api/meetings/{meeting_id}/items",
            json={"section": "requirements", "content": "New requirement"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["section"] == "requirements"
        assert data["content"] == "New requirement"
        assert data["order"] == 1
        assert "id" in data

    def test_add_item_order_increments(self, auth_client: TestClient, test_db: Session) -> None:
        """Test that order is set to max(order) + 1 for the section."""
        project_id = _create_project(auth_client)
        meeting_id = _create_meeting(auth_client, project_id)
        _set_meeting_status(test_db, meeting_id, MeetingStatus.processed)

        # Add first item
        response1 = auth_client.post(
            f"/api/meetings/{meeting_id}/items",
            json={"section": "needs_and_goals", "content": "First problem"},
        )
        assert response1.json()["order"] == 1

        # Add second item in same section
        response2 = auth_client.post(
            f"/api/meetings/{meeting_id}/items",
            json={"section": "needs_and_goals", "content": "Second problem"},
        )
        assert response2.json()["order"] == 2

        # Add item in different section (should reset order)
        response3 = auth_client.post(
            f"/api/meetings/{meeting_id}/items",
            json={"section": "scope_and_constraints", "content": "First constraint"},
        )
        assert response3.json()["order"] == 1

    def test_add_item_404_meeting_not_found(self, auth_client: TestClient) -> None:
        """Test adding item to non-existent meeting returns 404."""
        fake_meeting_id = "00000000-0000-0000-0000-000000000000"

        response = auth_client.post(
            f"/api/meetings/{fake_meeting_id}/items",
            json={"section": "needs_and_goals", "content": "Content"},
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Meeting not found"

    def test_add_item_400_meeting_not_processed(
        self, auth_client: TestClient
    ) -> None:
        """Test adding item when meeting status is not processed returns 400."""
        project_id = _create_project(auth_client)
        meeting_id = _create_meeting(auth_client, project_id)
        # Meeting is in pending status by default

        response = auth_client.post(
            f"/api/meetings/{meeting_id}/items",
            json={"section": "needs_and_goals", "content": "Content"},
        )

        assert response.status_code == 400
        assert "processed" in response.json()["detail"].lower()


# =============================================================================
# STATUS VALIDATION TESTS (ADDITIONAL)
# =============================================================================

class TestStatusValidation:
    """Additional tests for status validation across all endpoints."""

    def test_update_fails_on_processing_status(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that update fails when meeting is in processing status."""
        project_id = _create_project(auth_client)
        meeting_id = _create_meeting(auth_client, project_id)
        _set_meeting_status(test_db, meeting_id, MeetingStatus.processing)
        item_id = _create_meeting_item(test_db, meeting_id, Section.needs_and_goals, "Content")

        response = auth_client.put(
            f"/api/meeting-items/{item_id}",
            json={"content": "New content"},
        )

        assert response.status_code == 400

    def test_delete_fails_on_failed_status(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that delete fails when meeting is in failed status."""
        project_id = _create_project(auth_client)
        meeting_id = _create_meeting(auth_client, project_id)
        _set_meeting_status(test_db, meeting_id, MeetingStatus.failed)
        item_id = _create_meeting_item(test_db, meeting_id, Section.needs_and_goals, "Content")

        response = auth_client.delete(f"/api/meeting-items/{item_id}")

        assert response.status_code == 400

    def test_add_fails_on_applied_status(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that add fails when meeting is in applied status."""
        project_id = _create_project(auth_client)
        meeting_id = _create_meeting(auth_client, project_id)
        _set_meeting_status(test_db, meeting_id, MeetingStatus.applied)

        response = auth_client.post(
            f"/api/meetings/{meeting_id}/items",
            json={"section": "needs_and_goals", "content": "Content"},
        )

        assert response.status_code == 400

