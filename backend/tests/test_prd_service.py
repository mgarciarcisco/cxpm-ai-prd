"""Tests for the PRD generator service."""

import json
from datetime import datetime
from typing import cast
from unittest.mock import patch

import pytest
from sqlalchemy.orm import Session

from app.exceptions import LLMResponseError, NoRequirementsError
from app.models import PRD, Project, Requirement
from app.models.meeting_item import Section
from app.models.prd import PRDMode, PRDStatus
from app.services.llm import LLMError
from app.services.prd_generator import PRDGenerator, _parse_streaming_prd_json, generate_prd_task


def _get_project_id(project: Project) -> str:
    """Get project ID as string for type safety."""
    return cast(str, project.id)


def _create_test_project(db: Session, name: str = "Test Project") -> Project:
    """Create a test project."""
    project = Project(
        name=name,
        description="For PRD generator tests"
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _create_test_requirement(
    db: Session,
    project_id: str,
    section: Section,
    content: str,
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


def _create_test_prd(
    db: Session,
    project_id: str,
    version: int = 1,
    mode: PRDMode = PRDMode.DRAFT,
    status: PRDStatus = PRDStatus.QUEUED,
) -> PRD:
    """Create a test PRD."""
    prd = PRD(
        project_id=project_id,
        version=version,
        mode=mode,
        status=status,
    )
    db.add(prd)
    db.commit()
    db.refresh(prd)
    return prd


class MockLLMProvider:
    """Mock LLM provider for testing."""

    def __init__(self, response: str):
        self.response = response
        self.generate_called = False
        self.prompt_received: str | None = None
        self.temperature_received: float | None = None
        self.max_tokens_received: int | None = None
        self.timeout_received: float | None = None

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
        self.temperature_received = temperature
        self.max_tokens_received = max_tokens
        self.timeout_received = timeout
        return self.response


class FailingLLMProvider:
    """Mock LLM provider that raises an error."""

    def __init__(self, error_message: str = "LLM connection failed"):
        self.error_message = error_message

    def generate(
        self,
        prompt: str,
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> str:
        raise LLMError(self.error_message)


class TimeoutLLMProvider:
    """Mock LLM provider that simulates a timeout."""

    def generate(
        self,
        prompt: str,
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> str:
        raise LLMError("LLM API request timed out")


def _create_mock_prd_response(
    title: str,
    sections: list[dict],
) -> str:
    """Create a mock LLM response for PRD generation."""
    return json.dumps({
        "title": title,
        "sections": sections
    })


def _create_draft_mode_sections() -> list[dict]:
    """Create sections for draft mode PRD (7 sections)."""
    return [
        {"id": "executive_summary", "title": "Executive Summary", "content": "This is a draft summary.", "order": 1},
        {"id": "problem_statement", "title": "Problem Statement", "content": "Users face challenges.", "order": 2},
        {"id": "goals_and_objectives", "title": "Goals & Objectives", "content": "Improve user experience.", "order": 3},
        {"id": "proposed_solution", "title": "Proposed Solution", "content": "Build a new feature.", "order": 4},
        {"id": "open_questions", "title": "Open Questions", "content": "- What is the timeline?", "order": 5},
        {"id": "identified_gaps", "title": "Identified Gaps", "content": "- Need more user research.", "order": 6},
        {"id": "next_steps", "title": "Next Steps", "content": "- Conduct interviews.", "order": 7},
    ]


def _create_detailed_mode_sections() -> list[dict]:
    """Create sections for detailed mode PRD (12 sections)."""
    return [
        {"id": "executive_summary", "title": "Executive Summary", "content": "Comprehensive project summary.", "order": 1},
        {"id": "problem_statement", "title": "Problem Statement", "content": "Detailed problem analysis.", "order": 2},
        {"id": "goals_and_objectives", "title": "Goals & Objectives", "content": "Measurable objectives.", "order": 3},
        {"id": "target_users", "title": "Target Users", "content": "Personas and user segments.", "order": 4},
        {"id": "proposed_solution", "title": "Proposed Solution", "content": "Technical approach.", "order": 5},
        {"id": "functional_requirements", "title": "Functional Requirements", "content": "Feature specifications.", "order": 6},
        {"id": "non_functional_requirements", "title": "Non-Functional Requirements", "content": "Performance goals.", "order": 7},
        {"id": "technical_considerations", "title": "Technical Considerations", "content": "Architecture notes.", "order": 8},
        {"id": "success_metrics", "title": "Success Metrics", "content": "KPIs and measurements.", "order": 9},
        {"id": "timeline_and_milestones", "title": "Timeline & Milestones", "content": "Project phases.", "order": 10},
        {"id": "risks_and_mitigations", "title": "Risks & Mitigations", "content": "Risk assessment.", "order": 11},
        {"id": "appendix", "title": "Appendix", "content": "Supporting materials.", "order": 12},
    ]


# =============================================================================
# Test: Generate PRD in Draft Mode
# =============================================================================

def test_generate_prd_draft_mode(test_db: Session) -> None:
    """Test that draft mode generates PRD with draft sections."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create test requirements
    _create_test_requirement(test_db, project_id, Section.problems, "Users struggle with X")
    _create_test_requirement(test_db, project_id, Section.user_goals, "Users want to achieve Y")

    # Create mock response with draft sections
    draft_sections = _create_draft_mode_sections()
    mock_response = _create_mock_prd_response("Draft PRD Title", draft_sections)
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)
        prd = generator.generate(project_id, PRDMode.DRAFT, created_by="test_user")

    # Verify PRD was created correctly
    assert prd is not None
    assert prd.title == "Draft PRD Title"
    assert prd.mode == PRDMode.DRAFT
    assert prd.status == PRDStatus.READY
    assert prd.version == 1
    assert prd.created_by == "test_user"
    assert prd.sections is not None
    assert len(prd.sections) == 7

    # Verify raw_markdown was generated
    assert prd.raw_markdown is not None
    assert "# Draft PRD Title" in prd.raw_markdown
    assert "## Executive Summary" in prd.raw_markdown

    # Verify the LLM was called with draft template
    assert mock_provider.generate_called
    assert mock_provider.prompt_received is not None


def test_generate_prd_draft_mode_includes_gaps_and_questions(test_db: Session) -> None:
    """Test that draft mode PRD includes open questions and identified gaps sections."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.open_questions, "What is the budget?")

    draft_sections = _create_draft_mode_sections()
    mock_response = _create_mock_prd_response("Draft with Gaps", draft_sections)
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)
        prd = generator.generate(project_id, PRDMode.DRAFT)

    # Verify key draft sections exist
    section_ids = [s["id"] for s in prd.sections]
    assert "open_questions" in section_ids
    assert "identified_gaps" in section_ids
    assert "next_steps" in section_ids


# =============================================================================
# Test: Generate PRD in Detailed Mode
# =============================================================================

def test_generate_prd_detailed_mode(test_db: Session) -> None:
    """Test that detailed mode generates PRD with all 12 sections."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create test requirements
    _create_test_requirement(test_db, project_id, Section.functional_requirements, "Feature A")
    _create_test_requirement(test_db, project_id, Section.constraints, "Must use Python")

    # Create mock response with detailed sections
    detailed_sections = _create_detailed_mode_sections()
    mock_response = _create_mock_prd_response("Detailed PRD Title", detailed_sections)
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)
        prd = generator.generate(project_id, PRDMode.DETAILED, created_by="product_manager")

    # Verify PRD was created correctly
    assert prd is not None
    assert prd.title == "Detailed PRD Title"
    assert prd.mode == PRDMode.DETAILED
    assert prd.status == PRDStatus.READY
    assert prd.version == 1
    assert prd.created_by == "product_manager"
    assert prd.sections is not None
    assert len(prd.sections) == 12

    # Verify all 12 sections are present
    expected_section_ids = [
        "executive_summary", "problem_statement", "goals_and_objectives",
        "target_users", "proposed_solution", "functional_requirements",
        "non_functional_requirements", "technical_considerations",
        "success_metrics", "timeline_and_milestones", "risks_and_mitigations",
        "appendix"
    ]
    actual_section_ids = [s["id"] for s in prd.sections]
    for expected_id in expected_section_ids:
        assert expected_id in actual_section_ids, f"Missing section: {expected_id}"


# =============================================================================
# Test: Version Auto-Increment
# =============================================================================

def test_version_auto_increment(test_db: Session) -> None:
    """Test that version increments correctly for multiple PRDs in same project."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create requirements
    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    mock_response = _create_mock_prd_response("V1 PRD", _create_draft_mode_sections())
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)

        # Generate first PRD
        prd1 = generator.generate(project_id, PRDMode.DRAFT)
        assert prd1.version == 1

        # Generate second PRD - should be version 2
        mock_provider.response = _create_mock_prd_response("V2 PRD", _create_draft_mode_sections())
        prd2 = generator.generate(project_id, PRDMode.DRAFT)
        assert prd2.version == 2

        # Generate third PRD - should be version 3
        mock_provider.response = _create_mock_prd_response("V3 PRD", _create_detailed_mode_sections())
        prd3 = generator.generate(project_id, PRDMode.DETAILED)
        assert prd3.version == 3


def test_version_independent_across_projects(test_db: Session) -> None:
    """Test that versions are independent across different projects."""
    project1 = _create_test_project(test_db, "Project 1")
    project2 = _create_test_project(test_db, "Project 2")

    # Create requirements for both projects
    _create_test_requirement(test_db, _get_project_id(project1), Section.problems, "P1 problem")
    _create_test_requirement(test_db, _get_project_id(project2), Section.problems, "P2 problem")

    mock_response = _create_mock_prd_response("PRD", _create_draft_mode_sections())
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)

        # Generate PRD for project 1
        prd1 = generator.generate(_get_project_id(project1), PRDMode.DRAFT)
        assert prd1.version == 1

        # Generate PRD for project 2 - should also be version 1
        prd2 = generator.generate(_get_project_id(project2), PRDMode.DRAFT)
        assert prd2.version == 1

        # Generate another PRD for project 1 - should be version 2
        prd3 = generator.generate(_get_project_id(project1), PRDMode.DRAFT)
        assert prd3.version == 2


# =============================================================================
# Test: Version Increment with Concurrency (Row Lock)
# =============================================================================

def test_version_increment_with_concurrency(test_db: Session) -> None:
    """Test that row-level locking prevents duplicate version numbers.

    Note: In SQLite (test environment), FOR UPDATE is a no-op but the test
    verifies the logic is correct. In PostgreSQL, this would actually lock.
    """
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    # Create an existing PRD with version 1
    _create_test_prd(test_db, project_id, version=1, status=PRDStatus.READY)

    mock_response = _create_mock_prd_response("New PRD", _create_draft_mode_sections())
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)

        # Next version should be 2
        prd = generator.generate(project_id, PRDMode.DRAFT)
        assert prd.version == 2


