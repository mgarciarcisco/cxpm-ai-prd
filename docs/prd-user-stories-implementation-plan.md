# Implementation Plan: PRD Generation & User Stories (v1)

## Overview

Add two new capabilities to CXPM AI:
1. **PRD Generation** - Transform requirements into structured PRD documents
2. **User Stories Generation** - Convert requirements into actionable development stories

Both features share similar patterns and will be built together.

---

## Key Design Decisions

| Decision | Choice |
|----------|--------|
| PRD modes | Draft (gaps focus) + Detailed (polished) |
| Story formats | Classic ("As a...") + Job Story ("When...") |
| Templates | Built-in only (Draft, Detailed) - no custom upload for v1 |
| Persistence | Store & version in database |
| Edit workflow | Save first, then edit (matches existing flow) |
| Traceability | Optional linking from stories to requirements |
| Entry point | Feature landing pages with project selection |
| Regeneration | Creates new version (PRD) / new batch (stories) |
| Deletion | Soft delete with `deleted_at` timestamp |
| Auth model | Single-tenant, no explicit access checks (matches existing codebase) |
| Rate limiting | UI cooldown (30s button disable after generation) |
| Export formats | Markdown, JSON, CSV only for v1 (schemas defined below) |
| Async generation | FastAPI BackgroundTasks with status polling |
| PRD history UI | Version dropdown on editor page (no separate list page for v1) |
| Cancellation | Best-effort (see notes below) |

---

## Async Generation Architecture

Generation is a long-running operation (30-120 seconds). We use FastAPI BackgroundTasks with status polling.

### v1 Limitations (Accepted Trade-offs)

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Jobs lost on server restart | User sees "generating" forever | User can cancel and retry |
| No automatic retries | Failed jobs stay failed | User manually retries |
| No job queue visibility | Can't see pending jobs | Status endpoint shows current state |

**Future enhancement:** Migrate to Celery/RQ for durable job queue (see future-features.md).

### Cancellation Behavior (Best-Effort)

Cancellation is **best-effort**, not guaranteed:
- If status is `queued`: Cancellation succeeds, worker skips the job
- If status is `generating`: Status set to `cancelled`, but LLM call continues to completion
  - Worker checks status after LLM returns; if cancelled, discards result
  - LLM tokens are still consumed (cost implication)
- If status is `ready`/`failed`: Cancellation has no effect

**Why not true cancellation?** Aborting mid-LLM-call requires async cancellation tokens and streaming interruption - complexity deferred to v2.

### Status State Machine

```
┌──────────┐     ┌────────────┐     ┌─────────┐
│  queued  │ ──► │ generating │ ──► │  ready  │
└──────────┘     └────────────┘     └─────────┘
                       │
                       ▼
                 ┌──────────┐
                 │  failed  │
                 └──────────┘
                       │
                       ▼
                 ┌───────────┐
                 │ cancelled │
                 └───────────┘
```

### Generation Flow

1. **POST /generate** - Creates record with `status=queued`, returns `{id, status}` immediately
2. **Background worker** picks up queued job, sets `status=generating`
3. **Worker completes** - sets `status=ready` with content, or `status=failed` with error
4. **Frontend polls** `GET /prds/{id}` every 2 seconds until status != `generating`
5. **Cancel** - `POST /prds/{id}/cancel` sets `status=cancelled` if still generating

### Backend Implementation

```python
# Using FastAPI BackgroundTasks (v1) - migrate to Celery in v2 if needed
@router.post("/projects/{project_id}/prds/generate")
async def generate_prd(
    project_id: UUID,
    request: PRDGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> PRDStatusResponse:
    """Create PRD record and queue generation.

    IMPORTANT: Version increment and record creation happen in a single
    locked transaction to prevent race conditions with concurrent requests.
    """
    # Single transaction with row lock for version increment
    with db.begin():
        # Get next version with lock to prevent concurrent duplicates
        result = db.execute(
            select(func.coalesce(func.max(PRD.version), 0) + 1)
            .where(PRD.project_id == project_id)
            .where(PRD.deleted_at.is_(None))
            .with_for_update()
        )
        next_version = result.scalar()

        # Create PRD with status=queued
        prd = PRD(
            project_id=project_id,
            mode=request.mode,
            status=PRDStatus.QUEUED,
            version=next_version,
        )
        db.add(prd)
        # Transaction commits here, releasing lock

    # Queue background task (after transaction commits)
    background_tasks.add_task(generate_prd_task, prd.id)

    return PRDStatusResponse(id=prd.id, status=prd.status)

async def generate_prd_task(prd_id: UUID):
    """Background task that performs actual generation."""
    async with get_db_session() as db:
        prd = db.get(PRD, prd_id)
        if prd.status == PRDStatus.CANCELLED:
            return  # User cancelled before we started

        prd.status = PRDStatus.GENERATING
        db.commit()

        try:
            # Actual LLM generation
            result = await prd_generator.generate(prd)
            prd.sections = result.sections
            prd.raw_markdown = result.markdown
            prd.title = result.title
            prd.status = PRDStatus.READY
        except Exception as e:
            prd.status = PRDStatus.FAILED
            prd.error_message = str(e)

        db.commit()
```

### Status Polling Endpoint

```python
@router.get("/prds/{prd_id}/status")
async def get_prd_status(prd_id: UUID, db: Session = Depends(get_db)) -> PRDStatusResponse:
    """Lightweight endpoint for polling generation status."""
    prd = db.get(PRD, prd_id)
    return PRDStatusResponse(
        id=prd.id,
        status=prd.status,
        error_message=prd.error_message if prd.status == PRDStatus.FAILED else None
    )
```

### Cancel Endpoint

