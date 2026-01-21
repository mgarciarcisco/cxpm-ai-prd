# Meeting Notes to Requirements - Feature Design & Implementation Plan (v3 Final)

## Overview

Build the first feature of CXPM AI PRD: converting meeting notes into structured requirements that accumulate over time into a coherent Working Requirements document.

**Core Concept**:
- **Meeting Recaps**: Immutable, point-in-time snapshots of what was discussed
- **Working Requirements**: A living, AI-assisted draft representing current understanding
- **PM Control**: No automatic overwrites; conflicts require human decision

---

## Key Decisions

| Aspect | Decision |
|--------|----------|
| Auth | Skipped for V1 (single-user, local) |
| Input formats | .txt and .md only |
| Export formats | Markdown only |
| AI Backend | Ollama (primary) + Claude (fallback) |
| Storage | SQLite with SQLAlchemy ORM, fully normalized schema |
| Backend | Python + FastAPI |
| AI Response UX | Streaming with SSE (two-step job-based flow) |
| Editing UX | Inline editing (Notion-style) |
| Conflict Resolution | Conflict-only view with bulk actions |
| Navigation | Landing at `/`, app at `/app/*` |
| Development Style | Vertical slices (full features end-to-end) |
| Testing | Solid from day one (pytest, Vitest, Playwright) |
| DB Migrations | Alembic from day one |
| File Size Limit | 50KB max upload |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Projects │  │ Meeting  │  │ Working  │  │   Conflict   │ │
│  │ Dashboard│  │  Recap   │  │   Reqs   │  │   Resolver   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API + SSE (streaming)
┌────────────────────────┴────────────────────────────────────┐
│                    FastAPI Backend                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │  File    │  │   LLM    │  │ Conflict │  │   Chunking   │ │
│  │  Parser  │  │ Service  │  │ Detector │  │   Service    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│  SQLite DB (SQLAlchemy + Alembic)  │  LLM (Ollama / Claude) │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model (Fully Normalized)

### Tables

**Project**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | string | required |
| description | text | nullable |
| created_at | datetime | |
| updated_at | datetime | |

**MeetingRecap**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| project_id | UUID | FK → Project |
| title | string | required |
| meeting_date | date | |
| raw_input | text | original uploaded content |
| input_type | enum | txt, md |
| status | enum | pending, processing, processed, failed, applied |
| prompt_version | string | e.g., "extract_v1" |
| created_at | datetime | |
| processed_at | datetime | nullable |
| applied_at | datetime | nullable |
| failed_at | datetime | nullable |
| error_message | text | nullable, for failed status |

**MeetingItem** (extracted items from a meeting, before apply)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| meeting_id | UUID | FK → MeetingRecap |
| section | enum | see Section Enum below |
| content | text | |
| source_quote | text | nullable, original text from meeting |
| order | integer | display order within section |
| is_deleted | boolean | soft delete for user edits |
| created_at | datetime | |
| updated_at | datetime | |

**MeetingItemDecision** (audit trail for apply decisions)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| meeting_item_id | UUID | FK → MeetingItem |
| decision | enum | added, skipped_duplicate, skipped_semantic, conflict_keep_existing, conflict_replaced, conflict_kept_both, conflict_merged |
| matched_requirement_id | UUID | nullable, FK → Requirement (for duplicates/conflicts) |
| reason | text | nullable, AI explanation |
| created_at | datetime | |

**Requirement**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| project_id | UUID | FK → Project |
| section | enum | see Section Enum below |
| content | text | |
| order | integer | display order within section |
| is_active | boolean | default true, false = soft deleted |
| created_at | datetime | |
| updated_at | datetime | |

**RequirementSource** (traceability: which meetings contributed)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| requirement_id | UUID | FK → Requirement |
| meeting_id | UUID | FK → MeetingRecap |
| meeting_item_id | UUID | nullable, FK → MeetingItem |
| source_quote | text | nullable |
| created_at | datetime | |

**RequirementHistory** (audit trail for changes)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| requirement_id | UUID | FK → Requirement |
| meeting_id | UUID | nullable, FK → MeetingRecap |
| actor | enum | system, user, ai_extraction, ai_merge |
| action | enum | created, modified, deactivated, reactivated, merged |
| old_content | text | nullable |
| new_content | text | nullable |
| created_at | datetime | |

