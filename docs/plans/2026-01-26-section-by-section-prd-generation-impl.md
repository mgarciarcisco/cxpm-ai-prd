# Section-by-Section PRD Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement staged parallel PRD generation with per-section streaming, error recovery, and individual section regeneration.

**Architecture:** Three-stage generation pipeline where foundational sections (Stage 1) generate sequentially with streaming, bulk sections (Stage 2) generate in parallel showing on completion, and Executive Summary (Stage 3) generates last with streaming. Single SSE connection with multiplexed events.

**Tech Stack:** Python/FastAPI (backend), React (frontend), SQLAlchemy (ORM), SSE (streaming), asyncio (parallel execution)

---

## Task 1: Add Section Status Fields to PRD Model

**Files:**
- Modify: `backend/app/models/prd.py`
- Create: `backend/alembic/versions/xxxx_add_section_status_fields.py`
- Test: `backend/tests/test_prd_model.py`

**Step 1: Write the failing test**

Create `backend/tests/test_prd_model.py`:

```python
"""Tests for PRD model section status fields."""

import pytest
from sqlalchemy.orm import Session

from app.models import PRD, PRDMode, PRDStatus, Project


def _create_test_project(db: Session, name: str = "Test Project") -> Project:
    """Create a test project."""
    project = Project(name=name, description="Test")
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


class TestPRDSectionStatus:
    """Tests for PRD section status tracking fields."""

    def test_prd_has_current_stage_field(self, test_db: Session) -> None:
        """Test that PRD model has current_stage field."""
        project = _create_test_project(test_db)
        prd = PRD(
            project_id=str(project.id),
            version=1,
            mode=PRDMode.DRAFT,
            status=PRDStatus.GENERATING,
            current_stage=2,
        )
        test_db.add(prd)
        test_db.commit()
        test_db.refresh(prd)
        assert prd.current_stage == 2

    def test_prd_has_sections_completed_field(self, test_db: Session) -> None:
        """Test that PRD model has sections_completed field."""
        project = _create_test_project(test_db)
        prd = PRD(
            project_id=str(project.id),
            version=1,
            mode=PRDMode.DRAFT,
            status=PRDStatus.GENERATING,
            sections_completed=5,
        )
        test_db.add(prd)
        test_db.commit()
        test_db.refresh(prd)
        assert prd.sections_completed == 5

    def test_prd_has_sections_total_field(self, test_db: Session) -> None:
        """Test that PRD model has sections_total field."""
        project = _create_test_project(test_db)
        prd = PRD(
            project_id=str(project.id),
            version=1,
            mode=PRDMode.DRAFT,
            status=PRDStatus.GENERATING,
            sections_total=12,
        )
        test_db.add(prd)
        test_db.commit()
        test_db.refresh(prd)
        assert prd.sections_total == 12

    def test_prd_status_partial_exists(self, test_db: Session) -> None:
        """Test that PRDStatus.PARTIAL enum value exists."""
        project = _create_test_project(test_db)
        prd = PRD(
            project_id=str(project.id),
            version=1,
            mode=PRDMode.DRAFT,
            status=PRDStatus.PARTIAL,
        )
        test_db.add(prd)
        test_db.commit()
        test_db.refresh(prd)
        assert prd.status == PRDStatus.PARTIAL
        assert prd.status.value == "partial"

    def test_section_with_status_fields(self, test_db: Session) -> None:
        """Test that sections JSON can include status, error, and generated_at."""
        project = _create_test_project(test_db)
        sections = [
            {
                "id": "problem_statement",
                "title": "Problem Statement",
                "content": "Content here",
                "order": 1,
                "status": "completed",
                "error": None,
                "generated_at": "2026-01-26T10:00:00Z",
            },
            {
                "id": "goals_objectives",
                "title": "Goals",
                "content": "",
                "order": 2,
                "status": "failed",
                "error": "LLM timeout",
                "generated_at": None,
            },
        ]
        prd = PRD(
            project_id=str(project.id),
            version=1,
            mode=PRDMode.DRAFT,
            status=PRDStatus.PARTIAL,
            sections=sections,
        )
        test_db.add(prd)
        test_db.commit()
        test_db.refresh(prd)

        assert prd.sections[0]["status"] == "completed"
        assert prd.sections[1]["status"] == "failed"
        assert prd.sections[1]["error"] == "LLM timeout"
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_prd_model.py -v`
Expected: FAIL with AttributeError or similar (fields don't exist)

**Step 3: Update PRD model**

Modify `backend/app/models/prd.py`:

```python
"""PRD model for storing Product Requirements Documents with status lifecycle."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base


class PRDMode(str, enum.Enum):
    """Enum for PRD generation modes."""
    DRAFT = "draft"
    DETAILED = "detailed"


class PRDStatus(str, enum.Enum):
    """Enum for PRD generation status lifecycle."""
    QUEUED = "queued"
    GENERATING = "generating"
    READY = "ready"
    PARTIAL = "partial"  # NEW: Some sections failed
    FAILED = "failed"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class PRD(Base):
    """PRD model for storing Product Requirements Documents."""

    __tablename__ = "prds"
    __table_args__ = (
        UniqueConstraint("project_id", "version", name="uq_prds_project_version"),
    )

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=True)
    mode: Mapped[PRDMode] = mapped_column(SAEnum(PRDMode), nullable=False)
    sections = Column(JSON, nullable=True)
    raw_markdown = Column(Text, nullable=True)

    # Status lifecycle
    status: Mapped[PRDStatus] = mapped_column(SAEnum(PRDStatus), default=PRDStatus.QUEUED, nullable=False)
    error_message = Column(Text, nullable=True)

    # NEW: Section generation progress tracking
    current_stage: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sections_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sections_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Audit fields
    created_by: Mapped[str] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str] = mapped_column(String(255), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    project = relationship("Project", back_populates="prds")

    def __repr__(self) -> str:
        return f"<PRD(id={self.id}, title={self.title}, version={self.version}, status={self.status})>"
```

**Step 4: Create migration**

Run: `cd backend && alembic revision --autogenerate -m "add_prd_section_progress_fields"`

Then edit the generated migration to include:

```python
def upgrade() -> None:
    op.add_column('prds', sa.Column('current_stage', sa.Integer(), nullable=True))
    op.add_column('prds', sa.Column('sections_completed', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('prds', sa.Column('sections_total', sa.Integer(), nullable=False, server_default='0'))
    # Update PRDStatus enum to include PARTIAL
    # Note: For SQLite this is a no-op, for PostgreSQL would need ALTER TYPE

def downgrade() -> None:
    op.drop_column('prds', 'sections_total')
    op.drop_column('prds', 'sections_completed')
    op.drop_column('prds', 'current_stage')
```

**Step 5: Run migration and test**

Run: `cd backend && alembic upgrade head && python -m pytest tests/test_prd_model.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/models/prd.py backend/alembic/versions/*section_progress* backend/tests/test_prd_model.py
git commit -m "feat: add PRD section progress tracking fields

- Add current_stage, sections_completed, sections_total to PRD model
- Add PRDStatus.PARTIAL for partial generation completion
- Sections JSON now supports status, error, generated_at per section"
```

---

## Task 2: Create Section Prompt Templates

**Files:**
- Create: `backend/prompts/sections/shared_context.txt`
- Create: `backend/prompts/sections/problem_statement.txt`
- Create: `backend/prompts/sections/goals_objectives.txt`
- Create: `backend/prompts/sections/target_users.txt`
- Create: `backend/prompts/sections/proposed_solution.txt`
- Create: `backend/prompts/sections/functional_requirements.txt`
- Create: `backend/prompts/sections/non_functional_requirements.txt`
- Create: `backend/prompts/sections/technical_considerations.txt`
- Create: `backend/prompts/sections/success_metrics.txt`
- Create: `backend/prompts/sections/timeline_milestones.txt`
- Create: `backend/prompts/sections/risks_mitigations.txt`
- Create: `backend/prompts/sections/appendix.txt`
- Create: `backend/prompts/sections/executive_summary.txt`
- Create: `backend/prompts/sections/open_questions.txt`
- Create: `backend/prompts/sections/identified_gaps.txt`
- Create: `backend/prompts/sections/next_steps.txt`

**Step 1: Create shared context template**

Create `backend/prompts/sections/shared_context.txt`:

```text
You are a product manager writing a section of a Product Requirements Document.

IMPORTANT INSTRUCTIONS:
- Return ONLY a valid JSON object with "title" and "content" fields
- Do NOT include any explanation, markdown formatting, or text before or after the JSON
- Use rich markdown formatting within the content field (headers, lists, tables, bold)
- Be specific and detailed

## Output Format

Return a JSON object with this exact structure:
{
  "title": "Section Title",
  "content": "markdown content here..."
}
```

**Step 2: Create Stage 1 section templates**

Create `backend/prompts/sections/problem_statement.txt`:

```text
{shared_context}

## Your Task

Generate the **Problem Statement** section for a PRD.

## Requirements Context

{requirements_by_section}

## Section Guidelines

The Problem Statement should include:
- Detailed problem description with context
- Current state vs. desired state
- Impact of not solving this problem
- Supporting data or research if available from requirements

Be thorough and specific. This section establishes the foundation for the entire PRD.

Generate the Problem Statement section now:
```

Create `backend/prompts/sections/goals_objectives.txt`:

```text
{shared_context}

## Your Task

Generate the **Goals and Objectives** section for a PRD.

## Requirements Context

{requirements_by_section}

## Prior Sections (for context)

{prior_sections}

## Section Guidelines

Goals and Objectives should include:
- SMART goals with clear success criteria
- Primary and secondary objectives
- Alignment with broader business goals
- Key results expected from this initiative

Build upon the problem statement to define measurable objectives.

Generate the Goals and Objectives section now:
```

Create `backend/prompts/sections/target_users.txt`:

```text
{shared_context}

## Your Task

Generate the **Target Users** section for a PRD.

## Requirements Context

{requirements_by_section}

## Prior Sections (for context)

{prior_sections}

## Section Guidelines

Target Users should include:
- User personas and segments
- User needs and pain points
- User journey considerations
- Prioritization of user segments if multiple

Consider who will benefit from solving the problem defined earlier.

Generate the Target Users section now:
```

Create `backend/prompts/sections/proposed_solution.txt`:

```text
{shared_context}

## Your Task

Generate the **Proposed Solution** section for a PRD.

## Requirements Context

{requirements_by_section}

## Prior Sections (for context)

{prior_sections}

## Section Guidelines

Proposed Solution should include:
- Detailed solution description
- Key features and capabilities
- User experience overview
- How the solution addresses the problem statement

Connect the solution directly to the goals and user needs defined earlier.

Generate the Proposed Solution section now:
```

**Step 3: Create Stage 2 section templates (parallel)**

Create `backend/prompts/sections/functional_requirements.txt`:

```text
{shared_context}

## Your Task

Generate the **Functional Requirements** section for a PRD.

## Requirements Context

{requirements_by_section}

## Foundation Context (Problem, Goals, Users, Solution)

{prior_sections}

## Section Guidelines

Functional Requirements should include:
- Specific features and capabilities
- Use cases and user flows
- Input/output specifications
- Business rules and logic
- Format as a structured list with clear requirement IDs (FR-001, FR-002, etc.)

Base requirements on the proposed solution and user needs.

Generate the Functional Requirements section now:
```

Create `backend/prompts/sections/non_functional_requirements.txt`:

```text
{shared_context}

## Your Task

Generate the **Non-Functional Requirements** section for a PRD.

## Requirements Context

{requirements_by_section}

## Foundation Context (Problem, Goals, Users, Solution)

{prior_sections}

## Section Guidelines

Non-Functional Requirements should include:
- Performance requirements (response time, throughput)
- Security and compliance requirements
- Scalability considerations
- Accessibility requirements
- Reliability and availability targets
- Format as a structured list with clear requirement IDs (NFR-001, NFR-002, etc.)

Generate the Non-Functional Requirements section now:
```

Create `backend/prompts/sections/technical_considerations.txt`:

```text
{shared_context}

## Your Task

Generate the **Technical Considerations** section for a PRD.

## Requirements Context

{requirements_by_section}

## Foundation Context (Problem, Goals, Users, Solution)

{prior_sections}

## Section Guidelines

Technical Considerations should include:
- Architecture overview or constraints
- Integration points with existing systems
- Technology stack recommendations or constraints
- Data requirements and storage considerations
- API requirements if applicable

Generate the Technical Considerations section now:
```

Create `backend/prompts/sections/success_metrics.txt`:

```text
{shared_context}

## Your Task

Generate the **Success Metrics** section for a PRD.

## Requirements Context

{requirements_by_section}

## Foundation Context (Problem, Goals, Users, Solution)

{prior_sections}

## Section Guidelines

Success Metrics should include:
- Key Performance Indicators (KPIs)
- Measurement methodology
- Baseline metrics if available
- Target values and timeframes
- How success will be tracked and reported

Align metrics with the goals and objectives defined earlier.

Generate the Success Metrics section now:
```

Create `backend/prompts/sections/timeline_milestones.txt`:

```text
{shared_context}

## Your Task

Generate the **Timeline and Milestones** section for a PRD.

## Requirements Context

{requirements_by_section}

## Foundation Context (Problem, Goals, Users, Solution)

{prior_sections}

## Section Guidelines

Timeline and Milestones should include:
- Phased delivery plan
- Key milestones with descriptions
- Dependencies between phases
- Critical path items
- Format as a structured timeline or table

Generate the Timeline and Milestones section now:
```

Create `backend/prompts/sections/risks_mitigations.txt`:

```text
{shared_context}

## Your Task

Generate the **Risks and Mitigations** section for a PRD.

## Requirements Context

{requirements_by_section}

## Foundation Context (Problem, Goals, Users, Solution)

{prior_sections}

## Section Guidelines

Risks and Mitigations should include:
- Risk assessment with likelihood and impact
- Mitigation strategies for each risk
- Contingency plans for high-impact risks
- Risk owners if identifiable
- Format as a risk matrix or structured list

Generate the Risks and Mitigations section now:
```

Create `backend/prompts/sections/appendix.txt`:

```text
{shared_context}

## Your Task

Generate the **Appendix** section for a PRD.

## Requirements Context

{requirements_by_section}

## Foundation Context (Problem, Goals, Users, Solution)

{prior_sections}

## Section Guidelines

Appendix should include:
- Supporting information and references
- Glossary of terms if needed
- Related documents or links
- Assumptions made during PRD creation
- Out of scope items for future consideration

Generate the Appendix section now:
```

**Step 4: Create Stage 3 template (Executive Summary)**

Create `backend/prompts/sections/executive_summary.txt`:

```text
{shared_context}

## Your Task

Generate the **Executive Summary** section for a PRD.

This is a summary of the entire document, so all sections are provided below.

## Requirements Context

{requirements_by_section}

## All PRD Sections

{all_sections}

## Section Guidelines

Executive Summary should include:
- Concise overview for executives (2-3 paragraphs)
- Key value proposition and business impact
- High-level scope and timeline summary

Synthesize the key points from all sections into a compelling executive overview.

Generate the Executive Summary section now:
```

**Step 5: Create DRAFT mode specific templates**

Create `backend/prompts/sections/open_questions.txt`:

```text
{shared_context}

## Your Task

Generate the **Open Questions** section for a DRAFT PRD.

## Requirements Context

{requirements_by_section}

## Foundation Context (Problem, Goals, Solution)

{prior_sections}

## Section Guidelines

Open Questions should include:
- All unanswered questions that need clarification
- Questions prioritized by importance
- Questions grouped by topic area
- Suggested stakeholders to answer each question

This is a CRITICAL section for draft PRDs - be thorough in identifying gaps.

Generate the Open Questions section now:
```

Create `backend/prompts/sections/identified_gaps.txt`:

```text
{shared_context}

## Your Task

Generate the **Identified Gaps** section for a DRAFT PRD.

## Requirements Context

{requirements_by_section}

## Foundation Context (Problem, Goals, Solution)

{prior_sections}

## Section Guidelines

Identified Gaps should include:
- Missing requirements by category
- Areas needing more research or data
- Unclear or ambiguous requirements
- Dependencies that need to be resolved

This is a CRITICAL section for draft PRDs - be thorough in identifying what's missing.

Generate the Identified Gaps section now:
```

Create `backend/prompts/sections/next_steps.txt`:

```text
{shared_context}

## Your Task

Generate the **Next Steps** section for a DRAFT PRD.

## Requirements Context

{requirements_by_section}

## Foundation Context (Problem, Goals, Solution)

{prior_sections}

## Section Guidelines

Next Steps should include:
- Specific actions to address identified gaps
- Actions to answer open questions
- Stakeholder meetings or reviews needed
- Timeline for completing the draft

Provide actionable next steps to move from draft to detailed PRD.

Generate the Next Steps section now:
```

**Step 6: Commit**

```bash
git add backend/prompts/sections/
git commit -m "feat: add section-specific prompt templates

- Add shared_context.txt with common instructions
- Add Stage 1 templates: problem_statement, goals_objectives, target_users, proposed_solution
- Add Stage 2 templates: functional_requirements, non_functional_requirements, technical_considerations, success_metrics, timeline_milestones, risks_mitigations, appendix
- Add Stage 3 template: executive_summary
- Add DRAFT mode templates: open_questions, identified_gaps, next_steps"
```

---

## Task 3: Create Section Generator Service

**Files:**
- Create: `backend/app/services/section_generator.py`
- Test: `backend/tests/test_section_generator.py`

**Step 1: Write the failing tests**

Create `backend/tests/test_section_generator.py`:

```python
"""Tests for the section generator service."""

import json
from unittest.mock import AsyncMock, patch
import pytest
from sqlalchemy.orm import Session

from app.models import Project, Requirement
from app.models.meeting_item import Section
from app.services.section_generator import (
    SectionGenerator,
    SectionConfig,
    DETAILED_STAGE_1_SECTIONS,
    DETAILED_STAGE_2_SECTIONS,
    DRAFT_STAGE_1_SECTIONS,
    DRAFT_STAGE_2_SECTIONS,
)


def _create_test_project(db: Session) -> Project:
    """Create a test project."""
    project = Project(name="Test Project", description="Test")
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _create_test_requirement(db: Session, project_id: str) -> Requirement:
    """Create a test requirement."""
    req = Requirement(
        project_id=project_id,
        section=Section.problems,
        content="Users have problems",
        order=0,
        is_active=True,
    )
    db.add(req)
    db.commit()
    return req


class TestSectionConfig:
    """Tests for section configuration."""

    def test_detailed_stage_1_sections(self) -> None:
        """Test DETAILED mode Stage 1 sections are correct."""
        expected = ["problem_statement", "goals_objectives", "target_users", "proposed_solution"]
        assert DETAILED_STAGE_1_SECTIONS == expected

    def test_detailed_stage_2_sections(self) -> None:
        """Test DETAILED mode Stage 2 sections are correct."""
        expected = [
            "functional_requirements",
            "non_functional_requirements",
            "technical_considerations",
            "success_metrics",
            "timeline_milestones",
            "risks_mitigations",
            "appendix",
        ]
        assert DETAILED_STAGE_2_SECTIONS == expected

    def test_draft_stage_1_sections(self) -> None:
        """Test DRAFT mode Stage 1 sections are correct."""
        expected = ["problem_statement", "goals_objectives", "proposed_solution"]
        assert DRAFT_STAGE_1_SECTIONS == expected

    def test_draft_stage_2_sections(self) -> None:
        """Test DRAFT mode Stage 2 sections are correct."""
        expected = ["open_questions", "identified_gaps", "next_steps"]
        assert DRAFT_STAGE_2_SECTIONS == expected


class TestSectionGenerator:
    """Tests for section generator service."""

    def test_build_section_prompt_includes_requirements(self, test_db: Session) -> None:
        """Test that build_section_prompt includes requirements."""
        project = _create_test_project(test_db)
        _create_test_requirement(test_db, str(project.id))

        generator = SectionGenerator(test_db)
        requirements = {"problems": ["Users have problems"]}

        prompt = generator.build_section_prompt(
            section_id="problem_statement",
            requirements_by_section=requirements,
            prior_sections=[],
        )

        assert "Users have problems" in prompt
        assert "Problem Statement" in prompt

    def test_build_section_prompt_includes_prior_sections(self, test_db: Session) -> None:
        """Test that build_section_prompt includes prior sections context."""
        generator = SectionGenerator(test_db)
        requirements = {"problems": ["A problem"]}
        prior = [
            {"id": "problem_statement", "title": "Problem Statement", "content": "The problem is X"},
        ]

        prompt = generator.build_section_prompt(
            section_id="goals_objectives",
            requirements_by_section=requirements,
            prior_sections=prior,
        )

        assert "The problem is X" in prompt
        assert "Goals" in prompt

    def test_parse_section_response_valid_json(self, test_db: Session) -> None:
        """Test that valid JSON response is parsed correctly."""
        generator = SectionGenerator(test_db)
        response = json.dumps({
            "title": "Problem Statement",
            "content": "The problem is that users struggle.",
        })

        result = generator.parse_section_response(response, "problem_statement", 1)

        assert result["id"] == "problem_statement"
        assert result["title"] == "Problem Statement"
        assert result["content"] == "The problem is that users struggle."
        assert result["order"] == 1
        assert result["status"] == "completed"

    def test_parse_section_response_with_markdown_wrapper(self, test_db: Session) -> None:
        """Test that markdown-wrapped JSON is parsed correctly."""
        generator = SectionGenerator(test_db)
        response = '```json\n{"title": "Goals", "content": "Our goals are..."}\n```'

        result = generator.parse_section_response(response, "goals_objectives", 2)

        assert result["title"] == "Goals"
        assert result["content"] == "Our goals are..."

    @pytest.mark.asyncio
    async def test_generate_section_stream_yields_chunks(self, test_db: Session) -> None:
        """Test that generate_section_stream yields content chunks."""
        generator = SectionGenerator(test_db)
        requirements = {"problems": ["A problem"]}

        mock_provider = AsyncMock()
        mock_provider.stream = AsyncMock(return_value=async_iter([
            '{"title": "Problem",',
            ' "content": "The problem is X"}',
        ]))

        with patch("app.services.section_generator.get_provider", return_value=mock_provider):
            chunks = []
            async for chunk in generator.generate_section_stream(
                section_id="problem_statement",
                requirements_by_section=requirements,
                prior_sections=[],
            ):
                chunks.append(chunk)

        assert len(chunks) > 0
        # Last chunk should be the complete section
        assert chunks[-1]["type"] == "section_complete"

    @pytest.mark.asyncio
    async def test_generate_section_returns_complete_section(self, test_db: Session) -> None:
        """Test that generate_section returns a complete section dict."""
        generator = SectionGenerator(test_db)
        requirements = {"problems": ["A problem"]}

        mock_provider = AsyncMock()
        mock_provider.generate = lambda *args, **kwargs: json.dumps({
            "title": "Problem Statement",
            "content": "The problem is X",
        })

        with patch("app.services.section_generator.get_provider", return_value=mock_provider):
            section = await generator.generate_section(
                section_id="problem_statement",
                requirements_by_section=requirements,
                prior_sections=[],
                order=1,
            )

        assert section["id"] == "problem_statement"
        assert section["title"] == "Problem Statement"
        assert section["content"] == "The problem is X"
        assert section["status"] == "completed"


async def async_iter(items):
    """Helper to create async iterator from list."""
    for item in items:
        yield item
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_section_generator.py -v`
Expected: FAIL with ModuleNotFoundError

**Step 3: Implement section generator service**

Create `backend/app/services/section_generator.py`:

```python
"""Section generator service for individual PRD section generation."""

import json
from collections.abc import AsyncIterator
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.exceptions import LLMResponseError
from app.services.llm import get_provider

# Path to section prompt templates
SECTIONS_PROMPTS_PATH = Path(__file__).parent.parent.parent / "prompts" / "sections"

# Section timeout configuration (seconds)
STAGE_1_TIMEOUT = 60  # Sequential, user watching
STAGE_2_TIMEOUT = 90  # Parallel, more tolerance
STAGE_3_TIMEOUT = 45  # Executive summary, shorter

# Temperature and max tokens for section generation
SECTION_TEMPERATURE = 0.7
SECTION_MAX_TOKENS = 2000  # Smaller per section

# Stage configurations for DETAILED mode (12 sections)
DETAILED_STAGE_1_SECTIONS = [
    "problem_statement",
    "goals_objectives",
    "target_users",
    "proposed_solution",
]
DETAILED_STAGE_2_SECTIONS = [
    "functional_requirements",
    "non_functional_requirements",
    "technical_considerations",
    "success_metrics",
    "timeline_milestones",
    "risks_mitigations",
    "appendix",
]

# Stage configurations for DRAFT mode (7 sections)
DRAFT_STAGE_1_SECTIONS = [
    "problem_statement",
    "goals_objectives",
    "proposed_solution",
]
DRAFT_STAGE_2_SECTIONS = [
    "open_questions",
    "identified_gaps",
    "next_steps",
]

# Section display names and order
SECTION_CONFIG = {
    "problem_statement": {"title": "Problem Statement", "order": 1},
    "goals_objectives": {"title": "Goals and Objectives", "order": 2},
    "target_users": {"title": "Target Users", "order": 3},
    "proposed_solution": {"title": "Proposed Solution", "order": 4},
    "functional_requirements": {"title": "Functional Requirements", "order": 5},
    "non_functional_requirements": {"title": "Non-Functional Requirements", "order": 6},
    "technical_considerations": {"title": "Technical Considerations", "order": 7},
    "success_metrics": {"title": "Success Metrics", "order": 8},
    "timeline_milestones": {"title": "Timeline and Milestones", "order": 9},
    "risks_mitigations": {"title": "Risks and Mitigations", "order": 10},
    "appendix": {"title": "Appendix", "order": 11},
    "executive_summary": {"title": "Executive Summary", "order": 0},  # Reordered to first in final output
    "open_questions": {"title": "Open Questions", "order": 5},
    "identified_gaps": {"title": "Identified Gaps", "order": 6},
    "next_steps": {"title": "Next Steps", "order": 7},
}


class SectionGenerator:
    """Service for generating individual PRD sections."""

    def __init__(self, db: Session):
        """Initialize section generator."""
        self.db = db

    def build_section_prompt(
        self,
        section_id: str,
        requirements_by_section: dict[str, list[str]],
        prior_sections: list[dict[str, Any]],
        all_sections: list[dict[str, Any]] | None = None,
    ) -> str:
        """Build the prompt for generating a specific section.

        Args:
            section_id: The section identifier (e.g., "problem_statement").
            requirements_by_section: Requirements grouped by section.
            prior_sections: Previously generated sections for context.
            all_sections: All sections (only for executive_summary).

        Returns:
            Complete prompt string.
        """
        # Load shared context
        shared_context = self._load_template("shared_context.txt")

        # Load section-specific template
        section_template = self._load_template(f"{section_id}.txt")

        # Format requirements
        requirements_text = self._format_requirements(requirements_by_section)

        # Format prior sections context
        prior_sections_text = self._format_prior_sections(prior_sections)

        # Format all sections (for executive summary)
        all_sections_text = ""
        if all_sections:
            all_sections_text = self._format_all_sections(all_sections)

        # Build complete prompt
        prompt = section_template.replace("{shared_context}", shared_context)
        prompt = prompt.replace("{requirements_by_section}", requirements_text)
        prompt = prompt.replace("{prior_sections}", prior_sections_text)
        prompt = prompt.replace("{all_sections}", all_sections_text)

        return prompt

    def _load_template(self, filename: str) -> str:
        """Load a prompt template file."""
        template_path = SECTIONS_PROMPTS_PATH / filename
        try:
            return template_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            raise LLMResponseError(f"Template not found: {filename}")

    def _format_requirements(self, requirements_by_section: dict[str, list[str]]) -> str:
        """Format requirements into a string for the prompt."""
        lines: list[str] = []
        section_display_names = {
            "problems": "Problems & Pain Points",
            "user_goals": "User Goals",
            "functional_requirements": "Functional Requirements",
            "data_needs": "Data Needs",
            "constraints": "Constraints",
            "non_goals": "Non-Goals",
            "risks_assumptions": "Risks & Assumptions",
            "open_questions": "Open Questions",
            "action_items": "Action Items",
        }

        for section_value, contents in requirements_by_section.items():
            display_name = section_display_names.get(
                section_value, section_value.replace("_", " ").title()
            )
            lines.append(f"### {display_name}")
            lines.append("")
            for i, content in enumerate(contents, 1):
                lines.append(f"{i}. {content}")
            lines.append("")

        return "\n".join(lines)

    def _format_prior_sections(self, prior_sections: list[dict[str, Any]]) -> str:
        """Format prior sections for context."""
        if not prior_sections:
            return "No prior sections yet."

        lines: list[str] = []
        for section in prior_sections:
            lines.append(f"### {section.get('title', 'Untitled')}")
            lines.append("")
            lines.append(section.get("content", ""))
            lines.append("")

        return "\n".join(lines)

    def _format_all_sections(self, all_sections: list[dict[str, Any]]) -> str:
        """Format all sections for executive summary context."""
        if not all_sections:
            return "No sections available."

        # Sort by order
        sorted_sections = sorted(all_sections, key=lambda s: s.get("order", 0))

        lines: list[str] = []
        for section in sorted_sections:
            lines.append(f"## {section.get('title', 'Untitled')}")
            lines.append("")
            lines.append(section.get("content", ""))
            lines.append("")

        return "\n".join(lines)

    def parse_section_response(
        self,
        response: str,
        section_id: str,
        order: int,
    ) -> dict[str, Any]:
        """Parse LLM response into a section dict.

        Args:
            response: Raw LLM response string.
            section_id: The section identifier.
            order: The section order number.

        Returns:
            Section dictionary with id, title, content, order, status.
        """
        # Strip markdown code blocks
        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as e:
            raise LLMResponseError(f"Invalid JSON response: {e}", raw_response=response)

        if not isinstance(parsed, dict):
            raise LLMResponseError("Response must be a JSON object", raw_response=response)

        title = parsed.get("title", SECTION_CONFIG.get(section_id, {}).get("title", "Untitled"))
        content = parsed.get("content", "")

        if not content:
            raise LLMResponseError("Response missing 'content' field", raw_response=response)

        return {
            "id": section_id,
            "title": title,
            "content": content,
            "order": order,
            "status": "completed",
            "error": None,
            "generated_at": datetime.utcnow().isoformat() + "Z",
        }

    async def generate_section_stream(
        self,
        section_id: str,
        requirements_by_section: dict[str, list[str]],
        prior_sections: list[dict[str, Any]],
        all_sections: list[dict[str, Any]] | None = None,
        order: int | None = None,
        timeout: float = STAGE_1_TIMEOUT,
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream generation of a single section.

        Yields:
            - {"type": "chunk", "section_id": "...", "content": "..."} for streaming content
            - {"type": "section_complete", "section": {...}} when done
        """
        prompt = self.build_section_prompt(
            section_id=section_id,
            requirements_by_section=requirements_by_section,
            prior_sections=prior_sections,
            all_sections=all_sections,
        )

        provider = get_provider()
        accumulated = ""

        async for chunk in provider.stream(prompt):
            accumulated += chunk
            yield {
                "type": "chunk",
                "section_id": section_id,
                "content": chunk,
            }

        # Parse complete response
        final_order = order if order is not None else SECTION_CONFIG.get(section_id, {}).get("order", 0)
        section = self.parse_section_response(accumulated, section_id, final_order)

        yield {
            "type": "section_complete",
            "section": section,
        }

    async def generate_section(
        self,
        section_id: str,
        requirements_by_section: dict[str, list[str]],
        prior_sections: list[dict[str, Any]],
        order: int,
        timeout: float = STAGE_2_TIMEOUT,
    ) -> dict[str, Any]:
        """Generate a single section (non-streaming, for parallel execution).

        Args:
            section_id: The section to generate.
            requirements_by_section: Requirements context.
            prior_sections: Prior sections for context.
            order: Section order number.
            timeout: Timeout in seconds.

        Returns:
            Complete section dictionary.
        """
        prompt = self.build_section_prompt(
            section_id=section_id,
            requirements_by_section=requirements_by_section,
            prior_sections=prior_sections,
        )

        provider = get_provider()
        response = provider.generate(
            prompt,
            temperature=SECTION_TEMPERATURE,
            max_tokens=SECTION_MAX_TOKENS,
            timeout=timeout,
        )

        return self.parse_section_response(response, section_id, order)
```

**Step 4: Add to services __init__.py**

Update `backend/app/services/__init__.py` to export the new service.

**Step 5: Run tests**

Run: `cd backend && python -m pytest tests/test_section_generator.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/services/section_generator.py backend/app/services/__init__.py backend/tests/test_section_generator.py
git commit -m "feat: add section generator service

- SectionGenerator for individual PRD section generation
- Support for streaming and non-streaming generation
- Stage configuration for DETAILED and DRAFT modes
- Section-specific timeout configuration"
```

---

## Task 4: Implement Staged PRD Generator

**Files:**
- Modify: `backend/app/services/prd_generator.py`
- Test: `backend/tests/test_staged_prd_generator.py`

**Step 1: Write the failing tests**

Create `backend/tests/test_staged_prd_generator.py`:

```python
"""Tests for staged PRD generation."""

import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from sqlalchemy.orm import Session

from app.models import PRD, Project, Requirement, PRDMode, PRDStatus
from app.models.meeting_item import Section
from app.services.prd_generator import PRDGenerator


def _create_test_project(db: Session) -> Project:
    project = Project(name="Test Project", description="Test")
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _create_test_requirement(db: Session, project_id: str) -> Requirement:
    req = Requirement(
        project_id=project_id,
        section=Section.problems,
        content="Users have problems",
        order=0,
        is_active=True,
    )
    db.add(req)
    db.commit()
    return req


class TestStagedPRDGeneration:
    """Tests for staged PRD generation."""

    @pytest.mark.asyncio
    async def test_generate_stream_staged_yields_stage_events(self, test_db: Session) -> None:
        """Test that staged generation yields stage start events."""
        project = _create_test_project(test_db)
        _create_test_requirement(test_db, str(project.id))

        generator = PRDGenerator(test_db)

        # Mock section generator to return quickly
        with patch.object(generator, '_generate_stage_1_streaming') as mock_s1, \
             patch.object(generator, '_generate_stage_2_parallel') as mock_s2, \
             patch.object(generator, '_generate_stage_3_streaming') as mock_s3:

            mock_s1.return_value = async_iter([
                {"type": "stage", "stage": 1, "sections": ["problem_statement"]},
                {"type": "section_complete", "section": {"id": "problem_statement", "title": "Problem", "content": "X", "order": 1, "status": "completed"}},
            ])
            mock_s2.return_value = async_iter([
                {"type": "stage", "stage": 2, "sections": ["functional_requirements"]},
                {"type": "section_complete", "section": {"id": "functional_requirements", "title": "FR", "content": "Y", "order": 5, "status": "completed"}},
            ])
            mock_s3.return_value = async_iter([
                {"type": "stage", "stage": 3, "sections": ["executive_summary"]},
                {"type": "section_complete", "section": {"id": "executive_summary", "title": "Summary", "content": "Z", "order": 0, "status": "completed"}},
            ])

            events = []
            async for event in generator.generate_stream_staged(
                project_id=str(project.id),
                mode=PRDMode.DETAILED,
            ):
                events.append(event)

        # Should have stage events
        stage_events = [e for e in events if e.get("type") == "stage"]
        assert len(stage_events) == 3

    @pytest.mark.asyncio
    async def test_generate_stream_staged_yields_chunk_events(self, test_db: Session) -> None:
        """Test that staged generation yields chunk events during streaming."""
        project = _create_test_project(test_db)
        _create_test_requirement(test_db, str(project.id))

        generator = PRDGenerator(test_db)

        with patch.object(generator, '_generate_stage_1_streaming') as mock_s1, \
             patch.object(generator, '_generate_stage_2_parallel') as mock_s2, \
             patch.object(generator, '_generate_stage_3_streaming') as mock_s3:

            mock_s1.return_value = async_iter([
                {"type": "stage", "stage": 1, "sections": ["problem_statement"]},
                {"type": "chunk", "section_id": "problem_statement", "content": "The"},
                {"type": "chunk", "section_id": "problem_statement", "content": " problem"},
                {"type": "section_complete", "section": {"id": "problem_statement", "title": "Problem", "content": "The problem", "order": 1, "status": "completed"}},
            ])
            mock_s2.return_value = async_iter([
                {"type": "stage", "stage": 2, "sections": []},
            ])
            mock_s3.return_value = async_iter([
                {"type": "stage", "stage": 3, "sections": ["executive_summary"]},
                {"type": "section_complete", "section": {"id": "executive_summary", "title": "Summary", "content": "Sum", "order": 0, "status": "completed"}},
            ])

            events = []
            async for event in generator.generate_stream_staged(
                project_id=str(project.id),
                mode=PRDMode.DETAILED,
            ):
                events.append(event)

        chunk_events = [e for e in events if e.get("type") == "chunk"]
        assert len(chunk_events) >= 2

    @pytest.mark.asyncio
    async def test_generate_stream_staged_yields_complete_event(self, test_db: Session) -> None:
        """Test that staged generation yields complete event at end."""
        project = _create_test_project(test_db)
        _create_test_requirement(test_db, str(project.id))

        generator = PRDGenerator(test_db)

        with patch.object(generator, '_generate_stage_1_streaming') as mock_s1, \
             patch.object(generator, '_generate_stage_2_parallel') as mock_s2, \
             patch.object(generator, '_generate_stage_3_streaming') as mock_s3:

            mock_s1.return_value = async_iter([
                {"type": "stage", "stage": 1, "sections": []},
                {"type": "section_complete", "section": {"id": "problem_statement", "title": "P", "content": "C", "order": 1, "status": "completed"}},
            ])
            mock_s2.return_value = async_iter([{"type": "stage", "stage": 2, "sections": []}])
            mock_s3.return_value = async_iter([
                {"type": "stage", "stage": 3, "sections": []},
                {"type": "section_complete", "section": {"id": "executive_summary", "title": "S", "content": "C", "order": 0, "status": "completed"}},
            ])

            events = []
            async for event in generator.generate_stream_staged(
                project_id=str(project.id),
                mode=PRDMode.DETAILED,
            ):
                events.append(event)

        # Last event should be complete
        assert events[-1]["type"] == "complete"
        assert "prd_id" in events[-1]

    @pytest.mark.asyncio
    async def test_generate_stream_staged_handles_section_failure(self, test_db: Session) -> None:
        """Test that failed sections are marked and generation continues."""
        project = _create_test_project(test_db)
        _create_test_requirement(test_db, str(project.id))

        generator = PRDGenerator(test_db)

        with patch.object(generator, '_generate_stage_1_streaming') as mock_s1, \
             patch.object(generator, '_generate_stage_2_parallel') as mock_s2, \
             patch.object(generator, '_generate_stage_3_streaming') as mock_s3:

            mock_s1.return_value = async_iter([
                {"type": "stage", "stage": 1, "sections": ["problem_statement"]},
                {"type": "section_complete", "section": {"id": "problem_statement", "title": "P", "content": "C", "order": 1, "status": "completed"}},
            ])
            mock_s2.return_value = async_iter([
                {"type": "stage", "stage": 2, "sections": ["functional_requirements"]},
                {"type": "section_failed", "section_id": "functional_requirements", "error": "LLM timeout"},
            ])
            mock_s3.return_value = async_iter([
                {"type": "stage", "stage": 3, "sections": ["executive_summary"]},
                {"type": "section_complete", "section": {"id": "executive_summary", "title": "S", "content": "C", "order": 0, "status": "completed"}},
            ])

            events = []
            async for event in generator.generate_stream_staged(
                project_id=str(project.id),
                mode=PRDMode.DETAILED,
            ):
                events.append(event)

        # Should have a section_failed event
        failed_events = [e for e in events if e.get("type") == "section_failed"]
        assert len(failed_events) == 1
        assert failed_events[0]["section_id"] == "functional_requirements"

        # Should still complete
        assert events[-1]["type"] == "complete"


async def async_iter(items):
    """Helper to create async iterator from list."""
    for item in items:
        yield item
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_staged_prd_generator.py -v`
Expected: FAIL with AttributeError (method doesn't exist)

**Step 3: Implement staged generation in PRDGenerator**

Add to `backend/app/services/prd_generator.py`:

```python
# Add these imports at the top
import asyncio
from app.services.section_generator import (
    SectionGenerator,
    DETAILED_STAGE_1_SECTIONS,
    DETAILED_STAGE_2_SECTIONS,
    DRAFT_STAGE_1_SECTIONS,
    DRAFT_STAGE_2_SECTIONS,
    SECTION_CONFIG,
    STAGE_1_TIMEOUT,
    STAGE_2_TIMEOUT,
    STAGE_3_TIMEOUT,
)

# Add this method to PRDGenerator class:

    async def generate_stream_staged(
        self,
        project_id: str,
        mode: PRDMode,
        created_by: str | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream PRD generation using staged parallel approach.

        Stage 1: Sequential generation with streaming (foundation sections)
        Stage 2: Parallel generation, yield on complete (bulk sections)
        Stage 3: Sequential generation with streaming (executive summary)

        Yields:
            Events for stage starts, chunks, section completions, failures, and final complete.
        """
        # Load requirements
        requirements_by_section = self._load_requirements(project_id)
        if not requirements_by_section:
            raise NoRequirementsError(project_id)

        # Determine sections based on mode
        if mode == PRDMode.DETAILED:
            stage_1_sections = DETAILED_STAGE_1_SECTIONS
            stage_2_sections = DETAILED_STAGE_2_SECTIONS
        else:
            stage_1_sections = DRAFT_STAGE_1_SECTIONS
            stage_2_sections = DRAFT_STAGE_2_SECTIONS

        total_sections = len(stage_1_sections) + len(stage_2_sections) + 1  # +1 for executive summary

        # Create PRD record
        prd = PRD(
            project_id=project_id,
            version=0,
            title=None,
            mode=mode,
            sections=[],
            status=PRDStatus.GENERATING,
            current_stage=1,
            sections_completed=0,
            sections_total=total_sections,
            created_by=created_by,
            updated_by=created_by,
        )
        self.db.add(prd)
        self.db.flush()

        all_sections: list[dict[str, Any]] = []
        failed_sections: list[str] = []

        # Stage 1: Sequential with streaming
        async for event in self._generate_stage_1_streaming(
            requirements_by_section, stage_1_sections, all_sections
        ):
            yield event
            if event.get("type") == "section_complete":
                all_sections.append(event["section"])
                prd.sections_completed += 1
            elif event.get("type") == "section_failed":
                failed_sections.append(event["section_id"])

        prd.current_stage = 2
        self.db.flush()

        # Stage 2: Parallel, yield on complete
        async for event in self._generate_stage_2_parallel(
            requirements_by_section, stage_2_sections, all_sections
        ):
            yield event
            if event.get("type") == "section_complete":
                all_sections.append(event["section"])
                prd.sections_completed += 1
            elif event.get("type") == "section_failed":
                failed_sections.append(event["section_id"])

        prd.current_stage = 3
        self.db.flush()

        # Stage 3: Executive Summary with streaming
        async for event in self._generate_stage_3_streaming(
            requirements_by_section, all_sections
        ):
            yield event
            if event.get("type") == "section_complete":
                all_sections.append(event["section"])
                prd.sections_completed += 1
            elif event.get("type") == "section_failed":
                failed_sections.append(event["section_id"])

        # Finalize PRD
        # Sort sections by order for final output
        sorted_sections = sorted(all_sections, key=lambda s: s.get("order", 0))

        # Reorder executive summary to position 0
        exec_summary = next((s for s in sorted_sections if s["id"] == "executive_summary"), None)
        if exec_summary:
            sorted_sections.remove(exec_summary)
            sorted_sections.insert(0, exec_summary)
            # Update orders
            for i, section in enumerate(sorted_sections):
                section["order"] = i + 1

        # Generate title from first section or use default
        title = f"PRD: {project_id[:8]}"  # Default title
        if sorted_sections:
            # Try to extract a meaningful title
            problem_section = next((s for s in sorted_sections if s["id"] == "problem_statement"), None)
            if problem_section and problem_section.get("content"):
                # Use first line or first 50 chars as title hint
                first_line = problem_section["content"].split("\n")[0][:100]
                title = f"PRD: {first_line}"

        # Generate markdown
        raw_markdown = self._generate_markdown(title, sorted_sections)

        # Determine final status
        if failed_sections:
            final_status = PRDStatus.PARTIAL
        else:
            final_status = PRDStatus.READY

        # Atomic version assignment
        version = self.assign_version_atomically(
            prd=prd,
            title=title,
            sections=sorted_sections,
            raw_markdown=raw_markdown,
            updated_by=created_by,
        )

        # Update final status if partial
        if final_status == PRDStatus.PARTIAL:
            prd.status = PRDStatus.PARTIAL
            self.db.commit()

        yield {
            "type": "complete",
            "prd_id": str(prd.id),
            "version": version,
            "section_count": len(sorted_sections),
            "failed_sections": failed_sections,
        }

    async def _generate_stage_1_streaming(
        self,
        requirements_by_section: dict[str, list[str]],
        stage_1_sections: list[str],
        prior_sections: list[dict[str, Any]],
    ) -> AsyncIterator[dict[str, Any]]:
        """Generate Stage 1 sections sequentially with streaming."""
        yield {
            "type": "stage",
            "stage": 1,
            "sections": stage_1_sections,
        }

        section_generator = SectionGenerator(self.db)

        for section_id in stage_1_sections:
            order = SECTION_CONFIG.get(section_id, {}).get("order", 0)
            try:
                async for event in section_generator.generate_section_stream(
                    section_id=section_id,
                    requirements_by_section=requirements_by_section,
                    prior_sections=prior_sections,
                    order=order,
                    timeout=STAGE_1_TIMEOUT,
                ):
                    yield event
                    if event.get("type") == "section_complete":
                        prior_sections.append(event["section"])
            except Exception as e:
                yield {
                    "type": "section_failed",
                    "section_id": section_id,
                    "error": str(e),
                }

    async def _generate_stage_2_parallel(
        self,
        requirements_by_section: dict[str, list[str]],
        stage_2_sections: list[str],
        prior_sections: list[dict[str, Any]],
    ) -> AsyncIterator[dict[str, Any]]:
        """Generate Stage 2 sections in parallel, yield on completion."""
        yield {
            "type": "stage",
            "stage": 2,
            "sections": stage_2_sections,
        }

        section_generator = SectionGenerator(self.db)

        # Create tasks for all stage 2 sections
        async def generate_with_id(section_id: str) -> tuple[str, dict[str, Any] | Exception]:
            """Generate section and return with ID for tracking."""
            order = SECTION_CONFIG.get(section_id, {}).get("order", 0)
            try:
                section = await section_generator.generate_section(
                    section_id=section_id,
                    requirements_by_section=requirements_by_section,
                    prior_sections=prior_sections,
                    order=order,
                    timeout=STAGE_2_TIMEOUT,
                )
                return section_id, section
            except Exception as e:
                return section_id, e

        # Create all tasks
        tasks = [
            asyncio.create_task(generate_with_id(section_id))
            for section_id in stage_2_sections
        ]

        # Yield results as they complete
        for coro in asyncio.as_completed(tasks):
            section_id, result = await coro
            if isinstance(result, Exception):
                yield {
                    "type": "section_failed",
                    "section_id": section_id,
                    "error": str(result),
                }
            else:
                yield {
                    "type": "section_complete",
                    "section": result,
                }

    async def _generate_stage_3_streaming(
        self,
        requirements_by_section: dict[str, list[str]],
        all_sections: list[dict[str, Any]],
    ) -> AsyncIterator[dict[str, Any]]:
        """Generate Executive Summary with streaming, using all prior sections."""
        yield {
            "type": "stage",
            "stage": 3,
            "sections": ["executive_summary"],
        }

        section_generator = SectionGenerator(self.db)

        try:
            async for event in section_generator.generate_section_stream(
                section_id="executive_summary",
                requirements_by_section=requirements_by_section,
                prior_sections=[],
                all_sections=all_sections,
                order=0,
                timeout=STAGE_3_TIMEOUT,
            ):
                yield event
        except Exception as e:
            yield {
                "type": "section_failed",
                "section_id": "executive_summary",
                "error": str(e),
            }
```

**Step 4: Run tests**

Run: `cd backend && python -m pytest tests/test_staged_prd_generator.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/services/prd_generator.py backend/tests/test_staged_prd_generator.py
git commit -m "feat: implement staged parallel PRD generation

- Add generate_stream_staged() for 3-stage generation
- Stage 1: Sequential with streaming (foundation sections)
- Stage 2: Parallel with completion events (bulk sections)
- Stage 3: Sequential with streaming (executive summary)
- Handle section failures gracefully with PARTIAL status"
```

---

## Task 5: Add Staged Generation API Endpoint

**Files:**
- Modify: `backend/app/routers/prds.py`
- Test: `backend/tests/test_prd_api.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_prd_api.py`:

```python
def test_stream_prd_staged_endpoint_exists(client, test_db: Session) -> None:
    """Test that the staged streaming endpoint exists."""
    project = _create_test_project(test_db)
    _create_test_requirement(test_db, str(project.id))

    # The endpoint should exist and return SSE
    response = client.get(
        f"/api/projects/{project.id}/prds/stream/v2?mode=draft",
        headers={"Accept": "text/event-stream"},
    )

    # Should not be 404
    assert response.status_code != 404
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_prd_api.py::test_stream_prd_staged_endpoint_exists -v`
Expected: FAIL with 404

**Step 3: Add the endpoint**

Add to `backend/app/routers/prds.py`:

```python
@router.get("/projects/{project_id}/prds/stream/v2")
async def stream_prd_generation_staged(
    project_id: str,
    request: Request,
    mode: PRDMode = Query(default=PRDMode.DRAFT, description="Generation mode (draft or detailed)"),
    db: Session = Depends(get_db),
) -> EventSourceResponse:
    """Stream PRD generation using staged parallel approach (v2).

    This endpoint uses a 3-stage approach for faster generation:
    - Stage 1: Foundation sections (sequential, streamed)
    - Stage 2: Bulk sections (parallel, complete on done)
    - Stage 3: Executive Summary (sequential, streamed)

    Emits events:
    - {event: 'stage', data: {stage: N, sections: [...]}} at each stage start
    - {event: 'chunk', data: {section_id, content}} during streaming
    - {event: 'section_complete', data: {section}} when a section finishes
    - {event: 'section_failed', data: {section_id, error}} on section failure
    - {event: 'complete', data: {prd_id, version, section_count, failed_sections}} when done
    - {event: 'error', data: {message}} on fatal error
    """
    project = _get_project_or_404(project_id, db)

    async def event_generator() -> AsyncIterator[dict[str, Any]]:
        try:
            yield {
                "event": "status",
                "data": json.dumps({
                    "status": "generating",
                    "mode": mode.value,
                    "project_name": project.name,
                    "staged": True,
                }),
            }

            generator = PRDGenerator(db)
            async for event in generator.generate_stream_staged(
                project_id=project_id,
                mode=mode,
                created_by=None,
            ):
                if await request.is_disconnected():
                    break

                event_type = event.get("type", "unknown")

                if event_type == "stage":
                    yield {
                        "event": "stage",
                        "data": json.dumps({
                            "stage": event["stage"],
                            "sections": event["sections"],
                        }),
                    }
                elif event_type == "chunk":
                    yield {
                        "event": "chunk",
                        "data": json.dumps({
                            "section_id": event["section_id"],
                            "content": event["content"],
                        }),
                    }
                elif event_type == "section_complete":
                    section = event["section"]
                    yield {
                        "event": "section_complete",
                        "data": json.dumps({
                            "id": section["id"],
                            "title": section["title"],
                            "content": section["content"],
                            "order": section["order"],
                            "status": section.get("status", "completed"),
                        }),
                    }
                elif event_type == "section_failed":
                    yield {
                        "event": "section_failed",
                        "data": json.dumps({
                            "section_id": event["section_id"],
                            "error": event["error"],
                        }),
                    }
                elif event_type == "complete":
                    yield {
                        "event": "complete",
                        "data": json.dumps({
                            "prd_id": event["prd_id"],
                            "version": event["version"],
                            "section_count": event["section_count"],
                            "failed_sections": event.get("failed_sections", []),
                        }),
                    }

        except NoRequirementsError as e:
            yield {
                "event": "error",
                "data": json.dumps({"message": str(e)}),
            }
        except LLMResponseError as e:
            yield {
                "event": "error",
                "data": json.dumps({"message": f"Failed to parse LLM response: {e}"}),
            }
        except LLMError as e:
            yield {
                "event": "error",
                "data": json.dumps({"message": f"LLM error: {e}"}),
            }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"message": f"Generation failed: {e}"}),
            }

    return EventSourceResponse(event_generator())
```

**Step 4: Run tests**

Run: `cd backend && python -m pytest tests/test_prd_api.py -v -k staged`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/routers/prds.py backend/tests/test_prd_api.py
git commit -m "feat: add staged PRD generation endpoint

- Add /prds/stream/v2 endpoint for staged generation
- Emit stage, chunk, section_complete, section_failed events
- Handle errors gracefully with error events"
```

---

## Task 6: Add Section Regeneration Endpoint

**Files:**
- Modify: `backend/app/routers/prds.py`
- Create: `backend/app/schemas/section.py`
- Test: `backend/tests/test_section_regenerate.py`

**Step 1: Write the failing test**

Create `backend/tests/test_section_regenerate.py`:

```python
"""Tests for section regeneration endpoint."""

import json
from unittest.mock import patch, AsyncMock
import pytest
from sqlalchemy.orm import Session

from app.models import PRD, Project, Requirement, PRDMode, PRDStatus
from app.models.meeting_item import Section


def _create_test_project(db: Session) -> Project:
    project = Project(name="Test", description="Test")
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _create_test_requirement(db: Session, project_id: str) -> Requirement:
    req = Requirement(
        project_id=project_id,
        section=Section.problems,
        content="A problem",
        order=0,
        is_active=True,
    )
    db.add(req)
    db.commit()
    return req


def _create_test_prd(db: Session, project_id: str) -> PRD:
    prd = PRD(
        project_id=project_id,
        version=1,
        title="Test PRD",
        mode=PRDMode.DETAILED,
        status=PRDStatus.READY,
        sections=[
            {"id": "problem_statement", "title": "Problem", "content": "Old content", "order": 1, "status": "completed"},
            {"id": "goals_objectives", "title": "Goals", "content": "Goals content", "order": 2, "status": "completed"},
        ],
    )
    db.add(prd)
    db.commit()
    db.refresh(prd)
    return prd


class TestSectionRegeneration:

    def test_regenerate_section_endpoint_exists(self, client, test_db: Session) -> None:
        """Test that the regenerate endpoint exists."""
        project = _create_test_project(test_db)
        _create_test_requirement(test_db, str(project.id))
        prd = _create_test_prd(test_db, str(project.id))

        response = client.post(
            f"/api/prds/{prd.id}/sections/problem_statement/regenerate",
        )

        assert response.status_code != 404

    def test_regenerate_section_returns_affected_sections(self, client, test_db: Session) -> None:
        """Test that regeneration returns list of affected downstream sections."""
        project = _create_test_project(test_db)
        _create_test_requirement(test_db, str(project.id))
        prd = _create_test_prd(test_db, str(project.id))

        with patch("app.services.section_generator.SectionGenerator.generate_section") as mock_gen:
            mock_gen.return_value = {
                "id": "problem_statement",
                "title": "Problem Statement",
                "content": "New content",
                "order": 1,
                "status": "completed",
            }

            response = client.post(
                f"/api/prds/{prd.id}/sections/problem_statement/regenerate",
            )

        assert response.status_code == 200
        data = response.json()
        assert "section" in data
        assert "affected_sections" in data
        # Problem statement affects goals, which affects many others
        assert len(data["affected_sections"]) > 0
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_section_regenerate.py -v`
Expected: FAIL with 404

**Step 3: Add the endpoint**

Add to `backend/app/routers/prds.py`:

```python
# Section dependency map for determining affected sections
SECTION_DEPENDENCIES = {
    # Stage 1 sections affect Stage 2 and 3
    "problem_statement": [
        "goals_objectives", "target_users", "proposed_solution",
        "functional_requirements", "non_functional_requirements",
        "technical_considerations", "success_metrics", "timeline_milestones",
        "risks_mitigations", "appendix", "executive_summary",
        "open_questions", "identified_gaps", "next_steps",
    ],
    "goals_objectives": [
        "target_users", "proposed_solution",
        "functional_requirements", "non_functional_requirements",
        "technical_considerations", "success_metrics", "timeline_milestones",
        "risks_mitigations", "appendix", "executive_summary",
        "open_questions", "identified_gaps", "next_steps",
    ],
    "target_users": [
        "proposed_solution",
        "functional_requirements", "non_functional_requirements",
        "technical_considerations", "success_metrics", "timeline_milestones",
        "risks_mitigations", "appendix", "executive_summary",
    ],
    "proposed_solution": [
        "functional_requirements", "non_functional_requirements",
        "technical_considerations", "success_metrics", "timeline_milestones",
        "risks_mitigations", "appendix", "executive_summary",
        "open_questions", "identified_gaps", "next_steps",
    ],
    # Stage 2 sections only affect executive summary
    "functional_requirements": ["executive_summary"],
    "non_functional_requirements": ["executive_summary"],
    "technical_considerations": ["executive_summary"],
    "success_metrics": ["executive_summary"],
    "timeline_milestones": ["executive_summary"],
    "risks_mitigations": ["executive_summary"],
    "appendix": ["executive_summary"],
    "open_questions": ["executive_summary"],
    "identified_gaps": ["executive_summary"],
    "next_steps": ["executive_summary"],
    # Executive summary affects nothing
    "executive_summary": [],
}


@router.post("/prds/{prd_id}/sections/{section_id}/regenerate")
async def regenerate_section(
    prd_id: str,
    section_id: str,
    request: Request,
    custom_instructions: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Regenerate a single section of a PRD.

    Returns the regenerated section and a list of sections that may be
    affected (used this section as context).

    Args:
        prd_id: The PRD ID.
        section_id: The section to regenerate.
        custom_instructions: Optional additional instructions for regeneration.
        db: Database session.

    Returns:
        {
            "section": {...},
            "affected_sections": ["section_id_1", ...],
            "warning": "N sections used this as context and may be outdated"
        }
    """
    prd = _get_prd_or_404(prd_id, db)

    if prd.status not in (PRDStatus.READY, PRDStatus.PARTIAL):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot regenerate section for PRD with status '{prd.status.value}'",
        )

    # Find the section to regenerate
    sections = prd.sections or []
    section_index = next(
        (i for i, s in enumerate(sections) if s.get("id") == section_id),
        None,
    )

    if section_index is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section '{section_id}' not found in PRD",
        )

    # Load requirements
    from app.services.prd_generator import PRDGenerator
    from app.services.section_generator import SectionGenerator, SECTION_CONFIG

    generator = PRDGenerator(db)
    requirements_by_section = generator._load_requirements(str(prd.project_id))

    # Gather prior sections (sections that come before this one in the dependency chain)
    prior_section_ids = _get_prior_sections(section_id)
    prior_sections = [s for s in sections if s.get("id") in prior_section_ids]

    # Generate the section
    section_generator = SectionGenerator(db)
    order = sections[section_index].get("order", SECTION_CONFIG.get(section_id, {}).get("order", 0))

    # For executive summary, pass all other sections
    all_sections = None
    if section_id == "executive_summary":
        all_sections = [s for s in sections if s.get("id") != "executive_summary"]

    new_section = await section_generator.generate_section(
        section_id=section_id,
        requirements_by_section=requirements_by_section,
        prior_sections=prior_sections,
        order=order,
    )

    # Update the section in the PRD
    sections[section_index] = new_section
    prd.sections = sections
    prd.raw_markdown = _generate_markdown(prd.title or "", sections)
    prd.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(prd)

    # Determine affected sections
    affected = SECTION_DEPENDENCIES.get(section_id, [])
    # Filter to only sections that exist in this PRD
    existing_section_ids = {s.get("id") for s in sections}
    affected = [s for s in affected if s in existing_section_ids]

    warning = None
    if affected:
        warning = f"{len(affected)} sections used this as context and may be outdated"

    return {
        "section": new_section,
        "affected_sections": affected,
        "warning": warning,
    }


def _get_prior_sections(section_id: str) -> list[str]:
    """Get sections that should be provided as context for a given section."""
    # Stage 1 sections in order
    stage_1 = ["problem_statement", "goals_objectives", "target_users", "proposed_solution"]

    if section_id in stage_1:
        # Return all stage 1 sections before this one
        idx = stage_1.index(section_id)
        return stage_1[:idx]
    elif section_id == "executive_summary":
        # Executive summary gets all sections as context (handled separately)
        return []
    else:
        # Stage 2 sections get all of stage 1
        return stage_1
```

**Step 4: Run tests**

Run: `cd backend && python -m pytest tests/test_section_regenerate.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/routers/prds.py backend/tests/test_section_regenerate.py
git commit -m "feat: add section regeneration endpoint

- POST /prds/{prd_id}/sections/{section_id}/regenerate
- Returns regenerated section and affected downstream sections
- Warns user about sections that may be outdated"
```

---

## Task 7: Update Frontend Streaming Hook

**Files:**
- Modify: `ui/src/hooks/usePRDStreaming.js`
- Create: `ui/src/hooks/usePRDStreamingV2.js`
- Test: `ui/tests/hooks/usePRDStreamingV2.test.js`

**Step 1: Create the new hook**

Create `ui/src/hooks/usePRDStreamingV2.js`:

```javascript
/**
 * React hook for consuming SSE streams from the staged PRD generation endpoint (v2).
 * Handles staged generation with parallel sections and individual section streaming.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');
const CONNECTION_TIMEOUT_MS = 300000; // 5 minutes

/**
 * Custom hook for staged PRD generation via SSE
 * @param {string} projectId - The project ID to generate PRD for
 * @param {string} mode - The PRD mode ('draft' or 'detailed')
 * @param {boolean} shouldConnect - Whether to start the connection
 * @returns {Object} State and controls for staged generation
 */
export function usePRDStreamingV2(projectId, mode, shouldConnect = false) {
  // Section state - keyed by section_id
  const [sections, setSections] = useState({});
  const [currentStage, setCurrentStage] = useState(null);
  const [streamingSection, setStreamingSection] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [prdId, setPrdId] = useState(null);
  const [version, setVersion] = useState(null);
  const [failedSections, setFailedSections] = useState([]);

  const eventSourceRef = useRef(null);
  const timeoutRef = useRef(null);

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setError('Connection timed out. No events received for 5 minutes.');
        setStatus('error');
      }
    }, CONNECTION_TIMEOUT_MS);
  }, []);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setSections({});
    setCurrentStage(null);
    setStreamingSection(null);
    setError(null);
    setPrdId(null);
    setVersion(null);
    setFailedSections([]);
  }, []);

  const connect = useCallback(() => {
    if (!projectId || !mode) return;

    resetState();
    setStatus('connecting');
    cleanup();

    const url = `${BASE_URL}/api/projects/${projectId}/prds/stream/v2?mode=${mode}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    resetTimeout();

    // Handle status event
    eventSource.addEventListener('status', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setStatus(data.status || 'generating');
      } catch {
        setStatus('generating');
      }
    });

    // Handle stage event
    eventSource.addEventListener('stage', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setCurrentStage(data.stage);
        // Initialize pending sections
        data.sections.forEach((sectionId) => {
          setSections((prev) => ({
            ...prev,
            [sectionId]: { status: 'pending', content: '' },
          }));
        });
      } catch (e) {
        console.error('Failed to parse stage event:', e);
      }
    });

    // Handle chunk event (streaming content)
    eventSource.addEventListener('chunk', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setStreamingSection(data.section_id);
        setSections((prev) => ({
          ...prev,
          [data.section_id]: {
            ...prev[data.section_id],
            status: 'generating',
            content: (prev[data.section_id]?.content || '') + data.content,
          },
        }));
      } catch (e) {
        console.error('Failed to parse chunk event:', e);
      }
    });

    // Handle section_complete event
    eventSource.addEventListener('section_complete', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setStreamingSection(null);
        setSections((prev) => ({
          ...prev,
          [data.id]: {
            id: data.id,
            title: data.title,
            content: data.content,
            order: data.order,
            status: 'completed',
          },
        }));
      } catch (e) {
        console.error('Failed to parse section_complete event:', e);
      }
    });

    // Handle section_failed event
    eventSource.addEventListener('section_failed', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setStreamingSection(null);
        setSections((prev) => ({
          ...prev,
          [data.section_id]: {
            ...prev[data.section_id],
            status: 'failed',
            error: data.error,
          },
        }));
        setFailedSections((prev) => [...prev, data.section_id]);
      } catch (e) {
        console.error('Failed to parse section_failed event:', e);
      }
    });

    // Handle complete event
    eventSource.addEventListener('complete', (event) => {
      resetTimeout();
      try {
        const data = JSON.parse(event.data);
        setPrdId(data.prd_id);
        setVersion(data.version);
        setStatus('complete');
        setCurrentStage(null);
        setStreamingSection(null);
      } catch {
        setStatus('complete');
      }
      cleanup();
    });

    // Handle error event from server
    eventSource.addEventListener('error', (event) => {
      resetTimeout();
      if (event.data) {
        try {
          const data = JSON.parse(event.data);
          setError(data.message || 'An error occurred during PRD generation.');
        } catch {
          setError(event.data);
        }
        setStatus('error');
        cleanup();
      }
    });

    // Handle EventSource connection error
    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setError('Connection to server lost. Please try again.');
        setStatus('error');
        cleanup();
      }
    };

    eventSource.onopen = () => {
      resetTimeout();
      setStatus('connected');
    };
  }, [projectId, mode, cleanup, resetTimeout, resetState]);

  const retry = useCallback(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (shouldConnect && projectId && mode) {
      connect();
    }
    return cleanup;
  }, [shouldConnect, projectId, mode, connect, cleanup]);

  // Convert sections object to sorted array for display
  const sectionsArray = Object.values(sections).sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  );

  return {
    sections,
    sectionsArray,
    currentStage,
    streamingSection,
    status,
    error,
    prdId,
    version,
    failedSections,
    retry,
  };
}

export default usePRDStreamingV2;
```

**Step 2: Commit**

```bash
git add ui/src/hooks/usePRDStreamingV2.js
git commit -m "feat: add usePRDStreamingV2 hook for staged generation

- Handle stage, chunk, section_complete, section_failed events
- Track sections by ID with status (pending, generating, completed, failed)
- Track current stage and streaming section for UI state"
```

---

## Task 8: Create PRD Generation UI Components

**Files:**
- Create: `ui/src/components/prd/StagedPRDGenerator.jsx`
- Create: `ui/src/components/prd/StagedPRDGenerator.css`
- Create: `ui/src/components/prd/SectionCard.jsx`
- Create: `ui/src/components/prd/SectionCard.css`

**Step 1: Create SectionCard component**

Create `ui/src/components/prd/SectionCard.jsx`:

```jsx
import React from 'react';
import './SectionCard.css';

/**
 * Displays a single PRD section with status indicators.
 */
export function SectionCard({ section, isStreaming, onRegenerate }) {
  const { id, title, content, status, error } = section;

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <span className="status-icon pending">○</span>;
      case 'generating':
        return <span className="status-icon generating">◐</span>;
      case 'completed':
        return <span className="status-icon completed">✓</span>;
      case 'failed':
        return <span className="status-icon failed">✕</span>;
      default:
        return null;
    }
  };

  return (
    <div className={`section-card ${status} ${isStreaming ? 'streaming' : ''}`}>
      <div className="section-header">
        {getStatusIcon()}
        <h3 className="section-title">{title || id}</h3>
        {status === 'completed' && onRegenerate && (
          <button
            className="regenerate-btn"
            onClick={() => onRegenerate(id)}
            title="Regenerate this section"
          >
            ↻
          </button>
        )}
      </div>

      <div className="section-content">
        {status === 'pending' && (
          <div className="pending-placeholder">
            <span className="spinner"></span>
            <span>Waiting to generate...</span>
          </div>
        )}

        {status === 'generating' && (
          <div className="generating-content">
            <pre className="content-text">{content}</pre>
            <span className="cursor">▌</span>
          </div>
        )}

        {status === 'completed' && (
          <div className="completed-content">
            <pre className="content-text">{content}</pre>
          </div>
        )}

        {status === 'failed' && (
          <div className="failed-content">
            <p className="error-message">Failed to generate: {error}</p>
            {onRegenerate && (
              <button
                className="retry-btn"
                onClick={() => onRegenerate(id)}
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SectionCard;
```

Create `ui/src/components/prd/SectionCard.css`:

```css
.section-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
  transition: border-color 0.3s ease;
}

.section-card.generating {
  border-color: #2196f3;
}

.section-card.streaming {
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.3);
}

.section-card.completed {
  border-color: #4caf50;
}

.section-card.failed {
  border-color: #f44336;
}

.section-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.status-icon {
  margin-right: 8px;
  font-size: 14px;
}

.status-icon.pending {
  color: #9e9e9e;
}

.status-icon.generating {
  color: #2196f3;
  animation: spin 1s linear infinite;
}

.status-icon.completed {
  color: #4caf50;
}

.status-icon.failed {
  color: #f44336;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.section-title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.regenerate-btn {
  background: none;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 14px;
}

.regenerate-btn:hover {
  background: #e0e0e0;
}

.section-content {
  padding: 16px;
  min-height: 100px;
}

.pending-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9e9e9e;
  gap: 8px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e0e0e0;
  border-top-color: #2196f3;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.generating-content {
  position: relative;
}

.content-text {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
}

.cursor {
  animation: blink 0.7s infinite;
  color: #2196f3;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.failed-content {
  text-align: center;
}

.error-message {
  color: #f44336;
  margin-bottom: 12px;
}

.retry-btn {
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
}

.retry-btn:hover {
  background: #d32f2f;
}
```

**Step 2: Create StagedPRDGenerator component**

Create `ui/src/components/prd/StagedPRDGenerator.jsx`:

```jsx
import React from 'react';
import { usePRDStreamingV2 } from '../../hooks/usePRDStreamingV2';
import { SectionCard } from './SectionCard';
import './StagedPRDGenerator.css';

/**
 * Main component for staged PRD generation with real-time updates.
 */
export function StagedPRDGenerator({ projectId, mode, onComplete }) {
  const {
    sectionsArray,
    currentStage,
    streamingSection,
    status,
    error,
    prdId,
    version,
    failedSections,
    retry,
  } = usePRDStreamingV2(projectId, mode, true);

  const handleRegenerate = async (sectionId) => {
    // TODO: Implement section regeneration
    console.log('Regenerate section:', sectionId);
  };

  const getStageLabel = () => {
    switch (currentStage) {
      case 1:
        return 'Stage 1: Building foundation...';
      case 2:
        return 'Stage 2: Generating details in parallel...';
      case 3:
        return 'Stage 3: Creating executive summary...';
      default:
        return '';
    }
  };

  if (status === 'error') {
    return (
      <div className="staged-prd-generator error-state">
        <div className="error-container">
          <h3>Generation Failed</h3>
          <p>{error}</p>
          <button onClick={retry} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (status === 'complete') {
    return (
      <div className="staged-prd-generator complete-state">
        <div className="completion-header">
          <h2>PRD Generated Successfully</h2>
          <p>Version {version} • {sectionsArray.length} sections</p>
          {failedSections.length > 0 && (
            <p className="warning">
              {failedSections.length} section(s) failed to generate
            </p>
          )}
        </div>

        <div className="sections-list">
          {sectionsArray.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              isStreaming={false}
              onRegenerate={handleRegenerate}
            />
          ))}
        </div>

        {onComplete && (
          <button
            onClick={() => onComplete(prdId)}
            className="view-prd-button"
          >
            View Full PRD
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="staged-prd-generator generating-state">
      <div className="progress-header">
        <h2>Generating PRD</h2>
        {currentStage && <p className="stage-label">{getStageLabel()}</p>}
      </div>

      <div className="sections-list">
        {sectionsArray.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            isStreaming={streamingSection === section.id}
          />
        ))}
      </div>
    </div>
  );
}

export default StagedPRDGenerator;
```

Create `ui/src/components/prd/StagedPRDGenerator.css`:

```css
.staged-prd-generator {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}

.progress-header,
.completion-header {
  text-align: center;
  margin-bottom: 32px;
}

.progress-header h2,
.completion-header h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
}

.stage-label {
  color: #2196f3;
  font-weight: 500;
}

.warning {
  color: #ff9800;
  font-weight: 500;
}

.sections-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error-state {
  text-align: center;
  padding: 48px;
}

.error-container {
  background: #ffebee;
  padding: 32px;
  border-radius: 8px;
}

.error-container h3 {
  color: #f44336;
  margin: 0 0 16px 0;
}

.retry-button,
.view-prd-button {
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px 24px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 24px;
}

.retry-button:hover,
.view-prd-button:hover {
  background: #1976d2;
}

.retry-button {
  background: #f44336;
}

.retry-button:hover {
  background: #d32f2f;
}
```

**Step 3: Commit**

```bash
git add ui/src/components/prd/
git commit -m "feat: add staged PRD generation UI components

- SectionCard: displays individual section with status
- StagedPRDGenerator: orchestrates staged generation display
- Real-time streaming with cursor animation
- Support for section regeneration (UI only)"
```

---

## Task 9: Integration Testing

**Files:**
- Create: `backend/tests/test_staged_integration.py`

**Step 1: Create integration tests**

Create `backend/tests/test_staged_integration.py`:

```python
"""Integration tests for staged PRD generation."""

import json
from unittest.mock import patch, AsyncMock
import pytest
from sqlalchemy.orm import Session

from app.models import Project, Requirement, PRDMode, PRDStatus
from app.models.meeting_item import Section
from app.services.prd_generator import PRDGenerator


def _create_project_with_requirements(db: Session) -> Project:
    """Create a project with multiple requirements."""
    project = Project(name="Integration Test Project", description="For testing")
    db.add(project)
    db.commit()
    db.refresh(project)

    # Add various requirements
    requirements = [
        (Section.problems, "Users cannot track their tasks efficiently"),
        (Section.problems, "Current solutions are too complex"),
        (Section.user_goals, "Simple task management"),
        (Section.user_goals, "Quick task entry"),
        (Section.functional_requirements, "Create tasks with title and description"),
        (Section.functional_requirements, "Mark tasks as complete"),
        (Section.constraints, "Must work offline"),
        (Section.constraints, "Must be accessible"),
    ]

    for section, content in requirements:
        req = Requirement(
            project_id=str(project.id),
            section=section,
            content=content,
            order=0,
            is_active=True,
        )
        db.add(req)

    db.commit()
    return project


class TestStagedGenerationIntegration:
    """Integration tests for the complete staged generation flow."""

    @pytest.mark.asyncio
    async def test_full_detailed_mode_generation(self, test_db: Session) -> None:
        """Test complete DETAILED mode generation flow."""
        project = _create_project_with_requirements(test_db)

        # Mock LLM responses for each section
        def mock_generate(prompt, **kwargs):
            # Extract section type from prompt
            if "Problem Statement" in prompt:
                return json.dumps({"title": "Problem Statement", "content": "Users struggle with task management."})
            elif "Goals" in prompt:
                return json.dumps({"title": "Goals and Objectives", "content": "Enable efficient task tracking."})
            elif "Target Users" in prompt:
                return json.dumps({"title": "Target Users", "content": "Busy professionals."})
            elif "Proposed Solution" in prompt:
                return json.dumps({"title": "Proposed Solution", "content": "A simple task app."})
            elif "Functional Requirements" in prompt:
                return json.dumps({"title": "Functional Requirements", "content": "FR-001: Create tasks."})
            elif "Non-Functional" in prompt:
                return json.dumps({"title": "Non-Functional Requirements", "content": "NFR-001: Fast load times."})
            elif "Technical" in prompt:
                return json.dumps({"title": "Technical Considerations", "content": "Use React and FastAPI."})
            elif "Success Metrics" in prompt:
                return json.dumps({"title": "Success Metrics", "content": "User adoption rate."})
            elif "Timeline" in prompt:
                return json.dumps({"title": "Timeline and Milestones", "content": "Phase 1: MVP."})
            elif "Risks" in prompt:
                return json.dumps({"title": "Risks and Mitigations", "content": "Risk: Low adoption."})
            elif "Appendix" in prompt:
                return json.dumps({"title": "Appendix", "content": "Glossary: Task = unit of work."})
            elif "Executive Summary" in prompt:
                return json.dumps({"title": "Executive Summary", "content": "This PRD outlines a task management app."})
            else:
                return json.dumps({"title": "Unknown", "content": "Content"})

        mock_provider = AsyncMock()
        mock_provider.generate = mock_generate
        mock_provider.stream = AsyncMock(return_value=async_iter([
            json.dumps({"title": "Section", "content": "Content"})
        ]))

        with patch("app.services.section_generator.get_provider", return_value=mock_provider):
            generator = PRDGenerator(test_db)

            events = []
            async for event in generator.generate_stream_staged(
                project_id=str(project.id),
                mode=PRDMode.DETAILED,
            ):
                events.append(event)

        # Verify all stages were emitted
        stage_events = [e for e in events if e.get("type") == "stage"]
        assert len(stage_events) == 3

        # Verify complete event
        complete_event = events[-1]
        assert complete_event["type"] == "complete"
        assert complete_event["section_count"] == 12  # DETAILED mode has 12 sections

    @pytest.mark.asyncio
    async def test_full_draft_mode_generation(self, test_db: Session) -> None:
        """Test complete DRAFT mode generation flow."""
        project = _create_project_with_requirements(test_db)

        def mock_generate(prompt, **kwargs):
            if "Problem Statement" in prompt:
                return json.dumps({"title": "Problem Statement", "content": "The problem is..."})
            elif "Goals" in prompt:
                return json.dumps({"title": "Goals and Objectives", "content": "Our goals are..."})
            elif "Proposed Solution" in prompt:
                return json.dumps({"title": "Proposed Solution", "content": "We propose..."})
            elif "Open Questions" in prompt:
                return json.dumps({"title": "Open Questions", "content": "- What is the timeline?"})
            elif "Identified Gaps" in prompt:
                return json.dumps({"title": "Identified Gaps", "content": "- Need user research"})
            elif "Next Steps" in prompt:
                return json.dumps({"title": "Next Steps", "content": "- Schedule interviews"})
            elif "Executive Summary" in prompt:
                return json.dumps({"title": "Executive Summary", "content": "Draft summary..."})
            else:
                return json.dumps({"title": "Section", "content": "Content"})

        mock_provider = AsyncMock()
        mock_provider.generate = mock_generate
        mock_provider.stream = AsyncMock(return_value=async_iter([
            json.dumps({"title": "Section", "content": "Content"})
        ]))

        with patch("app.services.section_generator.get_provider", return_value=mock_provider):
            generator = PRDGenerator(test_db)

            events = []
            async for event in generator.generate_stream_staged(
                project_id=str(project.id),
                mode=PRDMode.DRAFT,
            ):
                events.append(event)

        complete_event = events[-1]
        assert complete_event["type"] == "complete"
        assert complete_event["section_count"] == 7  # DRAFT mode has 7 sections

    @pytest.mark.asyncio
    async def test_partial_failure_handling(self, test_db: Session) -> None:
        """Test that partial failures result in PARTIAL status."""
        project = _create_project_with_requirements(test_db)

        call_count = 0

        def mock_generate(prompt, **kwargs):
            nonlocal call_count
            call_count += 1
            # Fail on the 5th call (a Stage 2 section)
            if call_count == 5:
                raise Exception("LLM timeout")
            return json.dumps({"title": "Section", "content": "Content"})

        mock_provider = AsyncMock()
        mock_provider.generate = mock_generate
        mock_provider.stream = AsyncMock(return_value=async_iter([
            json.dumps({"title": "Section", "content": "Content"})
        ]))

        with patch("app.services.section_generator.get_provider", return_value=mock_provider):
            generator = PRDGenerator(test_db)

            events = []
            async for event in generator.generate_stream_staged(
                project_id=str(project.id),
                mode=PRDMode.DETAILED,
            ):
                events.append(event)

        # Should have a section_failed event
        failed_events = [e for e in events if e.get("type") == "section_failed"]
        assert len(failed_events) > 0

        # Should still complete
        complete_event = events[-1]
        assert complete_event["type"] == "complete"
        assert len(complete_event["failed_sections"]) > 0


async def async_iter(items):
    """Helper to create async iterator from list."""
    for item in items:
        yield item
```

**Step 2: Run integration tests**

Run: `cd backend && python -m pytest tests/test_staged_integration.py -v`
Expected: PASS

**Step 3: Commit**

```bash
git add backend/tests/test_staged_integration.py
git commit -m "test: add staged generation integration tests

- Test full DETAILED mode generation (12 sections)
- Test full DRAFT mode generation (7 sections)
- Test partial failure handling with PARTIAL status"
```

---

## Task 10: Documentation and Cleanup

**Files:**
- Update: `docs/plans/2026-01-26-section-by-section-prd-generation-design.md`

**Step 1: Update design doc with implementation notes**

Add implementation notes section to the design document.

**Step 2: Final commit**

```bash
git add docs/plans/
git commit -m "docs: update design doc with implementation notes

- Mark all tasks as implemented
- Add notes on actual implementation details
- Reference test files for each feature"
```

---

## Summary

This plan implements section-by-section PRD generation in 10 tasks:

1. **Data Model** - Add section status tracking fields
2. **Prompts** - Create 16 section-specific prompt templates
3. **Section Generator** - Service for individual section generation
4. **Staged Generator** - 3-stage parallel generation in PRDGenerator
5. **API Endpoint** - `/prds/stream/v2` for staged streaming
6. **Regeneration** - `/prds/{id}/sections/{id}/regenerate` endpoint
7. **Frontend Hook** - `usePRDStreamingV2` for staged events
8. **UI Components** - `StagedPRDGenerator` and `SectionCard`
9. **Integration Tests** - Full flow testing
10. **Documentation** - Update design doc

Each task follows TDD with explicit test → implement → commit cycles.