```python
@router.post("/prds/{prd_id}/cancel")
async def cancel_prd_generation(prd_id: UUID, db: Session = Depends(get_db)) -> PRDStatusResponse:
    """Cancel a queued or generating PRD."""
    prd = db.get(PRD, prd_id)
    if prd.status in (PRDStatus.QUEUED, PRDStatus.GENERATING):
        prd.status = PRDStatus.CANCELLED
        db.commit()
    return PRDStatusResponse(id=prd.id, status=prd.status)
```

### Frontend Polling

```jsx
// PRDGeneratorPage.jsx
const pollGeneration = async (prdId) => {
  const poll = async () => {
    const { status, error_message } = await api.getPRDStatus(prdId);

    if (status === 'ready') {
      navigate(`/app/prds/${prdId}`);
    } else if (status === 'failed') {
      setError(error_message || 'Generation failed. Please try again.');
      setIsGenerating(false);
    } else if (status === 'cancelled') {
      setIsGenerating(false);
    } else {
      // Still queued or generating - poll again
      setTimeout(poll, 2000);
    }
  };
  poll();
};
```

---

## Data Models

### PRD Model (`backend/app/models/prd.py`)

```python
class PRDMode(str, Enum):
    DRAFT = "draft"        # Emphasizes gaps, questions, areas needing clarification
    DETAILED = "detailed"  # Comprehensive, polished document

class PRDStatus(str, Enum):
    QUEUED = "queued"          # Waiting to start
    GENERATING = "generating"  # LLM working
    READY = "ready"            # Complete
    FAILED = "failed"          # Generation error
    CANCELLED = "cancelled"    # User cancelled
    ARCHIVED = "archived"      # Soft archived

class PRD(Base):
    __tablename__ = "prds"

    id: UUID = Column(UUID, primary_key=True, default=uuid4)
    project_id: UUID = Column(UUID, ForeignKey("projects.id"), nullable=False)
    version: int = Column(Integer, nullable=False)  # Auto-increment per project
    title: str = Column(String(500), nullable=True)  # Nullable until generation completes
    mode: PRDMode = Column(Enum(PRDMode), nullable=False)
    sections: JSON = Column(JSON, nullable=True)  # Nullable until generation completes
    raw_markdown: str = Column(Text, nullable=True)  # Full markdown for export
    status: PRDStatus = Column(Enum(PRDStatus), default=PRDStatus.QUEUED)
    error_message: str = Column(Text, nullable=True)  # Error details if failed

    # Audit fields
    created_by: UUID = Column(UUID, ForeignKey("users.id"), nullable=True)
    updated_by: UUID = Column(UUID, ForeignKey("users.id"), nullable=True)
    created_at: datetime = Column(DateTime, default=datetime.utcnow)
    updated_at: datetime = Column(DateTime, onupdate=datetime.utcnow)
    deleted_at: datetime = Column(DateTime, nullable=True)  # Soft delete
```

### PRD Sections Schema

```python
# sections JSON structure
{
    "sections": [
        {
            "id": "executive_summary",
            "title": "Executive Summary",
            "content": "markdown content...",
            "order": 1,
            "is_collapsed": false
        },
        {
            "id": "problem_statement",
            "title": "Problem Statement",
            "content": "markdown content...",
            "order": 2,
            "is_collapsed": false
        },
        # ... more sections
    ]
}

# Default sections for DRAFT mode:
DEFAULT_DRAFT_SECTIONS = [
    "executive_summary",
    "problem_statement",
    "goals_and_objectives",
    "proposed_solution",
    "open_questions",      # Emphasized in draft
    "identified_gaps",     # Emphasized in draft
    "next_steps"
]

# Default sections for DETAILED mode:
DEFAULT_DETAILED_SECTIONS = [
    "executive_summary",
    "problem_statement",
    "goals_and_objectives",
    "target_users",
    "proposed_solution",
    "functional_requirements",
    "non_functional_requirements",
    "technical_considerations",
    "success_metrics",
    "timeline_and_milestones",
    "risks_and_mitigations",
    "appendix"
]
```

### User Story Model (`backend/app/models/user_story.py`)

```python
class StoryFormat(str, Enum):
    CLASSIC = "classic"      # "As a [user], I want [goal], so that [benefit]"
    JOB_STORY = "job_story"  # "When [situation], I want [motivation], so I can [outcome]"

class StoryStatus(str, Enum):
    DRAFT = "draft"
    READY = "ready"
    EXPORTED = "exported"

class StorySize(str, Enum):
    XS = "xs"
    S = "s"
    M = "m"
    L = "l"
    XL = "xl"

class UserStory(Base):
    __tablename__ = "user_stories"

    id: UUID = Column(UUID, primary_key=True, default=uuid4)
    project_id: UUID = Column(UUID, ForeignKey("projects.id"), nullable=False)

    # Generation tracking
    batch_id: UUID = Column(UUID, ForeignKey("story_batches.id"), nullable=False)
    story_number: int = Column(Integer, nullable=False)  # Sequential within project (never reused)

    # Content
    format: StoryFormat = Column(Enum(StoryFormat), nullable=False)
    title: str = Column(String(500), nullable=False)
    description: str = Column(Text, nullable=False)  # The full story statement
    acceptance_criteria: JSON = Column(JSON, default=list)  # Array of strings

    # Organization
    order: int = Column(Integer, nullable=False)  # For manual reordering
    labels: JSON = Column(JSON, default=list)  # Array of strings for categorization
    size: StorySize = Column(Enum(StorySize), nullable=True)  # T-shirt sizing

    # Traceability (links to Requirement model via requirement.id)
    requirement_ids: JSON = Column(JSON, default=list)  # Array of UUID strings

    # Status
    status: StoryStatus = Column(Enum(StoryStatus), default=StoryStatus.DRAFT)

    # Audit fields
    created_by: UUID = Column(UUID, ForeignKey("users.id"), nullable=True)
    updated_by: UUID = Column(UUID, ForeignKey("users.id"), nullable=True)
    created_at: datetime = Column(DateTime, default=datetime.utcnow)
    updated_at: datetime = Column(DateTime, onupdate=datetime.utcnow)
    deleted_at: datetime = Column(DateTime, nullable=True)  # Soft delete

    # Computed property for display ID
    @property
    def story_id(self) -> str:
        return f"US-{self.story_number:03d}"  # US-001, US-002, etc.
```

