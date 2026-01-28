"""Test health endpoint to verify test setup works."""

from fastapi.testclient import TestClient


def test_health_check(test_client: TestClient) -> None:
    """Test that the health check endpoint returns ok."""
    response = test_client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
