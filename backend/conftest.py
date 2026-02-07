"""Pytest fixtures for testing the FastAPI application."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import get_current_user, get_current_user_from_query
from app.database import Base, get_db
from app.main import app

# Import models so that Base.metadata knows about them
from app.models import (  # noqa: F401
    PRD,
    ActivityLog,
    MeetingItem,
    MeetingItemDecision,
    MeetingRecap,
    Project,
    Requirement,
    RequirementHistory,
    RequirementSource,
    User,
)

# Create in-memory SQLite database for testing
# Using StaticPool ensures all connections share the same in-memory database
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Fixed test user ID for consistent test data
TEST_USER_ID = "test-user-0000-0000-000000000001"


@pytest.fixture
def test_db() -> Generator[Session, None, None]:
    """Create a test database session using in-memory SQLite.

    Creates all tables before the test and drops them after.
    """
    # Create all tables
    Base.metadata.create_all(bind=test_engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def test_user(test_db: Session) -> User:
    """Create a test user for authenticated tests."""
    user = User(
        id=TEST_USER_ID,
        email="test@example.com",
        name="Test User",
        hashed_password="!not-a-real-hash",
        is_active=True,
        is_admin=False,
        is_approved=True,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def test_client(test_db: Session) -> Generator[TestClient, None, None]:
    """Create a test client with the test database (unauthenticated).

    Overrides the get_db dependency to use the test database session.
    """
    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield test_db
        finally:
            pass  # Don't close here, let test_db fixture handle it

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def auth_client(test_db: Session, test_user: User) -> Generator[TestClient, None, None]:
    """Create a test client with auth bypass (returns test_user for all auth deps).

    Overrides both get_db and get_current_user/get_current_user_from_query
    so all protected routes work without actual JWT tokens.
    """
    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield test_db
        finally:
            pass

    def override_get_current_user() -> User:
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_user_from_query] = override_get_current_user

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()