### Story Generation Batch Model (`backend/app/models/story_batch.py`)

```python
class StoryBatchStatus(str, Enum):
    QUEUED = "queued"
    GENERATING = "generating"
    READY = "ready"
    FAILED = "failed"
    CANCELLED = "cancelled"

class StoryBatch(Base):
    """Tracks each story generation run"""
    __tablename__ = "story_batches"

    id: UUID = Column(UUID, primary_key=True, default=uuid4)
    project_id: UUID = Column(UUID, ForeignKey("projects.id"), nullable=False)
    format: StoryFormat = Column(Enum(StoryFormat), nullable=False)
    section_filter: JSON = Column(JSON, nullable=True)  # Which requirement sections were used
    story_count: int = Column(Integer, default=0)  # Updated after generation
    status: StoryBatchStatus = Column(Enum(StoryBatchStatus), default=StoryBatchStatus.QUEUED)
    error_message: str = Column(Text, nullable=True)
    created_by: UUID = Column(UUID, ForeignKey("users.id"), nullable=True)
    created_at: datetime = Column(DateTime, default=datetime.utcnow)
```

### Requirements Model Reference

Stories link to the existing `Requirement` model in the codebase:

```python
# Existing model (for reference - do not modify)
# backend/app/models/requirement.py
class Requirement(Base):
    __tablename__ = "requirements"

    id: UUID  # This is what story.requirement_ids references
    project_id: UUID
    section: str  # e.g., "functional", "non_functional", "user_needs"
    content: str
    # ... other fields
```

When generating stories, the LLM is given requirement IDs and can reference them in `source_requirement_ids`. The UI can then show which requirements a story traces back to.

---

## Backend Implementation

### Services

#### PRD Generator (`backend/app/services/prd_generator.py`)

```python
class PRDGenerator:
    def __init__(self, db: Session, llm_client: LLMClient):
        self.db = db
        self.llm = llm_client

    async def generate(self, prd: PRD) -> PRDResult:
        """
        Generate PRD content. Called by background task.

        Steps:
        1. Load project requirements grouped by section
        2. Build prompt based on mode (draft/detailed)
        3. Call LLM
        4. Parse response into sections
        5. Return result (caller saves to DB)
        """
        requirements = await self._load_requirements(prd.project_id)
        if not requirements:
            raise NoRequirementsError(
                f"Project has no requirements. Please add requirements before generating a PRD."
            )

        prompt = self._build_prompt(requirements, prd.mode)
        response = await self.llm.generate(prompt, **LLM_CONFIG["prd_generation"])
        return self._parse_response(response, prd.mode)

    def _get_next_version(self, project_id: UUID) -> int:
        """Get next version with row-level lock to prevent race conditions"""
        result = self.db.execute(
            select(func.coalesce(func.max(PRD.version), 0) + 1)
            .where(PRD.project_id == project_id)
            .where(PRD.deleted_at.is_(None))
            .with_for_update()
        )
        return result.scalar()

    def _build_prompt(self, requirements: List[Requirement], mode: PRDMode) -> str:
        """Build the generation prompt"""
        # Load appropriate prompt template
        template_file = f"prompts/generate_prd_{mode.value}_v1.txt"
        template = load_prompt_template(template_file)

        # Format requirements by section
        requirements_by_section = format_requirements_by_section(requirements)

        return template.format(requirements_by_section=requirements_by_section)

    def _parse_response(self, response: str, mode: PRDMode) -> PRDResult:
        """Parse LLM response into structured sections"""
        try:
            data = json.loads(response)
            return PRDResult(
                title=data["title"],
                sections=data["sections"],
                markdown=self._sections_to_markdown(data["sections"])
            )
        except (json.JSONDecodeError, KeyError) as e:
            raise LLMResponseError(f"Failed to parse LLM response: {e}")
```

#### Stories Generator (`backend/app/services/stories_generator.py`)

```python
class StoriesGenerator:
    def __init__(self, db: Session, llm_client: LLMClient):
        self.db = db
        self.llm = llm_client

    async def generate(self, batch: StoryBatch) -> List[UserStory]:
        """
        Generate user stories. Called by background task.

        Steps:
        1. Load requirements (filtered by section if specified)
        2. Build prompt based on format
        3. Call LLM
        4. Parse JSON array response
        5. Create UserStory records with sequential numbers
        6. Return created stories
        """
        requirements = await self._load_requirements(
            batch.project_id,
            section_filter=batch.section_filter
        )
        if not requirements:
            raise NoRequirementsError("No requirements found for story generation.")

        prompt = self._build_prompt(requirements, batch.format)
        response = await self.llm.generate(prompt, **LLM_CONFIG["story_generation"])
        stories_data = self._parse_response(response)

        # Get next story number with lock
        next_number = self._get_next_story_number(batch.project_id)

        stories = []
        for i, story_data in enumerate(stories_data):
            story = UserStory(
                project_id=batch.project_id,
                batch_id=batch.id,
                story_number=next_number + i,
                format=batch.format,
                order=i,
                title=story_data["title"],
                description=story_data["description"],
                acceptance_criteria=story_data.get("acceptance_criteria", []),
                labels=story_data.get("suggested_labels", []),
                size=story_data.get("suggested_size"),
                requirement_ids=story_data.get("source_requirement_ids", []),
            )
            stories.append(story)

        return stories

    def _get_next_story_number(self, project_id: UUID) -> int:
        """Get next story number with row-level lock - never reuses deleted numbers"""
        result = self.db.execute(
            select(func.coalesce(func.max(UserStory.story_number), 0) + 1)
            .where(UserStory.project_id == project_id)
            .with_for_update()  # Row lock to prevent race conditions
        )
        return result.scalar()
```