### Section Enum
```
problems
user_goals
functional_requirements
data_needs
constraints
non_goals
risks_assumptions
open_questions
action_items
```

### Indexes
- `MeetingItem(meeting_id, section)` - fetch items by section
- `Requirement(project_id, section)` - fetch requirements by section
- `Requirement(project_id, is_active)` - fetch active requirements
- `RequirementSource(meeting_id)` - traceability queries
- `RequirementHistory(requirement_id)` - audit trail

Note: Full-text search deferred to later phase. V1 uses LIKE queries for cross-project search.

---

## Conflict Detection Logic

### Definitions

| Scenario | Example | Action | Decision Record |
|----------|---------|--------|-----------------|
| **Exact duplicate** | Same text verbatim | Auto-skip | `skipped_duplicate` |
| **Semantic duplicate** | Same meaning, different words | Auto-skip | `skipped_semantic` |
| **Refinement** | Adds detail to existing | Conflict → PM decides | `conflict_*` |
| **Contradiction** | Opposes existing | Conflict → PM decides | `conflict_*` |
| **New** | No match found | Auto-add | `added` |

### Detection Flow

1. For each `MeetingItem` extracted from meeting:
   a. Check exact match against existing `Requirement` in same section
   b. If no exact match, call LLM to classify: `duplicate`, `new`, `refinement`, or `contradiction`
   c. Record decision in `MeetingItemDecision` with reason
   d. `duplicate` → skip, record matched requirement
   e. `new` → add to requirements
   f. `refinement` or `contradiction` → add to conflicts list for PM review

### PM Resolution Options

For each conflict:
- **Keep existing**: Discard new item → `conflict_keep_existing`
- **Replace with new**: Deactivate existing, add new → `conflict_replaced`
- **Keep both**: Add new as separate requirement → `conflict_kept_both`
- **Merge**: AI suggests merged text, PM can edit before saving → `conflict_merged`

### Bulk Actions
- "Accept all new items" - add all non-conflict items immediately
- "Accept AI recommendations" - apply AI's suggested resolution for all conflicts

---

## LLM Integration

### Provider Abstraction

```
backend/app/services/llm/
├── __init__.py
├── base.py       # Abstract LLMProvider class
├── ollama.py     # Ollama implementation (primary)
├── claude.py     # Anthropic Claude implementation (fallback)
└── factory.py    # Provider selection logic
```

### Fallback Strategy

```
1. Try Ollama (localhost:11434)
   ├── Success → use response
   └── Failure → try Claude
       ├── Success → use response
       └── Failure → return error with clear message:
           - If ANTHROPIC_API_KEY missing: "Claude API key not configured"
           - If both unavailable: "No LLM available. Please start Ollama or configure Claude API key."
```

### Error Handling

| Error | Strategy |
|-------|----------|
| LLM not available | Fallback chain: Ollama → Claude → clear error message |
| Malformed output | Auto-retry once, then show error with manual retry option |
| Timeout | Auto-retry once, then show error |
| Long input | Auto-chunk, process parts, merge results |

### Chunking Strategy

For inputs exceeding context window:
1. Estimate tokens (characters / 4 as approximation)
2. Split by paragraphs/sections (preserve semantic boundaries)
3. Keep section headers with each chunk for context
4. Process each chunk independently
5. Merge extracted items, deduplicate exact matches
6. Run conflict detection on merged results

### Prompts

Stored in `backend/app/prompts/` as versioned text files:
- `extract_meeting_v1.txt` - Meeting notes → structured sections
- `classify_conflict_v1.txt` - Compare new item vs existing, classify relationship
- `suggest_merge_v1.txt` - Generate merged text for two conflicting items

Version is recorded in `MeetingRecap.prompt_version` for traceability.

### Streaming (Two-Step Job Flow)

Since SSE requires GET but file upload requires POST, use a job-based pattern:

**Step 1: Upload**
```
POST /api/meetings/upload
Content-Type: multipart/form-data

Request: { project_id, title, meeting_date, file OR text }
Response: { job_id, meeting_id }
```

