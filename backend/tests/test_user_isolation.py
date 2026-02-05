"""Tests for user isolation: User A cannot see/edit/delete User B's data."""

import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_current_user_from_query
from app.database import get_db
from app.main import app
from app.models import Project, User


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

USER_A_ID = "test-user-0000-0000-000000000001"  # matches conftest TEST_USER_ID
USER_B_ID = "test-user-0000-0000-000000000002"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_auth_client(test_db: Session, user: User) -> TestClient:
    """Create a test client authenticated as the given user."""

    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield test_db
        finally:
            pass

    def override_get_current_user() -> User:
        return user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_user_from_query] = override_get_current_user

    client = TestClient(app)
    return client


def _create_user(test_db: Session, user_id: str, email: str, name: str) -> User:
    """Insert a User row into the test database and return it."""
    user = User(
        id=user_id,
        email=email,
        name=name,
        hashed_password="!not-a-real-hash",
        is_active=True,
        is_admin=False,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


def _create_project_for_user(test_db: Session, user: User, name: str) -> Project:
    """Insert a Project row owned by *user* and return it."""
    project = Project(
        id=str(uuid.uuid4()),
        name=name,
        user_id=user.id,
    )
    test_db.add(project)
    test_db.commit()
    test_db.refresh(project)
    return project


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user_a(test_db: Session) -> User:
    """User A (the default test user)."""
    return _create_user(test_db, USER_A_ID, "user_a@example.com", "User A")


@pytest.fixture
def user_b(test_db: Session) -> User:
    """User B (a second, independent user)."""
    return _create_user(test_db, USER_B_ID, "user_b@example.com", "User B")


@pytest.fixture
def client_a(test_db: Session, user_a: User) -> Generator[TestClient, None, None]:
    """Authenticated test client for User A."""
    client = _make_auth_client(test_db, user_a)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def client_b(test_db: Session, user_b: User) -> Generator[TestClient, None, None]:
    """Authenticated test client for User B."""
    client = _make_auth_client(test_db, user_b)
    yield client
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Tests — User A cannot access User B's projects
# ---------------------------------------------------------------------------

class TestProjectIsolation:
    """Verify that one user's projects are invisible to another user."""

    def test_user_a_cannot_list_user_b_projects(
        self, test_db: Session, user_a: User, user_b: User, client_a: TestClient
    ) -> None:
        """GET /api/projects should NOT include User B's projects."""
        _create_project_for_user(test_db, user_b, "User B Secret Project")

        response = client_a.get("/api/projects")
        assert response.status_code == 200
        projects = response.json()
        assert len(projects) == 0, "User A should see zero projects"

    def test_user_a_cannot_get_user_b_project_by_id(
        self, test_db: Session, user_a: User, user_b: User, client_a: TestClient
    ) -> None:
        """GET /api/projects/{id} should return 404 for User B's project."""
        project_b = _create_project_for_user(test_db, user_b, "B's Project")

        response = client_a.get(f"/api/projects/{project_b.id}")
        assert response.status_code == 404

    def test_user_a_cannot_update_user_b_project(
        self, test_db: Session, user_a: User, user_b: User, client_a: TestClient
    ) -> None:
        """PUT /api/projects/{id} should return 404 for User B's project."""
        project_b = _create_project_for_user(test_db, user_b, "B's Project")

        response = client_a.put(
            f"/api/projects/{project_b.id}",
            json={"name": "Hacked Name"},
        )
        assert response.status_code == 404

    def test_user_a_cannot_delete_user_b_project(
        self, test_db: Session, user_a: User, user_b: User, client_a: TestClient
    ) -> None:
        """DELETE /api/projects/{id} should return 404 for User B's project."""
        project_b = _create_project_for_user(test_db, user_b, "B's Project")

        response = client_a.delete(f"/api/projects/{project_b.id}")
        assert response.status_code == 404

        # Verify the project still exists in the database
        still_exists = test_db.query(Project).filter(Project.id == project_b.id).first()
        assert still_exists is not None, "User B's project must not be deleted"


# ---------------------------------------------------------------------------
# Tests — each user can see their own projects
# ---------------------------------------------------------------------------

class TestOwnProjectsVisible:
    """Verify that each user can see projects they own."""

    def test_user_a_can_see_own_projects(
        self, test_db: Session, user_a: User, user_b: User, client_a: TestClient
    ) -> None:
        """User A should see only their own projects in the listing."""
        _create_project_for_user(test_db, user_a, "A's Project 1")
        _create_project_for_user(test_db, user_a, "A's Project 2")
        _create_project_for_user(test_db, user_b, "B's Project")

        response = client_a.get("/api/projects")
        assert response.status_code == 200
        projects = response.json()
        assert len(projects) == 2
        names = {p["name"] for p in projects}
        assert names == {"A's Project 1", "A's Project 2"}

    def test_user_b_can_see_own_projects(
        self, test_db: Session, user_a: User, user_b: User, client_b: TestClient
    ) -> None:
        """User B should see only their own projects in the listing."""
        _create_project_for_user(test_db, user_a, "A's Project")
        _create_project_for_user(test_db, user_b, "B's Project 1")
        _create_project_for_user(test_db, user_b, "B's Project 2")

        response = client_b.get("/api/projects")
        assert response.status_code == 200
        projects = response.json()
        assert len(projects) == 2
        names = {p["name"] for p in projects}
        assert names == {"B's Project 1", "B's Project 2"}

    def test_user_a_can_get_own_project_by_id(
        self, test_db: Session, user_a: User, client_a: TestClient
    ) -> None:
        """GET /api/projects/{id} succeeds for User A's own project."""
        project_a = _create_project_for_user(test_db, user_a, "A's Own Project")

        response = client_a.get(f"/api/projects/{project_a.id}")
        assert response.status_code == 200
        assert response.json()["name"] == "A's Own Project"

    def test_user_a_can_update_own_project(
        self, test_db: Session, user_a: User, client_a: TestClient
    ) -> None:
        """PUT /api/projects/{id} succeeds for User A's own project."""
        project_a = _create_project_for_user(test_db, user_a, "Original Name")

        response = client_a.put(
            f"/api/projects/{project_a.id}",
            json={"name": "Updated Name"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    def test_user_a_can_delete_own_project(
        self, test_db: Session, user_a: User, client_a: TestClient
    ) -> None:
        """DELETE /api/projects/{id} succeeds for User A's own project."""
        project_a = _create_project_for_user(test_db, user_a, "To Delete")

        response = client_a.delete(f"/api/projects/{project_a.id}")
        assert response.status_code == 204

        gone = test_db.query(Project).filter(Project.id == project_a.id).first()
        assert gone is None


# ---------------------------------------------------------------------------
# Tests — cross-user isolation with projects created via the API
# ---------------------------------------------------------------------------

class TestIsolationViaAPI:
    """Same isolation guarantees, but projects are created through the API.

    NOTE: Because ``app.dependency_overrides`` is a single global dict, we
    cannot use ``client_a`` and ``client_b`` fixtures simultaneously.  Instead
    we create clients manually and switch overrides between calls.
    """

    def test_api_created_projects_are_isolated(
        self,
        test_db: Session,
        user_a: User,
        user_b: User,
    ) -> None:
        """Projects created via the API by one user are invisible to the other."""
        # Step 1: authenticate as User A and create a project
        client_a = _make_auth_client(test_db, user_a)
        try:
            resp_a = client_a.post(
                "/api/projects", json={"name": "A's API Project"}
            )
            assert resp_a.status_code == 201
            project_a_id = resp_a.json()["id"]
        finally:
            app.dependency_overrides.clear()

        # Step 2: authenticate as User B and verify isolation
        client_b = _make_auth_client(test_db, user_b)
        try:
            # User B should not see User A's project
            resp_list = client_b.get("/api/projects")
            assert resp_list.status_code == 200
            assert len(resp_list.json()) == 0

            resp_get = client_b.get(f"/api/projects/{project_a_id}")
            assert resp_get.status_code == 404

            resp_put = client_b.put(
                f"/api/projects/{project_a_id}",
                json={"name": "Hijacked"},
            )
            assert resp_put.status_code == 404

            resp_del = client_b.delete(f"/api/projects/{project_a_id}")
            assert resp_del.status_code == 404
        finally:
            app.dependency_overrides.clear()