### LLM Configuration

```python
# config/llm.py
LLM_CONFIG = {
    "prd_generation": {
        "model": "gpt-4-turbo",  # Or configured model
        "temperature": 0.7,      # Some creativity for prose
        "max_tokens": 8000,      # PRDs can be long
        "timeout": 120           # 2 minute timeout
    },
    "story_generation": {
        "model": "gpt-4-turbo",
        "temperature": 0.5,      # More structured output
        "max_tokens": 4000,
        "timeout": 90
    }
}
```

### Error Handling

```python
# exceptions.py
class PRDGenerationError(Exception):
    """Base error for PRD generation"""
    pass

class NoRequirementsError(PRDGenerationError):
    """Project has no requirements to generate from"""
    pass

class LLMResponseError(PRDGenerationError):
    """LLM returned invalid or unparseable response"""
    pass

class GenerationTimeoutError(PRDGenerationError):
    """Generation exceeded timeout"""
    pass

class GenerationCancelledError(PRDGenerationError):
    """Generation was cancelled by user"""
    pass
```

### Prompts

#### Draft PRD Prompt (`prompts/generate_prd_draft_v1.txt`)

```
You are a product manager creating a DRAFT Product Requirements Document.
Focus on identifying gaps, open questions, and areas needing clarification.

## Project Requirements

{requirements_by_section}

## Instructions

Generate a PRD with the following sections. For each section, write clear content
based on the requirements provided. Importantly, highlight:
- Gaps in the requirements
- Ambiguities that need clarification
- Open questions for stakeholders
- Assumptions being made

## Required Sections

1. **Executive Summary**: Brief overview of the product/feature
2. **Problem Statement**: What problem are we solving?
3. **Goals and Objectives**: What are we trying to achieve?
4. **Proposed Solution**: High-level solution approach
5. **Open Questions**: List all questions that need answers (IMPORTANT)
6. **Identified Gaps**: What's missing from the requirements? (IMPORTANT)
7. **Next Steps**: Recommended actions to move forward

## Output Format

Return a JSON object with this structure:
```json
{
  "title": "PRD: [Feature Name]",
  "sections": [
    {
      "id": "executive_summary",
      "title": "Executive Summary",
      "content": "markdown content here..."
    }
  ]
}
```

Generate the PRD now:
```

#### Detailed PRD Prompt (`prompts/generate_prd_detailed_v1.txt`)

```
You are a product manager creating a comprehensive Product Requirements Document.
This should be a polished, complete document suitable for stakeholder review.

## Project Requirements

{requirements_by_section}

## Instructions

Generate a detailed PRD covering all aspects of the product/feature.
Be thorough and specific. Use the requirements provided to inform each section.

## Required Sections

1. **Executive Summary**: Concise overview for executives
2. **Problem Statement**: Detailed problem description with context
3. **Goals and Objectives**: SMART goals with success criteria
4. **Target Users**: User personas and segments
5. **Proposed Solution**: Detailed solution description
6. **Functional Requirements**: Specific features and capabilities
7. **Non-Functional Requirements**: Performance, security, scalability
8. **Technical Considerations**: Architecture, integrations, constraints
9. **Success Metrics**: KPIs and measurement approach
10. **Timeline and Milestones**: Phased delivery plan
11. **Risks and Mitigations**: Risk assessment with mitigation strategies
12. **Appendix**: Supporting information, references

## Output Format

Return a JSON object with this structure:
```json
{
  "title": "PRD: [Feature Name]",
  "sections": [
    {
      "id": "executive_summary",
      "title": "Executive Summary",
      "content": "markdown content here..."
    }
  ]
}
```

Generate the PRD now:
```

#### Classic Stories Prompt (`prompts/generate_stories_classic_v1.txt`)

```
You are a product manager creating user stories from requirements.
Use the classic user story format.

## Project Requirements

{requirements_by_section}

## Instructions

Generate user stories that:
- Cover all the functionality described in the requirements
- Are small enough to complete in a single sprint
- Have clear, testable acceptance criteria
- Follow the INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable)

## Story Format

Use the classic format:
"As a [type of user], I want [goal/desire], so that [benefit/value]"

## Output Format

Return a JSON object:
```json
{
  "stories": [
    {
      "title": "Short descriptive title",
      "description": "As a [user], I want [goal], so that [benefit]",
      "acceptance_criteria": [
        "Given [context], when [action], then [result]",
        "Given [context], when [action], then [result]"
      ],
      "suggested_size": "m",
      "suggested_labels": ["frontend", "auth"],
      "source_requirement_ids": ["uuid-of-requirement"]
    }
  ]
}
```

Generate the user stories now:
```

#### Job Stories Prompt (`prompts/generate_stories_job_v1.txt`)

```
You are a product manager creating job stories from requirements.
Use the Jobs-to-be-Done story format.

## Project Requirements

{requirements_by_section}

## Instructions

Generate job stories that:
- Focus on the situation and motivation, not the user role
- Capture the context in which a need arises
- Are small enough to complete in a single sprint
- Have clear, testable acceptance criteria

## Story Format

Use the job story format:
"When [situation/trigger], I want to [motivation/action], so I can [expected outcome]"

## Output Format

Return a JSON object:
```json
{
  "stories": [
    {
      "title": "Short descriptive title",
      "description": "When [situation], I want to [action], so I can [outcome]",
      "acceptance_criteria": [
        "Given [context], when [action], then [result]",
        "Given [context], when [action], then [result]"
      ],
      "suggested_size": "m",
      "suggested_labels": ["frontend", "auth"],
      "source_requirement_ids": ["uuid-of-requirement"]
    }
  ]
}
```

Generate the job stories now:
```

### API Endpoints

#### PRD Router (`backend/app/routers/prds.py`)

