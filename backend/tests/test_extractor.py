"""Tests for the extractor service."""

import json
from datetime import date
from typing import Any, cast
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy.orm import Session

from app.models import MeetingItem, MeetingRecap, Project, User
from app.models.meeting_item import Section
from app.models.meeting_recap import InputType, MeetingStatus
from app.services.extractor import ExtractionError, extract


def _get_project_id(project: Project) -> str:
    """Get project ID as string for type safety."""
    return cast(str, project.id)


def _get_meeting_uuid(meeting: MeetingRecap) -> UUID:
    """Get meeting ID as UUID for type safety."""
    return UUID(cast(str, meeting.id))


def _ensure_test_user(db: Session) -> None:
    """Ensure the test user exists in the database."""
    existing = db.query(User).filter(User.id == "test-user-0000-0000-000000000001").first()
    if not existing:
        user = User(id="test-user-0000-0000-000000000001", email="test@example.com", name="Test User", hashed_password="x", is_active=True, is_admin=False)
        db.add(user)
        db.commit()


def _create_test_project(db: Session) -> Project:
    """Create a test project."""
    _ensure_test_user(db)
    project = Project(
        name="Test Project",
        user_id="test-user-0000-0000-000000000001",
        description="For extractor tests"
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


class MockLLMProvider:
    """Mock LLM provider for testing."""

    def __init__(self, response: str):
        self.response = response
        self.generate_called = False
        self.prompt_received: str | None = None

    def generate(
        self,
        prompt: str,
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> str:
        self.generate_called = True
        self.prompt_received = prompt
        return self.response


def test_successful_extraction_creates_meeting_items(test_db: Session) -> None:
    """Test that successful extraction creates MeetingItem records."""
    project = _create_test_project(test_db)
    meeting = _create_test_meeting(
        test_db,
        _get_project_id(project),
        raw_input="We need to add user authentication."
    )

    # Mock LLM response with valid JSON
    mock_response = json.dumps([
        {
            "section": "requirements",
            "content": "Add user authentication",
            "source_quote": "We need to add user authentication",
            "speaker": "John",
            "priority": "high"
        },
        {
            "section": "needs_and_goals",
            "content": "Users want to securely log in",
            "source_quote": None,
            "speaker": "Sarah",
            "priority": "medium"
        }
    ])

    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.extractor.get_provider", return_value=mock_provider):
        items = extract(_get_meeting_uuid(meeting), test_db)

    # Verify items were created
    assert len(items) == 2
    assert items[0].section == Section.requirements
    assert items[0].content == "Add user authentication"
    assert items[0].source_quote == "We need to add user authentication"
    assert items[0].speaker == "John"
    assert items[0].priority == "high"
    assert items[1].section == Section.needs_and_goals
    assert items[1].content == "Users want to securely log in"
    assert items[1].source_quote is None
    assert items[1].speaker == "Sarah"
    assert items[1].priority == "medium"

    # Verify items are in database
    db_items = test_db.query(MeetingItem).filter(
        MeetingItem.meeting_id == str(meeting.id)
    ).all()
    assert len(db_items) == 2


def test_extraction_status_transitions_to_processed(test_db: Session) -> None:
    """Test status transitions from pending to processing to processed."""
    project = _create_test_project(test_db)
    meeting = _create_test_meeting(test_db, _get_project_id(project))

    # Verify initial status is pending
    assert meeting.status == MeetingStatus.pending

    mock_response = json.dumps([
        {
            "section": "needs_and_goals",
            "content": "Performance is slow",
            "source_quote": None,
            "speaker": "John",
            "priority": "high"
        }
    ])
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.extractor.get_provider", return_value=mock_provider):
        extract(_get_meeting_uuid(meeting), test_db)

    # Refresh meeting from database
    test_db.refresh(meeting)

    # Verify final status is processed
    assert meeting.status == MeetingStatus.processed
    assert meeting.processed_at is not None
    assert meeting.prompt_version == "extract_v2"
    assert meeting.error_message is None


def test_malformed_json_sets_status_to_failed(test_db: Session) -> None:
    """Test that malformed LLM output sets status to failed."""
    project = _create_test_project(test_db)
    meeting = _create_test_meeting(test_db, _get_project_id(project))

    # Mock LLM returning invalid JSON
    mock_provider = MockLLMProvider("This is not valid JSON at all")

    with patch("app.services.extractor.get_provider", return_value=mock_provider):
        with pytest.raises(ExtractionError) as exc_info:
            extract(_get_meeting_uuid(meeting), test_db)

    assert "Invalid JSON" in str(exc_info.value) or "failed" in str(exc_info.value).lower()

    # Refresh meeting from database
    test_db.refresh(meeting)

    # Verify status is failed
    assert meeting.status == MeetingStatus.failed
    assert meeting.failed_at is not None
    assert meeting.error_message is not None
    assert meeting.prompt_version == "extract_v2"


def test_missing_required_field_sets_status_to_failed(test_db: Session) -> None:
    """Test that JSON missing required fields sets status to failed."""
    project = _create_test_project(test_db)
    meeting = _create_test_meeting(test_db, _get_project_id(project))

    # Mock LLM returning JSON without 'content' field
    mock_response = json.dumps([
        {"section": "needs_and_goals"}  # Missing 'content' field
    ])
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.extractor.get_provider", return_value=mock_provider):
        with pytest.raises(ExtractionError) as exc_info:
            extract(_get_meeting_uuid(meeting), test_db)

    assert "missing 'content' field" in str(exc_info.value)

    # Refresh meeting from database
    test_db.refresh(meeting)
    assert meeting.status == MeetingStatus.failed


def test_invalid_section_sets_status_to_failed(test_db: Session) -> None:
    """Test that invalid section value sets status to failed."""
    project = _create_test_project(test_db)
    meeting = _create_test_meeting(test_db, _get_project_id(project))

    # Mock LLM returning JSON with invalid section
    mock_response = json.dumps([
        {
            "section": "invalid_section_name",
            "content": "Some content",
            "source_quote": None,
            "speaker": "John",
            "priority": "high"
        }
    ])
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.extractor.get_provider", return_value=mock_provider):
        with pytest.raises(ExtractionError) as exc_info:
            extract(_get_meeting_uuid(meeting), test_db)

    assert "invalid section" in str(exc_info.value)

    # Refresh meeting from database
    test_db.refresh(meeting)
    assert meeting.status == MeetingStatus.failed


def test_meeting_not_found_raises_error(test_db: Session) -> None:
    """Test that extraction fails for non-existent meeting."""
    fake_meeting_id = uuid4()

    with pytest.raises(ExtractionError) as exc_info:
        extract(fake_meeting_id, test_db)

    assert "Meeting not found" in str(exc_info.value)


def test_extraction_handles_empty_response(test_db: Session) -> None:
    """Test that empty JSON array response is handled correctly."""
    project = _create_test_project(test_db)
    meeting = _create_test_meeting(test_db, _get_project_id(project))

    # Mock LLM returning empty array
    mock_response = json.dumps([])
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.extractor.get_provider", return_value=mock_provider):
        items = extract(_get_meeting_uuid(meeting), test_db)

    # Should succeed with no items
    assert len(items) == 0

    # Refresh meeting from database
    test_db.refresh(meeting)
    assert meeting.status == MeetingStatus.processed


def test_extraction_strips_markdown_code_blocks(test_db: Session) -> None:
    """Test that markdown code blocks are stripped from LLM response."""
    project = _create_test_project(test_db)
    meeting = _create_test_meeting(test_db, _get_project_id(project))

    # Mock LLM returning JSON wrapped in markdown code block
    items_json = json.dumps([
        {
            "section": "scope_and_constraints",
            "content": "Must use PostgreSQL",
            "source_quote": None,
            "speaker": "John",
            "priority": "high"
        }
    ])
    mock_response = f"```json\n{items_json}\n```"
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.extractor.get_provider", return_value=mock_provider):
        items = extract(_get_meeting_uuid(meeting), test_db)

    assert len(items) == 1
    assert items[0].content == "Must use PostgreSQL"


def test_extraction_handles_all_section_types(test_db: Session) -> None:
    """Test that all 5 section types are correctly handled."""
    project = _create_test_project(test_db)
    meeting = _create_test_meeting(test_db, _get_project_id(project))

    # Mock LLM returning items for all 5 sections
    all_sections = [
        "needs_and_goals", "requirements", "scope_and_constraints",
        "risks_and_questions", "action_items"
    ]
    mock_items = [
        {"section": section, "content": f"Item for {section}", "source_quote": None, "speaker": "John", "priority": "high"}
        for section in all_sections
    ]
    mock_response = json.dumps(mock_items)
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.extractor.get_provider", return_value=mock_provider):
        items = extract(_get_meeting_uuid(meeting), test_db)

    assert len(items) == 5

    # Verify all sections are represented
    sections_extracted = {item.section.value for item in items}
    assert sections_extracted == set(all_sections)


def test_extraction_sets_order_by_section(test_db: Session) -> None:
    """Test that items are given correct order values within their section."""
    project = _create_test_project(test_db)
    meeting = _create_test_meeting(test_db, _get_project_id(project))

    # Mock LLM returning multiple items in same section
    mock_response = json.dumps([
        {"section": "needs_and_goals", "content": "First need", "source_quote": None, "speaker": "John", "priority": "high"},
        {"section": "needs_and_goals", "content": "Second need", "source_quote": None, "speaker": "Sarah", "priority": "medium"},
        {"section": "requirements", "content": "A requirement", "source_quote": None, "speaker": "Mike", "priority": "low"},
        {"section": "needs_and_goals", "content": "Third need", "source_quote": None, "speaker": "John", "priority": "high"},
    ])
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.extractor.get_provider", return_value=mock_provider):
        items = extract(_get_meeting_uuid(meeting), test_db)

    # Get needs_and_goals sorted by order
    needs = [i for i in items if i.section == Section.needs_and_goals]
    needs.sort(key=lambda x: x.order)

    assert len(needs) == 3
    assert needs[0].order == 0
    assert needs[0].content == "First need"
    assert needs[1].order == 1
    assert needs[1].content == "Second need"
    assert needs[2].order == 2
    assert needs[2].content == "Third need"


def test_extraction_retries_on_failure(test_db: Session) -> None:
    """Test that extraction retries on malformed output before failing."""
    project = _create_test_project(test_db)
    meeting = _create_test_meeting(test_db, _get_project_id(project))

    call_count = 0

    class FailingThenSucceedingProvider:
        def generate(self, prompt: str) -> str:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return "invalid json"
            return json.dumps([
                {"section": "needs_and_goals", "content": "A problem", "source_quote": None, "speaker": "John", "priority": "high"}
            ])

    with patch("app.services.extractor.get_provider", return_value=FailingThenSucceedingProvider()):
        items = extract(_get_meeting_uuid(meeting), test_db)

    # Should succeed on second attempt
    assert len(items) == 1
    assert call_count == 2


def test_non_array_response_sets_status_to_failed(test_db: Session) -> None:
    """Test that a non-array JSON response sets status to failed."""
    project = _create_test_project(test_db)
    meeting = _create_test_meeting(test_db, _get_project_id(project))

    # Mock LLM returning a JSON object instead of array
    mock_response = json.dumps({"error": "something went wrong"})
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.extractor.get_provider", return_value=mock_provider):
        with pytest.raises(ExtractionError) as exc_info:
            extract(_get_meeting_uuid(meeting), test_db)

    assert "must be a JSON array" in str(exc_info.value)

    # Refresh meeting from database
    test_db.refresh(meeting)
    assert meeting.status == MeetingStatus.failed
