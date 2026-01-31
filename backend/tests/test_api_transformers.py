"""Unit tests for API response transformers.

Tests the transformation of database models to API response schemas:
- Project data transformation (model to response)
- Requirements list transformation
- PRD response handling
- User stories response handling
- Computed fields (like progress)

These tests verify that Pydantic schemas correctly serialize SQLAlchemy models
using the `from_attributes=True` configuration.
"""

from datetime import datetime
from typing import cast

import pytest
from sqlalchemy.orm import Session

from app.models import (
    PRD,
    MeetingRecap,
    Project,
    Requirement,
    RequirementHistory,
    RequirementSource,
    StoryBatch,
    UserStory,
)
from app.models.meeting_item import Section
from app.models.meeting_recap import InputType, MeetingStatus
from app.models.prd import PRDMode, PRDStatus
from app.models.project import (
    ExportStatus,
    MockupsStatus,
    PRDStageStatus,
    RequirementsStatus,
    StoriesStatus,
)
from app.models.requirement_history import Action, Actor
from app.models.story_batch import StoryBatchStatus
from app.models.user_story import StoryFormat, StoryPriority, StorySize, StoryStatus
from app.schemas import (
    PRDResponse,
    PRDSection,
    PRDStatusResponse,
    PRDSummary,
    ProgressResponse,
    ProjectResponse,
    ProjectStatsResponse,
    RequirementHistoryResponse,
    RequirementResponse,
    RequirementsListResponse,
    RequirementSourceResponse,
    SectionCount,
    StoryBatchResponse,
    StoryBatchStatusResponse,
    UserStoryResponse,
)

# =============================================================================
# Helper Functions
# =============================================================================