```python
router = APIRouter(prefix="/api", tags=["prds"])

# PRD Generation & Management
@router.post("/projects/{project_id}/prds/generate")
async def generate_prd(
    project_id: UUID,
    request: PRDGenerateRequest,  # mode only (no template_id for v1)
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> PRDStatusResponse:
    """Start PRD generation. Returns immediately with id and status=queued."""

@router.get("/prds/{prd_id}/status")
async def get_prd_status(
    prd_id: UUID,
    db: Session = Depends(get_db)
) -> PRDStatusResponse:
    """Get PRD generation status (for polling)."""

@router.post("/prds/{prd_id}/cancel")
async def cancel_prd_generation(
    prd_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> PRDStatusResponse:
    """Cancel a queued or generating PRD."""

@router.get("/projects/{project_id}/prds")
async def list_prds(
    project_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    include_archived: bool = Query(False),
    db: Session = Depends(get_db)
) -> PaginatedResponse[PRDSummary]:
    """List PRDs for project with pagination."""

@router.get("/prds/{prd_id}")
async def get_prd(
    prd_id: UUID,
    db: Session = Depends(get_db)
) -> PRDResponse:
    """Get single PRD with all sections."""

@router.put("/prds/{prd_id}")
async def update_prd(
    prd_id: UUID,
    request: PRDUpdateRequest,  # sections, title
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> PRDResponse:
    """Update PRD content."""

@router.delete("/prds/{prd_id}")
async def delete_prd(
    prd_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> None:
    """Soft delete PRD."""

@router.post("/prds/{prd_id}/archive")
async def archive_prd(
    prd_id: UUID,
    db: Session = Depends(get_db)
) -> PRDResponse:
    """Archive PRD (sets status to archived)."""

@router.get("/prds/{prd_id}/export")
async def export_prd(
    prd_id: UUID,
    format: ExportFormat = Query(ExportFormat.MARKDOWN),  # markdown, json only for v1
    db: Session = Depends(get_db)
) -> StreamingResponse:
    """Export PRD in specified format."""
```

#### Stories Router (`backend/app/routers/stories.py`)

```python
router = APIRouter(prefix="/api", tags=["stories"])

@router.post("/projects/{project_id}/stories/generate")
async def generate_stories(
    project_id: UUID,
    request: StoriesGenerateRequest,  # format, section_filter (optional)
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> StoryBatchStatusResponse:
    """Start story generation. Returns batch_id and status=queued."""

@router.get("/stories/batches/{batch_id}/status")
async def get_batch_status(
    batch_id: UUID,
    db: Session = Depends(get_db)
) -> StoryBatchStatusResponse:
    """Get batch generation status (for polling)."""

@router.post("/stories/batches/{batch_id}/cancel")
async def cancel_story_generation(
    batch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> StoryBatchStatusResponse:
    """Cancel a queued or generating batch."""

@router.get("/projects/{project_id}/stories")
async def list_stories(
    project_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    batch_id: Optional[UUID] = Query(None),
    status: Optional[StoryStatus] = Query(None),
    labels: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db)
) -> PaginatedResponse[UserStoryResponse]:
    """List stories with filtering and pagination."""

@router.get("/projects/{project_id}/stories/batches")
async def list_batches(
    project_id: UUID,
    db: Session = Depends(get_db)
) -> List[StoryBatchResponse]:
    """List all generation batches for project."""

@router.get("/stories/{story_id}")
async def get_story(
    story_id: UUID,
    db: Session = Depends(get_db)
) -> UserStoryResponse:
    """Get single story."""

@router.put("/stories/{story_id}")
async def update_story(
    story_id: UUID,
    request: StoryUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> UserStoryResponse:
    """Update story details."""

@router.delete("/stories/{story_id}")
async def delete_story(
    story_id: UUID,
    db: Session = Depends(get_db)
) -> None:
    """Soft delete story."""

@router.post("/projects/{project_id}/stories/reorder")
async def reorder_stories(
    project_id: UUID,
    request: ReorderRequest,  # story_ids: List[UUID] in desired order
    db: Session = Depends(get_db)
) -> None:
    """Reorder stories. Request body: {"story_ids": ["uuid1", "uuid2", ...]}"""

@router.delete("/projects/{project_id}/stories/batch/{batch_id}")
async def delete_batch(
    project_id: UUID,
    batch_id: UUID,
    db: Session = Depends(get_db)
) -> None:
    """Delete all stories from a generation batch."""

@router.get("/projects/{project_id}/stories/export")
async def export_stories(
    project_id: UUID,
    format: StoryExportFormat = Query(StoryExportFormat.MARKDOWN),  # markdown, csv, json for v1
    batch_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db)
) -> StreamingResponse:
    """Export stories in specified format."""
```

### Schemas (`backend/app/schemas/`)

#### PRD Schemas (`prd.py`)

```python
class PRDGenerateRequest(BaseModel):
    mode: PRDMode

class PRDStatusResponse(BaseModel):
    id: UUID
    status: PRDStatus
    error_message: Optional[str] = None

class PRDSection(BaseModel):
    id: str
    title: str
    content: str
    order: int
    is_collapsed: bool = False

class PRDResponse(BaseModel):
    id: UUID
    project_id: UUID
    version: int
    title: Optional[str]
    mode: PRDMode
    sections: Optional[List[PRDSection]]
    status: PRDStatus
    error_message: Optional[str]
    created_by: Optional[UUID]
    created_at: datetime
    updated_at: Optional[datetime]

class PRDSummary(BaseModel):
    id: UUID
    version: int
    title: Optional[str]
    mode: PRDMode
    status: PRDStatus
    created_at: datetime

class PRDUpdateRequest(BaseModel):
    title: Optional[str] = None
    sections: Optional[List[PRDSection]] = None

class ExportFormat(str, Enum):
    MARKDOWN = "markdown"
    JSON = "json"
```