def test_get_next_version_starts_at_one(test_db: Session) -> None:
    """Test that version starts at 1 for a project with no PRDs."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    generator = PRDGenerator(test_db)
    version = generator._get_next_version(project_id)

    assert version == 1


# =============================================================================
# Test: No Requirements Error
# =============================================================================

def test_no_requirements_raises_error(test_db: Session) -> None:
    """Test that NoRequirementsError is raised when project has no requirements."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    generator = PRDGenerator(test_db)

    with pytest.raises(NoRequirementsError) as exc_info:
        generator.generate(project_id, PRDMode.DRAFT)

    assert project_id in str(exc_info.value)
    assert exc_info.value.project_id == project_id


def test_no_active_requirements_raises_error(test_db: Session) -> None:
    """Test that only inactive requirements still raises NoRequirementsError."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create an inactive requirement
    _create_test_requirement(
        test_db, project_id, Section.problems, "Inactive requirement", is_active=False
    )

    generator = PRDGenerator(test_db)

    with pytest.raises(NoRequirementsError):
        generator.generate(project_id, PRDMode.DRAFT)


# =============================================================================
# Test: Malformed LLM Response
# =============================================================================

def test_malformed_llm_response_invalid_json(test_db: Session) -> None:
    """Test that invalid JSON from LLM raises LLMResponseError."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    mock_provider = MockLLMProvider("This is not valid JSON at all")

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)

        with pytest.raises(LLMResponseError) as exc_info:
            generator.generate(project_id, PRDMode.DRAFT)

        assert "Invalid JSON" in str(exc_info.value)
        assert exc_info.value.raw_response == "This is not valid JSON at all"


