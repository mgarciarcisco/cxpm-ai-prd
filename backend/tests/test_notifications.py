"""Tests for Notification API endpoints."""
from fastapi.testclient import TestClient

from app.models.notification import Notification, NotificationType


def _create_notification(test_db, user_id, title="Test Notification", is_read=False):
    """Helper to create a notification directly in the DB."""
    n = Notification(
        user_id=user_id,
        type=NotificationType.bug_status_change,
        title=title,
        message="Test message",
        is_read=is_read,
    )
    test_db.add(n)
    test_db.commit()
    test_db.refresh(n)
    return n


class TestUnreadCount:
    def test_unread_count_zero(self, auth_client):
        resp = auth_client.get("/api/notifications/unread-count")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    def test_unread_count_with_notifications(self, auth_client, test_db, test_user):
        _create_notification(test_db, test_user.id)
        _create_notification(test_db, test_user.id)
        _create_notification(test_db, test_user.id, is_read=True)
        resp = auth_client.get("/api/notifications/unread-count")
        assert resp.status_code == 200
        assert resp.json()["count"] == 2


class TestListNotifications:
    def test_list_empty(self, auth_client):
        resp = auth_client.get("/api/notifications")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_list_with_notifications(self, auth_client, test_db, test_user):
        _create_notification(test_db, test_user.id, title="N1")
        _create_notification(test_db, test_user.id, title="N2")
        resp = auth_client.get("/api/notifications")
        assert resp.status_code == 200
        assert resp.json()["total"] == 2

    def test_list_unread_only(self, auth_client, test_db, test_user):
        _create_notification(test_db, test_user.id, title="Unread", is_read=False)
        _create_notification(test_db, test_user.id, title="Read", is_read=True)
        resp = auth_client.get("/api/notifications?unread_only=true")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1
        assert resp.json()["items"][0]["title"] == "Unread"

    def test_pagination(self, auth_client, test_db, test_user):
        for i in range(5):
            _create_notification(test_db, test_user.id, title=f"N{i}")
        resp = auth_client.get("/api/notifications?page=1&per_page=2")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["total"] == 5


class TestMarkRead:
    def test_mark_single_as_read(self, auth_client, test_db, test_user):
        n = _create_notification(test_db, test_user.id)
        resp = auth_client.post(f"/api/notifications/{n.id}/read")
        assert resp.status_code == 200
        # Verify
        count_resp = auth_client.get("/api/notifications/unread-count")
        assert count_resp.json()["count"] == 0

    def test_mark_all_as_read(self, auth_client, test_db, test_user):
        _create_notification(test_db, test_user.id)
        _create_notification(test_db, test_user.id)
        _create_notification(test_db, test_user.id)
        resp = auth_client.post("/api/notifications/mark-all-read")
        assert resp.status_code == 200
        assert "message" in resp.json()
        # Verify
        count_resp = auth_client.get("/api/notifications/unread-count")
        assert count_resp.json()["count"] == 0