def _create_test_project(
    db: Session,
    name: str = "Test Project",
    description: str | None = "Test description",
    archived: bool = False,
    requirements_status: RequirementsStatus = RequirementsStatus.empty,
    prd_status: PRDStageStatus = PRDStageStatus.empty,
    stories_status: StoriesStatus = StoriesStatus.empty,
    mockups_status: MockupsStatus = MockupsStatus.empty,
    export_status: ExportStatus = ExportStatus.not_exported,
) -> Project:
    """Create a test project with specified attributes."""
    project = Project(
        name=name,
        description=description,
        archived=archived,
        requirements_status=requirements_status,
        prd_status=prd_status,
        stories_status=stories_status,
        mockups_status=mockups_status,
        export_status=export_status,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _create_test_requirement(
    db: Session,
    project_id: str,
    section: Section = Section.problems,
    content: str = "Test requirement content",
    order: int = 0,
    is_active: bool = True,
) -> Requirement:
    """Create a test requirement."""
    requirement = Requirement(
        project_id=project_id,
        section=section,
        content=content,
        order=order,
        is_active=is_active,
    )
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return requirement


def _create_test_meeting(
    db: Session,
    project_id: str,
    title: str = "Test Meeting",
    status: MeetingStatus = MeetingStatus.applied,
) -> MeetingRecap:
    """Create a test meeting recap."""
    from datetime import date

    meeting = MeetingRecap(
        project_id=project_id,
        title=title,
        meeting_date=date.today(),
        raw_input="Test meeting content",
        input_type=InputType.txt,
        status=status,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def _create_test_requirement_source(
    db: Session,
    requirement_id: str,
    meeting_id: str,
    source_quote: str | None = "Quoted text from meeting",
) -> RequirementSource:
    """Create a test requirement source."""
    source = RequirementSource(
        requirement_id=requirement_id,
        meeting_id=meeting_id,
        source_quote=source_quote,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


def _create_test_requirement_history(
    db: Session,
    requirement_id: str,
    actor: Actor = Actor.user,
    action: Action = Action.created,
    old_content: str | None = None,
    new_content: str | None = "New content",
) -> RequirementHistory:
    """Create a test requirement history entry."""
    history = RequirementHistory(
        requirement_id=requirement_id,
        actor=actor,
        action=action,
        old_content=old_content,
        new_content=new_content,
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return history


def _create_test_prd(
    db: Session,
    project_id: str,
    version: int = 1,
    title: str = "Test PRD",
    mode: PRDMode = PRDMode.DRAFT,
    status: PRDStatus = PRDStatus.READY,
    sections: list[dict] | None = None,
    raw_markdown: str | None = None,
    error_message: str | None = None,
) -> PRD:
    """Create a test PRD."""
    if sections is None:
        sections = [
            {"title": "Executive Summary", "content": "Summary content"},
            {"title": "Problem Statement", "content": "Problem content"},
        ]
    if raw_markdown is None:
        raw_markdown = "# Test PRD\n\n## Executive Summary\n\nSummary content"

    prd = PRD(
        project_id=project_id,
        version=version,
        title=title,
        mode=mode,
        status=status,
        sections=sections,
        raw_markdown=raw_markdown,
        error_message=error_message,
    )
    db.add(prd)
    db.commit()
    db.refresh(prd)
    return prd


def _create_test_story_batch(
    db: Session,
    project_id: str,
    format: StoryFormat = StoryFormat.CLASSIC,
    status: StoryBatchStatus = StoryBatchStatus.READY,
    story_count: int = 0,
    section_filter: list[str] | None = None,
    error_message: str | None = None,
) -> StoryBatch:
    """Create a test story batch."""
    batch = StoryBatch(
        project_id=project_id,
        format=format,
        status=status,
        story_count=story_count,
        section_filter=section_filter,
        error_message=error_message,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def _create_test_user_story(
    db: Session,
    project_id: str,
    batch_id: str | None = None,
    story_number: int = 1,
    title: str = "Test Story",
    description: str | None = "As a user, I want to test things",
    acceptance_criteria: list[str] | None = None,
    format: StoryFormat = StoryFormat.CLASSIC,
    size: StorySize = StorySize.M,
    priority: StoryPriority = StoryPriority.P2,
    labels: list[str] | None = None,
    status: StoryStatus = StoryStatus.DRAFT,
    requirement_ids: list[str] | None = None,
    order: int = 0,
) -> UserStory:
    """Create a test user story."""
    if acceptance_criteria is None:
        acceptance_criteria = ["Given X", "When Y", "Then Z"]
    if labels is None:
        labels = ["test"]
    if requirement_ids is None:
        requirement_ids = []

    story = UserStory(
        project_id=project_id,
        batch_id=batch_id,
        story_number=story_number,
        title=title,
        description=description,
        acceptance_criteria=acceptance_criteria,
        format=format,
        size=size,
        priority=priority,
        labels=labels,
        status=status,
        requirement_ids=requirement_ids,
        order=order,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return story


def _get_id(model: Project | Requirement | PRD | UserStory | StoryBatch | MeetingRecap | RequirementSource | RequirementHistory) -> str:
    """Get model ID as string for type safety."""
    return cast(str, model.id)


# =============================================================================
# Test: Project Response Transformation
# =============================================================================


class TestProjectTransformation:
    """Tests for Project model to ProjectResponse transformation."""

    def test_project_basic_fields_transform(self, test_db: Session) -> None:
        """Test that basic Project fields transform correctly to ProjectResponse."""
        project = _create_test_project(
            test_db,
            name="My Project",
            description="My description",
            archived=False,
        )

        response = ProjectResponse.model_validate(project)

        assert response.id == _get_id(project)
        assert response.name == "My Project"
        assert response.description == "My description"
        assert response.archived is False
        assert isinstance(response.created_at, datetime)
        assert isinstance(response.updated_at, datetime)

    def test_project_null_description_transforms(self, test_db: Session) -> None:
        """Test that null description transforms correctly."""
        project = _create_test_project(test_db, description=None)

        response = ProjectResponse.model_validate(project)

        assert response.description is None

    def test_project_archived_flag_transforms(self, test_db: Session) -> None:
        """Test that archived flag transforms correctly."""
        project = _create_test_project(test_db, archived=True)

        response = ProjectResponse.model_validate(project)

        assert response.archived is True

    def test_project_stage_statuses_transform(self, test_db: Session) -> None:
        """Test that all stage statuses transform correctly."""
        project = _create_test_project(
            test_db,
            requirements_status=RequirementsStatus.has_items,
            prd_status=PRDStageStatus.draft,
            stories_status=StoriesStatus.generated,
            mockups_status=MockupsStatus.generated,
            export_status=ExportStatus.exported,
        )

        response = ProjectResponse.model_validate(project)

        assert response.requirements_status.value == "has_items"
        assert response.prd_status.value == "draft"
        assert response.stories_status.value == "generated"
        assert response.mockups_status.value == "generated"
        assert response.export_status.value == "exported"

    def test_project_progress_computed_field(self, test_db: Session) -> None:
        """Test that progress computed field calculates correctly."""
        # Empty project = 0%
        project_empty = _create_test_project(test_db, name="Empty Project")
        response_empty = ProjectResponse.model_validate(project_empty)
        assert response_empty.progress == 0

        # Fully complete project = 100%
        project_full = _create_test_project(
            test_db,
            name="Full Project",
            requirements_status=RequirementsStatus.reviewed,
            prd_status=PRDStageStatus.ready,
            stories_status=StoriesStatus.refined,
            mockups_status=MockupsStatus.generated,
            export_status=ExportStatus.exported,
        )
        response_full = ProjectResponse.model_validate(project_full)
        assert response_full.progress == 100

    def test_project_partial_progress(self, test_db: Session) -> None:
        """Test partial progress calculations."""
        # Requirements has_items (10%) + PRD draft (10%) = 20%
        project = _create_test_project(
            test_db,
            requirements_status=RequirementsStatus.has_items,
            prd_status=PRDStageStatus.draft,
        )

        response = ProjectResponse.model_validate(project)

        assert response.progress == 20

    def test_project_timestamps_transform(self, test_db: Session) -> None:
        """Test that timestamps transform correctly."""
        project = _create_test_project(test_db)

        response = ProjectResponse.model_validate(project)

        assert response.created_at is not None
        assert response.updated_at is not None
        assert response.created_at <= response.updated_at


class TestProgressResponse:
    """Tests for ProgressResponse transformation."""

    def test_progress_response_all_fields(self, test_db: Session) -> None:
        """Test that ProgressResponse includes all stage statuses and progress."""
        project = _create_test_project(
            test_db,
            requirements_status=RequirementsStatus.reviewed,
            prd_status=PRDStageStatus.ready,
            stories_status=StoriesStatus.refined,
            mockups_status=MockupsStatus.generated,
            export_status=ExportStatus.exported,
        )

        # Create ProgressResponse manually (as API does)
        response = ProgressResponse(
            requirements_status=project.requirements_status,
            prd_status=project.prd_status,
            stories_status=project.stories_status,
            mockups_status=project.mockups_status,
            export_status=project.export_status,
            progress=100,  # Would be calculated in API
        )

        assert response.requirements_status.value == "reviewed"
        assert response.prd_status.value == "ready"
        assert response.stories_status.value == "refined"
        assert response.mockups_status.value == "generated"
        assert response.export_status.value == "exported"
        assert response.progress == 100


class TestProjectStatsResponse:
    """Tests for ProjectStatsResponse transformation."""

    def test_project_stats_empty_project(self, test_db: Session) -> None:
        """Test ProjectStatsResponse for empty project."""
        response = ProjectStatsResponse(
            meeting_count=0,
            requirement_count=0,
            requirement_counts_by_section=[],
            last_activity=None,
        )

        assert response.meeting_count == 0
        assert response.requirement_count == 0
        assert response.requirement_counts_by_section == []
        assert response.last_activity is None

    def test_project_stats_with_data(self, test_db: Session) -> None:
        """Test ProjectStatsResponse with actual data."""
        now = datetime.utcnow()
        section_counts = [
            SectionCount(section="problems", count=3),
            SectionCount(section="user_goals", count=2),
        ]

        response = ProjectStatsResponse(
            meeting_count=5,
            requirement_count=10,
            requirement_counts_by_section=section_counts,
            last_activity=now,
        )

        assert response.meeting_count == 5
        assert response.requirement_count == 10
        assert len(response.requirement_counts_by_section) == 2
        assert response.requirement_counts_by_section[0].section == "problems"
        assert response.requirement_counts_by_section[0].count == 3
        assert response.last_activity == now


# =============================================================================
# Test: Requirements Response Transformation
# =============================================================================


class TestRequirementTransformation:
    """Tests for Requirement model to RequirementResponse transformation."""

    def test_requirement_basic_fields_transform(self, test_db: Session) -> None:
        """Test that basic Requirement fields transform correctly."""
        project = _create_test_project(test_db)
        requirement = _create_test_requirement(
            test_db,
            project_id=_get_id(project),
            section=Section.problems,
            content="User needs better search",
            order=5,
        )

        response = RequirementResponse.model_validate(requirement)

        assert response.id == _get_id(requirement)
        assert response.section == Section.problems
        assert response.content == "User needs better search"
        assert response.order == 5

    def test_requirement_all_sections(self, test_db: Session) -> None:
        """Test that all section types transform correctly."""
        project = _create_test_project(test_db)

        for section in Section:
            requirement = _create_test_requirement(
                test_db,
                project_id=_get_id(project),
                section=section,
                content=f"Requirement for {section.value}",
            )

            response = RequirementResponse.model_validate(requirement)

            assert response.section == section

    def test_requirement_sources_default_empty(self, test_db: Session) -> None:
        """Test that sources default to empty list."""
        project = _create_test_project(test_db)
        requirement = _create_test_requirement(test_db, project_id=_get_id(project))

        response = RequirementResponse(
            id=_get_id(requirement),
            section=requirement.section,
            content=requirement.content,
            order=requirement.order,
        )

        assert response.sources == []

    def test_requirement_history_count_default(self, test_db: Session) -> None:
        """Test that history_count defaults to 0."""
        project = _create_test_project(test_db)
        requirement = _create_test_requirement(test_db, project_id=_get_id(project))

        response = RequirementResponse(
            id=_get_id(requirement),
            section=requirement.section,
            content=requirement.content,
            order=requirement.order,
        )

        assert response.history_count == 0


class TestRequirementSourceTransformation:
    """Tests for RequirementSource model to RequirementSourceResponse transformation."""

    def test_requirement_source_basic_transform(self, test_db: Session) -> None:
        """Test that RequirementSource transforms correctly."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, project_id=_get_id(project))
        requirement = _create_test_requirement(test_db, project_id=_get_id(project))
        source = _create_test_requirement_source(
            test_db,
            requirement_id=_get_id(requirement),
            meeting_id=_get_id(meeting),
            source_quote="Important quote from meeting",
        )

        response = RequirementSourceResponse.model_validate(source)

        assert response.id == _get_id(source)
        assert response.meeting_id == _get_id(meeting)
        assert response.source_quote == "Important quote from meeting"
        assert isinstance(response.created_at, datetime)

    def test_requirement_source_null_quote(self, test_db: Session) -> None:
        """Test that null source_quote transforms correctly."""
        project = _create_test_project(test_db)
        meeting = _create_test_meeting(test_db, project_id=_get_id(project))
        requirement = _create_test_requirement(test_db, project_id=_get_id(project))
        source = _create_test_requirement_source(
            test_db,
            requirement_id=_get_id(requirement),
            meeting_id=_get_id(meeting),
            source_quote=None,
        )

        response = RequirementSourceResponse.model_validate(source)

        assert response.source_quote is None


class TestRequirementHistoryTransformation:
    """Tests for RequirementHistory model to RequirementHistoryResponse transformation."""

    def test_requirement_history_basic_transform(self, test_db: Session) -> None:
        """Test that RequirementHistory transforms correctly."""
        project = _create_test_project(test_db)
        requirement = _create_test_requirement(test_db, project_id=_get_id(project))
        history = _create_test_requirement_history(
            test_db,
            requirement_id=_get_id(requirement),
            actor=Actor.user,
            action=Action.modified,
            old_content="Old content",
            new_content="New content",
        )

        response = RequirementHistoryResponse.model_validate(history)

        assert response.id == _get_id(history)
        assert response.actor == Actor.user
        assert response.action == Action.modified
        assert response.old_content == "Old content"
        assert response.new_content == "New content"
        assert isinstance(response.created_at, datetime)

    def test_requirement_history_all_actors(self, test_db: Session) -> None:
        """Test all actor types transform correctly."""
        project = _create_test_project(test_db)
        requirement = _create_test_requirement(test_db, project_id=_get_id(project))

        for actor in Actor:
            history = _create_test_requirement_history(
                test_db,
                requirement_id=_get_id(requirement),
                actor=actor,
            )

            response = RequirementHistoryResponse.model_validate(history)

            assert response.actor == actor

    def test_requirement_history_all_actions(self, test_db: Session) -> None:
        """Test all action types transform correctly."""
        project = _create_test_project(test_db)
        requirement = _create_test_requirement(test_db, project_id=_get_id(project))

        for action in Action:
            history = _create_test_requirement_history(
                test_db,
                requirement_id=_get_id(requirement),
                action=action,
            )

            response = RequirementHistoryResponse.model_validate(history)

            assert response.action == action


class TestRequirementsListTransformation:
    """Tests for RequirementsListResponse transformation."""

    def test_requirements_list_empty(self) -> None:
        """Test empty RequirementsListResponse."""
        response = RequirementsListResponse()

        assert response.problems == []
        assert response.user_goals == []
        assert response.functional_requirements == []
        assert response.data_needs == []
        assert response.constraints == []
        assert response.non_goals == []
        assert response.risks_assumptions == []
        assert response.open_questions == []
        assert response.action_items == []

    def test_requirements_list_with_items(self, test_db: Session) -> None:
        """Test RequirementsListResponse with items in multiple sections."""
        project = _create_test_project(test_db)

        # Create requirements in different sections
        req1 = _create_test_requirement(
            test_db, project_id=_get_id(project), section=Section.problems, content="Problem 1"
        )
        req2 = _create_test_requirement(
            test_db, project_id=_get_id(project), section=Section.user_goals, content="Goal 1"
        )

        # Convert to response format
        problems = [RequirementResponse(
            id=_get_id(req1),
            section=req1.section,
            content=req1.content,
            order=req1.order,
        )]
        user_goals = [RequirementResponse(
            id=_get_id(req2),
            section=req2.section,
            content=req2.content,
            order=req2.order,
        )]

        response = RequirementsListResponse(
            problems=problems,
            user_goals=user_goals,
        )

        assert len(response.problems) == 1
        assert response.problems[0].content == "Problem 1"
        assert len(response.user_goals) == 1
        assert response.user_goals[0].content == "Goal 1"


# =============================================================================
# Test: PRD Response Transformation
# =============================================================================


class TestPRDTransformation:
    """Tests for PRD model to PRDResponse transformation."""

    def test_prd_basic_fields_transform(self, test_db: Session) -> None:
        """Test that basic PRD fields transform correctly."""
        project = _create_test_project(test_db)
        prd = _create_test_prd(
            test_db,
            project_id=_get_id(project),
            version=2,
            title="My PRD Title",
            mode=PRDMode.DETAILED,
            status=PRDStatus.READY,
        )

        response = PRDResponse.model_validate(prd)

        assert response.id == _get_id(prd)
        assert response.project_id == _get_id(project)
        assert response.version == 2
        assert response.title == "My PRD Title"
        assert response.mode == PRDMode.DETAILED
        assert response.status == PRDStatus.READY

    def test_prd_sections_transform(self, test_db: Session) -> None:
        """Test that PRD sections transform correctly."""
        project = _create_test_project(test_db)
        sections = [
            {"title": "Section 1", "content": "Content 1"},
            {"title": "Section 2", "content": "Content 2"},
            {"title": "Section 3", "content": "Content 3"},
        ]
        prd = _create_test_prd(
            test_db,
            project_id=_get_id(project),
            sections=sections,
        )

        response = PRDResponse.model_validate(prd)

        assert response.sections is not None
        assert len(response.sections) == 3
        # Sections are validated as PRDSection objects when using model_validate
        # But when coming from JSON column they may be dicts
        first_section = response.sections[0]
        if isinstance(first_section, dict):
            assert first_section["title"] == "Section 1"
            assert first_section["content"] == "Content 1"
        else:
            assert first_section.title == "Section 1"
            assert first_section.content == "Content 1"

    def test_prd_raw_markdown_transform(self, test_db: Session) -> None:
        """Test that raw_markdown transforms correctly."""
        project = _create_test_project(test_db)
        markdown = "# PRD\n\n## Summary\n\nThis is the summary."
        prd = _create_test_prd(
            test_db,
            project_id=_get_id(project),
            raw_markdown=markdown,
        )

        response = PRDResponse.model_validate(prd)

        assert response.raw_markdown == markdown

    def test_prd_all_statuses(self, test_db: Session) -> None:
        """Test all PRD status values transform correctly."""
        project = _create_test_project(test_db)

        for i, status in enumerate(PRDStatus, start=1):
            prd = _create_test_prd(
                test_db,
                project_id=_get_id(project),
                version=i,
                status=status,
            )

            response = PRDResponse.model_validate(prd)

            assert response.status == status

    def test_prd_all_modes(self, test_db: Session) -> None:
        """Test all PRD mode values transform correctly."""
        project = _create_test_project(test_db)

        for i, mode in enumerate(PRDMode, start=1):
            prd = _create_test_prd(
                test_db,
                project_id=_get_id(project),
                version=i,
                mode=mode,
            )

            response = PRDResponse.model_validate(prd)

            assert response.mode == mode

    def test_prd_error_message_transform(self, test_db: Session) -> None:
        """Test that error_message transforms correctly."""
        project = _create_test_project(test_db)
        prd = _create_test_prd(
            test_db,
            project_id=_get_id(project),
            status=PRDStatus.FAILED,
            error_message="AI generation failed",
        )

        response = PRDResponse.model_validate(prd)

        assert response.error_message == "AI generation failed"

    def test_prd_null_optional_fields(self, test_db: Session) -> None:
        """Test that null optional fields transform correctly."""
        project = _create_test_project(test_db)
        prd = _create_test_prd(
            test_db,
            project_id=_get_id(project),
            title=None,
            sections=None,
            raw_markdown=None,
            error_message=None,
        )
        # Manually set to None to test null handling
        prd.title = None
        prd.sections = None
        prd.raw_markdown = None
        test_db.commit()
        test_db.refresh(prd)

        response = PRDResponse.model_validate(prd)

        assert response.title is None
        assert response.sections is None
        assert response.raw_markdown is None
        assert response.error_message is None

    def test_prd_timestamps_transform(self, test_db: Session) -> None:
        """Test that PRD timestamps transform correctly."""
        project = _create_test_project(test_db)
        prd = _create_test_prd(test_db, project_id=_get_id(project))

        response = PRDResponse.model_validate(prd)

        assert isinstance(response.created_at, datetime)
        assert isinstance(response.updated_at, datetime)


class TestPRDStatusResponseTransformation:
    """Tests for PRDStatusResponse transformation."""

    def test_prd_status_response_transform(self, test_db: Session) -> None:
        """Test PRDStatusResponse from PRD model."""
        project = _create_test_project(test_db)
        prd = _create_test_prd(
            test_db,
            project_id=_get_id(project),
            version=3,
            status=PRDStatus.GENERATING,
        )

        response = PRDStatusResponse.model_validate(prd)

        assert response.id == _get_id(prd)
        assert response.status == PRDStatus.GENERATING
        assert response.version == 3
        assert response.error_message is None

    def test_prd_status_response_with_error(self, test_db: Session) -> None:
        """Test PRDStatusResponse with error message."""
        project = _create_test_project(test_db)
        prd = _create_test_prd(
            test_db,
            project_id=_get_id(project),
            status=PRDStatus.FAILED,
            error_message="Rate limit exceeded",
        )

        response = PRDStatusResponse.model_validate(prd)

        assert response.status == PRDStatus.FAILED
        assert response.error_message == "Rate limit exceeded"


class TestPRDSummaryTransformation:
    """Tests for PRDSummary transformation."""

    def test_prd_summary_transform(self, test_db: Session) -> None:
        """Test PRDSummary from PRD model (list view)."""
        project = _create_test_project(test_db)
        prd = _create_test_prd(
            test_db,
            project_id=_get_id(project),
            version=1,
            title="Summary PRD",
            mode=PRDMode.DRAFT,
            status=PRDStatus.READY,
        )

        response = PRDSummary.model_validate(prd)

        assert response.id == _get_id(prd)
        assert response.project_id == _get_id(project)
        assert response.version == 1
        assert response.title == "Summary PRD"
        assert response.mode == PRDMode.DRAFT
        assert response.status == PRDStatus.READY
        # PRDSummary should NOT include sections or raw_markdown


class TestPRDSectionTransformation:
    """Tests for PRDSection schema."""

    def test_prd_section_creation(self) -> None:
        """Test PRDSection schema creation."""
        section = PRDSection(
            title="Executive Summary",
            content="This is the executive summary content.",
        )

        assert section.title == "Executive Summary"
        assert section.content == "This is the executive summary content."

    def test_prd_section_required_fields(self) -> None:
        """Test that PRDSection requires both title and content."""
        # This should raise validation error
        with pytest.raises(Exception):
            PRDSection(title="Only title")  # type: ignore


# =============================================================================
# Test: User Stories Response Transformation
# =============================================================================


class TestUserStoryTransformation:
    """Tests for UserStory model to UserStoryResponse transformation."""

    def test_user_story_basic_fields_transform(self, test_db: Session) -> None:
        """Test that basic UserStory fields transform correctly."""
        project = _create_test_project(test_db)
        batch = _create_test_story_batch(test_db, project_id=_get_id(project))
        story = _create_test_user_story(
            test_db,
            project_id=_get_id(project),
            batch_id=_get_id(batch),
            story_number=42,
            title="User Login",
            description="As a user, I want to log in",
            order=5,
        )

        response = UserStoryResponse.model_validate(story)

        assert response.id == _get_id(story)
        assert response.project_id == _get_id(project)
        assert response.batch_id == _get_id(batch)
        assert response.story_number == 42
        assert response.title == "User Login"
        assert response.description == "As a user, I want to log in"
        assert response.order == 5

    def test_user_story_computed_story_id(self, test_db: Session) -> None:
        """Test that story_id computed property formats correctly."""
        project = _create_test_project(test_db)

        # Test various story numbers
        test_cases = [
            (1, "US-001"),
            (10, "US-010"),
            (100, "US-100"),
            (999, "US-999"),
        ]

        for story_number, expected_story_id in test_cases:
            story = _create_test_user_story(
                test_db,
                project_id=_get_id(project),
                story_number=story_number,
            )

            response = UserStoryResponse.model_validate(story)

            assert response.story_id == expected_story_id

    def test_user_story_acceptance_criteria_transform(self, test_db: Session) -> None:
        """Test that acceptance_criteria list transforms correctly."""
        project = _create_test_project(test_db)
        criteria = [
            "Given user is on login page",
            "When user enters valid credentials",
            "Then user is redirected to dashboard",
        ]
        story = _create_test_user_story(
            test_db,
            project_id=_get_id(project),
            acceptance_criteria=criteria,
        )

        response = UserStoryResponse.model_validate(story)

        assert response.acceptance_criteria == criteria

    def test_user_story_labels_transform(self, test_db: Session) -> None:
        """Test that labels list transforms correctly."""
        project = _create_test_project(test_db)
        labels = ["auth", "mvp", "high-priority"]
        story = _create_test_user_story(
            test_db,
            project_id=_get_id(project),
            labels=labels,
        )

        response = UserStoryResponse.model_validate(story)

        assert response.labels == labels

    def test_user_story_all_sizes(self, test_db: Session) -> None:
        """Test all StorySize values transform correctly."""
        project = _create_test_project(test_db)

        for i, size in enumerate(StorySize, start=1):
            story = _create_test_user_story(
                test_db,
                project_id=_get_id(project),
                story_number=i,
                size=size,
            )

            response = UserStoryResponse.model_validate(story)

            assert response.size == size

    def test_user_story_all_priorities(self, test_db: Session) -> None:
        """Test all StoryPriority values transform correctly."""
        project = _create_test_project(test_db)

        for i, priority in enumerate(StoryPriority, start=100):
            story = _create_test_user_story(
                test_db,
                project_id=_get_id(project),
                story_number=i,
                priority=priority,
            )

            response = UserStoryResponse.model_validate(story)

            assert response.priority == priority

    def test_user_story_all_statuses(self, test_db: Session) -> None:
        """Test all StoryStatus values transform correctly."""
        project = _create_test_project(test_db)

        for i, status in enumerate(StoryStatus, start=200):
            story = _create_test_user_story(
                test_db,
                project_id=_get_id(project),
                story_number=i,
                status=status,
            )

            response = UserStoryResponse.model_validate(story)

            assert response.status == status

    def test_user_story_all_formats(self, test_db: Session) -> None:
        """Test all StoryFormat values transform correctly."""
        project = _create_test_project(test_db)

        for i, format in enumerate(StoryFormat, start=300):
            story = _create_test_user_story(
                test_db,
                project_id=_get_id(project),
                story_number=i,
                format=format,
            )

            response = UserStoryResponse.model_validate(story)

            assert response.format == format

    def test_user_story_requirement_ids_transform(self, test_db: Session) -> None:
        """Test that requirement_ids list transforms correctly."""
        project = _create_test_project(test_db)
        req_ids = ["uuid-1", "uuid-2", "uuid-3"]
        story = _create_test_user_story(
            test_db,
            project_id=_get_id(project),
            requirement_ids=req_ids,
        )

        response = UserStoryResponse.model_validate(story)

        assert response.requirement_ids == req_ids

    def test_user_story_null_optional_fields(self, test_db: Session) -> None:
        """Test that null optional fields transform correctly."""
        project = _create_test_project(test_db)
        story = _create_test_user_story(
            test_db,
            project_id=_get_id(project),
            batch_id=None,
            description=None,
            acceptance_criteria=None,
            labels=None,
            size=None,
            priority=None,
            requirement_ids=None,
        )
        # Set nullable fields to None
        story.size = None
        story.priority = None
        test_db.commit()
        test_db.refresh(story)

        response = UserStoryResponse.model_validate(story)

        assert response.batch_id is None
        assert response.description is None
        assert response.size is None
        assert response.priority is None

    def test_user_story_timestamps_transform(self, test_db: Session) -> None:
        """Test that UserStory timestamps transform correctly."""
        project = _create_test_project(test_db)
        story = _create_test_user_story(test_db, project_id=_get_id(project))

        response = UserStoryResponse.model_validate(story)

        assert isinstance(response.created_at, datetime)
        assert isinstance(response.updated_at, datetime)


class TestStoryBatchTransformation:
    """Tests for StoryBatch model to StoryBatchResponse transformation."""

    def test_story_batch_basic_transform(self, test_db: Session) -> None:
        """Test that StoryBatch transforms correctly."""
        project = _create_test_project(test_db)
        batch = _create_test_story_batch(
            test_db,
            project_id=_get_id(project),
            format=StoryFormat.CLASSIC,
            status=StoryBatchStatus.READY,
            story_count=10,
        )

        response = StoryBatchResponse.model_validate(batch)

        assert response.id == _get_id(batch)
        assert response.project_id == _get_id(project)
        assert response.format == StoryFormat.CLASSIC
        assert response.status == StoryBatchStatus.READY
        assert response.story_count == 10

    def test_story_batch_all_statuses(self, test_db: Session) -> None:
        """Test all StoryBatchStatus values transform correctly."""
        project = _create_test_project(test_db)

        for status in StoryBatchStatus:
            batch = _create_test_story_batch(
                test_db,
                project_id=_get_id(project),
                status=status,
            )

            response = StoryBatchResponse.model_validate(batch)

            assert response.status == status

    def test_story_batch_section_filter_transform(self, test_db: Session) -> None:
        """Test that section_filter transforms correctly."""
        project = _create_test_project(test_db)
        filter_sections = ["problems", "user_goals", "functional_requirements"]
        batch = _create_test_story_batch(
            test_db,
            project_id=_get_id(project),
            section_filter=filter_sections,
        )

        response = StoryBatchResponse.model_validate(batch)

        assert response.section_filter == filter_sections

    def test_story_batch_error_message_transform(self, test_db: Session) -> None:
        """Test that error_message transforms correctly."""
        project = _create_test_project(test_db)
        batch = _create_test_story_batch(
            test_db,
            project_id=_get_id(project),
            status=StoryBatchStatus.FAILED,
            error_message="Generation failed due to timeout",
        )

        response = StoryBatchResponse.model_validate(batch)

        assert response.error_message == "Generation failed due to timeout"


class TestStoryBatchStatusResponseTransformation:
    """Tests for StoryBatchStatusResponse transformation."""

    def test_story_batch_status_response(self, test_db: Session) -> None:
        """Test StoryBatchStatusResponse from StoryBatch model."""
        project = _create_test_project(test_db)
        batch = _create_test_story_batch(
            test_db,
            project_id=_get_id(project),
            status=StoryBatchStatus.GENERATING,
            story_count=5,
        )

        response = StoryBatchStatusResponse.model_validate(batch)

        assert response.id == _get_id(batch)
        assert response.status == StoryBatchStatus.GENERATING
        assert response.story_count == 5
        assert response.error_message is None

    def test_story_batch_status_response_with_error(self, test_db: Session) -> None:
        """Test StoryBatchStatusResponse with error message."""
        project = _create_test_project(test_db)
        batch = _create_test_story_batch(
            test_db,
            project_id=_get_id(project),
            status=StoryBatchStatus.FAILED,
            error_message="API error occurred",
        )

        response = StoryBatchStatusResponse.model_validate(batch)

        assert response.status == StoryBatchStatus.FAILED
        assert response.error_message == "API error occurred"


# =============================================================================
# Test: From Attributes Configuration
# =============================================================================


class TestFromAttributesConfiguration:
    """Tests to verify from_attributes=True configuration works correctly."""

    def test_project_response_from_orm(self, test_db: Session) -> None:
        """Test ProjectResponse can be created from ORM model."""
        project = _create_test_project(test_db)

        # This should work due to from_attributes=True
        response = ProjectResponse.model_validate(project)

        assert response.id == _get_id(project)

    def test_requirement_response_from_orm(self, test_db: Session) -> None:
        """Test RequirementResponse can be created from ORM model."""
        project = _create_test_project(test_db)
        requirement = _create_test_requirement(test_db, project_id=_get_id(project))

        response = RequirementResponse.model_validate(requirement)

        assert response.id == _get_id(requirement)

    def test_prd_response_from_orm(self, test_db: Session) -> None:
        """Test PRDResponse can be created from ORM model."""
        project = _create_test_project(test_db)
        prd = _create_test_prd(test_db, project_id=_get_id(project))

        response = PRDResponse.model_validate(prd)

        assert response.id == _get_id(prd)

    def test_user_story_response_from_orm(self, test_db: Session) -> None:
        """Test UserStoryResponse can be created from ORM model."""
        project = _create_test_project(test_db)
        story = _create_test_user_story(test_db, project_id=_get_id(project))

        response = UserStoryResponse.model_validate(story)

        assert response.id == _get_id(story)

    def test_story_batch_response_from_orm(self, test_db: Session) -> None:
        """Test StoryBatchResponse can be created from ORM model."""
        project = _create_test_project(test_db)
        batch = _create_test_story_batch(test_db, project_id=_get_id(project))

        response = StoryBatchResponse.model_validate(batch)

        assert response.id == _get_id(batch)
