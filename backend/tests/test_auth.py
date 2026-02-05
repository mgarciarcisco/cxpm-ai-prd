"""Tests for authentication endpoints."""

import pytest


class TestRegister:
    """Tests for POST /api/auth/register."""

    def test_register_success(self, test_client):
        """First user registration succeeds and returns a token."""
        resp = test_client.post("/api/auth/register", json={
            "name": "Alice",
            "email": "alice@example.com",
            "password": "password123",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_first_user_is_admin(self, test_client):
        """First registered user should be admin."""
        test_client.post("/api/auth/register", json={
            "name": "First",
            "email": "first@example.com",
            "password": "password123",
        })
        resp = test_client.post("/api/auth/register", json={
            "name": "Second",
            "email": "second@example.com",
            "password": "password123",
        })
        # Login as first to check admin status
        login_resp = test_client.post("/api/auth/login", json={
            "email": "first@example.com",
            "password": "password123",
        })
        token = login_resp.json()["access_token"]
        me_resp = test_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.json()["is_admin"] is True

        # Second user should not be admin
        login_resp2 = test_client.post("/api/auth/login", json={
            "email": "second@example.com",
            "password": "password123",
        })
        token2 = login_resp2.json()["access_token"]
        me_resp2 = test_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token2}"})
        assert me_resp2.json()["is_admin"] is False

    def test_register_duplicate_email(self, test_client):
        """Registering with an existing email returns 409."""
        test_client.post("/api/auth/register", json={
            "name": "Alice",
            "email": "alice@example.com",
            "password": "password123",
        })
        resp = test_client.post("/api/auth/register", json={
            "name": "Alice 2",
            "email": "alice@example.com",
            "password": "different123",
        })
        assert resp.status_code == 409

    def test_register_short_password(self, test_client):
        """Password shorter than 8 chars should be rejected (422)."""
        resp = test_client.post("/api/auth/register", json={
            "name": "Alice",
            "email": "alice@example.com",
            "password": "short",
        })
        assert resp.status_code == 422


class TestLogin:
    """Tests for POST /api/auth/login."""

    def test_login_success(self, test_client):
        """Valid credentials return a token."""
        test_client.post("/api/auth/register", json={
            "name": "Bob",
            "email": "bob@example.com",
            "password": "password123",
        })
        resp = test_client.post("/api/auth/login", json={
            "email": "bob@example.com",
            "password": "password123",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_login_wrong_password(self, test_client):
        """Wrong password returns 401."""
        test_client.post("/api/auth/register", json={
            "name": "Bob",
            "email": "bob@example.com",
            "password": "password123",
        })
        resp = test_client.post("/api/auth/login", json={
            "email": "bob@example.com",
            "password": "wrong_password",
        })
        assert resp.status_code == 401

    def test_login_unknown_email(self, test_client):
        """Unknown email returns 401."""
        resp = test_client.post("/api/auth/login", json={
            "email": "nobody@example.com",
            "password": "password123",
        })
        assert resp.status_code == 401


class TestMe:
    """Tests for GET /api/auth/me."""

    def test_me_authenticated(self, test_client):
        """Authenticated user gets their info."""
        reg = test_client.post("/api/auth/register", json={
            "name": "Carol",
            "email": "carol@example.com",
            "password": "password123",
        })
        token = reg.json()["access_token"]
        resp = test_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "carol@example.com"
        assert data["name"] == "Carol"

    def test_me_no_token(self, test_client):
        """No token returns 401."""
        resp = test_client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_invalid_token(self, test_client):
        """Invalid token returns 401."""
        resp = test_client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert resp.status_code == 401
