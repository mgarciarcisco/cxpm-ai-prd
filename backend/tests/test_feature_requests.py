"""Tests for Feature Request API endpoints."""
from fastapi.testclient import TestClient


def _create_feature_request(client, title="Test Feature", desc="A description", category="requirements"):
    return client.post("/api/feature-requests", json={
        "title": title,
        "description": desc,
        "category": category,
    })


class TestCreateFeatureRequest:
    def test_create_success(self, auth_client):
        resp = _create_feature_request(auth_client)
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Test Feature"
        assert data["status"] == "submitted"
        assert data["upvote_count"] == 0

    def test_create_with_all_categories(self, auth_client):
        for cat in ["requirements", "jira_integration", "export", "ui_ux", "new_capability"]:
            resp = _create_feature_request(auth_client, title=f"Test {cat}", category=cat)
            assert resp.status_code == 201

    def test_create_invalid_category(self, auth_client):
        resp = auth_client.post("/api/feature-requests", json={
            "title": "Bad", "description": "Desc", "category": "invalid"
        })
        assert resp.status_code == 422


class TestListFeatureRequests:
    def test_list_empty(self, auth_client):
        resp = auth_client.get("/api/feature-requests")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_list_with_items(self, auth_client):
        _create_feature_request(auth_client, title="FR 1")
        _create_feature_request(auth_client, title="FR 2")
        resp = auth_client.get("/api/feature-requests")
        assert resp.status_code == 200
        assert resp.json()["total"] == 2

    def test_list_filter_by_category(self, auth_client):
        _create_feature_request(auth_client, title="Export FR", category="export")
        _create_feature_request(auth_client, title="UI FR", category="ui_ux")
        resp = auth_client.get("/api/feature-requests?category=export")
        assert resp.status_code == 200
        assert all(item["category"] == "export" for item in resp.json()["items"])

    def test_list_sort_most_upvoted(self, auth_client):
        resp = auth_client.get("/api/feature-requests?sort=most_upvoted")
        assert resp.status_code == 200


class TestGetFeatureRequest:
    def test_get_by_id(self, auth_client):
        create_resp = _create_feature_request(auth_client)
        fr_id = create_resp.json()["id"]
        resp = auth_client.get(f"/api/feature-requests/{fr_id}")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Test Feature"

    def test_get_nonexistent(self, auth_client):
        resp = auth_client.get("/api/feature-requests/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


class TestUpvote:
    def test_toggle_upvote(self, auth_client):
        create_resp = _create_feature_request(auth_client)
        fr_id = create_resp.json()["id"]

        # First toggle - upvote
        resp = auth_client.post(f"/api/feature-requests/{fr_id}/upvote")
        assert resp.status_code == 200
        assert resp.json()["upvoted"] is True
        assert resp.json()["upvote_count"] == 1

        # Second toggle - remove upvote
        resp = auth_client.post(f"/api/feature-requests/{fr_id}/upvote")
        assert resp.status_code == 200
        assert resp.json()["upvoted"] is False
        assert resp.json()["upvote_count"] == 0


class TestComments:
    def test_add_comment(self, auth_client):
        create_resp = _create_feature_request(auth_client)
        fr_id = create_resp.json()["id"]
        resp = auth_client.post(f"/api/feature-requests/{fr_id}/comments", json={"content": "Great idea!"})
        assert resp.status_code == 201
        assert resp.json()["content"] == "Great idea!"
        assert resp.json()["user_name"] == "Test User"

    def test_list_comments(self, auth_client):
        create_resp = _create_feature_request(auth_client)
        fr_id = create_resp.json()["id"]
        auth_client.post(f"/api/feature-requests/{fr_id}/comments", json={"content": "Comment 1"})
        auth_client.post(f"/api/feature-requests/{fr_id}/comments", json={"content": "Comment 2"})
        resp = auth_client.get(f"/api/feature-requests/{fr_id}/comments")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_admin_update_comment(self, admin_client):
        """Admin can edit a comment."""
        create_resp = _create_feature_request(admin_client)
        fr_id = create_resp.json()["id"]
        comment_resp = admin_client.post(f"/api/feature-requests/{fr_id}/comments", json={"content": "Original"})
        comment_id = comment_resp.json()["id"]
        resp = admin_client.put(f"/api/feature-requests/{fr_id}/comments/{comment_id}", json={"content": "Updated"})
        assert resp.status_code == 200
        assert resp.json()["content"] == "Updated"

    def test_admin_delete_comment(self, admin_client):
        """Admin can delete a comment."""
        create_resp = _create_feature_request(admin_client)
        fr_id = create_resp.json()["id"]
        comment_resp = admin_client.post(f"/api/feature-requests/{fr_id}/comments", json={"content": "To delete"})
        comment_id = comment_resp.json()["id"]
        resp = admin_client.delete(f"/api/feature-requests/{fr_id}/comments/{comment_id}")
        assert resp.status_code == 204

    def test_non_admin_cannot_update_comment(self, auth_client):
        """Non-admin gets 403 when trying to edit a comment."""
        create_resp = _create_feature_request(auth_client)
        fr_id = create_resp.json()["id"]
        comment_resp = auth_client.post(f"/api/feature-requests/{fr_id}/comments", json={"content": "Original"})
        comment_id = comment_resp.json()["id"]
        resp = auth_client.put(f"/api/feature-requests/{fr_id}/comments/{comment_id}", json={"content": "Updated"})
        assert resp.status_code == 403

    def test_non_admin_cannot_delete_comment(self, auth_client):
        """Non-admin gets 403 when trying to delete a comment."""
        create_resp = _create_feature_request(auth_client)
        fr_id = create_resp.json()["id"]
        comment_resp = auth_client.post(f"/api/feature-requests/{fr_id}/comments", json={"content": "To delete"})
        comment_id = comment_resp.json()["id"]
        resp = auth_client.delete(f"/api/feature-requests/{fr_id}/comments/{comment_id}")
        assert resp.status_code == 403


class TestAdminFeatureControls:
    def test_admin_update_status(self, admin_client):
        create_resp = _create_feature_request(admin_client)
        fr_id = create_resp.json()["id"]
        resp = admin_client.patch(f"/api/feature-requests/{fr_id}/status", json={
            "status": "planned",
            "admin_response": "We'll build this in Q2",
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "planned"
        assert resp.json()["admin_response"] == "We'll build this in Q2"

    def test_non_admin_cannot_update_status(self, auth_client):
        create_resp = _create_feature_request(auth_client)
        fr_id = create_resp.json()["id"]
        resp = auth_client.patch(f"/api/feature-requests/{fr_id}/status", json={"status": "planned"})
        assert resp.status_code == 403

    def test_admin_delete(self, admin_client):
        create_resp = _create_feature_request(admin_client)
        fr_id = create_resp.json()["id"]
        resp = admin_client.delete(f"/api/feature-requests/{fr_id}")
        assert resp.status_code == 204
        # Verify deleted
        resp = admin_client.get(f"/api/feature-requests/{fr_id}")
        assert resp.status_code == 404