def test_malformed_llm_response_missing_title(test_db: Session) -> None:
    """Test that LLM response missing title raises LLMResponseError."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    # Response with sections but no title
    mock_response = json.dumps({
        "sections": _create_draft_mode_sections()
    })
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)

        with pytest.raises(LLMResponseError) as exc_info:
            generator.generate(project_id, PRDMode.DRAFT)

        assert "title" in str(exc_info.value).lower()


def test_malformed_llm_response_empty_sections(test_db: Session) -> None:
    """Test that LLM response with empty sections raises LLMResponseError."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    mock_response = json.dumps({
        "title": "PRD Title",
        "sections": []
    })
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)

        with pytest.raises(LLMResponseError) as exc_info:
            generator.generate(project_id, PRDMode.DRAFT)

        assert "empty" in str(exc_info.value).lower()


def test_malformed_llm_response_section_missing_required_field(test_db: Session) -> None:
    """Test that section missing required field raises LLMResponseError."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    # Section missing 'content' field
    mock_response = json.dumps({
        "title": "PRD Title",
        "sections": [
            {"id": "summary", "title": "Summary", "order": 1}  # Missing 'content'
        ]
    })
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)

        with pytest.raises(LLMResponseError) as exc_info:
            generator.generate(project_id, PRDMode.DRAFT)

        assert "content" in str(exc_info.value).lower()


def test_malformed_llm_response_non_object(test_db: Session) -> None:
    """Test that non-object JSON response raises LLMResponseError."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    # Response is an array instead of object
    mock_response = json.dumps(["not", "an", "object"])
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)

        with pytest.raises(LLMResponseError) as exc_info:
            generator.generate(project_id, PRDMode.DRAFT)

        assert "object" in str(exc_info.value).lower()


def test_llm_response_with_markdown_code_blocks(test_db: Session) -> None:
    """Test that LLM response wrapped in markdown code blocks is parsed correctly."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    inner_json = json.dumps({
        "title": "PRD Title",
        "sections": _create_draft_mode_sections()
    })
    mock_response = f"```json\n{inner_json}\n```"
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)
        prd = generator.generate(project_id, PRDMode.DRAFT)

    assert prd.title == "PRD Title"
    assert len(prd.sections) == 7


# =============================================================================
# Test: Background Task
# =============================================================================

def test_generate_prd_task_success(test_db: Session) -> None:
    """Test that background task successfully generates PRD."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    # Create a queued PRD
    prd = _create_test_prd(test_db, project_id, version=0, status=PRDStatus.QUEUED)
    prd_id = str(prd.id)

    mock_response = _create_mock_prd_response("Generated PRD", _create_draft_mode_sections())
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generate_prd_task(test_db, prd_id, project_id, PRDMode.DRAFT, created_by="task_user")

    # Refresh PRD from database
    test_db.refresh(prd)

    assert prd.status == PRDStatus.READY
    assert prd.title == "Generated PRD"
    assert prd.sections is not None
    assert prd.raw_markdown is not None
    assert prd.error_message is None


def test_generate_prd_task_cancelled_before_start(test_db: Session) -> None:
    """Test that task exits early if PRD is already cancelled."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    # Create a cancelled PRD
    prd = _create_test_prd(test_db, project_id, version=0, status=PRDStatus.CANCELLED)
    prd_id = str(prd.id)

    mock_response = _create_mock_prd_response("PRD", _create_draft_mode_sections())
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generate_prd_task(test_db, prd_id, project_id, PRDMode.DRAFT)

    # Verify LLM was never called
    assert not mock_provider.generate_called

    # Verify status unchanged
    test_db.refresh(prd)
    assert prd.status == PRDStatus.CANCELLED


def test_generate_prd_task_sets_failed_on_no_requirements(test_db: Session) -> None:
    """Test that task sets FAILED status when project has no requirements."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create a queued PRD but no requirements
    prd = _create_test_prd(test_db, project_id, version=0, status=PRDStatus.QUEUED)
    prd_id = str(prd.id)

    generate_prd_task(test_db, prd_id, project_id, PRDMode.DRAFT)

    # Verify status is FAILED
    test_db.refresh(prd)
    assert prd.status == PRDStatus.FAILED
    assert prd.error_message is not None
    assert "no requirements" in prd.error_message.lower()


