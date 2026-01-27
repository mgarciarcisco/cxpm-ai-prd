# Section-by-Section PRD Generation Design

**Date:** 2026-01-26
**Status:** Approved

## Goals

1. **Faster perceived response time** - User sees content sooner (first section appears within ~5s)
2. **Better error recovery** - If one section fails, don't lose everything
3. **Edit/regenerate individual sections** - User can regenerate just one section

## Staging Strategy

### DETAILED Mode (12 sections)

- **Stage 1 (sequential, streamed):** Problem Statement → Goals and Objectives → Target Users → Proposed Solution
- **Stage 2 (parallel, complete-on-done):** 7 sections simultaneously - Functional Requirements, Non-Functional Requirements, Technical Considerations, Success Metrics, Timeline and Milestones, Risks and Mitigations, Appendix
- **Stage 3 (sequential, streamed):** Executive Summary (uses all sections as context)

### DRAFT Mode (7 sections)

- **Stage 1 (sequential, streamed):** Problem Statement → Goals and Objectives → Proposed Solution
- **Stage 2 (parallel, complete-on-done):** Open Questions, Identified Gaps, Next Steps
- **Stage 3 (sequential, streamed):** Executive Summary

### Why This Ordering

- Stage 1 establishes core understanding (problem, goals, users, solution) that all other sections reference
- Stage 2 sections are independent given Stage 1 context - they don't need each other
- Executive Summary last because it genuinely summarizes everything

### Estimated Timing Improvement

- Current: ~60-90 seconds for all sections sequentially in one prompt
- New: Stage 1 (~25s) + Stage 2 parallel (~15s) + Stage 3 (~5s) = ~45s total, with first content visible in ~5s

## Prompt Architecture

### Directory Structure

```
backend/prompts/sections/
├── shared_context.txt         # Common instructions (tone, format, JSON structure)
├── problem_statement.txt      # Section-specific prompt
├── goals_objectives.txt
├── target_users.txt
├── proposed_solution.txt
├── functional_requirements.txt
├── non_functional_requirements.txt
├── technical_considerations.txt
├── success_metrics.txt
├── timeline_milestones.txt
├── risks_mitigations.txt
├── appendix.txt
├── open_questions.txt         # DRAFT mode only
├── identified_gaps.txt        # DRAFT mode only
├── next_steps.txt             # DRAFT mode only
└── executive_summary.txt      # Special: receives all other sections as input
```

### Each Section Prompt Receives

1. **Requirements:** The project's requirements (same as today)
2. **Shared context:** Common instructions from `shared_context.txt`
3. **Prior sections (if applicable):** Stage 2 sections receive Stage 1 output as context
4. **Section-specific instructions:** What to generate, format, length guidance

### Token Efficiency

- Stage 1 prompts: ~1500 tokens input, ~800 tokens output each
- Stage 2 prompts: ~2500 tokens input (includes Stage 1), ~600 tokens output each
- Stage 3 prompt: ~4000 tokens input (all sections), ~400 tokens output
- Total: Roughly similar to current (~12-15k total), but spread across calls

## Backend Implementation

### Service Layer Changes (`prd_generator.py`)

```python
async def generate_stream_staged(project_id, mode) -> AsyncIterator[dict]:
    # Stage 1: Sequential with streaming
    for section in stage_1_sections:
        async for chunk in generate_section_stream(section, context):
            yield {"type": "chunk", "section_id": section.id, "content": chunk}
        yield {"type": "section_complete", "section_id": section.id, ...}
        context.add(section)  # Add to context for next sections

    # Stage 2: Parallel, yield complete
    tasks = [generate_section(s, context) for s in stage_2_sections]
    for coro in asyncio.as_completed(tasks):
        section = await coro
        yield {"type": "section_complete", "section_id": section.id, ...}

    # Stage 3: Executive Summary with streaming
    async for chunk in generate_section_stream("executive_summary", all_sections):
        yield {"type": "chunk", "section_id": "executive_summary", "content": chunk}
    yield {"type": "complete", "prd_id": prd.id}
```

### New Helper Methods

- `generate_section_stream(section_id, context)` - Streams a single section
- `generate_section(section_id, context)` - Returns complete section (for parallel)
- `build_section_prompt(section_id, requirements, context)` - Assembles prompt from templates

### SSE Event Types

| Event Type | Payload | Description |
|------------|---------|-------------|
| `stage` | `{"stage": 1, "sections": ["problem_statement", ...]}` | Stage starting |
| `chunk` | `{"section_id": "...", "content": "..."}` | Streaming content |
| `section_complete` | `{"section_id": "...", "title": "...", "content": "..."}` | Section done |
| `section_failed` | `{"section_id": "...", "error": "..."}` | Section failed |
| `complete` | `{"prd_id": "..."}` | All done |

## Data Model Changes

### PRD.sections Array (JSON with status)

```python
[
    {
        "id": "problem_statement",
        "title": "Problem Statement",
        "content": "...",
        "order": 1,
        "status": "completed",  # "pending" | "generating" | "completed" | "failed"
        "error": null,          # error message if failed
        "generated_at": "..."   # timestamp for cache/regeneration tracking
    },
    ...
]
```

### New PRD Fields

```python
class PRD:
    # ... existing fields ...
    current_stage: int | None      # 1, 2, or 3 during generation
    sections_completed: int        # Count for progress display
    sections_total: int            # Total expected sections
```

### New Status Enum Value