**Step 2: Stream extraction**
```
GET /api/meetings/{job_id}/stream
Accept: text/event-stream

Events:
- { type: "status", data: "processing" }
- { type: "item", data: { section, content, source_quote } }
- { type: "item", data: { section, content, source_quote } }
- { type: "complete", data: { item_count } }
- { type: "error", data: { message } }
```

Frontend connects to SSE endpoint after upload, displays items as they stream in.

---

## User Interface Flow

### URL Structure

```
/                                    → Landing page (existing)
/app                                 → Projects dashboard
/app/projects/:id                    → Project dashboard
/app/projects/:id/meetings/new       → Upload meeting
/app/projects/:id/meetings/:mid      → Recap editor
/app/projects/:id/meetings/:mid/apply → Conflict resolver
/app/projects/:id/requirements       → Working requirements
```

### Key Screens

**Projects Dashboard** (`/app`)
- Card grid of all projects
- Each card: name, meeting count, last activity
- "+ New Project" card

**Project Dashboard** (`/app/projects/:id`)
- Left panel: Recent meetings with status badges (pending/processing/processed/applied/failed)
- Right panel: Requirements summary (count per section)
- Actions: "Add Meeting", "View Requirements", "Export"

**Upload Meeting** (`/app/projects/:id/meetings/new`)
- Title input
- Date picker
- Dual input: File dropzone (.txt, .md, max 50KB) OR textarea for paste
- "Process Meeting Notes" button
- On submit:
  1. POST to upload endpoint
  2. Navigate to recap editor
  3. Connect to SSE stream

**Recap Editor** (`/app/projects/:id/meetings/:mid`)
- Status indicator (processing/processed/failed)
- If processing: streaming preview, items appear as extracted
- If failed: error message + "Retry" button
- If processed: inline editor with sections
  - Each section collapsible
  - Items have edit/delete icons, drag handle for reorder
  - "+ Add item" per section
  - Empty sections show "No data found"
- "Save & Apply" button → navigate to conflict resolver

**Conflict Resolver** (`/app/projects/:id/meetings/:mid/apply`)
- Summary header: "X new items will be added, Y conflicts need review"
- Auto-added items section: list with checkmarks (informational)
- Skipped duplicates section: expandable list showing what was skipped and why
- Conflict sections (only shown if conflicts exist):
  - Each conflict card shows:
    - Existing requirement
    - New item
    - AI recommendation with reasoning
    - Options: Keep existing / Replace / Keep both / Merge
  - Merge option: shows AI-suggested merged text, editable before confirming
- Bulk actions at top: "Accept all new" / "Accept AI recommendations"
- "Apply Changes" button → updates requirements, marks meeting as applied

**Working Requirements** (`/app/projects/:id/requirements`)
- All 9 sections displayed
- Items within sections can be reordered (drag-and-drop)
- Inline editing for any item
- Source links (click to see originating meeting)
- History icon per item (shows change log with actor)
- "Export as Markdown" button

---

## Export Markdown Format

```markdown
# {Project Name} - Working Requirements

Generated: {YYYY-MM-DD}
Total meetings: {count}

---

## Problems

1. {item content}
2. {item content}

## User Goals

1. {item content}

## Functional Requirements

1. {item content}
2. {item content}

## Data Needs

1. {item content}

## Constraints

1. {item content}

## Non-Goals

1. {item content}

## Risks & Assumptions

1. {item content}

## Open Questions

1. {item content}

## Action Items

1. {item content}

---

## Sources

| Meeting | Date | Status |
|---------|------|--------|
| {title} | {YYYY-MM-DD} | Applied |
| {title} | {YYYY-MM-DD} | Applied |
```

Empty sections are included with "No items in this section." for completeness.

---

## Project Structure

