"""Tests for authentication endpoints."""

import pytest


class TestRegister:
    """Tests for POST /api/auth/register."""

    def test_register_success(self, test_client):
        """First user registration succeeds, returns a token, and is auto-approved."""
        resp = test_client.post("/api/auth/register", json={
            "name": "Alice",
            "email": "alice@cisco.com",
            "password": "Password1",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_first_user_is_admin(self, test_client):
        """First registered user should be admin; second user is pending approval."""
        test_client.post("/api/auth/register", json={
            "name": "First",
            "email": "first@cisco.com",
            "password": "Password1",
        })
        # Second user gets pending_approval (no token)
        resp = test_client.post("/api/auth/register", json={
            "name": "Second",
            "email": "second@cisco.com",
            "password": "Password1",
        })
        assert resp.status_code == 201
        assert resp.json()["status"] == "pending_approval"
        assert "access_token" not in resp.json()

        # Login as first to check admin status
        login_resp = test_client.post("/api/auth/login", json={
            "email": "first@cisco.com",
            "password": "Password1",
        })
        token = login_resp.json()["access_token"]
        me_resp = test_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.json()["is_admin"] is True

        # Second user (pending) cannot login - gets 403
        login_resp2 = test_client.post("/api/auth/login", json={
            "email": "second@cisco.com",
            "password": "Password1",
        })
        assert login_resp2.status_code == 403

    def test_register_duplicate_email(self, test_client):
        """Registering with an existing email returns 409."""
        test_client.post("/api/auth/register", json={
            "name": "Alice",
            "email": "alice@cisco.com",
            "password": "Password1",
        })
        resp = test_client.post("/api/auth/register", json={
            "name": "Alice 2",
            "email": "alice@cisco.com",
            "password": "Different1",
        })
        assert resp.status_code == 409

    def test_register_short_password(self, test_client):
        """Password shorter than 8 chars should be rejected (422)."""
        resp = test_client.post("/api/auth/register", json={
            "name": "Alice",
            "email": "alice@cisco.com",
            "password": "Sh1",
        })
        assert resp.status_code == 422


class TestLogin:
    """Tests for POST /api/auth/login."""

    def test_login_success(self, test_client):
        """Valid credentials return a token (first user / admin)."""
        test_client.post("/api/auth/register", json={
            "name": "Bob",
            "email": "bob@cisco.com",
            "password": "Password1",
        })
        resp = test_client.post("/api/auth/login", json={
            "email": "bob@cisco.com",
            "password": "Password1",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_login_wrong_password(self, test_client):
        """Wrong password returns 401."""
        test_client.post("/api/auth/register", json={
            "name": "Bob",
            "email": "bob@cisco.com",
            "password": "Password1",
        })
        resp = test_client.post("/api/auth/login", json={
            "email": "bob@cisco.com",
            "password": "WrongPass1",
        })
        assert resp.status_code == 401

    def test_login_unknown_email(self, test_client):
        """Unknown email returns 401."""
        resp = test_client.post("/api/auth/login", json={
            "email": "nobody@cisco.com",
            "password": "Password1",
        })
        assert resp.status_code == 401


class TestMe:
    """Tests for GET /api/auth/me."""

    def test_me_authenticated(self, test_client):
        """Authenticated user gets their info."""
        reg = test_client.post("/api/auth/register", json={
            "name": "Carol",
            "email": "carol@cisco.com",
            "password": "Password1",
        })
        token = reg.json()["access_token"]
        resp = test_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "carol@cisco.com"
        assert data["name"] == "Carol"

    def test_me_no_token(self, test_client):
        """No token returns 401."""
        resp = test_client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_invalid_token(self, test_client):
        """Invalid token returns 401."""
        resp = test_client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert resp.status_code == 401


class TestApprovalFlow:
    """Tests for the approval-based registration flow."""

    def test_non_cisco_email_rejected(self, test_client):
        """Non-cisco.com email should be rejected with 400."""
        resp = test_client.post("/api/auth/register", json={
            "name": "Alice",
            "email": "alice@gmail.com",
            "password": "Password1",
        })
        assert resp.status_code == 400
        assert "cisco.com" in resp.json()["detail"].lower()

    def test_weak_password_rejected(self, test_client):
        """Password without uppercase should be rejected."""
        resp = test_client.post("/api/auth/register", json={
            "name": "Alice",
            "email": "alice@cisco.com",
            "password": "password1",
        })
        assert resp.status_code == 400
        assert "uppercase" in resp.json()["detail"].lower()

    def test_second_user_pending_approval(self, test_client):
        """Second user registration returns pending_approval status."""
        # First user (admin, auto-approved)
        test_client.post("/api/auth/register", json={
            "name": "Admin",
            "email": "admin@cisco.com",
            "password": "Password1",
        })
        # Second user
        resp = test_client.post("/api/auth/register", json={
            "name": "User2",
            "email": "user2@cisco.com",
            "password": "Password1",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "pending_approval"
        assert "access_token" not in data

    def test_pending_user_cannot_login(self, test_client):
        """Pending user gets 403 on login."""
        test_client.post("/api/auth/register", json={
            "name": "Admin",
            "email": "admin@cisco.com",
            "password": "Password1",
        })
        test_client.post("/api/auth/register", json={
            "name": "Pending",
            "email": "pending@cisco.com",
            "password": "Password1",
        })
        resp = test_client.post("/api/auth/login", json={
            "email": "pending@cisco.com",
            "password": "Password1",
        })
        assert resp.status_code == 403
        assert resp.json()["detail"] == "pending_approval"


class TestAccountLockout:
    """Tests for account lockout after failed login attempts."""

    def test_lockout_after_5_failures(self, test_client):
        """Account should lock after 5 failed login attempts."""
        test_client.post("/api/auth/register", json={
            "name": "Admin",
            "email": "admin@cisco.com",
            "password": "Password1",
        })
        for i in range(5):
            test_client.post("/api/auth/login", json={
                "email": "admin@cisco.com",
                "password": "WrongPass1",
            })
        resp = test_client.post("/api/auth/login", json={
            "email": "admin@cisco.com",
            "password": "Password1",
        })
        assert resp.status_code == 429
        assert "locked" in resp.json()["detail"].lower()

    def test_successful_login_resets_counter(self, test_client):
        """Successful login should reset the failed attempt counter."""
        test_client.post("/api/auth/register", json={
            "name": "Admin",
            "email": "admin@cisco.com",
            "password": "Password1",
        })
        # 3 failed attempts
        for i in range(3):
            test_client.post("/api/auth/login", json={
                "email": "admin@cisco.com",
                "password": "WrongPass1",
            })
        # Successful login
        resp = test_client.post("/api/auth/login", json={
            "email": "admin@cisco.com",
            "password": "Password1",
        })
        assert resp.status_code == 200
        # 4 more failed attempts should not lock (counter was reset)
        for i in range(4):
            test_client.post("/api/auth/login", json={
                "email": "admin@cisco.com",
                "password": "WrongPass1",
            })
        resp = test_client.post("/api/auth/login", json={
            "email": "admin@cisco.com",
            "password": "Password1",
        })
        assert resp.status_code == 200
