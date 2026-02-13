"""Tests for Bug Report API endpoints."""
import io

from fastapi.testclient import TestClient


class TestSubmitBugReport:
    """Tests for POST /api/bug-reports."""

    def test_submit_basic_bug_report(self, auth_client):
        """Submit a bug report with required fields only."""
        resp = auth_client.post("/api/bug-reports", data={
            "title": "Login button broken",
            "description": "The login button doesn't respond to clicks",
            "severity": "major",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Login button broken"
        assert data["severity"] == "major"
        assert data["status"] == "open"
        assert data["has_screenshot"] is False
        assert "id" in data

    def test_submit_with_all_fields(self, auth_client):
        """Submit a bug report with all optional fields."""
        resp = auth_client.post("/api/bug-reports", data={
            "title": "Page crash",
            "description": "Dashboard crashes on load",
            "severity": "blocker",
            "steps_to_reproduce": "1. Go to dashboard\n2. Wait 3 seconds",
            "page_url": "/dashboard",
            "browser_info": "Chrome 120",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["steps_to_reproduce"] == "1. Go to dashboard\n2. Wait 3 seconds"
        assert data["page_url"] == "/dashboard"
        assert data["browser_info"] == "Chrome 120"

    def test_submit_with_screenshot(self, auth_client):
        """Submit a bug report with a screenshot upload."""
        image_content = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100  # Minimal PNG-like bytes
        resp = auth_client.post("/api/bug-reports", data={
            "title": "Visual glitch",
            "description": "Button misaligned",
            "severity": "minor",
        }, files={"screenshot": ("test.png", io.BytesIO(image_content), "image/png")})
        assert resp.status_code == 201
        assert resp.json()["has_screenshot"] is True

    def test_submit_invalid_severity(self, auth_client):
        """Submit with invalid severity returns 400."""
        resp = auth_client.post("/api/bug-reports", data={
            "title": "Test",
            "description": "Test desc",
            "severity": "critical",  # Not a valid value
        })
        assert resp.status_code == 400

    def test_submit_invalid_file_type(self, auth_client):
        """Submit with non-image file returns 400."""
        resp = auth_client.post("/api/bug-reports", data={
            "title": "Test",
            "description": "Test desc",
            "severity": "minor",
        }, files={"screenshot": ("test.pdf", io.BytesIO(b"pdf content"), "application/pdf")})
        assert resp.status_code == 400


class TestListMyBugs:
    """Tests for GET /api/bug-reports/mine."""

    def test_list_own_bugs(self, auth_client):
        """List current user's bug reports."""
        # Create a bug first
        auth_client.post("/api/bug-reports", data={
            "title": "My bug",
            "description": "Description",
            "severity": "minor",
        })
        resp = auth_client.get("/api/bug-reports/mine")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert len(data["items"]) >= 1
        assert data["items"][0]["title"] == "My bug"

    def test_list_pagination(self, auth_client):
        """Pagination works correctly."""
        resp = auth_client.get("/api/bug-reports/mine?page=1&per_page=5")
        assert resp.status_code == 200
        data = resp.json()
        assert data["page"] == 1
        assert data["per_page"] == 5


class TestListAllBugs:
    """Tests for GET /api/bug-reports (admin only)."""

    def test_admin_can_list_all(self, admin_client):
        """Admin can list all bug reports."""
        admin_client.post("/api/bug-reports", data={
            "title": "Admin bug",
            "description": "Desc",
            "severity": "minor",
        })
        resp = admin_client.get("/api/bug-reports")
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    def test_non_admin_cannot_list_all(self, auth_client):
        """Non-admin gets 403."""
        resp = auth_client.get("/api/bug-reports")
        assert resp.status_code == 403

    def test_filter_by_status(self, admin_client):
        """Filter by status works."""
        admin_client.post("/api/bug-reports", data={
            "title": "Status test",
            "description": "Desc",
            "severity": "minor",
        })
        resp = admin_client.get("/api/bug-reports?status_filter=open")
        assert resp.status_code == 200

    def test_filter_by_severity(self, admin_client):
        """Filter by severity works."""
        resp = admin_client.get("/api/bug-reports?severity=blocker")
        assert resp.status_code == 200


class TestGetBugReport:
    """Tests for GET /api/bug-reports/{id}."""

    def test_get_own_bug(self, auth_client):
        """Reporter can view their own bug."""
        create_resp = auth_client.post("/api/bug-reports", data={
            "title": "Get test",
            "description": "Desc",
            "severity": "minor",
        })
        bug_id = create_resp.json()["id"]
        resp = auth_client.get(f"/api/bug-reports/{bug_id}")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Get test"

    def test_get_nonexistent_returns_404(self, auth_client):
        """Getting a non-existent bug returns 404."""
        resp = auth_client.get("/api/bug-reports/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


class TestUpdateBugStatus:
    """Tests for PATCH /api/bug-reports/{id}/status."""

    def test_admin_can_update_status(self, admin_client):
        """Admin can change bug status."""
        create_resp = admin_client.post("/api/bug-reports", data={
            "title": "Status update test",
            "description": "Desc",
            "severity": "major",
        })
        bug_id = create_resp.json()["id"]
        resp = admin_client.patch(f"/api/bug-reports/{bug_id}/status", json={"status": "investigating"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "investigating"

    def test_non_admin_cannot_update_status(self, auth_client):
        """Non-admin gets 403."""
        create_resp = auth_client.post("/api/bug-reports", data={
            "title": "No access",
            "description": "Desc",
            "severity": "minor",
        })
        bug_id = create_resp.json()["id"]
        resp = auth_client.patch(f"/api/bug-reports/{bug_id}/status", json={"status": "fixed"})
        assert resp.status_code == 403

    def test_status_change_creates_notification(self, admin_client, test_db):
        """Changing status creates a notification for the reporter."""
        create_resp = admin_client.post("/api/bug-reports", data={
            "title": "Notification test",
            "description": "Desc",
            "severity": "minor",
        })
        bug_id = create_resp.json()["id"]
        admin_client.patch(f"/api/bug-reports/{bug_id}/status", json={"status": "fixed"})

        from app.models.notification import Notification
        notifications = test_db.query(Notification).all()
        assert len(notifications) >= 1
        assert any(n.resource_id == bug_id for n in notifications)