```
cxpm-ai-prd/
├── ui/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/           # Button, Input, Card, Modal, FileDropzone
│   │   │   ├── projects/         # ProjectCard, ProjectForm
│   │   │   ├── meetings/         # UploadForm, StreamingPreview, RecapEditor
│   │   │   ├── requirements/     # RequirementsViewer, SectionEditor, ItemRow
│   │   │   └── conflicts/        # ConflictCard, BulkActions, ResolutionOptions, MergeEditor
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx   # Existing
│   │   │   ├── ProjectsPage.jsx
│   │   │   ├── ProjectDashboard.jsx
│   │   │   ├── UploadMeetingPage.jsx
│   │   │   ├── RecapEditorPage.jsx
│   │   │   ├── ConflictResolverPage.jsx
│   │   │   └── RequirementsPage.jsx
│   │   ├── services/
│   │   │   └── api.js            # API client with streaming support
│   │   ├── hooks/
│   │   │   └── useStreaming.js   # SSE consumption hook
│   │   ├── App.jsx               # Router setup
│   │   └── main.jsx
│   ├── tests/
│   │   ├── components/           # Component tests
│   │   └── e2e/                  # Playwright tests
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI app, CORS, routes
│   │   ├── config.py             # Settings (LLM URLs, DB path, limits)
│   │   ├── database.py           # SQLAlchemy setup
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── project.py
│   │   │   ├── meeting.py
│   │   │   ├── meeting_item.py
│   │   │   ├── meeting_item_decision.py
│   │   │   ├── requirement.py
│   │   │   ├── requirement_source.py
│   │   │   └── requirement_history.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── project.py
│   │   │   ├── meeting.py
│   │   │   └── requirement.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── projects.py
│   │   │   ├── meetings.py
│   │   │   └── requirements.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── llm/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py
│   │   │   │   ├── ollama.py
│   │   │   │   ├── claude.py
│   │   │   │   └── factory.py
│   │   │   ├── parser.py         # .txt/.md file parsing
│   │   │   ├── extractor.py      # Meeting → requirements extraction
│   │   │   ├── chunker.py        # Long input chunking
│   │   │   ├── conflict.py       # Conflict detection
│   │   │   ├── merger.py         # AI merge suggestions
│   │   │   └── exporter.py       # Markdown export
│   │   └── prompts/
│   │       ├── extract_meeting_v1.txt
│   │       ├── classify_conflict_v1.txt
│   │       └── suggest_merge_v1.txt
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py           # Fixtures
│   │   ├── test_projects.py
│   │   ├── test_meetings.py
│   │   ├── test_requirements.py
│   │   ├── test_extractor.py
│   │   ├── test_conflict.py
│   │   ├── test_merger.py
│   │   ├── test_chunker.py
│   │   └── test_streaming.py     # Streaming error/retry tests
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── pytest.ini
│
├── docs/
│   └── *.md
│
└── docker-compose.yml            # Optional: full stack
```

---

## Implementation Phases (Vertical Slices)

### Phase 1: Project Foundation
**Goal**: Create a project, see it on dashboard

**Backend**:
- [ ] Set up FastAPI app structure with CORS
- [ ] Configure SQLAlchemy + SQLite
- [ ] Set up Alembic, create initial migration
- [ ] Project model + CRUD endpoints
- [ ] pytest setup with test for project CRUD

**Frontend**:
- [ ] Set up React Router with `/app` routes
- [ ] API service with fetch wrapper
- [ ] ProjectsPage with card grid
- [ ] ProjectForm modal for create/edit
- [ ] Vitest setup with component test

**Verification**:
```bash
# Backend
cd backend && pytest tests/test_projects.py

# Frontend
cd ui && npm test

# Manual: Create project, see it in dashboard
```

### Phase 2: Meeting Upload & Storage
**Goal**: Upload meeting notes, store raw input with proper status lifecycle

**Backend**:
- [ ] MeetingRecap model with status enum + timestamps + migration
- [ ] MeetingItem model + migration
- [ ] File parser service (.txt, .md) with 50KB limit
- [ ] Meeting upload endpoint (POST, returns job_id)
- [ ] Meeting CRUD endpoints (list, get, delete)
- [ ] Tests for parser and meeting endpoints

**Frontend**:
- [ ] ProjectDashboard with meetings list and status badges
- [ ] UploadMeetingPage with dropzone (50KB limit) + textarea
- [ ] File upload handling with size validation
- [ ] Tests for upload form

**Verification**:
```bash
# Backend
pytest tests/test_meetings.py

# Manual: Upload .txt and .md files, verify stored with pending status
# Test: Upload >50KB file, verify rejection
```

### Phase 3: LLM Extraction with Streaming
**Goal**: Process meeting notes with AI, stream results via SSE