def test_generate_prd_task_sets_failed_on_llm_error(test_db: Session) -> None:
    """Test that task sets FAILED status on LLM error."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    prd = _create_test_prd(test_db, project_id, version=0, status=PRDStatus.QUEUED)
    prd_id = str(prd.id)

    failing_provider = FailingLLMProvider("Connection timeout")

    with patch("app.services.prd_generator.get_provider", return_value=failing_provider):
        generate_prd_task(test_db, prd_id, project_id, PRDMode.DRAFT)

    test_db.refresh(prd)
    assert prd.status == PRDStatus.FAILED
    assert prd.error_message is not None
    assert "LLM error" in prd.error_message


def test_generate_prd_task_deleted_prd_no_op(test_db: Session) -> None:
    """Test that task does nothing if PRD was deleted."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Use a non-existent PRD ID
    fake_prd_id = "00000000-0000-0000-0000-000000000000"

    # Should not raise any error
    generate_prd_task(test_db, fake_prd_id, project_id, PRDMode.DRAFT)


# =============================================================================
# Test: Helper Methods
# =============================================================================

def test_load_requirements_filters_by_project(test_db: Session) -> None:
    """Test that _load_requirements only returns requirements for the specified project."""
    project1 = _create_test_project(test_db, "Project 1")
    project2 = _create_test_project(test_db, "Project 2")

    _create_test_requirement(test_db, _get_project_id(project1), Section.problems, "P1 Req")
    _create_test_requirement(test_db, _get_project_id(project2), Section.problems, "P2 Req")

    generator = PRDGenerator(test_db)
    reqs = generator._load_requirements(_get_project_id(project1))

    assert len(reqs) == 1
    assert "problems" in reqs
    assert reqs["problems"] == ["P1 Req"]


def test_load_requirements_groups_by_section(test_db: Session) -> None:
    """Test that _load_requirements groups requirements by section."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "Problem 1")
    _create_test_requirement(test_db, project_id, Section.problems, "Problem 2")
    _create_test_requirement(test_db, project_id, Section.user_goals, "Goal 1")

    generator = PRDGenerator(test_db)
    reqs = generator._load_requirements(project_id)

    assert len(reqs) == 2
    assert "problems" in reqs
    assert "user_goals" in reqs
    assert reqs["problems"] == ["Problem 1", "Problem 2"]
    assert reqs["user_goals"] == ["Goal 1"]


def test_format_requirements_output(test_db: Session) -> None:
    """Test that _format_requirements produces correct markdown format."""
    generator = PRDGenerator(test_db)

    reqs = {
        "problems": ["Issue A", "Issue B"],
        "user_goals": ["Goal X"],
    }

    formatted = generator._format_requirements(reqs)

    assert "### Problems & Pain Points" in formatted
    assert "1. Issue A" in formatted
    assert "2. Issue B" in formatted
    assert "### User Goals" in formatted
    assert "1. Goal X" in formatted


def test_generate_markdown_output(test_db: Session) -> None:
    """Test that _generate_markdown produces correct markdown structure."""
    generator = PRDGenerator(test_db)

    title = "Test PRD"
    sections = [
        {"id": "summary", "title": "Summary", "content": "This is a summary.", "order": 1},
        {"id": "details", "title": "Details", "content": "These are details.", "order": 2},
    ]

    markdown = generator._generate_markdown(title, sections)

    assert markdown.startswith("# Test PRD")
    assert "## Summary" in markdown
    assert "This is a summary." in markdown
    assert "## Details" in markdown
    assert "These are details." in markdown


# =============================================================================
# Test: Atomic Version Assignment (US-035)
# =============================================================================

def test_assign_version_atomically_assigns_correct_version(test_db: Session) -> None:
    """Test that assign_version_atomically sets the correct version number."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create a PRD with placeholder values (simulating background task creation)
    prd = PRD(
        project_id=project_id,
        version=0,  # Placeholder
        mode=PRDMode.DRAFT,
        status=PRDStatus.GENERATING,
    )
    test_db.add(prd)
    test_db.flush()  # Get ID without committing

    generator = PRDGenerator(test_db)

    sections = [
        {"id": "summary", "title": "Summary", "content": "Test content", "order": 1}
    ]

    # Atomically assign version
    assigned_version = generator.assign_version_atomically(
        prd=prd,
        title="Atomic PRD",
        sections=sections,
        raw_markdown="# Atomic PRD",
        updated_by="test_user",
    )

    assert assigned_version == 1
    assert prd.version == 1
    assert prd.title == "Atomic PRD"
    assert prd.status == PRDStatus.READY
    assert prd.sections == sections
    assert prd.updated_by == "test_user"