#### Story Schemas (`user_story.py`)

```python
class StoriesGenerateRequest(BaseModel):
    format: StoryFormat
    section_filter: Optional[List[str]] = None  # Filter by requirement sections

class StoryBatchStatusResponse(BaseModel):
    batch_id: UUID
    status: StoryBatchStatus
    story_count: int
    error_message: Optional[str] = None

class StoriesGenerateResponse(BaseModel):
    batch_id: UUID
    stories: List[UserStoryResponse]
    story_count: int

class UserStoryResponse(BaseModel):
    id: UUID
    story_id: str  # "US-001"
    project_id: UUID
    batch_id: UUID
    format: StoryFormat
    title: str
    description: str
    acceptance_criteria: List[str]
    order: int
    labels: List[str]
    size: Optional[StorySize]
    requirement_ids: List[str]
    status: StoryStatus
    created_at: datetime
    updated_at: Optional[datetime]

class StoryUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    acceptance_criteria: Optional[List[str]] = None
    labels: Optional[List[str]] = None
    size: Optional[StorySize] = None
    status: Optional[StoryStatus] = None

class ReorderRequest(BaseModel):
    story_ids: List[UUID]  # IDs in desired order

class StoryBatchResponse(BaseModel):
    id: UUID
    format: StoryFormat
    story_count: int
    status: StoryBatchStatus
    created_at: datetime

class StoryExportFormat(str, Enum):
    MARKDOWN = "markdown"
    CSV = "csv"
    JSON = "json"

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    skip: int
    limit: int
    has_more: bool
```

---

## Export Format Specifications

### PRD Markdown Export

```markdown
# {title}

**Version:** {version}
**Mode:** {mode}
**Generated:** {created_at}
**Status:** {status}

---

## {section.title}

{section.content}

---

## {next_section.title}

{next_section.content}

...
```

### PRD JSON Export

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "version": 1,
  "title": "PRD: Feature Name",
  "mode": "draft",
  "status": "ready",
  "created_at": "2024-01-15T10:30:00Z",
  "sections": [
    {
      "id": "executive_summary",
      "title": "Executive Summary",
      "content": "markdown content...",
      "order": 1
    }
  ]
}
```

### Stories Markdown Export

```markdown
# User Stories

**Project:** {project_name}
**Exported:** {export_date}
**Total Stories:** {count}

---

## US-001: {title}

{description}

**Size:** {size}
**Labels:** {labels}
**Status:** {status}

### Acceptance Criteria

- {criteria_1}
- {criteria_2}

---

## US-002: {title}

