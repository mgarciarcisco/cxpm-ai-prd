"""Tests for the conflict detection service."""

import json
from datetime import date
from typing import cast
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy.orm import Session

from app.models import MeetingItem, MeetingRecap, Project, Requirement, User
from app.models.meeting_item import Section
from app.models.meeting_recap import InputType, MeetingStatus
from app.services.conflict import (
    ConflictDetectionError,
    ConflictDetectionResult,
    _parse_classification_response,
    detect_conflicts,
)


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
        description="For conflict detection tests"
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _create_test_meeting(
    db: Session,
    project_id: str,
    raw_input: str = "Test meeting notes",
    status: MeetingStatus = MeetingStatus.processed
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


def _create_test_meeting_item(
    db: Session,
    meeting_id: str,
    section: Section,
    content: str,
    order: int = 0
) -> MeetingItem:
    """Create a test meeting item."""
    item = MeetingItem(
        meeting_id=meeting_id,
        section=section,
        content=content,
        source_quote=None,
        order=order,
        is_deleted=False
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _create_test_requirement(
    db: Session,
    project_id: str,
    section: Section,
    content: str,
    order: int = 0
) -> Requirement:
    """Create a test requirement."""
    req = Requirement(
        project_id=project_id,
        section=section,
        content=content,
        order=order,
        is_active=True
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


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


# =============================================
# Tests for exact match detection
# =============================================

def test_exact_match_detection_skips_duplicate(test_db: Session) -> None:
    """Test that exact text match is detected and skipped as duplicate."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create an existing requirement
    existing_content = "User must be able to log in with email and password"
    _create_test_requirement(
        test_db,
        project_id,
        Section.requirements,
        existing_content
    )

    # Create a meeting with an item that has the exact same content
    meeting = _create_test_meeting(test_db, project_id)
    _create_test_meeting_item(
        test_db,
        cast(str, meeting.id),
        Section.requirements,
        existing_content  # Exact match
    )

    # No LLM should be called for exact match
    result = detect_conflicts(_get_meeting_uuid(meeting), test_db)

    assert len(result.skipped) == 1
    assert len(result.added) == 0
    assert len(result.conflicts) == 0
    assert result.skipped[0].decision == "skipped_duplicate"
    assert result.skipped[0].classification == "duplicate"
    assert result.skipped[0].matched_requirement is not None


def test_exact_match_detection_with_whitespace_differences(test_db: Session) -> None:
    """Test that exact match detection handles whitespace differences."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create an existing requirement with extra spaces
    _create_test_requirement(
        test_db,
        project_id,
        Section.requirements,
        "  User authentication required  "
    )

    # Create a meeting with an item that has the same content but trimmed
    meeting = _create_test_meeting(test_db, project_id)
    _create_test_meeting_item(
        test_db,
        cast(str, meeting.id),
        Section.requirements,
        "User authentication required"  # Trimmed version
    )

    result = detect_conflicts(_get_meeting_uuid(meeting), test_db)

    # Should detect as duplicate (content is stripped before comparison)
    assert len(result.skipped) == 1
    assert result.skipped[0].decision == "skipped_duplicate"


# =============================================
# Tests for LLM classification with mocked responses
# =============================================

def test_llm_classification_called_for_non_exact_matches(test_db: Session) -> None:
    """Test that LLM is called for non-exact matches."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create an existing requirement
    _create_test_requirement(
        test_db,
        project_id,
        Section.requirements,
        "User must log in"
    )

    # Create a meeting with an item that has different content
    meeting = _create_test_meeting(test_db, project_id)
    _create_test_meeting_item(
        test_db,
        cast(str, meeting.id),
        Section.requirements,
        "Users should be able to authenticate"  # Different wording
    )

    # Mock LLM to return "new" classification
    mock_response = json.dumps({
        "classification": "new",
        "reason": "Different concept"
    })
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.conflict.get_provider", return_value=mock_provider):
        detect_conflicts(_get_meeting_uuid(meeting), test_db)

    assert mock_provider.generate_called
    assert mock_provider.prompt_received is not None


# =============================================
# Tests for duplicate classification
# =============================================

def test_duplicate_classification_skips_item(test_db: Session) -> None:
    """Test that LLM 'duplicate' classification results in skipped_semantic decision."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create an existing requirement
    _create_test_requirement(
        test_db,
        project_id,
        Section.requirements,
        "User must log in with email"
    )

    # Create a meeting item with semantically similar content
    meeting = _create_test_meeting(test_db, project_id)
    _create_test_meeting_item(
        test_db,
        cast(str, meeting.id),
        Section.requirements,
        "Email-based login is required for users"
    )

    # Mock LLM to return "duplicate" classification
    mock_response = json.dumps({
        "classification": "duplicate",
        "reason": "Both describe email-based login requirement"
    })
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.conflict.get_provider", return_value=mock_provider):
        result = detect_conflicts(_get_meeting_uuid(meeting), test_db)

    assert len(result.skipped) == 1
    assert len(result.added) == 0
    assert len(result.conflicts) == 0
    assert result.skipped[0].decision == "skipped_semantic"
    assert result.skipped[0].classification == "duplicate"
    assert result.skipped[0].matched_requirement is not None


# =============================================
# Tests for new item classification
# =============================================

def test_new_classification_adds_item(test_db: Session) -> None:
    """Test that LLM 'new' classification results in added decision."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create an existing requirement
    _create_test_requirement(
        test_db,
        project_id,
        Section.requirements,
        "User must log in"
    )

    # Create a meeting item with completely different content
    meeting = _create_test_meeting(test_db, project_id)
    _create_test_meeting_item(
        test_db,
        cast(str, meeting.id),
        Section.requirements,
        "Dashboard should display analytics"
    )

    # Mock LLM to return "new" classification
    mock_response = json.dumps({
        "classification": "new",
        "reason": "Dashboard analytics is unrelated to login"
    })
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.conflict.get_provider", return_value=mock_provider):
        result = detect_conflicts(_get_meeting_uuid(meeting), test_db)

    assert len(result.added) == 1
    assert len(result.skipped) == 0
    assert len(result.conflicts) == 0
    assert result.added[0].decision == "added"
    assert result.added[0].classification == "new"


def test_new_item_in_empty_section_is_added_without_llm(test_db: Session) -> None:
    """Test that items in sections with no existing requirements are added without LLM call."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create an existing requirement in a DIFFERENT section
    _create_test_requirement(
        test_db,
        project_id,
        Section.requirements,
        "Some requirement"
    )

    # Create a meeting item in a section with no requirements
    meeting = _create_test_meeting(test_db, project_id)
    _create_test_meeting_item(
        test_db,
        cast(str, meeting.id),
        Section.needs_and_goals,  # Different section, no requirements exist here
        "Users are having difficulty finding features"
    )

    # Should not need LLM since section is empty
    result = detect_conflicts(_get_meeting_uuid(meeting), test_db)

    assert len(result.added) == 1
    assert len(result.skipped) == 0
    assert len(result.conflicts) == 0
    assert result.added[0].decision == "added"
    assert result.added[0].reason == "No existing requirements in this section"


# =============================================
# Tests for refinement classification
# =============================================

def test_refinement_classification_creates_conflict(test_db: Session) -> None:
    """Test that LLM 'refinement' classification results in conflict decision."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create an existing requirement
    _create_test_requirement(
        test_db,
        project_id,
        Section.requirements,
        "Search functionality is required"
    )

    # Create a meeting item that refines the existing requirement
    meeting = _create_test_meeting(test_db, project_id)
    _create_test_meeting_item(
        test_db,
        cast(str, meeting.id),
        Section.requirements,
        "Search must return results within 2 seconds"
    )

    # Mock LLM to return "refinement" classification
    mock_response = json.dumps({
        "classification": "refinement",
        "reason": "Adds performance requirement to general search feature"
    })
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.conflict.get_provider", return_value=mock_provider):
        result = detect_conflicts(_get_meeting_uuid(meeting), test_db)

    assert len(result.conflicts) == 1
    assert len(result.added) == 0
    assert len(result.skipped) == 0
    assert result.conflicts[0].decision == "conflict"
    assert result.conflicts[0].classification == "refinement"
    assert result.conflicts[0].matched_requirement is not None


# =============================================
# Tests for contradiction classification
# =============================================

def test_contradiction_classification_creates_conflict(test_db: Session) -> None:
    """Test that LLM 'contradiction' classification results in conflict decision."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create an existing requirement
    _create_test_requirement(
        test_db,
        project_id,
        Section.requirements,
        "User must log in with email only"
    )

    # Create a meeting item that contradicts the existing requirement
    meeting = _create_test_meeting(test_db, project_id)
    _create_test_meeting_item(
        test_db,
        cast(str, meeting.id),
        Section.requirements,
        "User must log in with social media accounts"
    )

    # Mock LLM to return "contradiction" classification
    mock_response = json.dumps({
        "classification": "contradiction",
        "reason": "Email-only login conflicts with social media login requirement"
    })
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.conflict.get_provider", return_value=mock_provider):
        result = detect_conflicts(_get_meeting_uuid(meeting), test_db)

    assert len(result.conflicts) == 1
    assert len(result.added) == 0
    assert len(result.skipped) == 0
    assert result.conflicts[0].decision == "conflict"
    assert result.conflicts[0].classification == "contradiction"
    assert result.conflicts[0].matched_requirement is not None


# =============================================
# Tests for edge cases
# =============================================

def test_meeting_not_found_raises_error(test_db: Session) -> None:
    """Test that conflict detection fails for non-existent meeting."""
    fake_meeting_id = uuid4()

    with pytest.raises(ConflictDetectionError) as exc_info:
        detect_conflicts(fake_meeting_id, test_db)

    assert "Meeting not found" in str(exc_info.value)


def test_meeting_with_wrong_status_raises_error(test_db: Session) -> None:
    """Test that conflict detection fails if meeting status is not 'processed'."""
    project = _create_test_project(test_db)
    meeting = _create_test_meeting(
        test_db,
        _get_project_id(project),
        status=MeetingStatus.pending  # Wrong status
    )

    with pytest.raises(ConflictDetectionError) as exc_info:
        detect_conflicts(_get_meeting_uuid(meeting), test_db)

    assert "must have status 'processed'" in str(exc_info.value)


def test_empty_meeting_returns_empty_result(test_db: Session) -> None:
    """Test that meeting with no items returns empty result."""
    project = _create_test_project(test_db)
    meeting = _create_test_meeting(test_db, _get_project_id(project))
    # No meeting items created

    result = detect_conflicts(_get_meeting_uuid(meeting), test_db)

    assert len(result.added) == 0
    assert len(result.skipped) == 0
    assert len(result.conflicts) == 0


def test_deleted_meeting_items_are_excluded(test_db: Session) -> None:
    """Test that deleted meeting items are not processed."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    meeting = _create_test_meeting(test_db, project_id)

    # Create a deleted meeting item
    deleted_item = MeetingItem(
        meeting_id=cast(str, meeting.id),
        section=Section.needs_and_goals,
        content="This should be ignored",
        source_quote=None,
        order=0,
        is_deleted=True  # Deleted
    )
    test_db.add(deleted_item)
    test_db.commit()

    result = detect_conflicts(_get_meeting_uuid(meeting), test_db)

    assert len(result.added) == 0
    assert len(result.skipped) == 0
    assert len(result.conflicts) == 0


def test_inactive_requirements_are_excluded(test_db: Session) -> None:
    """Test that inactive requirements are not considered for matching."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create an inactive requirement
    inactive_req = Requirement(
        project_id=project_id,
        section=Section.requirements,
        content="User must log in",
        order=0,
        is_active=False  # Inactive
    )
    test_db.add(inactive_req)
    test_db.commit()

    # Create a meeting item with the same content
    meeting = _create_test_meeting(test_db, project_id)
    _create_test_meeting_item(
        test_db,
        cast(str, meeting.id),
        Section.requirements,
        "User must log in"
    )

    # Should be added as new since inactive requirement is not considered
    result = detect_conflicts(_get_meeting_uuid(meeting), test_db)

    assert len(result.added) == 1
    assert len(result.skipped) == 0
    assert result.added[0].reason == "No existing requirements in this section"


def test_llm_failure_creates_conflict_for_manual_review(test_db: Session) -> None:
    """Test that LLM failure results in conflict for manual review."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(
        test_db,
        project_id,
        Section.requirements,
        "Existing requirement"
    )

    meeting = _create_test_meeting(test_db, project_id)
    _create_test_meeting_item(
        test_db,
        cast(str, meeting.id),
        Section.requirements,
        "New item content"
    )

    # Mock LLM to return invalid JSON
    mock_provider = MockLLMProvider("not valid json")

    with patch("app.services.conflict.get_provider", return_value=mock_provider):
        result = detect_conflicts(_get_meeting_uuid(meeting), test_db)

    # Should create a conflict for manual review
    assert len(result.conflicts) == 1
    assert "review manually" in result.conflicts[0].reason.lower()


# =============================================
# Tests for _parse_classification_response helper
# =============================================

def test_parse_classification_response_valid_json() -> None:
    """Test parsing valid JSON classification response."""
    response = json.dumps({
        "classification": "new",
        "reason": "Completely different"
    })

    result = _parse_classification_response(response)

    assert result["classification"] == "new"
    assert result["reason"] == "Completely different"


def test_parse_classification_response_strips_markdown() -> None:
    """Test that markdown code blocks are stripped from response."""
    json_content = json.dumps({
        "classification": "duplicate",
        "reason": "Same meaning"
    })
    response = f"```json\n{json_content}\n```"

    result = _parse_classification_response(response)

    assert result["classification"] == "duplicate"


def test_parse_classification_response_invalid_json_raises_error() -> None:
    """Test that invalid JSON raises ConflictDetectionError."""
    with pytest.raises(ConflictDetectionError) as exc_info:
        _parse_classification_response("not valid json")

    assert "Invalid JSON" in str(exc_info.value)


def test_parse_classification_response_missing_classification_raises_error() -> None:
    """Test that missing classification field raises error."""
    response = json.dumps({"reason": "Some reason"})

    with pytest.raises(ConflictDetectionError) as exc_info:
        _parse_classification_response(response)

    assert "missing 'classification'" in str(exc_info.value)


def test_parse_classification_response_invalid_classification_raises_error() -> None:
    """Test that invalid classification value raises error."""
    response = json.dumps({
        "classification": "unknown_value",
        "reason": "Some reason"
    })

    with pytest.raises(ConflictDetectionError) as exc_info:
        _parse_classification_response(response)

    assert "Invalid classification" in str(exc_info.value)


def test_parse_classification_response_non_object_raises_error() -> None:
    """Test that non-object JSON raises error."""
    response = json.dumps(["not", "an", "object"])

    with pytest.raises(ConflictDetectionError) as exc_info:
        _parse_classification_response(response)

    assert "must be a JSON object" in str(exc_info.value)