def test_assign_version_atomically_increments_from_existing(test_db: Session) -> None:
    """Test that assign_version_atomically increments from existing PRDs."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create existing PRDs with versions 1 and 2
    _create_test_prd(test_db, project_id, version=1, status=PRDStatus.READY)
    _create_test_prd(test_db, project_id, version=2, status=PRDStatus.READY)

    # Create new PRD with placeholder
    prd = PRD(
        project_id=project_id,
        version=0,
        mode=PRDMode.DRAFT,
        status=PRDStatus.GENERATING,
    )
    test_db.add(prd)
    test_db.flush()

    generator = PRDGenerator(test_db)

    sections = [{"id": "s1", "title": "Section", "content": "Content", "order": 1}]

    assigned_version = generator.assign_version_atomically(
        prd=prd,
        title="Third PRD",
        sections=sections,
        raw_markdown="# Third PRD",
    )

    assert assigned_version == 3
    assert prd.version == 3


def test_assign_version_atomically_updates_all_fields(test_db: Session) -> None:
    """Test that assign_version_atomically updates all PRD fields correctly."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    prd = PRD(
        project_id=project_id,
        version=0,
        mode=PRDMode.DETAILED,
        status=PRDStatus.GENERATING,
        title=None,
        sections=None,
        raw_markdown=None,
    )
    test_db.add(prd)
    test_db.flush()

    generator = PRDGenerator(test_db)

    sections = [
        {"id": "sec1", "title": "Section 1", "content": "Content 1", "order": 1},
        {"id": "sec2", "title": "Section 2", "content": "Content 2", "order": 2},
    ]
    raw_markdown = "# Full PRD\n\n## Section 1\n\nContent 1\n\n## Section 2\n\nContent 2"

    generator.assign_version_atomically(
        prd=prd,
        title="Full PRD",
        sections=sections,
        raw_markdown=raw_markdown,
        updated_by="pm_user",
    )

    # Verify all fields were updated
    assert prd.version == 1
    assert prd.title == "Full PRD"
    assert prd.sections == sections
    assert prd.raw_markdown == raw_markdown
    assert prd.status == PRDStatus.READY
    assert prd.updated_by == "pm_user"
    assert prd.updated_at is not None


def test_assign_version_atomically_commits_transaction(test_db: Session) -> None:
    """Test that assign_version_atomically commits the transaction."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    prd = PRD(
        project_id=project_id,
        version=0,
        mode=PRDMode.DRAFT,
        status=PRDStatus.GENERATING,
    )
    test_db.add(prd)
    test_db.flush()
    prd_id = str(prd.id)

    generator = PRDGenerator(test_db)

    sections = [{"id": "s", "title": "S", "content": "C", "order": 1}]

    generator.assign_version_atomically(
        prd=prd,
        title="Committed PRD",
        sections=sections,
        raw_markdown="# Committed PRD",
    )

    # Expunge the PRD from the session
    test_db.expunge(prd)

    # Re-fetch from database to verify commit occurred
    fetched_prd = test_db.query(PRD).filter(PRD.id == prd_id).first()
    assert fetched_prd is not None
    assert fetched_prd.version == 1
    assert fetched_prd.title == "Committed PRD"
    assert fetched_prd.status == PRDStatus.READY


def test_generate_uses_atomic_version_assignment(test_db: Session) -> None:
    """Test that generate() method uses atomic version assignment."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    # Create an existing PRD
    _create_test_prd(test_db, project_id, version=1, status=PRDStatus.READY)

    mock_response = _create_mock_prd_response("New PRD", _create_draft_mode_sections())
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)
        prd = generator.generate(project_id, PRDMode.DRAFT)

    # Version should be 2 (atomically assigned after existing version 1)
    assert prd.version == 2
    assert prd.status == PRDStatus.READY