...
```

### Stories CSV Export

| Column | Description | Example |
|--------|-------------|---------|
| story_id | Display ID | US-001 |
| title | Story title | User Login |
| description | Full story text | As a user, I want... |
| acceptance_criteria | Pipe-separated | Given X \| When Y \| Then Z |
| size | T-shirt size | m |
| labels | Comma-separated | auth, frontend |
| status | Current status | draft |
| created_at | ISO timestamp | 2024-01-15T10:30:00Z |

**CSV Header:**
```
story_id,title,description,acceptance_criteria,size,labels,status,created_at
```

### Stories JSON Export

```json
{
  "project_id": "uuid",
  "exported_at": "2024-01-15T10:30:00Z",
  "total_count": 15,
  "stories": [
    {
      "story_id": "US-001",
      "title": "User Login",
      "description": "As a user, I want to log in...",
      "acceptance_criteria": ["Given...", "When..."],
      "size": "m",
      "labels": ["auth", "frontend"],
      "status": "draft",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## Frontend Implementation

### New Pages

| Page | Route | Purpose |
|------|-------|---------|
| `PRDLandingPage.jsx` | `/app/prd` | Feature landing with project selection |
| `PRDGeneratorPage.jsx` | `/app/projects/{id}/prd` | Generate PRD with options |
| `PRDEditorPage.jsx` | `/app/prds/{id}` | View/edit PRD content |
| `StoriesLandingPage.jsx` | `/app/stories` | Feature landing with project selection |
| `UserStoriesPage.jsx` | `/app/projects/{id}/stories` | Generate & manage stories |

### Components

#### PRD Components (`ui/src/components/prd/`)

```jsx
// PRDOptionsPanel.jsx
// - Mode selector (Draft/Detailed) with descriptions
// - Generate button with loading state
// - 30-second cooldown after generation starts

// PRDSectionEditor.jsx
// - Collapsible section with markdown editor
// - Auto-save with 1 second debounce
// - Save indicator (Saved / Saving... / Error)

// PRDTableOfContents.jsx
// - Sticky sidebar navigation
// - Section links with scroll-to
// - Collapse/expand all button

// PRDGenerationProgress.jsx
// - Full-screen overlay during generation
// - Animated progress indicator
// - Status messages based on generation stage
// - Cancel button

// PRDExportModal.jsx
// - Format selector (Markdown, JSON)
// - Download button

// PRDVersionSelector.jsx
// - Dropdown of versions with dates
```

#### Story Components (`ui/src/components/stories/`)

```jsx
// StoryCard.jsx
// - Expandable card showing story details
// - Story ID badge (US-001)
// - Size indicator (XS-XL)
// - Label chips
// - Expand to show acceptance criteria
// - Quick actions: Edit, Delete

// StoryEditModal.jsx
// - Full story editor
// - Title, description fields
// - Acceptance criteria list (add/remove)
// - Size selector
// - Label multi-select/create
// - Status selector
// - Save/Cancel with unsaved changes warning

// StoriesOptionsPanel.jsx
// - Format selector (Classic/Job Story)
// - Section filter (multi-select)
// - Generate button with loading
// - 30-second cooldown after generation starts

// AcceptanceCriteriaEditor.jsx
// - List of criteria with delete buttons
// - Add new criterion input
// - Drag to reorder

// StoriesGenerationProgress.jsx
// - Progress overlay during generation
// - Cancel button

// StoryBatchFilter.jsx
// - Filter by generation batch
// - "All stories" / specific batch dropdown
// - Delete batch option

// StoriesExportModal.jsx
// - Format selector (Markdown, CSV, JSON)
// - Batch filter option
// - Download button
```

### UI States & Interactions

#### Generation with Polling and Cooldown

```jsx
// PRDGeneratorPage.jsx
const COOLDOWN_MS = 30000; // 30 seconds

const [isGenerating, setIsGenerating] = useState(false);
const [cooldownUntil, setCooldownUntil] = useState(null);
const [status, setStatus] = useState(null);
const [error, setError] = useState(null);

const handleGenerate = async () => {
  setIsGenerating(true);
  setCooldownUntil(Date.now() + COOLDOWN_MS);
  setError(null);

  try {
    const { id, status } = await api.generatePRD(projectId, { mode });
    pollStatus(id);
  } catch (err) {
    setError(err.message);
    setIsGenerating(false);
  }
};

const pollStatus = async (prdId) => {
  const poll = async () => {
    const { status, error_message } = await api.getPRDStatus(prdId);
    setStatus(status);

    if (status === 'ready') {
      navigate(`/app/prds/${prdId}`);
    } else if (status === 'failed') {
      setError(error_message || 'Generation failed');
      setIsGenerating(false);
    } else if (status === 'cancelled') {
      setIsGenerating(false);
    } else {
      setTimeout(poll, 2000);
    }
  };
  poll();
};

const handleCancel = async () => {
  await api.cancelPRDGeneration(currentPrdId);
};

// Cooldown timer
const isCoolingDown = cooldownUntil && Date.now() < cooldownUntil;

return (
  <>
    <PRDOptionsPanel
      mode={mode}
      onModeChange={setMode}
      onGenerate={handleGenerate}
      isGenerating={isGenerating}
      isCoolingDown={isCoolingDown}
      cooldownRemaining={Math.max(0, cooldownUntil - Date.now())}
    />

    {isGenerating && (
      <PRDGenerationProgress
        status={status}
        onCancel={handleCancel}
      />
    )}

    {error && <ErrorBanner message={error} />}
  </>
);
```

#### Auto-Save with Debounce

```jsx
// PRDSectionEditor.jsx
const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
const [content, setContent] = useState(section.content);

const debouncedSave = useMemo(
  () => debounce(async (newContent) => {
    setSaveStatus('saving');
    try {
      await api.updatePRD(prdId, {
        sections: sections.map(s =>
          s.id === section.id ? { ...s, content: newContent } : s
        )
      });
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('error');
      toast.error('Failed to save. Will retry...');
    }
  }, 1000),
  [prdId, section.id, sections]
);

<SaveIndicator status={saveStatus} />
```

#### Confirmation Dialogs

```jsx
// Required confirmations:

// 1. Delete story
<ConfirmDialog
  title="Delete Story"
  message={`Are you sure you want to delete ${story.story_id}? This cannot be undone.`}
  confirmLabel="Delete"
  variant="danger"
/>

// 2. Delete batch
<ConfirmDialog
  title="Delete All Stories in Batch"
  message={`This will delete ${batch.story_count} stories. Continue?`}
  confirmLabel="Delete All"
  variant="danger"
/>

// 3. Navigate away with unsaved changes
useEffect(() => {
  const handleBeforeUnload = (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [hasUnsavedChanges]);

// 4. Regenerate info (for stories - since they append)
<InfoDialog
  title="Generate More Stories"
  message="New stories will be added to your existing stories. To replace them, delete the old batch first."
  confirmLabel="Generate"
/>
```

### Navigation Updates

```jsx
// LandingPage.jsx - Enable cards
const features = [
  // ... existing features
  {
    title: "Generate PRD",
    description: "Transform requirements into a structured PRD",
    link: "/app/prd",
    enabled: true
  },
  {
    title: "User Stories",
    description: "Convert requirements into development stories",
    link: "/app/stories",
    enabled: true
  }
];

// App.jsx - Add routes
<Route path="/app/prd" element={<PRDLandingPage />} />
<Route path="/app/projects/:projectId/prd" element={<PRDGeneratorPage />} />
<Route path="/app/prds/:prdId" element={<PRDEditorPage />} />
<Route path="/app/stories" element={<StoriesLandingPage />} />
<Route path="/app/projects/:projectId/stories" element={<UserStoriesPage />} />
```

---

## Implementation Order

### Phase 1: Database & Models (Backend Foundation)
1. Create model files: `prd.py`, `user_story.py`, `story_batch.py`
2. Create Alembic migration
3. Create Pydantic schemas in `schemas/prd.py` and `schemas/user_story.py`
4. Export models in `models/__init__.py`
5. Create exception classes in `exceptions.py`

### Phase 2: PRD Backend (Core Functionality)
6. Create prompt files (draft + detailed)
7. Implement `PRDGenerator` service with background task
8. Create `prds.py` router with all endpoints (including status polling, cancel)
9. Register router in `main.py`

### Phase 3: PRD Frontend (User Interface)
10. Create `PRDLandingPage` (project selection)
11. Create `PRDGeneratorPage` with options panel, polling, and cooldown
12. Create `PRDEditorPage` with section editor and auto-save
13. Create `PRDExportModal` and `PRDVersionSelector`
14. Update `LandingPage` to enable PRD card
15. Add routes to `App.jsx`

### Phase 4: Stories Backend (Core Functionality)
16. Create prompt files (classic + job story)
17. Implement `StoriesGenerator` service with background task
18. Create `stories.py` router with all endpoints
19. Register router in `main.py`

### Phase 5: Stories Frontend (User Interface)
20. Create `StoriesLandingPage` (project selection)
21. Create `UserStoriesPage` with options panel, polling, and story list
22. Create `StoryCard` component with expand/collapse
23. Create `StoryEditModal` with all fields
24. Create `StoriesExportModal` with format options
25. Create `StoryBatchFilter` for batch management
26. Update `LandingPage` to enable Stories card
27. Add routes to `App.jsx`

### Phase 6: Testing & Polish
28. Backend unit tests for services
29. Backend integration tests for endpoints
30. Frontend component tests
31. E2E tests with Playwright
32. Error handling edge cases

---

## Testing Strategy

### Backend Tests

#### Unit Tests (`tests/test_prd_service.py`)

```python
class TestPRDGenerator:
    def test_generate_prd_draft_mode(self, mock_llm, db_session):
        """Draft mode generates expected sections"""

    def test_generate_prd_detailed_mode(self, mock_llm, db_session):
        """Detailed mode generates all sections"""

    def test_version_auto_increment(self, db_session):
        """Each generation increments version"""

    def test_version_increment_with_concurrency(self, db_session):
        """Concurrent generations get unique versions (row lock test)"""

    def test_no_requirements_raises_error(self, db_session):
        """NoRequirementsError when project has no requirements"""

    def test_malformed_llm_response(self, mock_llm, db_session):
        """LLMResponseError on invalid JSON"""

class TestStoriesGenerator:
    def test_story_number_never_reused(self, db_session):
        """Deleted story numbers are not reused"""

    def test_story_number_with_concurrency(self, db_session):
        """Concurrent generations get unique story numbers (row lock test)"""
```

#### Integration Tests (`tests/test_prd_api.py`)

```python
class TestPRDEndpoints:
    def test_generate_returns_queued_status(self, client, project_with_requirements):
        """POST /generate returns status=queued immediately"""

    def test_status_polling(self, client, generating_prd):
        """GET /status returns current generation status"""

    def test_cancel_generation(self, client, generating_prd):
        """POST /cancel sets status=cancelled"""

    def test_list_prds_pagination(self, client, project_with_multiple_prds):
        """GET /prds respects skip/limit"""

    def test_soft_delete_prd(self, client, existing_prd):
        """DELETE sets deleted_at, excludes from list"""

    def test_export_markdown(self, client, existing_prd):
        """GET /export?format=markdown returns valid markdown"""
```

### Mock LLM Responses

```python
# tests/fixtures/llm_responses.py
MOCK_PRD_RESPONSE = {
    "title": "PRD: Test Feature",
    "sections": [
        {"id": "executive_summary", "title": "Executive Summary", "content": "Test content..."},
        # ... more sections
    ]
}

MOCK_STORIES_RESPONSE = {
    "stories": [
        {
            "title": "User Login",
            "description": "As a user, I want to log in so that I can access my account",
            "acceptance_criteria": ["Given valid credentials, when I submit, then I'm logged in"],
            "suggested_size": "m",
            "suggested_labels": ["auth"],
            "source_requirement_ids": []
        }
    ]
}

@pytest.fixture
def mock_llm():
    with patch('app.services.llm_client.LLMClient') as mock:
        mock.return_value.generate.return_value = json.dumps(MOCK_PRD_RESPONSE)
        yield mock
```

### E2E Tests (`ui/e2e/`)

```javascript
// prd-generation.spec.ts
test('complete PRD generation flow', async ({ page }) => {
  // 1. Navigate to PRD landing
  await page.goto('/app/prd');

  // 2. Select project
  await page.click('[data-testid="project-selector"]');
  await page.click('text=Test Project');

  // 3. Choose draft mode
  await page.click('[data-testid="mode-draft"]');

  // 4. Click generate
  await page.click('[data-testid="generate-btn"]');

  // 5. Verify progress overlay appears
  await expect(page.locator('[data-testid="generation-progress"]')).toBeVisible();

  // 6. Wait for completion (mock LLM in CI)
  await expect(page.locator('[data-testid="prd-editor"]')).toBeVisible({ timeout: 30000 });

  // 7. Verify sections present
  await expect(page.locator('[data-testid="section-executive_summary"]')).toBeVisible();

  // 8. Edit a section
  await page.fill('[data-testid="section-executive_summary"] textarea', 'Updated content');

  // 9. Verify auto-save
  await expect(page.locator('text=Saved')).toBeVisible();
});
```

---

## Critical Files to Modify

### Backend
- `backend/app/models/__init__.py` - Export new models
- `backend/app/main.py` - Register new routers
- `backend/app/exceptions.py` - Add new exception classes (or create if doesn't exist)
- `backend/alembic/env.py` - Import new models for migration

### Frontend
- `ui/src/App.jsx` - Add new routes
- `ui/src/pages/LandingPage.jsx` - Enable card links
- `ui/src/services/api.js` - Add API functions

---

## Verification Checklist

### Before Marking Complete

- [ ] All new models have migrations that run successfully
- [ ] All endpoints return correct status codes
- [ ] Status polling returns accurate generation state
- [ ] Cancel stops generation and updates status
- [ ] Pagination works with skip/limit
- [ ] Soft delete excludes from list queries
- [ ] Generation handles empty requirements gracefully
- [ ] LLM errors are caught and set status=failed
- [ ] Row locks prevent duplicate version/story numbers
- [ ] Auto-save debounces correctly
- [ ] UI cooldown prevents rapid re-generation
- [ ] Confirmation dialogs appear for destructive actions
- [ ] Export formats produce valid output
- [ ] All tests pass
- [ ] No TypeScript/linting errors

### Manual Testing Scenarios

1. **Generate PRD with no requirements** - Should show helpful error
2. **Generate PRD, close browser, reopen** - Should show saved PRD
3. **Cancel mid-generation** - Should stop and show cancelled state
4. **Click generate twice quickly** - Cooldown should prevent second click
5. **Edit section, navigate away** - Should warn about unsaved changes
6. **Generate stories twice** - Should have 2 batches, all stories visible
7. **Delete a batch** - Should remove only that batch's stories
