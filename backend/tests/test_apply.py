"""Tests for the apply and resolve endpoints.

This module tests:
- POST /api/meetings/{id}/apply - Conflict detection and categorization
- POST /api/meetings/{id}/resolve - Requirement creation and decision recording
"""

import json
from datetime import date
from typing import cast
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    Action,
    Actor,
    MeetingItem,
    MeetingItemDecision,
    MeetingRecap,
    Project,
    Requirement,
    RequirementHistory,
    RequirementSource,
)
from app.models.meeting_item import Section
from app.models.meeting_item_decision import Decision
from app.models.meeting_recap import InputType, MeetingStatus

# =============================================
# Test helpers
# =============================================


def _get_id(obj: Project | MeetingRecap | MeetingItem | Requirement) -> str:
    """Get object ID as string for type safety."""
    return cast(str, obj.id)


def _create_project(db: Session, name: str = "Test Project") -> Project:
    """Create a test project."""
    project = Project(name=name, user_id="test-user-0000-0000-000000000001", description="For apply/resolve tests")
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _create_meeting(
    db: Session,
    project_id: str,
    status: MeetingStatus = MeetingStatus.processed,
    title: str = "Test Meeting",
) -> MeetingRecap:
    """Create a test meeting recap."""
    meeting = MeetingRecap(
        project_id=project_id,
        user_id="test-user-0000-0000-000000000001",
        title=title,
        meeting_date=date(2026, 1, 22),
        raw_input="Test meeting notes",
        input_type=InputType.txt,
        status=status,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def _create_meeting_item(
    db: Session,
    meeting_id: str,
    section: Section,
    content: str,
    source_quote: str | None = None,
    order: int = 1,
) -> MeetingItem:
    """Create a test meeting item."""
    item = MeetingItem(
        meeting_id=meeting_id,
        section=section,
        content=content,
        source_quote=source_quote,
        order=order,
        is_deleted=False,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _create_requirement(
    db: Session,
    project_id: str,
    section: Section,
    content: str,
    order: int = 1,
) -> Requirement:
    """Create a test requirement."""
    req = Requirement(
        project_id=project_id,
        section=section,
        content=content,
        order=order,
        is_active=True,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


class MockLLMProvider:
    """Mock LLM provider for testing."""

    def __init__(self, response: str):
        self.response = response

    def generate(
        self,
        prompt: str,
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> str:
        return self.response


# =============================================
# Tests for apply endpoint
# =============================================


def test_apply_endpoint_returns_categorized_items(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that apply endpoint returns categorized items (added, skipped, conflicts)."""
    project = _create_project(test_db)
    meeting = _create_meeting(test_db, _get_id(project))

    # Create a meeting item in a section with no requirements
    _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.problems,
        "Users are having difficulty finding features",
    )

    response = auth_client.post(f"/api/meetings/{_get_id(meeting)}/apply")

    assert response.status_code == 200
    data = response.json()
    assert "added" in data
    assert "skipped" in data
    assert "conflicts" in data
    assert len(data["added"]) == 1
    assert len(data["skipped"]) == 0
    assert len(data["conflicts"]) == 0


def test_apply_endpoint_detects_exact_duplicates(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that apply endpoint detects exact duplicates and marks them as skipped."""
    project = _create_project(test_db)

    # Create existing requirement
    _create_requirement(
        test_db,
        _get_id(project),
        Section.functional_requirements,
        "User must be able to log in",
    )

    meeting = _create_meeting(test_db, _get_id(project))

    # Create meeting item with exact same content
    _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.functional_requirements,
        "User must be able to log in",
    )

    response = auth_client.post(f"/api/meetings/{_get_id(meeting)}/apply")

    assert response.status_code == 200
    data = response.json()
    assert len(data["added"]) == 0
    assert len(data["skipped"]) == 1
    assert data["skipped"][0]["decision"] == "skipped_duplicate"


def test_apply_endpoint_returns_404_for_missing_meeting(
    auth_client: TestClient,
) -> None:
    """Test that apply endpoint returns 404 for non-existent meeting."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = auth_client.post(f"/api/meetings/{fake_id}/apply")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_apply_endpoint_returns_400_for_non_processed_meeting(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that apply endpoint returns 400 if meeting status is not processed."""
    project = _create_project(test_db)
    meeting = _create_meeting(test_db, _get_id(project), status=MeetingStatus.pending)

    response = auth_client.post(f"/api/meetings/{_get_id(meeting)}/apply")

    assert response.status_code == 400
    assert "processed" in response.json()["detail"].lower()


def test_apply_endpoint_with_conflicts(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that apply endpoint correctly identifies conflicts."""
    project = _create_project(test_db)

    # Create existing requirement
    _create_requirement(
        test_db,
        _get_id(project),
        Section.functional_requirements,
        "User must log in with email only",
    )

    meeting = _create_meeting(test_db, _get_id(project))

    # Create meeting item that contradicts
    _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.functional_requirements,
        "User must log in with social accounts",
    )

    # Mock LLM to return "contradiction" classification
    mock_response = json.dumps({
        "classification": "contradiction",
        "reason": "Email-only conflicts with social login",
    })
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.conflict.get_provider", return_value=mock_provider):
        response = auth_client.post(f"/api/meetings/{_get_id(meeting)}/apply")

    assert response.status_code == 200
    data = response.json()
    assert len(data["conflicts"]) == 1
    assert data["conflicts"][0]["classification"] == "contradiction"


# =============================================
# Tests for resolve endpoint creating requirements
# =============================================


def test_resolve_endpoint_creates_requirements_for_added_items(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint creates requirements for added items."""
    project = _create_project(test_db)
    meeting = _create_meeting(test_db, _get_id(project))

    item = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.problems,
        "Users need better search functionality",
        source_quote="We need better search",
    )

    # Send resolve request with 'added' decision
    resolve_payload = {
        "decisions": [
            {
                "item_id": _get_id(item),
                "decision": "added",
            }
        ]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )

    assert response.status_code == 200
    data = response.json()
    assert data["added"] == 1
    assert data["skipped"] == 0

    # Verify requirement was created in database
    requirements = test_db.query(Requirement).filter(
        Requirement.project_id == _get_id(project)
    ).all()
    assert len(requirements) == 1
    assert requirements[0].content == "Users need better search functionality"
    assert requirements[0].section == Section.problems
    assert requirements[0].is_active is True


def test_resolve_endpoint_returns_404_for_missing_meeting(
    auth_client: TestClient,
) -> None:
    """Test that resolve endpoint returns 404 for non-existent meeting."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = auth_client.post(
        f"/api/meetings/{fake_id}/resolve", json={"decisions": []}
    )

    assert response.status_code == 404


def test_resolve_endpoint_returns_400_for_non_processed_meeting(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint returns 400 if meeting status is not processed."""
    project = _create_project(test_db)
    meeting = _create_meeting(test_db, _get_id(project), status=MeetingStatus.pending)

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json={"decisions": []}
    )

    assert response.status_code == 400


# =============================================
# Tests for decision recording in MeetingItemDecision
# =============================================


def test_resolve_records_added_decision(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint records 'added' decisions in MeetingItemDecision table."""
    project = _create_project(test_db)
    meeting = _create_meeting(test_db, _get_id(project))

    item = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.functional_requirements,
        "New feature requirement",
    )

    resolve_payload = {
        "decisions": [{"item_id": _get_id(item), "decision": "added"}]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200

    # Check decision was recorded
    decisions = test_db.query(MeetingItemDecision).filter(
        MeetingItemDecision.meeting_item_id == _get_id(item)
    ).all()
    assert len(decisions) == 1
    assert decisions[0].decision == Decision.added
    assert decisions[0].reason == "New requirement added"


def test_resolve_records_skipped_duplicate_decision(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint records 'skipped_duplicate' decisions."""
    project = _create_project(test_db)

    # Create existing requirement
    existing_req = _create_requirement(
        test_db,
        _get_id(project),
        Section.functional_requirements,
        "Existing requirement",
    )

    meeting = _create_meeting(test_db, _get_id(project))

    item = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.functional_requirements,
        "Same content",
    )

    resolve_payload = {
        "decisions": [
            {
                "item_id": _get_id(item),
                "decision": "skipped_duplicate",
                "matched_requirement_id": _get_id(existing_req),
            }
        ]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200

    # Check decision was recorded
    decisions = test_db.query(MeetingItemDecision).filter(
        MeetingItemDecision.meeting_item_id == _get_id(item)
    ).all()
    assert len(decisions) == 1
    assert decisions[0].decision == Decision.skipped_duplicate
    assert decisions[0].matched_requirement_id == _get_id(existing_req)


def test_resolve_records_conflict_merged_decision(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint records 'conflict_merged' decisions."""
    project = _create_project(test_db)

    existing_req = _create_requirement(
        test_db,
        _get_id(project),
        Section.functional_requirements,
        "Original requirement",
    )

    meeting = _create_meeting(test_db, _get_id(project))

    item = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.functional_requirements,
        "New content to merge",
    )

    resolve_payload = {
        "decisions": [
            {
                "item_id": _get_id(item),
                "decision": "conflict_merged",
                "matched_requirement_id": _get_id(existing_req),
                "merged_text": "Original requirement with new merged content",
            }
        ]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200

    # Check decision was recorded
    decisions = test_db.query(MeetingItemDecision).filter(
        MeetingItemDecision.meeting_item_id == _get_id(item)
    ).all()
    assert len(decisions) == 1
    assert decisions[0].decision == Decision.conflict_merged
    assert decisions[0].matched_requirement_id == _get_id(existing_req)


def test_resolve_records_conflict_replaced_decision(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint records 'conflict_replaced' decisions."""
    project = _create_project(test_db)

    existing_req = _create_requirement(
        test_db,
        _get_id(project),
        Section.functional_requirements,
        "Old content to replace",
    )

    meeting = _create_meeting(test_db, _get_id(project))

    item = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.functional_requirements,
        "New replacement content",
    )

    resolve_payload = {
        "decisions": [
            {
                "item_id": _get_id(item),
                "decision": "conflict_replaced",
                "matched_requirement_id": _get_id(existing_req),
            }
        ]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200
    assert response.json()["replaced"] == 1

    # Check decision was recorded
    decisions = test_db.query(MeetingItemDecision).filter(
        MeetingItemDecision.meeting_item_id == _get_id(item)
    ).all()
    assert len(decisions) == 1
    assert decisions[0].decision == Decision.conflict_replaced


# =============================================
# Tests for RequirementHistory recording
# =============================================


def test_resolve_creates_history_for_added_requirements(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint creates RequirementHistory for added requirements."""
    project = _create_project(test_db)
    meeting = _create_meeting(test_db, _get_id(project))

    item = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.problems,
        "New problem statement",
    )

    resolve_payload = {
        "decisions": [{"item_id": _get_id(item), "decision": "added"}]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200

    # Get the created requirement
    req = test_db.query(Requirement).filter(
        Requirement.project_id == _get_id(project)
    ).first()
    assert req is not None

    # Check history was created
    history = test_db.query(RequirementHistory).filter(
        RequirementHistory.requirement_id == _get_id(req)
    ).all()
    assert len(history) == 1
    assert history[0].actor == Actor.ai_extraction
    assert history[0].action == Action.created
    assert history[0].old_content is None
    assert history[0].new_content == "New problem statement"
    assert history[0].meeting_id == _get_id(meeting)


def test_resolve_creates_history_for_merged_requirements(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint creates RequirementHistory with ai_merge actor for merged requirements."""
    project = _create_project(test_db)

    existing_req = _create_requirement(
        test_db,
        _get_id(project),
        Section.functional_requirements,
        "Original content",
    )

    meeting = _create_meeting(test_db, _get_id(project))

    item = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.functional_requirements,
        "Additional content",
    )

    resolve_payload = {
        "decisions": [
            {
                "item_id": _get_id(item),
                "decision": "conflict_merged",
                "matched_requirement_id": _get_id(existing_req),
                "merged_text": "Original content combined with additional content",
            }
        ]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200

    # Check history was created with ai_merge actor and merged action
    history = test_db.query(RequirementHistory).filter(
        RequirementHistory.requirement_id == _get_id(existing_req)
    ).all()
    assert len(history) == 1
    assert history[0].actor == Actor.ai_merge
    assert history[0].action == Action.merged
    assert history[0].old_content == "Original content"
    assert history[0].new_content == "Original content combined with additional content"


def test_resolve_creates_history_for_replaced_requirements(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint creates RequirementHistory for replaced requirements."""
    project = _create_project(test_db)

    existing_req = _create_requirement(
        test_db,
        _get_id(project),
        Section.functional_requirements,
        "Old requirement content",
    )

    meeting = _create_meeting(test_db, _get_id(project))

    item = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.functional_requirements,
        "New replacement content",
    )

    resolve_payload = {
        "decisions": [
            {
                "item_id": _get_id(item),
                "decision": "conflict_replaced",
                "matched_requirement_id": _get_id(existing_req),
            }
        ]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200

    # Check history was created
    history = test_db.query(RequirementHistory).filter(
        RequirementHistory.requirement_id == _get_id(existing_req)
    ).all()
    assert len(history) == 1
    assert history[0].actor == Actor.ai_extraction
    assert history[0].action == Action.modified
    assert history[0].old_content == "Old requirement content"
    assert history[0].new_content == "New replacement content"


# =============================================
# Tests for RequirementSource creation
# =============================================


def test_resolve_creates_requirement_source_for_added_items(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint creates RequirementSource linking requirement to meeting and meeting_item."""
    project = _create_project(test_db)
    meeting = _create_meeting(test_db, _get_id(project))

    item = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.user_goals,
        "Users want faster performance",
        source_quote="We need things to be faster",
    )

    resolve_payload = {
        "decisions": [{"item_id": _get_id(item), "decision": "added"}]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200

    # Get the created requirement
    req = test_db.query(Requirement).filter(
        Requirement.project_id == _get_id(project)
    ).first()
    assert req is not None

    # Check RequirementSource was created
    sources = test_db.query(RequirementSource).filter(
        RequirementSource.requirement_id == _get_id(req)
    ).all()
    assert len(sources) == 1
    assert sources[0].meeting_id == _get_id(meeting)
    assert sources[0].meeting_item_id == _get_id(item)
    assert sources[0].source_quote == "We need things to be faster"


def test_resolve_creates_requirement_source_for_merged_items(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint creates RequirementSource for merged requirements."""
    project = _create_project(test_db)

    existing_req = _create_requirement(
        test_db,
        _get_id(project),
        Section.functional_requirements,
        "Original content",
    )

    meeting = _create_meeting(test_db, _get_id(project))

    item = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.functional_requirements,
        "Additional content",
        source_quote="From the meeting discussion",
    )

    resolve_payload = {
        "decisions": [
            {
                "item_id": _get_id(item),
                "decision": "conflict_merged",
                "matched_requirement_id": _get_id(existing_req),
                "merged_text": "Merged content",
            }
        ]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200

    # Check RequirementSource was created for the existing requirement
    sources = test_db.query(RequirementSource).filter(
        RequirementSource.requirement_id == _get_id(existing_req)
    ).all()
    assert len(sources) == 1
    assert sources[0].meeting_id == _get_id(meeting)
    assert sources[0].meeting_item_id == _get_id(item)
    assert sources[0].source_quote == "From the meeting discussion"


def test_resolve_creates_requirement_source_for_replaced_items(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint creates RequirementSource for replaced requirements."""
    project = _create_project(test_db)

    existing_req = _create_requirement(
        test_db,
        _get_id(project),
        Section.functional_requirements,
        "Old content",
    )

    meeting = _create_meeting(test_db, _get_id(project))

    item = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.functional_requirements,
        "New replacement content",
        source_quote="Updated requirement from meeting",
    )

    resolve_payload = {
        "decisions": [
            {
                "item_id": _get_id(item),
                "decision": "conflict_replaced",
                "matched_requirement_id": _get_id(existing_req),
            }
        ]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200

    # Check RequirementSource was created
    sources = test_db.query(RequirementSource).filter(
        RequirementSource.requirement_id == _get_id(existing_req)
    ).all()
    assert len(sources) == 1
    assert sources[0].meeting_id == _get_id(meeting)
    assert sources[0].meeting_item_id == _get_id(item)
    assert sources[0].source_quote == "Updated requirement from meeting"


# =============================================
# Tests for status transition to applied
# =============================================


def test_resolve_updates_meeting_status_to_applied(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint updates meeting status to applied."""
    project = _create_project(test_db)
    meeting = _create_meeting(test_db, _get_id(project))

    item = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.problems,
        "Test problem",
    )

    resolve_payload = {
        "decisions": [{"item_id": _get_id(item), "decision": "added"}]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200

    # Refresh meeting from database
    test_db.refresh(meeting)
    assert meeting.status == MeetingStatus.applied


def test_resolve_sets_applied_at_timestamp(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint sets applied_at timestamp on meeting."""
    project = _create_project(test_db)
    meeting = _create_meeting(test_db, _get_id(project))

    # Verify applied_at is initially None
    assert meeting.applied_at is None

    item = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.problems,
        "Test problem",
    )

    resolve_payload = {
        "decisions": [{"item_id": _get_id(item), "decision": "added"}]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200

    # Refresh meeting from database
    test_db.refresh(meeting)
    assert meeting.applied_at is not None


def test_resolve_with_empty_decisions_still_updates_status(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve with empty decisions still updates meeting status to applied."""
    project = _create_project(test_db)
    meeting = _create_meeting(test_db, _get_id(project))

    resolve_payload: dict[str, list[dict[str, str]]] = {"decisions": []}

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200

    # Refresh meeting from database
    test_db.refresh(meeting)
    assert meeting.status == MeetingStatus.applied
    assert meeting.applied_at is not None


# =============================================
# Tests for multiple decisions in single resolve
# =============================================


def test_resolve_handles_multiple_decisions(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint handles multiple decisions in a single request."""
    project = _create_project(test_db)

    # Create existing requirement for skipping
    existing_req = _create_requirement(
        test_db,
        _get_id(project),
        Section.functional_requirements,
        "Existing requirement",
    )

    meeting = _create_meeting(test_db, _get_id(project))

    # Create multiple meeting items
    item1 = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.problems,
        "New problem",
    )
    item2 = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.functional_requirements,
        "Duplicate content",
    )
    item3 = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.user_goals,
        "User goal to add",
    )

    resolve_payload = {
        "decisions": [
            {"item_id": _get_id(item1), "decision": "added"},
            {
                "item_id": _get_id(item2),
                "decision": "skipped_duplicate",
                "matched_requirement_id": _get_id(existing_req),
            },
            {"item_id": _get_id(item3), "decision": "added"},
        ]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200
    data = response.json()
    assert data["added"] == 2
    assert data["skipped"] == 1

    # Verify requirements were created
    requirements = test_db.query(Requirement).filter(
        Requirement.project_id == _get_id(project),
        Requirement.is_active == True,
    ).all()
    # 1 existing + 2 new = 3 total
    assert len(requirements) == 3

    # Verify decisions were recorded
    decisions = test_db.query(MeetingItemDecision).all()
    assert len(decisions) == 3


def test_resolve_returns_correct_counts(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that resolve endpoint returns correct counts for all decision types."""
    project = _create_project(test_db)

    existing_req = _create_requirement(
        test_db,
        _get_id(project),
        Section.functional_requirements,
        "Existing for replace",
    )

    existing_req2 = _create_requirement(
        test_db,
        _get_id(project),
        Section.problems,
        "Existing for merge",
    )

    meeting = _create_meeting(test_db, _get_id(project))

    # Create items for each decision type
    item_added = _create_meeting_item(
        test_db, _get_id(meeting), Section.user_goals, "Added item"
    )
    item_skipped = _create_meeting_item(
        test_db, _get_id(meeting), Section.constraints, "Skipped item"
    )
    item_replaced = _create_meeting_item(
        test_db, _get_id(meeting), Section.functional_requirements, "Replacement"
    )
    item_merged = _create_meeting_item(
        test_db, _get_id(meeting), Section.problems, "Merged content"
    )

    resolve_payload = {
        "decisions": [
            {"item_id": _get_id(item_added), "decision": "added"},
            {
                "item_id": _get_id(item_skipped),
                "decision": "skipped_semantic",
                "matched_requirement_id": None,
            },
            {
                "item_id": _get_id(item_replaced),
                "decision": "conflict_replaced",
                "matched_requirement_id": _get_id(existing_req),
            },
            {
                "item_id": _get_id(item_merged),
                "decision": "conflict_merged",
                "matched_requirement_id": _get_id(existing_req2),
                "merged_text": "Merged result",
            },
        ]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200
    data = response.json()
    assert data["added"] == 1
    assert data["skipped"] == 1
    assert data["replaced"] == 1
    assert data["merged"] == 1


def test_resolve_conflict_kept_both_creates_new_requirement(
    auth_client: TestClient, test_db: Session
) -> None:
    """Test that 'conflict_kept_both' decision creates a new requirement alongside existing."""
    project = _create_project(test_db)

    existing_req = _create_requirement(
        test_db,
        _get_id(project),
        Section.functional_requirements,
        "Existing requirement",
    )

    meeting = _create_meeting(test_db, _get_id(project))

    item = _create_meeting_item(
        test_db,
        _get_id(meeting),
        Section.functional_requirements,
        "New requirement to keep alongside",
    )

    resolve_payload = {
        "decisions": [
            {
                "item_id": _get_id(item),
                "decision": "conflict_kept_both",
                "matched_requirement_id": _get_id(existing_req),
            }
        ]
    }

    response = auth_client.post(
        f"/api/meetings/{_get_id(meeting)}/resolve", json=resolve_payload
    )
    assert response.status_code == 200
    assert response.json()["added"] == 1

    # Verify both requirements exist
    requirements = test_db.query(Requirement).filter(
        Requirement.project_id == _get_id(project),
        Requirement.section == Section.functional_requirements,
        Requirement.is_active == True,
    ).all()
    assert len(requirements) == 2

    # Check decision was recorded correctly
    decisions = test_db.query(MeetingItemDecision).filter(
        MeetingItemDecision.meeting_item_id == _get_id(item)
    ).all()
    assert len(decisions) == 1
    assert decisions[0].decision == Decision.conflict_kept_both