def test_no_duplicate_versions_with_sequential_generations(test_db: Session) -> None:
    """Test that sequential generations produce distinct versions."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    mock_response = _create_mock_prd_response("PRD", _create_draft_mode_sections())
    mock_provider = MockLLMProvider(mock_response)

    versions: list[int] = []

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)

        # Generate 5 PRDs sequentially
        for i in range(5):
            mock_provider.response = _create_mock_prd_response(
                f"PRD v{i+1}", _create_draft_mode_sections()
            )
            prd = generator.generate(project_id, PRDMode.DRAFT)
            versions.append(prd.version)

    # All versions should be unique
    assert len(versions) == len(set(versions)), "Duplicate versions detected!"
    assert versions == [1, 2, 3, 4, 5]


def test_version_assignment_includes_deleted_prds(test_db: Session) -> None:
    """Test that version assignment considers soft-deleted PRDs.
    
    Even if a PRD is soft-deleted, its version number should not be reused.
    """
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create PRD v1 and v2, then soft-delete v2
    _create_test_prd(test_db, project_id, version=1, status=PRDStatus.READY)
    prd2 = _create_test_prd(test_db, project_id, version=2, status=PRDStatus.READY)
    prd2.deleted_at = datetime.utcnow()
    test_db.commit()

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    mock_response = _create_mock_prd_response("New PRD", _create_draft_mode_sections())
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)
        prd = generator.generate(project_id, PRDMode.DRAFT)

    # Version should be 3, not 2 (deleted PRD's version is not reused)
    assert prd.version == 3


# ============================================================================
# Tests for LLM Configuration Parameters (US-040)
# ============================================================================


def test_generate_passes_llm_config_parameters(test_db: Session) -> None:
    """Test that generate() passes temperature, max_tokens, and timeout to LLM provider."""
    from app.services.prd_generator import (
        PRD_LLM_MAX_TOKENS,
        PRD_LLM_TEMPERATURE,
        PRD_LLM_TIMEOUT,
    )

    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    mock_response = _create_mock_prd_response("Config Test", _create_draft_mode_sections())
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generator = PRDGenerator(test_db)
        generator.generate(project_id, PRDMode.DRAFT)

    # Verify the config parameters were passed to the provider
    assert mock_provider.generate_called is True
    assert mock_provider.temperature_received == PRD_LLM_TEMPERATURE
    assert mock_provider.max_tokens_received == PRD_LLM_MAX_TOKENS
    assert mock_provider.timeout_received == PRD_LLM_TIMEOUT


def test_generate_prd_task_passes_llm_config_parameters(test_db: Session) -> None:
    """Test that generate_prd_task() passes LLM config parameters."""
    from app.services.prd_generator import (
        PRD_LLM_MAX_TOKENS,
        PRD_LLM_TEMPERATURE,
        PRD_LLM_TIMEOUT,
    )

    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    prd = _create_test_prd(test_db, project_id, version=0, status=PRDStatus.QUEUED)
    prd_id = str(prd.id)

    mock_response = _create_mock_prd_response("Config Test", _create_draft_mode_sections())
    mock_provider = MockLLMProvider(mock_response)

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generate_prd_task(test_db, prd_id, project_id, PRDMode.DRAFT)

    # Verify the config parameters were passed to the provider
    assert mock_provider.generate_called is True
    assert mock_provider.temperature_received == PRD_LLM_TEMPERATURE
    assert mock_provider.max_tokens_received == PRD_LLM_MAX_TOKENS
    assert mock_provider.timeout_received == PRD_LLM_TIMEOUT


def test_prd_llm_config_values_are_correct() -> None:
    """Test that PRD LLM config constants have the expected values."""
    from app.services.prd_generator import (
        PRD_LLM_MAX_TOKENS,
        PRD_LLM_TEMPERATURE,
        PRD_LLM_TIMEOUT,
    )

    assert PRD_LLM_TIMEOUT == 300  # 5 minutes for PRD generation (longer for local Ollama models)
    assert PRD_LLM_TEMPERATURE == 0.7  # Higher temperature for creative PRD content
    assert PRD_LLM_MAX_TOKENS == 8000  # More tokens for detailed PRD sections


def test_generate_handles_llm_timeout_error(test_db: Session) -> None:
    """Test that generate() handles LLM timeout properly."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    timeout_provider = TimeoutLLMProvider()

    with patch("app.services.prd_generator.get_provider", return_value=timeout_provider):
        generator = PRDGenerator(test_db)

        with pytest.raises(LLMError) as exc_info:
            generator.generate(project_id, PRDMode.DRAFT)

        assert "timed out" in str(exc_info.value)


def test_generate_prd_task_records_timeout_error_in_status(test_db: Session) -> None:
    """Test that generate_prd_task() records timeout error in PRD status."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    prd = _create_test_prd(test_db, project_id, version=0, status=PRDStatus.QUEUED)
    prd_id = str(prd.id)

    timeout_provider = TimeoutLLMProvider()

    with patch("app.services.prd_generator.get_provider", return_value=timeout_provider):
        generate_prd_task(test_db, prd_id, project_id, PRDMode.DRAFT)

    # Refresh and verify PRD status
    test_db.refresh(prd)
    assert prd.status == PRDStatus.FAILED
    assert prd.error_message is not None
    assert "timed out" in prd.error_message


# ============================================================================
# Database Unique Constraint Tests (US-041)
# ============================================================================


def test_duplicate_prd_version_raises_integrity_error(test_db: Session) -> None:
    """Test that inserting duplicate PRD version for same project raises IntegrityError."""
    from sqlalchemy.exc import IntegrityError

    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create first PRD with version 1
    _create_test_prd(test_db, project_id, version=1)

    # Attempt to create second PRD with same version for same project
    prd2 = PRD(
        project_id=project_id,
        version=1,  # Duplicate version
        mode=PRDMode.DRAFT,
        status=PRDStatus.QUEUED,
    )
    test_db.add(prd2)

    with pytest.raises(IntegrityError):
        test_db.commit()

    # Rollback to clean up
    test_db.rollback()


def test_different_projects_can_have_same_prd_version(test_db: Session) -> None:
    """Test that different projects can have PRDs with the same version."""
    project1 = _create_test_project(test_db, name="Project 1")
    project2 = _create_test_project(test_db, name="Project 2")
    project1_id = _get_project_id(project1)
    project2_id = _get_project_id(project2)

    # Create PRD with version 1 for project 1
    prd1 = _create_test_prd(test_db, project1_id, version=1)

    # Create PRD with version 1 for project 2 - should succeed
    prd2 = _create_test_prd(test_db, project2_id, version=1)

    # Both PRDs should exist with version 1
    assert prd1.version == 1
    assert prd2.version == 1
    assert prd1.project_id != prd2.project_id


def test_same_project_can_have_different_prd_versions(test_db: Session) -> None:
    """Test that the same project can have PRDs with different versions."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create PRDs with different versions
    prd1 = _create_test_prd(test_db, project_id, version=1)
    prd2 = _create_test_prd(test_db, project_id, version=2)
    prd3 = _create_test_prd(test_db, project_id, version=3)

    # All PRDs should exist
    assert prd1.version == 1
    assert prd2.version == 2
    assert prd3.version == 3


