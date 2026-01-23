"""Pytest fixtures for testing the FastAPI application."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
# Import models so that Base.metadata knows about them
from app.models import Project, MeetingRecap, MeetingItem, Requirement, RequirementSource, RequirementHistory  # noqa: F401


# Create in-memory SQLite database for testing
# Using StaticPool ensures all connections share the same in-memory database
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


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
def test_client(test_db: Session) -> Generator[TestClient, None, None]:
    """Create a test client with the test database.

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