**Backend**:
- [ ] LLM base class and factory
- [ ] Ollama provider implementation
- [ ] Claude provider implementation
- [ ] Fallback logic with clear error messages
- [ ] Extractor service with streaming
- [ ] Chunking service for long inputs
- [ ] SSE endpoint (GET /meetings/{job_id}/stream)
- [ ] Status transitions: pending → processing → processed/failed
- [ ] Create prompts/extract_meeting_v1.txt
- [ ] Tests for extractor (mock LLM), chunker, streaming errors

**Frontend**:
- [ ] useStreaming hook for SSE with error handling
- [ ] StreamingPreview component
- [ ] Update UploadMeetingPage: upload → navigate → connect SSE
- [ ] Retry button for failed extractions
- [ ] Tests for streaming hook

**Verification**:
```bash
# Backend
pytest tests/test_extractor.py tests/test_chunker.py tests/test_streaming.py

# Manual: Upload meeting, watch streaming extraction
# Test: Ollama down → falls back to Claude
# Test: Both down → clear error message
# Test: Long input → chunked processing
# Test: Failed → retry works
```

### Phase 4: Recap Editor
**Goal**: Edit AI-generated recap before applying

**Backend**:
- [ ] Endpoints to update MeetingItem (edit, delete, add, reorder)
- [ ] Tests for item CRUD

**Frontend**:
- [ ] RecapEditor component with collapsible sections
- [ ] ItemRow with inline edit/delete/drag-reorder
- [ ] Add item functionality per section
- [ ] "No data found" for empty sections
- [ ] RecapEditorPage integrating streaming + editor
- [ ] Tests for editor interactions

**Verification**:
```bash
# Manual: Edit items, add items, delete items, reorder items
# Verify changes persist in MeetingItem table
```

### Phase 5: Working Requirements
**Goal**: View and edit accumulated requirements with full traceability

**Backend**:
- [ ] Requirement model with order field + migration
- [ ] RequirementSource model + migration
- [ ] RequirementHistory model with actor field + migration
- [ ] Requirements CRUD endpoints with reordering
- [ ] Markdown export service (defined format)
- [ ] Tests for requirements endpoints

**Frontend**:
- [ ] RequirementsPage with all sections
- [ ] SectionEditor component with drag-reorder
- [ ] Source links showing meeting origin
- [ ] History popover per item (shows actor + changes)
- [ ] Export button (downloads .md in specified format)
- [ ] Tests for requirements display

**Verification**:
```bash
# Backend
pytest tests/test_requirements.py

# Manual: View requirements, edit inline, reorder, export markdown
# Verify export matches specified format
```

### Phase 6: Conflict Detection & Resolution
**Goal**: Apply meeting recap with conflict handling and full audit trail

**Backend**:
- [ ] MeetingItemDecision model + migration
- [ ] Conflict detection service (exact match + LLM classification)
- [ ] Merge suggestion service
- [ ] Create prompts/classify_conflict_v1.txt
- [ ] Create prompts/suggest_merge_v1.txt
- [ ] Apply endpoint: detect conflicts, return for review
- [ ] Merge endpoint: apply PM decisions, record all decisions
- [ ] Status transition: processed → applied
- [ ] Tests for conflict detection, merge, decision recording

**Frontend**:
- [ ] ConflictResolverPage
- [ ] Summary section (auto-added, skipped duplicates, conflicts)
- [ ] ConflictCard component with resolution options
- [ ] MergeEditor: AI suggestion + editable field
- [ ] BulkActions component
- [ ] Tests for conflict UI

**Verification**:
```bash
# Backend
pytest tests/test_conflict.py tests/test_merger.py

# E2E test
cd ui && npx playwright test

# Manual scenario:
# 1. Create project
# 2. Upload meeting 1, apply (no conflicts, all added)
# 3. Upload meeting 2 with overlapping content
# 4. Verify: duplicates skipped (shown in summary), conflicts detected
# 5. Resolve conflicts: keep one, replace one, merge one
# 6. Verify requirements updated correctly
# 7. Check MeetingItemDecision has all decisions recorded
# 8. Check RequirementHistory shows changes with correct actor
```

### Phase 7: Polish & Edge Cases
**Goal**: Production-ready feature