def test_unique_constraint_applies_to_all_prd_statuses(test_db: Session) -> None:
    """Test that unique constraint applies regardless of PRD status (including deleted)."""
    from datetime import datetime

    from sqlalchemy.exc import IntegrityError

    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create a soft-deleted PRD with version 1
    prd1 = _create_test_prd(test_db, project_id, version=1, status=PRDStatus.ARCHIVED)
    prd1.deleted_at = datetime.utcnow()
    test_db.commit()

    # Attempt to create another PRD with version 1 - should fail because
    # unique constraint is on (project_id, version), not filtered by deleted_at
    prd2 = PRD(
        project_id=project_id,
        version=1,  # Duplicate version
        mode=PRDMode.DRAFT,
        status=PRDStatus.QUEUED,
    )
    test_db.add(prd2)

    with pytest.raises(IntegrityError):
        test_db.commit()

    test_db.rollback()


# ============================================================================
# Session Rollback Tests (US-042)
# ============================================================================


def test_generate_prd_task_rollback_on_no_requirements(test_db: Session) -> None:
    """Test that generate_prd_task() calls rollback before setting failed status."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    # Create a queued PRD but NO requirements
    prd = _create_test_prd(test_db, project_id, version=0, status=PRDStatus.QUEUED)
    prd_id = str(prd.id)

    # Run the task - it should fail due to no requirements
    generate_prd_task(test_db, prd_id, project_id, PRDMode.DRAFT)

    # Refresh PRD from database
    test_db.refresh(prd)

    # Verify status is FAILED with appropriate error message
    assert prd.status == PRDStatus.FAILED
    assert prd.error_message is not None
    assert "no requirements" in prd.error_message.lower() or "has no requirements" in prd.error_message.lower()


def test_generate_prd_task_rollback_on_llm_error(test_db: Session) -> None:
    """Test that generate_prd_task() calls rollback before setting failed status on LLM error."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    prd = _create_test_prd(test_db, project_id, version=0, status=PRDStatus.QUEUED)
    prd_id = str(prd.id)

    failing_provider = FailingLLMProvider("Connection timeout")

    with patch("app.services.prd_generator.get_provider", return_value=failing_provider):
        generate_prd_task(test_db, prd_id, project_id, PRDMode.DRAFT)

    test_db.refresh(prd)
    assert prd.status == PRDStatus.FAILED
    assert prd.error_message is not None
    assert "LLM error" in prd.error_message


def test_generate_prd_task_rollback_on_parse_error(test_db: Session) -> None:
    """Test that generate_prd_task() calls rollback before setting failed status on parse error."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    prd = _create_test_prd(test_db, project_id, version=0, status=PRDStatus.QUEUED)
    prd_id = str(prd.id)

    # Return invalid JSON from LLM
    mock_provider = MockLLMProvider("not valid json at all")

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generate_prd_task(test_db, prd_id, project_id, PRDMode.DRAFT)

    test_db.refresh(prd)
    assert prd.status == PRDStatus.FAILED
    assert prd.error_message is not None
    assert "Failed to parse LLM response" in prd.error_message


def test_generate_prd_task_rollback_on_unexpected_error(test_db: Session) -> None:
    """Test that generate_prd_task() calls rollback on unexpected errors."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    prd = _create_test_prd(test_db, project_id, version=0, status=PRDStatus.QUEUED)
    prd_id = str(prd.id)

    # Create a mock that raises a generic exception
    class UnexpectedErrorProvider:
        def generate(self, prompt: str, *, temperature=None, max_tokens=None, timeout=None) -> str:
            raise RuntimeError("Unexpected error during generation")

    with patch("app.services.prd_generator.get_provider", return_value=UnexpectedErrorProvider()):
        generate_prd_task(test_db, prd_id, project_id, PRDMode.DRAFT)

    test_db.refresh(prd)
    assert prd.status == PRDStatus.FAILED
    assert prd.error_message is not None
    assert "Unexpected error" in prd.error_message


def test_generate_prd_task_rollback_cleans_up_prd_in_bad_state(test_db: Session) -> None:
    """Test that rollback cleans up PRD modifications before error status is set.

    This test verifies that if an exception occurs after the PRD has been
    modified (e.g., during version assignment), those modifications are
    rolled back before recording the failure status.
    """
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    prd = _create_test_prd(test_db, project_id, version=0, status=PRDStatus.QUEUED)
    prd_id = str(prd.id)
    original_version = prd.version

    # Create mock that returns response that will fail parsing AFTER version check
    # This simulates a failure after partial processing
    mock_provider = MockLLMProvider('{"title": "Test", "sections": []}')  # Empty sections array

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generate_prd_task(test_db, prd_id, project_id, PRDMode.DRAFT)

    # Refresh and verify
    test_db.refresh(prd)

    # PRD should be in FAILED status
    assert prd.status == PRDStatus.FAILED
    assert prd.error_message is not None
    assert "sections" in prd.error_message.lower() or "empty" in prd.error_message.lower()

    # Version should remain unchanged (0) because rollback was called
    # before the error status was set
    assert prd.version == original_version


def test_generate_prd_task_only_error_status_committed_after_rollback(test_db: Session) -> None:
    """Test that after rollback, only the error status update is committed."""
    project = _create_test_project(test_db)
    project_id = _get_project_id(project)

    _create_test_requirement(test_db, project_id, Section.problems, "A problem")

    prd = _create_test_prd(test_db, project_id, version=0, status=PRDStatus.QUEUED)
    prd_id = str(prd.id)

    # Verify PRD has no title or sections initially
    assert prd.title is None
    assert prd.sections is None

    # Return response with missing required fields to trigger parse error
    mock_provider = MockLLMProvider('{"sections": []}')  # Missing title

    with patch("app.services.prd_generator.get_provider", return_value=mock_provider):
        generate_prd_task(test_db, prd_id, project_id, PRDMode.DRAFT)

    # Force a fresh read from database
    test_db.expire_all()
    prd = test_db.query(PRD).filter(PRD.id == prd_id).first()

    # Verify only error status was persisted, not partial PRD data
    assert prd is not None
    assert prd.status == PRDStatus.FAILED
    assert prd.error_message is not None
    # Title should still be None (no partial data persisted)
    assert prd.title is None
    # Sections should still be None
    assert prd.sections is None


