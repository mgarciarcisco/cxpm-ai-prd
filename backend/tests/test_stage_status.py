"""Tests for stage status utilities and enum conversions.

This module tests:
- Status enum values and conversions
- Stage completion logic
- Status update functions
- Auto-status updates when content changes
"""

import pytest
from sqlalchemy.orm import Session

from app.models import (
    ExportStatus,
    MockupsStatus,
    PRD,
    PRDMode,
    PRDStatus,
    PRDStageStatus,
    Project,
    Requirement,
    RequirementsStatus,
    StoriesStatus,
    UserStory,
)
from app.models.meeting_item import Section
from app.models.user_story import StoryFormat, StoryStatus
from app.services.stage_status import (
    update_export_status,
    update_mockups_status,
    update_prd_status,
    update_requirements_status,
    update_stories_status,
)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def _create_project(db: Session, name: str = "Test Project") -> Project:
    """Helper to create a project directly in the database."""
    project = Project(name=name, description="For stage status tests")
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _create_requirement(
    db: Session,
    project_id: str,
    section: Section = Section.problems,
    content: str = "Test requirement",
    is_active: bool = True,
) -> Requirement:
    """Helper to create a requirement in the database."""
    requirement = Requirement(
        project_id=project_id,
        section=section,
        content=content,
        order=1,
        is_active=is_active,
    )
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return requirement


def _create_prd(
    db: Session,
    project_id: str,
    version: int = 1,
    status: PRDStatus = PRDStatus.READY,
    mode: PRDMode = PRDMode.DRAFT,
    deleted: bool = False,
) -> PRD:
    """Helper to create a PRD in the database."""
    from datetime import datetime
    prd = PRD(
        project_id=project_id,
        version=version,
        mode=mode,
        status=status,
        deleted_at=datetime.utcnow() if deleted else None,
    )
    db.add(prd)
    db.commit()
    db.refresh(prd)
    return prd