```python
class PRDStatus(str, Enum):
    QUEUED = "queued"
    GENERATING = "generating"
    READY = "ready"
    PARTIAL = "partial"      # NEW: Some sections failed
    FAILED = "failed"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"
```

## Frontend Implementation

### State Management (`usePRDStreaming.js`)

```javascript
const [sections, setSections] = useState({});  // Keyed by section_id
const [currentStage, setCurrentStage] = useState(null);
const [streamingSection, setStreamingSection] = useState(null);

// Handle SSE events
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
        case 'stage':
            setCurrentStage(data.stage);
            // Initialize pending sections with spinners
            data.sections.forEach(id =>
                setSections(s => ({...s, [id]: {status: 'pending'}})));
            break;
        case 'chunk':
            setStreamingSection(data.section_id);
            setSections(s => ({...s, [data.section_id]: {
                status: 'generating',
                content: (s[data.section_id]?.content || '') + data.content
            }}));
            break;
        case 'section_complete':
            setSections(s => ({...s, [data.section_id]: {
                status: 'completed', ...data
            }}));
            break;
        case 'section_failed':
            setSections(s => ({...s, [data.section_id]: {
                status: 'failed', error: data.error
            }}));
            break;
    }
};
```

### UI Display States

- **Stage 1/3 streaming:** Show section with content appearing, cursor animation
- **Stage 2 pending:** Show section card with spinner and "Generating..."
- **Completed:** Full section content with checkmark
- **Failed:** Error state with "Retry" button

## Individual Section Regeneration

### API Endpoint

```
POST /prds/{prd_id}/sections/{section_id}/regenerate
```

### Request Body (optional)

```json
{
    "custom_instructions": "Focus more on scalability concerns"
}
```

### Backend Logic

1. Load PRD and identify which stage the section belongs to
2. Gather context: requirements + prior stage sections (same as original generation)
3. Stream the regenerated section
4. On complete, update the section in PRD.sections array
5. Identify downstream dependents and return them in response

### Response with Dependency Warning

```json
{
    "section": { "id": "goals_objectives", "content": "...", "status": "completed" },
    "affected_sections": ["functional_requirements", "success_metrics", "executive_summary"],
    "warning": "3 sections used this as context and may be outdated"
}
```

### Frontend Flow

1. User clicks "Regenerate" on a section
2. Section shows streaming state
3. On complete, if `affected_sections` exists, show modal:
   "This section was used as context for: [list]. Would you like to regenerate those too?"
4. User can select which to regenerate or dismiss

### Cascade Regeneration

If user selects affected sections, call regenerate for each (can be parallel for Stage 2 sections).

## Error Handling & Recovery

### Per-Section Error Handling

When a section generation fails (LLM timeout, invalid response, etc.):

1. **Mark section as failed** in the sections array with error message
2. **Continue with other sections** - don't abort the whole PRD
3. **Stage progression rules:**
   - Stage 1 failure: Skip that section, continue to next (downstream sections get partial context)
   - Stage 2 failure: Other parallel sections unaffected
   - Stage 3 failure: PRD still usable, just missing summary

### PRD Status Logic

- All sections completed → `status: "ready"`
- Some sections failed → `status: "partial"`
- All sections failed → `status: "failed"`

### Timeout Per Section

- Stage 1 sections: 60s each (sequential, user is watching)
- Stage 2 sections: 90s each (parallel, more tolerance)
- Stage 3 (Executive Summary): 45s (shorter output)

### Retry Behavior

- Automatic: None (user controls retries via regenerate)
- Manual: User clicks "Retry" on failed section, triggers `/sections/{id}/regenerate`

## Migration & Rollout Strategy

### Database Migration

```python
# Add new fields to PRD model
current_stage: int | None = None
sections_completed: int = 0
sections_total: int = 0

# Add new status enum value
class PRDStatus(str, Enum):
    # ... existing ...
    PARTIAL = "partial"  # Some sections failed
```

### Backfill Existing PRDs

- Add `status: "completed"`, `generated_at`, `error: null` to all existing sections
- Set `sections_completed = sections_total = len(sections)`

### API Compatibility

- Keep existing `/prds/stream` endpoint working (deprecate later)
- Add new `/prds/stream/v2` for staged generation
- Frontend feature flag to switch between old/new

### Rollout Phases

1. **Phase 1:** Backend implementation with feature flag off
2. **Phase 2:** Enable for DRAFT mode only (fewer sections, lower risk)
3. **Phase 3:** Enable for DETAILED mode
4. **Phase 4:** Remove old generation code path

### Prompt Files to Create

- 12 section prompts for DETAILED mode
- 7 section prompts for DRAFT mode (some shared with DETAILED)
- 1 shared context file
- Total: ~15-20 new prompt files in `backend/prompts/sections/`

## Section Dependency Map

### DETAILED Mode

```
Stage 1 (sequential):
  problem_statement
    └─► goals_objectives
          └─► target_users
                └─► proposed_solution

Stage 2 (parallel, all depend on Stage 1):
  ├─► functional_requirements
  ├─► non_functional_requirements
  ├─► technical_considerations
  ├─► success_metrics
  ├─► timeline_milestones
  ├─► risks_mitigations
  └─► appendix

Stage 3 (depends on all):
  executive_summary
```

### DRAFT Mode

```
Stage 1 (sequential):
  problem_statement
    └─► goals_objectives
          └─► proposed_solution

Stage 2 (parallel, all depend on Stage 1):
  ├─► open_questions
  ├─► identified_gaps
  └─► next_steps

Stage 3 (depends on all):
  executive_summary
```