- [ ] Loading states and error boundaries
- [ ] Empty states (no projects, no meetings, no requirements)
- [ ] Retry UI for failed LLM calls
- [ ] Mobile responsive layout
- [ ] Dashboard statistics (meeting count, requirement count per section)
- [ ] Full E2E happy path test
- [ ] Documentation update

---

## Testing Strategy

### Backend (pytest)

**Unit Tests**:
- `test_parser.py` - File parsing for .txt, .md, size limits
- `test_chunker.py` - Long input splitting with section preservation
- `test_extractor.py` - Meeting extraction (mocked LLM)
- `test_conflict.py` - Conflict classification logic, decision recording
- `test_merger.py` - Merge suggestion generation
- `test_streaming.py` - SSE error handling, retry logic, status transitions

**Integration Tests**:
- `test_projects.py` - Project CRUD API
- `test_meetings.py` - Meeting upload/retrieval/status API
- `test_requirements.py` - Requirements CRUD API with history

**Fixtures** (`conftest.py`):
- Test database (in-memory SQLite)
- Sample meeting text (short and long)
- Mock LLM responses
- Pre-populated project with requirements (for conflict testing)

### Frontend (Vitest + React Testing Library)

**Component Tests**:
- ProjectCard renders correctly
- UploadForm handles file drop, enforces size limit
- RecapEditor allows inline editing, reordering
- ConflictCard shows resolution options
- MergeEditor displays AI suggestion, allows editing

### E2E (Playwright)

**Happy Path Test**:
1. Navigate to /app
2. Create new project
3. Upload meeting notes
4. Wait for streaming to complete
5. Edit one item, reorder another
6. Apply to requirements (no conflicts)
7. Verify requirements appear with correct source
8. Upload second meeting with duplicate
9. Verify duplicate skipped, shown in summary
10. Export markdown, verify format

---

## Dependencies

### Backend (requirements.txt)
```
# Core
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
sqlalchemy>=2.0.0
alembic>=1.13.0
pydantic>=2.0.0
pydantic-settings>=2.0.0

# File handling
python-multipart>=0.0.6

# LLM
httpx>=0.26.0
anthropic>=0.18.0

# Streaming
sse-starlette>=1.8.0

# Export
markdown>=3.5.0

# Testing
pytest>=8.0.0
pytest-asyncio>=0.23.0
```

### Frontend (package.json additions)
```json
{
  "dependencies": {
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "vitest": "^1.2.0",
    "@testing-library/react": "^14.2.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@playwright/test": "^1.41.0"
  }
}
```

---

## Configuration

### Backend (`config.py`)
```python
class Settings:
    DATABASE_URL: str = "sqlite:///./cxpm.db"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    ANTHROPIC_API_KEY: str | None = None
    LLM_TIMEOUT: int = 60
    LLM_MAX_RETRIES: int = 1
    MAX_FILE_SIZE_KB: int = 50
    CHUNK_SIZE_CHARS: int = 4000  # ~1000 tokens
```

### Environment Variables
```bash
# .env (optional, for Claude fallback)
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Verification Checklist

### Per-Phase Verification
Each phase must pass before moving to next:
- [ ] All backend tests pass
- [ ] All frontend tests pass
- [ ] Manual verification of feature
- [ ] No regressions in previous features

### Final E2E Scenario
1. Create project "Mobile App Redesign"
2. Upload meeting 1 (initial requirements) → streams, shows in editor
3. Edit some items, reorder within section
4. Apply → creates Working Requirements, all recorded as `added`
5. Verify RequirementSource links to meeting
6. Upload meeting 2 (some overlapping content)
7. Apply → detects conflicts:
   - Exact duplicate → skipped, shown in summary
   - Semantic duplicate → skipped, shown with AI reason
   - New items → auto-added
   - Conflicts → PM resolves
8. Resolve: keep one, replace one, merge one
9. Verify MeetingItemDecision has all decisions
10. Verify RequirementHistory shows all changes with correct actor
11. Export as Markdown
12. Verify export matches specified format with all sections

### Ollama Setup
```bash
# Linux/Mac
curl -fsSL https://ollama.com/install.sh | sh

# Windows: Download from https://ollama.com/download

# Pull recommended model
ollama pull llama3

# Verify running
curl http://localhost:11434/api/tags
```