# ============================================================================
# Tests for _parse_streaming_prd_json
# ============================================================================


def test_parse_streaming_json_empty_string() -> None:
    """Test that empty string returns None and empty list."""
    title, sections = _parse_streaming_prd_json("")
    assert title is None
    assert sections == []


def test_parse_streaming_json_incomplete_object() -> None:
    """Test that incomplete JSON object returns None."""
    title, sections = _parse_streaming_prd_json('{"title": "PRD')
    assert title is None
    assert sections == []


def test_parse_streaming_json_extracts_title() -> None:
    """Test that title is extracted when complete."""
    json_str = '{"title": "PRD: Test Feature", "sections": ['
    title, sections = _parse_streaming_prd_json(json_str)
    assert title == "PRD: Test Feature"
    assert sections == []


def test_parse_streaming_json_extracts_title_with_escapes() -> None:
    """Test that title with escaped characters is properly unescaped."""
    json_str = '{"title": "PRD: Test \\"Quoted\\" Feature", "sections": ['
    title, sections = _parse_streaming_prd_json(json_str)
    assert title == 'PRD: Test "Quoted" Feature'
    assert sections == []


def test_parse_streaming_json_extracts_one_section() -> None:
    """Test that a complete section is extracted."""
    json_str = '''{"title": "PRD: Test", "sections": [
        {"id": "executive_summary", "title": "Executive Summary", "content": "This is the summary.", "order": 1}
    '''
    title, sections = _parse_streaming_prd_json(json_str)
    assert title == "PRD: Test"
    assert len(sections) == 1
    assert sections[0]["id"] == "executive_summary"
    assert sections[0]["title"] == "Executive Summary"
    assert sections[0]["content"] == "This is the summary."
    assert sections[0]["order"] == 1


def test_parse_streaming_json_extracts_multiple_sections() -> None:
    """Test that multiple complete sections are extracted."""
    json_str = '''{"title": "PRD: Test", "sections": [
        {"id": "executive_summary", "title": "Executive Summary", "content": "Summary here.", "order": 1},
        {"id": "problem_statement", "title": "Problem Statement", "content": "Problem here.", "order": 2}
    '''
    title, sections = _parse_streaming_prd_json(json_str)
    assert title == "PRD: Test"
    assert len(sections) == 2
    assert sections[0]["id"] == "executive_summary"
    assert sections[1]["id"] == "problem_statement"


def test_parse_streaming_json_ignores_incomplete_section() -> None:
    """Test that incomplete section is not extracted."""
    json_str = '''{"title": "PRD: Test", "sections": [
        {"id": "executive_summary", "title": "Executive Summary", "content": "Summary here.", "order": 1},
        {"id": "problem_statement", "title": "Problem Statement", "content": "Problem here...
    '''
    title, sections = _parse_streaming_prd_json(json_str)
    assert title == "PRD: Test"
    assert len(sections) == 1  # Only the first complete section
    assert sections[0]["id"] == "executive_summary"


def test_parse_streaming_json_handles_markdown_code_blocks() -> None:
    """Test that markdown code blocks are stripped."""
    json_str = '''```json
{"title": "PRD: Test", "sections": [
    {"id": "executive_summary", "title": "Executive Summary", "content": "Summary.", "order": 1}
]}
```'''
    title, sections = _parse_streaming_prd_json(json_str)
    assert title == "PRD: Test"
    assert len(sections) == 1


def test_parse_streaming_json_handles_content_with_quotes() -> None:
    """Test that content with quotes and special characters is handled."""
    json_str = '''{"title": "PRD: Test", "sections": [
        {"id": "exec", "title": "Exec", "content": "Use \\"quotes\\" and special chars: {}", "order": 1}
    ]}'''
    title, sections = _parse_streaming_prd_json(json_str)
    assert title == "PRD: Test"
    assert len(sections) == 1
    # The raw JSON parsing will handle the escapes
    assert sections[0]["content"] == 'Use "quotes" and special chars: {}'


def test_parse_streaming_json_skips_invalid_section() -> None:
    """Test that sections missing required fields are skipped."""
    json_str = '''{"title": "PRD: Test", "sections": [
        {"id": "valid", "title": "Valid", "content": "Has all fields.", "order": 1},
        {"id": "invalid", "title": "Invalid"},
        {"id": "also_valid", "title": "Also Valid", "content": "Also has fields.", "order": 3}
    ]}'''
    title, sections = _parse_streaming_prd_json(json_str)
    assert title == "PRD: Test"
    assert len(sections) == 2
    assert sections[0]["id"] == "valid"
    assert sections[1]["id"] == "also_valid"


def test_parse_streaming_json_no_sections_array() -> None:
    """Test that missing sections array returns empty list."""
    json_str = '{"title": "PRD: Test"}'
    title, sections = _parse_streaming_prd_json(json_str)
    assert title == "PRD: Test"
    assert sections == []


def test_parse_streaming_json_not_starting_with_object() -> None:
    """Test that text not starting with { returns None."""
    title, sections = _parse_streaming_prd_json("Some text before {}")
    assert title is None
    assert sections == []
