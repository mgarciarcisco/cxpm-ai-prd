"""Tests for the SSE streaming endpoint."""

import json
from collections.abc import AsyncIterator
from datetime import date
from typing import Any, cast
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import MeetingRecap, Project
from app.models.meeting_recap import InputType, MeetingStatus
from app.services.extractor import ExtractionError


def _get_project_id(project: Project) -> str:
    """Get project ID as string for type safety."""
    return cast(str, project.id)


def _create_test_project(db: Session) -> Project:
    """Create a test project."""
    project = Project(
        name="Test Project",
        user_id="test-user-0000-0000-000000000001",
        description="For streaming tests"
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _create_test_meeting(
    db: Session,
    project_id: str,
    raw_input: str = "Test meeting notes",
    status: MeetingStatus = MeetingStatus.pending
) -> MeetingRecap:
    """Create a test meeting recap."""
    meeting = MeetingRecap(
        project_id=project_id,
        user_id="test-user-0000-0000-000000000001",
        title="Test Meeting",
        meeting_date=date(2026, 1, 22),
        raw_input=raw_input,
        input_type=InputType.txt,
        status=status
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def _parse_sse_events(response_text: str) -> list[dict[str, Any]]:
    """Parse SSE events from response text.

    SSE format:
    event: event_name
    data: json_data

    Events are separated by double newlines.
    """
    events = []
    current_event: dict[str, str] = {}

    for line in response_text.split('\n'):
        line = line.strip()
        if not line:
            if current_event:
                # Parse the data field as JSON
                if 'data' in current_event:
                    try:
                        current_event['data'] = json.loads(current_event['data'])
                    except json.JSONDecodeError:
                        pass  # Keep as string if not valid JSON
                events.append(current_event)
                current_event = {}
            continue

        if line.startswith('event:'):
            current_event['event'] = line[6:].strip()
        elif line.startswith('data:'):
            current_event['data'] = line[5:].strip()

    # Don't forget the last event if no trailing newline
    if current_event:
        if 'data' in current_event:
            try:
                current_event['data'] = json.loads(current_event['data'])
            except json.JSONDecodeError:
                pass
        events.append(current_event)

    return events


async def _mock_extract_stream_success(
    meeting_id: Any, db: Any
) -> AsyncIterator[dict[str, Any]]:
    """Mock extract_stream that yields two items successfully."""
    yield {
        "section": "problems",
        "content": "First problem",
        "source_quote": "Some quote"
    }
    yield {
        "section": "user_goals",
        "content": "A user goal",
        "source_quote": None
    }


async def _mock_extract_stream_empty(
    meeting_id: Any, db: Any
) -> AsyncIterator[dict[str, Any]]:
    """Mock extract_stream that yields no items."""
    return
    yield  # Make this a generator


async def _mock_extract_stream_error(
    meeting_id: Any, db: Any
) -> AsyncIterator[dict[str, Any]]:
    """Mock extract_stream that raises an error."""
    raise ExtractionError("LLM failed to process")
    yield  # Make this a generator (unreachable but required for typing)


async def _mock_extract_stream_unexpected_error(
    meeting_id: Any, db: Any
) -> AsyncIterator[dict[str, Any]]:
    """Mock extract_stream that raises an unexpected error."""
    raise RuntimeError("Something unexpected happened")
    yield  # Make this a generator (unreachable but required for typing)


class TestStreamingEndpointStatusEvent:
    """Tests for status event emission."""

    def test_status_event_emitted_first(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that the status event is emitted first in the stream."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, _get_project_id(project))

        with patch(
            "app.routers.meetings.extract_stream",
            _mock_extract_stream_success
        ):
            response = auth_client.get(f"/api/meetings/{meeting.id}/stream")

        assert response.status_code == 200
        events = _parse_sse_events(response.text)

        # First event should be status event
        assert len(events) >= 1
        assert events[0]['event'] == 'status'
        assert events[0]['data'] == 'processing'

    def test_status_event_before_item_events(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that status event comes before any item events."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, _get_project_id(project))

        with patch(
            "app.routers.meetings.extract_stream",
            _mock_extract_stream_success
        ):
            response = auth_client.get(f"/api/meetings/{meeting.id}/stream")

        events = _parse_sse_events(response.text)

        # Find indices of status and item events
        status_indices = [i for i, e in enumerate(events) if e['event'] == 'status']
        item_indices = [i for i, e in enumerate(events) if e['event'] == 'item']

        assert len(status_indices) == 1
        assert len(item_indices) >= 1
        assert status_indices[0] < min(item_indices)


class TestStreamingEndpointItemEvents:
    """Tests for item event emission."""

    def test_item_events_emitted_for_each_extraction(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that an item event is emitted for each extracted item."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, _get_project_id(project))

        with patch(
            "app.routers.meetings.extract_stream",
            _mock_extract_stream_success
        ):
            response = auth_client.get(f"/api/meetings/{meeting.id}/stream")

        events = _parse_sse_events(response.text)
        item_events = [e for e in events if e['event'] == 'item']

        # Should have 2 item events (from _mock_extract_stream_success)
        assert len(item_events) == 2

    def test_item_event_contains_section(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that item events contain the section field."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, _get_project_id(project))

        with patch(
            "app.routers.meetings.extract_stream",
            _mock_extract_stream_success
        ):
            response = auth_client.get(f"/api/meetings/{meeting.id}/stream")

        events = _parse_sse_events(response.text)
        item_events = [e for e in events if e['event'] == 'item']

        assert item_events[0]['data']['section'] == 'problems'
        assert item_events[1]['data']['section'] == 'user_goals'

    def test_item_event_contains_content(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that item events contain the content field."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, _get_project_id(project))

        with patch(
            "app.routers.meetings.extract_stream",
            _mock_extract_stream_success
        ):
            response = auth_client.get(f"/api/meetings/{meeting.id}/stream")

        events = _parse_sse_events(response.text)
        item_events = [e for e in events if e['event'] == 'item']

        assert item_events[0]['data']['content'] == 'First problem'
        assert item_events[1]['data']['content'] == 'A user goal'

    def test_item_event_contains_source_quote(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that item events contain the source_quote field."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, _get_project_id(project))

        with patch(
            "app.routers.meetings.extract_stream",
            _mock_extract_stream_success
        ):
            response = auth_client.get(f"/api/meetings/{meeting.id}/stream")

        events = _parse_sse_events(response.text)
        item_events = [e for e in events if e['event'] == 'item']

        assert item_events[0]['data']['source_quote'] == 'Some quote'
        assert item_events[1]['data']['source_quote'] is None


class TestStreamingEndpointCompleteEvent:
    """Tests for complete event emission."""

    def test_complete_event_emitted_when_done(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that a complete event is emitted when extraction is done."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, _get_project_id(project))

        with patch(
            "app.routers.meetings.extract_stream",
            _mock_extract_stream_success
        ):
            response = auth_client.get(f"/api/meetings/{meeting.id}/stream")

        events = _parse_sse_events(response.text)
        complete_events = [e for e in events if e['event'] == 'complete']

        assert len(complete_events) == 1

    def test_complete_event_has_correct_item_count(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that complete event contains correct item count."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, _get_project_id(project))

        with patch(
            "app.routers.meetings.extract_stream",
            _mock_extract_stream_success
        ):
            response = auth_client.get(f"/api/meetings/{meeting.id}/stream")

        events = _parse_sse_events(response.text)
        complete_events = [e for e in events if e['event'] == 'complete']

        assert complete_events[0]['data']['item_count'] == 2

    def test_complete_event_after_all_items(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that complete event is emitted after all item events."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, _get_project_id(project))

        with patch(
            "app.routers.meetings.extract_stream",
            _mock_extract_stream_success
        ):
            response = auth_client.get(f"/api/meetings/{meeting.id}/stream")

        events = _parse_sse_events(response.text)

        complete_index = next(i for i, e in enumerate(events) if e['event'] == 'complete')
        item_indices = [i for i, e in enumerate(events) if e['event'] == 'item']

        assert len(item_indices) > 0
        assert complete_index > max(item_indices)

    def test_complete_event_with_zero_items(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that complete event shows item_count=0 when no items extracted."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, _get_project_id(project))

        with patch(
            "app.routers.meetings.extract_stream",
            _mock_extract_stream_empty
        ):
            response = auth_client.get(f"/api/meetings/{meeting.id}/stream")

        events = _parse_sse_events(response.text)
        complete_events = [e for e in events if e['event'] == 'complete']

        assert len(complete_events) == 1
        assert complete_events[0]['data']['item_count'] == 0


class TestStreamingEndpointErrorEvent:
    """Tests for error event emission."""

    def test_error_event_emitted_on_extraction_error(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that an error event is emitted when ExtractionError occurs."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, _get_project_id(project))

        with patch(
            "app.routers.meetings.extract_stream",
            _mock_extract_stream_error
        ):
            response = auth_client.get(f"/api/meetings/{meeting.id}/stream")

        events = _parse_sse_events(response.text)
        error_events = [e for e in events if e['event'] == 'error']

        assert len(error_events) == 1

    def test_error_event_contains_message(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that error event contains the error message."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, _get_project_id(project))

        with patch(
            "app.routers.meetings.extract_stream",
            _mock_extract_stream_error
        ):
            response = auth_client.get(f"/api/meetings/{meeting.id}/stream")

        events = _parse_sse_events(response.text)
        error_events = [e for e in events if e['event'] == 'error']

        assert error_events[0]['data']['message'] == 'LLM failed to process'

    def test_error_event_on_unexpected_error(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that error event is emitted for unexpected exceptions."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, _get_project_id(project))

        with patch(
            "app.routers.meetings.extract_stream",
            _mock_extract_stream_unexpected_error
        ):
            response = auth_client.get(f"/api/meetings/{meeting.id}/stream")

        events = _parse_sse_events(response.text)
        error_events = [e for e in events if e['event'] == 'error']

        assert len(error_events) == 1
        assert 'Something unexpected happened' in error_events[0]['data']['message']

    def test_no_complete_event_after_error(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that no complete event is emitted after an error."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, _get_project_id(project))

        with patch(
            "app.routers.meetings.extract_stream",
            _mock_extract_stream_error
        ):
            response = auth_client.get(f"/api/meetings/{meeting.id}/stream")

        events = _parse_sse_events(response.text)
        complete_events = [e for e in events if e['event'] == 'complete']

        assert len(complete_events) == 0


class TestStreamingEndpointMeetingNotFound:
    """Tests for meeting not found handling."""

    def test_returns_404_for_missing_meeting(
        self, auth_client: TestClient, test_db: Session
    ) -> None:
        """Test that 404 is returned for non-existent meeting."""
        fake_id = str(uuid4())
        response = auth_client.get(f"/api/meetings/{fake_id}/stream")

        assert response.status_code == 404
        assert response.json()['detail'] == 'Meeting not found'