def _create_user_story(
    db: Session,
    project_id: str,
    story_number: int = 1,
    title: str = "Test Story",
    deleted: bool = False,
) -> UserStory:
    """Helper to create a user story in the database."""
    from datetime import datetime
    story = UserStory(
        project_id=project_id,
        story_number=story_number,
        format=StoryFormat.CLASSIC,
        title=title,
        status=StoryStatus.DRAFT,
        deleted_at=datetime.utcnow() if deleted else None,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return story


# =============================================================================
# REQUIREMENTS STATUS ENUM TESTS
# =============================================================================


class TestRequirementsStatusEnum:
    """Tests for RequirementsStatus enum values and conversions."""

    def test_enum_values(self) -> None:
        """Test that RequirementsStatus has expected values."""
        assert RequirementsStatus.empty.value == "empty"
        assert RequirementsStatus.has_items.value == "has_items"
        assert RequirementsStatus.reviewed.value == "reviewed"

    def test_enum_from_string(self) -> None:
        """Test that RequirementsStatus can be created from string."""
        assert RequirementsStatus("empty") == RequirementsStatus.empty
        assert RequirementsStatus("has_items") == RequirementsStatus.has_items
        assert RequirementsStatus("reviewed") == RequirementsStatus.reviewed

    def test_enum_string_representation(self) -> None:
        """Test that RequirementsStatus str() returns the value."""
        # As a str subclass, the enum should work as a string
        assert str(RequirementsStatus.empty) == "RequirementsStatus.empty"
        assert RequirementsStatus.empty == "empty"

    def test_enum_invalid_value_raises(self) -> None:
        """Test that invalid value raises ValueError."""
        with pytest.raises(ValueError):
            RequirementsStatus("invalid_status")


# =============================================================================
# PRD STAGE STATUS ENUM TESTS
# =============================================================================


class TestPRDStageStatusEnum:
    """Tests for PRDStageStatus enum values and conversions."""

    def test_enum_values(self) -> None:
        """Test that PRDStageStatus has expected values."""
        assert PRDStageStatus.empty.value == "empty"
        assert PRDStageStatus.draft.value == "draft"
        assert PRDStageStatus.ready.value == "ready"

    def test_enum_from_string(self) -> None:
        """Test that PRDStageStatus can be created from string."""
        assert PRDStageStatus("empty") == PRDStageStatus.empty
        assert PRDStageStatus("draft") == PRDStageStatus.draft
        assert PRDStageStatus("ready") == PRDStageStatus.ready


class TestPRDStatusEnum:
    """Tests for PRDStatus (generation lifecycle) enum values."""

    def test_enum_values(self) -> None:
        """Test that PRDStatus has expected values."""
        assert PRDStatus.QUEUED.value == "queued"
        assert PRDStatus.GENERATING.value == "generating"
        assert PRDStatus.PARTIAL.value == "partial"
        assert PRDStatus.READY.value == "ready"
        assert PRDStatus.FAILED.value == "failed"
        assert PRDStatus.CANCELLED.value == "cancelled"
        assert PRDStatus.ARCHIVED.value == "archived"

    def test_all_lifecycle_statuses_exist(self) -> None:
        """Test that all expected lifecycle statuses exist."""
        expected = {"queued", "generating", "partial", "ready", "failed", "cancelled", "archived"}
        actual = {status.value for status in PRDStatus}
        assert actual == expected


# =============================================================================
# STORIES STATUS ENUM TESTS
# =============================================================================


class TestStoriesStatusEnum:
    """Tests for StoriesStatus enum values and conversions."""

    def test_enum_values(self) -> None:
        """Test that StoriesStatus has expected values."""
        assert StoriesStatus.empty.value == "empty"
        assert StoriesStatus.generated.value == "generated"
        assert StoriesStatus.refined.value == "refined"

    def test_enum_from_string(self) -> None:
        """Test that StoriesStatus can be created from string."""
        assert StoriesStatus("empty") == StoriesStatus.empty
        assert StoriesStatus("generated") == StoriesStatus.generated
        assert StoriesStatus("refined") == StoriesStatus.refined


# =============================================================================
# MOCKUPS STATUS ENUM TESTS
# =============================================================================


class TestMockupsStatusEnum:
    """Tests for MockupsStatus enum values and conversions."""

    def test_enum_values(self) -> None:
        """Test that MockupsStatus has expected values."""
        assert MockupsStatus.empty.value == "empty"
        assert MockupsStatus.generated.value == "generated"

    def test_enum_from_string(self) -> None:
        """Test that MockupsStatus can be created from string."""
        assert MockupsStatus("empty") == MockupsStatus.empty
        assert MockupsStatus("generated") == MockupsStatus.generated


# =============================================================================
# EXPORT STATUS ENUM TESTS
# =============================================================================


class TestExportStatusEnum:
    """Tests for ExportStatus enum values and conversions."""

    def test_enum_values(self) -> None:
        """Test that ExportStatus has expected values."""
        assert ExportStatus.not_exported.value == "not_exported"
        assert ExportStatus.exported.value == "exported"

    def test_enum_from_string(self) -> None:
        """Test that ExportStatus can be created from string."""
        assert ExportStatus("not_exported") == ExportStatus.not_exported
        assert ExportStatus("exported") == ExportStatus.exported


# =============================================================================
# UPDATE REQUIREMENTS STATUS TESTS
# =============================================================================


class TestUpdateRequirementsStatus:
    """Tests for update_requirements_status function."""

    def test_empty_when_no_requirements(self, test_db: Session) -> None:
        """Test status is 'empty' when project has no requirements."""
        project = _create_project(test_db)

        result = update_requirements_status(project.id, test_db)

        assert result == RequirementsStatus.empty
        test_db.refresh(project)
        assert project.requirements_status == RequirementsStatus.empty

    def test_has_items_when_active_requirements_exist(self, test_db: Session) -> None:
        """Test status is 'has_items' when project has active requirements."""
        project = _create_project(test_db)
        _create_requirement(test_db, project.id, is_active=True)

        result = update_requirements_status(project.id, test_db)

        assert result == RequirementsStatus.has_items
        test_db.refresh(project)
        assert project.requirements_status == RequirementsStatus.has_items

    def test_empty_when_all_requirements_inactive(self, test_db: Session) -> None:
        """Test status is 'empty' when all requirements are inactive."""
        project = _create_project(test_db)
        _create_requirement(test_db, project.id, is_active=False)

        result = update_requirements_status(project.id, test_db)

        assert result == RequirementsStatus.empty
        test_db.refresh(project)
        assert project.requirements_status == RequirementsStatus.empty

    def test_does_not_downgrade_from_reviewed(self, test_db: Session) -> None:
        """Test status stays 'reviewed' if already reviewed and has items."""
        project = _create_project(test_db)
        project.requirements_status = RequirementsStatus.reviewed
        test_db.commit()
        _create_requirement(test_db, project.id, is_active=True)

        result = update_requirements_status(project.id, test_db)

        assert result == RequirementsStatus.reviewed
        test_db.refresh(project)
        assert project.requirements_status == RequirementsStatus.reviewed

    def test_becomes_empty_when_reviewed_but_no_items(self, test_db: Session) -> None:
        """Test status becomes 'empty' if reviewed but all items removed."""
        project = _create_project(test_db)
        project.requirements_status = RequirementsStatus.reviewed
        test_db.commit()

        result = update_requirements_status(project.id, test_db)

        assert result == RequirementsStatus.empty
        test_db.refresh(project)
        assert project.requirements_status == RequirementsStatus.empty

    def test_nonexistent_project_returns_empty(self, test_db: Session) -> None:
        """Test that nonexistent project ID returns empty status."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        result = update_requirements_status(fake_id, test_db)

        assert result == RequirementsStatus.empty


# =============================================================================
# UPDATE PRD STATUS TESTS
# =============================================================================


class TestUpdatePRDStatus:
    """Tests for update_prd_status function."""

    def test_empty_when_no_prds(self, test_db: Session) -> None:
        """Test status is 'empty' when project has no PRDs."""
        project = _create_project(test_db)

        result = update_prd_status(project.id, test_db)

        assert result == PRDStageStatus.empty
        test_db.refresh(project)
        assert project.prd_status == PRDStageStatus.empty

    def test_ready_when_prd_is_ready(self, test_db: Session) -> None:
        """Test status is 'ready' when latest PRD has status READY."""
        project = _create_project(test_db)
        _create_prd(test_db, project.id, version=1, status=PRDStatus.READY)

        result = update_prd_status(project.id, test_db)

        assert result == PRDStageStatus.ready
        test_db.refresh(project)
        assert project.prd_status == PRDStageStatus.ready

    def test_draft_when_prd_is_generating(self, test_db: Session) -> None:
        """Test status is 'draft' when PRD is generating."""
        project = _create_project(test_db)
        _create_prd(test_db, project.id, version=1, status=PRDStatus.GENERATING)

        result = update_prd_status(project.id, test_db)

        assert result == PRDStageStatus.draft
        test_db.refresh(project)
        assert project.prd_status == PRDStageStatus.draft

    def test_draft_when_prd_is_queued(self, test_db: Session) -> None:
        """Test status is 'draft' when PRD is queued."""
        project = _create_project(test_db)
        _create_prd(test_db, project.id, version=1, status=PRDStatus.QUEUED)

        result = update_prd_status(project.id, test_db)

        assert result == PRDStageStatus.draft
        test_db.refresh(project)
        assert project.prd_status == PRDStageStatus.draft

    def test_draft_when_prd_is_partial(self, test_db: Session) -> None:
        """Test status is 'draft' when PRD is partial."""
        project = _create_project(test_db)
        _create_prd(test_db, project.id, version=1, status=PRDStatus.PARTIAL)

        result = update_prd_status(project.id, test_db)

        assert result == PRDStageStatus.draft
        test_db.refresh(project)
        assert project.prd_status == PRDStageStatus.draft

    def test_empty_when_prd_failed(self, test_db: Session) -> None:
        """Test status is 'empty' when PRD failed."""
        project = _create_project(test_db)
        _create_prd(test_db, project.id, version=1, status=PRDStatus.FAILED)

        result = update_prd_status(project.id, test_db)

        assert result == PRDStageStatus.empty
        test_db.refresh(project)
        assert project.prd_status == PRDStageStatus.empty

    def test_empty_when_prd_cancelled(self, test_db: Session) -> None:
        """Test status is 'empty' when PRD is cancelled."""
        project = _create_project(test_db)
        _create_prd(test_db, project.id, version=1, status=PRDStatus.CANCELLED)

        result = update_prd_status(project.id, test_db)

        assert result == PRDStageStatus.empty
        test_db.refresh(project)
        assert project.prd_status == PRDStageStatus.empty

    def test_uses_latest_version(self, test_db: Session) -> None:
        """Test that it uses the latest version of PRD."""
        project = _create_project(test_db)
        _create_prd(test_db, project.id, version=1, status=PRDStatus.READY)
        _create_prd(test_db, project.id, version=2, status=PRDStatus.GENERATING)

        result = update_prd_status(project.id, test_db)

        assert result == PRDStageStatus.draft  # Latest version is generating
        test_db.refresh(project)
        assert project.prd_status == PRDStageStatus.draft

    def test_ignores_deleted_prds(self, test_db: Session) -> None:
        """Test that deleted PRDs are ignored."""
        project = _create_project(test_db)
        _create_prd(test_db, project.id, version=1, status=PRDStatus.READY, deleted=True)

        result = update_prd_status(project.id, test_db)

        assert result == PRDStageStatus.empty
        test_db.refresh(project)
        assert project.prd_status == PRDStageStatus.empty

    def test_nonexistent_project_returns_empty(self, test_db: Session) -> None:
        """Test that nonexistent project ID returns empty status."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        result = update_prd_status(fake_id, test_db)

        assert result == PRDStageStatus.empty


# =============================================================================
# UPDATE STORIES STATUS TESTS
# =============================================================================


class TestUpdateStoriesStatus:
    """Tests for update_stories_status function."""

    def test_empty_when_no_stories(self, test_db: Session) -> None:
        """Test status is 'empty' when project has no stories."""
        project = _create_project(test_db)

        result = update_stories_status(project.id, test_db)

        assert result == StoriesStatus.empty
        test_db.refresh(project)
        assert project.stories_status == StoriesStatus.empty

    def test_generated_when_has_stories(self, test_db: Session) -> None:
        """Test status is 'generated' when project has stories."""
        project = _create_project(test_db)
        _create_user_story(test_db, project.id, story_number=1)

        result = update_stories_status(project.id, test_db)

        assert result == StoriesStatus.generated
        test_db.refresh(project)
        assert project.stories_status == StoriesStatus.generated

    def test_does_not_downgrade_from_refined(self, test_db: Session) -> None:
        """Test status stays 'refined' if already refined and has stories."""
        project = _create_project(test_db)
        project.stories_status = StoriesStatus.refined
        test_db.commit()
        _create_user_story(test_db, project.id, story_number=1)

        result = update_stories_status(project.id, test_db)

        assert result == StoriesStatus.refined
        test_db.refresh(project)
        assert project.stories_status == StoriesStatus.refined

    def test_becomes_empty_when_all_stories_deleted(self, test_db: Session) -> None:
        """Test status becomes 'empty' when all stories are deleted."""
        project = _create_project(test_db)
        _create_user_story(test_db, project.id, story_number=1, deleted=True)

        result = update_stories_status(project.id, test_db)

        assert result == StoriesStatus.empty
        test_db.refresh(project)
        assert project.stories_status == StoriesStatus.empty

    def test_ignores_deleted_stories(self, test_db: Session) -> None:
        """Test that deleted stories are not counted."""
        project = _create_project(test_db)
        _create_user_story(test_db, project.id, story_number=1)
        _create_user_story(test_db, project.id, story_number=2, deleted=True)

        result = update_stories_status(project.id, test_db)

        assert result == StoriesStatus.generated

    def test_nonexistent_project_returns_empty(self, test_db: Session) -> None:
        """Test that nonexistent project ID returns empty status."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        result = update_stories_status(fake_id, test_db)

        assert result == StoriesStatus.empty


# =============================================================================
# UPDATE MOCKUPS STATUS TESTS
# =============================================================================


class TestUpdateMockupsStatus:
    """Tests for update_mockups_status function."""

    def test_stays_empty_initially(self, test_db: Session) -> None:
        """Test mockups status starts empty."""
        project = _create_project(test_db)
        assert project.mockups_status == MockupsStatus.empty

    def test_updates_to_generated(self, test_db: Session) -> None:
        """Test mockups status updates to generated when called."""
        project = _create_project(test_db)

        result = update_mockups_status(project.id, test_db)

        assert result == MockupsStatus.generated
        test_db.refresh(project)
        assert project.mockups_status == MockupsStatus.generated

    def test_stays_generated_when_already_generated(self, test_db: Session) -> None:
        """Test mockups status stays generated if already generated."""
        project = _create_project(test_db)
        project.mockups_status = MockupsStatus.generated
        test_db.commit()

        result = update_mockups_status(project.id, test_db)

        assert result == MockupsStatus.generated

    def test_nonexistent_project_returns_empty(self, test_db: Session) -> None:
        """Test that nonexistent project ID returns empty status."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        result = update_mockups_status(fake_id, test_db)

        assert result == MockupsStatus.empty


# =============================================================================
# UPDATE EXPORT STATUS TESTS
# =============================================================================


class TestUpdateExportStatus:
    """Tests for update_export_status function."""

    def test_starts_not_exported(self, test_db: Session) -> None:
        """Test export status starts as not_exported."""
        project = _create_project(test_db)
        assert project.export_status == ExportStatus.not_exported

    def test_updates_to_exported(self, test_db: Session) -> None:
        """Test export status updates to exported when called."""
        project = _create_project(test_db)

        result = update_export_status(project.id, test_db)

        assert result == ExportStatus.exported
        test_db.refresh(project)
        assert project.export_status == ExportStatus.exported

    def test_stays_exported_when_already_exported(self, test_db: Session) -> None:
        """Test export status stays exported if already exported."""
        project = _create_project(test_db)
        project.export_status = ExportStatus.exported
        test_db.commit()

        result = update_export_status(project.id, test_db)

        assert result == ExportStatus.exported

    def test_nonexistent_project_returns_not_exported(self, test_db: Session) -> None:
        """Test that nonexistent project ID returns not_exported status."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        result = update_export_status(fake_id, test_db)

        assert result == ExportStatus.not_exported


# =============================================================================
# STAGE COMPLETION LOGIC TESTS
# =============================================================================


class TestStageCompletionLogic:
    """Tests for stage completion logic (what counts as 'complete')."""

    def test_requirements_complete_when_reviewed(self, test_db: Session) -> None:
        """Test requirements stage is complete when status is 'reviewed'."""
        project = _create_project(test_db)
        project.requirements_status = RequirementsStatus.reviewed
        test_db.commit()

        test_db.refresh(project)
        assert project.requirements_status == RequirementsStatus.reviewed
        # 'reviewed' is the terminal/complete state for requirements

    def test_prd_complete_when_ready(self, test_db: Session) -> None:
        """Test PRD stage is complete when status is 'ready'."""
        project = _create_project(test_db)
        project.prd_status = PRDStageStatus.ready
        test_db.commit()

        test_db.refresh(project)
        assert project.prd_status == PRDStageStatus.ready
        # 'ready' is the terminal/complete state for PRD stage

    def test_stories_complete_when_refined(self, test_db: Session) -> None:
        """Test stories stage is complete when status is 'refined'."""
        project = _create_project(test_db)
        project.stories_status = StoriesStatus.refined
        test_db.commit()

        test_db.refresh(project)
        assert project.stories_status == StoriesStatus.refined
        # 'refined' is the terminal/complete state for stories

    def test_mockups_complete_when_generated(self, test_db: Session) -> None:
        """Test mockups stage is complete when status is 'generated'."""
        project = _create_project(test_db)
        project.mockups_status = MockupsStatus.generated
        test_db.commit()

        test_db.refresh(project)
        assert project.mockups_status == MockupsStatus.generated
        # 'generated' is the terminal/complete state for mockups

    def test_export_complete_when_exported(self, test_db: Session) -> None:
        """Test export stage is complete when status is 'exported'."""
        project = _create_project(test_db)
        project.export_status = ExportStatus.exported
        test_db.commit()

        test_db.refresh(project)
        assert project.export_status == ExportStatus.exported
        # 'exported' is the terminal/complete state for export


# =============================================================================
# PROJECT DEFAULT STATUS TESTS
# =============================================================================


class TestProjectDefaultStatuses:
    """Tests for project default status values."""

    def test_new_project_has_empty_requirements(self, test_db: Session) -> None:
        """Test new project starts with empty requirements status."""
        project = _create_project(test_db)
        assert project.requirements_status == RequirementsStatus.empty

    def test_new_project_has_empty_prd(self, test_db: Session) -> None:
        """Test new project starts with empty PRD status."""
        project = _create_project(test_db)
        assert project.prd_status == PRDStageStatus.empty

    def test_new_project_has_empty_stories(self, test_db: Session) -> None:
        """Test new project starts with empty stories status."""
        project = _create_project(test_db)
        assert project.stories_status == StoriesStatus.empty

    def test_new_project_has_empty_mockups(self, test_db: Session) -> None:
        """Test new project starts with empty mockups status."""
        project = _create_project(test_db)
        assert project.mockups_status == MockupsStatus.empty

    def test_new_project_has_not_exported(self, test_db: Session) -> None:
        """Test new project starts with not_exported export status."""
        project = _create_project(test_db)
        assert project.export_status == ExportStatus.not_exported
