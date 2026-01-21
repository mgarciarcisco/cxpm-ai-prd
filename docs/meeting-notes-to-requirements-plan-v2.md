# Meeting Notes to Requirements - Feature Design & Implementation Plan (v2)

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
| Storage | SQLite with SQLAlchemy ORM, normalized schema |
| Backend | Python + FastAPI |
| AI Response UX | Streaming with SSE |
| Editing UX | Inline editing (Notion-style) |
| Conflict Resolution | Conflict-only view with bulk actions |
| Navigation | Landing at `/`, app at `/app/*` |
| Development Style | Vertical slices (full features end-to-end) |
| Testing | Solid from day one (pytest, Vitest, Playwright) |
| DB Migrations | Alembic from day one |

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

## Data Model (Normalized)

### Tables

**Project**
- id (UUID, PK)
- name (string)
- description (text, nullable)
- created_at (datetime)
- updated_at (datetime)

**MeetingRecap**
- id (UUID, PK)
- project_id (FK → Project)
- title (string)
- meeting_date (date)
- raw_input (text)
- input_type (enum: txt, md)
- applied_status (boolean, default false)
- created_at (datetime)

**Requirement**
- id (UUID, PK)
- project_id (FK → Project)
- section (enum: problems, user_goals, functional_requirements, data_needs, constraints, non_goals, risks_assumptions, open_questions, action_items)
- content (text)
- is_active (boolean, default true)
- created_at (datetime)
- updated_at (datetime)

**RequirementSource**
- id (UUID, PK)
- requirement_id (FK → Requirement)
- meeting_id (FK → MeetingRecap)
- source_quote (text, nullable)
- created_at (datetime)

**RequirementHistory**
- id (UUID, PK)
- requirement_id (FK → Requirement)
- meeting_id (FK → MeetingRecap, nullable)
- action (enum: created, modified, deactivated, reactivated)
- old_content (text, nullable)
- new_content (text, nullable)
- created_at (datetime)

### Indexes
- `Requirement(project_id, section)` - for fetching requirements by section
- `Requirement(content)` - full-text search for cross-project queries
- `RequirementSource(meeting_id)` - for traceability queries
- `RequirementHistory(requirement_id)` - for audit trail

---

## Conflict Detection Logic

### Definitions

| Scenario | Example | Action |
|----------|---------|--------|
| **Exact duplicate** | Existing: "Users can reset password via email" / New: "Users can reset password via email" | Auto-skip |
| **Semantic duplicate** | Existing: "Users can reset password via email" / New: "Password reset should work through email links" | Auto-skip |
| **Refinement** | Existing: "Users can reset password via email" / New: "Password reset emails must expire after 24 hours" | Conflict → PM decides |
| **Contradiction** | Existing: "Password reset via email" / New: "Password reset via SMS only" | Conflict → PM decides |

### Detection Flow

1. For each new item extracted from meeting:
   a. Compare against all existing requirements in same section
   b. LLM classifies as: `duplicate`, `refinement`, `contradiction`, or `new`
   c. `duplicate` → skip silently
   d. `new` → auto-add to requirements
   e. `refinement` or `contradiction` → add to conflicts list for PM review

### PM Resolution Options

For each conflict:
- **Keep existing**: Discard new item
- **Replace with new**: Deactivate existing, add new
- **Keep both**: Add new as separate requirement
- **Merge**: Edit and save combined version

### Bulk Actions
- "Accept all new items" - add all non-conflict items
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
       └── Failure → return error "Please configure an LLM provider"
```

### Error Handling

| Error | Strategy |
|-------|----------|
| LLM not available | Fallback chain: Ollama → Claude → error message |
| Malformed output | Auto-retry once, then show error with manual retry option |
| Timeout | Auto-retry once, then show error |
| Long input | Auto-chunk, process parts, merge results |

### Chunking Strategy

For inputs exceeding context window:
1. Split by paragraphs/sections (preserve semantic boundaries)
2. Process each chunk independently
3. Merge extracted items, deduplicate
4. Run conflict detection on merged results

### Prompts

Stored in `backend/app/prompts/` as text files:
- `extract_meeting.txt` - Meeting notes → structured sections
- `classify_conflict.txt` - Compare new item vs existing, classify relationship

### Streaming

- Backend: FastAPI with `sse-starlette` for Server-Sent Events
- Frontend: EventSource API
- Format: JSON chunks with section/item data as extracted

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
- Left panel: Recent meetings with applied/pending badges
- Right panel: Requirements summary (count per section)
- Actions: "Add Meeting", "View Requirements", "Export"

**Upload Meeting** (`/app/projects/:id/meetings/new`)
- Title input
- Date picker
- Dual input: File dropzone (.txt, .md) OR textarea for paste
- "Process Meeting Notes" button
- On submit: navigate to recap editor with streaming

**Recap Editor** (`/app/projects/:id/meetings/:mid`)
- Streaming preview while processing
- On complete: inline editor with sections
- Each section collapsible
- Items have edit/delete icons
- "+ Add item" per section
- Empty sections show "No data found"
- "Save & Apply" button → navigate to conflict resolver

**Conflict Resolver** (`/app/projects/:id/meetings/:mid/apply`)
- Summary header: "X new items, Y conflicts"
- Non-conflict items: listed with checkmarks, auto-added
- Conflict sections only shown if conflicts exist
- Each conflict shows:
  - Existing requirement
  - New item
  - AI recommendation
  - Options: Keep existing / Replace / Keep both / Merge
- Bulk actions at top: "Accept all new" / "Accept AI recommendations"
- "Apply Changes" button → updates requirements, marks meeting as applied

**Working Requirements** (`/app/projects/:id/requirements`)
- All 9 sections displayed
- Inline editing for any item
- Source links (click to see originating meeting)
- History icon per item (shows change log)
- "Export as Markdown" button

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
│   │   │   └── conflicts/        # ConflictCard, BulkActions, ResolutionOptions
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
│   │   ├── config.py             # Settings (LLM URLs, DB path)
│   │   ├── database.py           # SQLAlchemy setup
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── project.py
│   │   │   ├── meeting.py
│   │   │   ├── requirement.py
│   │   │   └── history.py
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
│   │   │   └── exporter.py       # Markdown export
│   │   └── prompts/
│   │       ├── extract_meeting.txt
│   │       └── classify_conflict.txt
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py           # Fixtures
│   │   ├── test_projects.py
│   │   ├── test_meetings.py
│   │   ├── test_requirements.py
│   │   ├── test_extractor.py
│   │   ├── test_conflict.py
│   │   └── test_chunker.py
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
**Goal**: Upload meeting notes, store raw input

**Backend**:
- [ ] MeetingRecap model + migration
- [ ] File parser service (.txt, .md)
- [ ] Meeting CRUD endpoints (upload, list, get)
- [ ] Tests for parser and meeting endpoints

**Frontend**:
- [ ] ProjectDashboard with meetings list
- [ ] UploadMeetingPage with dropzone + textarea
- [ ] File upload handling
- [ ] Tests for upload form

**Verification**:
```bash
# Backend
pytest tests/test_meetings.py

# Manual: Upload .txt and .md files, verify stored
```

### Phase 3: LLM Extraction with Streaming
**Goal**: Process meeting notes with AI, stream results

**Backend**:
- [ ] LLM base class and factory
- [ ] Ollama provider implementation
- [ ] Claude provider implementation
- [ ] Fallback logic
- [ ] Extractor service with streaming
- [ ] Chunking service for long inputs
- [ ] SSE endpoint for extraction
- [ ] Create prompts/extract_meeting.txt
- [ ] Tests for extractor (mock LLM)

**Frontend**:
- [ ] useStreaming hook for SSE
- [ ] StreamingPreview component
- [ ] Update UploadMeetingPage to show streaming results
- [ ] Tests for streaming hook

**Verification**:
```bash
# Backend
pytest tests/test_extractor.py tests/test_chunker.py

# Manual: Upload meeting, watch streaming extraction
# Test: Ollama down → falls back to Claude
# Test: Long input → chunked processing
```

### Phase 4: Recap Editor
**Goal**: Edit AI-generated recap before applying

**Backend**:
- [ ] Endpoint to update meeting sections (temp storage before apply)

**Frontend**:
- [ ] RecapEditor component with collapsible sections
- [ ] ItemRow with inline edit/delete
- [ ] Add item functionality per section
- [ ] RecapEditorPage integrating streaming + editor
- [ ] Tests for editor interactions

**Verification**:
```bash
# Manual: Edit items, add items, delete items
# Verify changes persist in recap
```

### Phase 5: Working Requirements
**Goal**: View and edit accumulated requirements

**Backend**:
- [ ] Requirement model + migration
- [ ] RequirementSource model + migration
- [ ] RequirementHistory model + migration
- [ ] Requirements CRUD endpoints
- [ ] Markdown export service
- [ ] Tests for requirements endpoints

**Frontend**:
- [ ] RequirementsPage with all sections
- [ ] SectionEditor component
- [ ] Source links showing meeting origin
- [ ] History popover per item
- [ ] Export button (downloads .md)
- [ ] Tests for requirements display

**Verification**:
```bash
# Backend
pytest tests/test_requirements.py

# Manual: View requirements, edit inline, export markdown
```

### Phase 6: Conflict Detection & Resolution
**Goal**: Apply meeting recap with conflict handling

**Backend**:
- [ ] Conflict detection service
- [ ] Create prompts/classify_conflict.txt
- [ ] Apply endpoint (detect conflicts, return for review)
- [ ] Merge endpoint (apply PM decisions)
- [ ] Tests for conflict detection

**Frontend**:
- [ ] ConflictResolverPage
- [ ] ConflictCard component
- [ ] ResolutionOptions (keep/replace/both/merge)
- [ ] BulkActions component
- [ ] Tests for conflict UI

**Verification**:
```bash
# Backend
pytest tests/test_conflict.py

# E2E test
cd ui && npx playwright test

# Manual scenario:
# 1. Create project
# 2. Upload meeting 1, apply (no conflicts)
# 3. Upload meeting 2 with overlapping content
# 4. Verify conflicts detected
# 5. Resolve conflicts, verify requirements updated
# 6. Check history shows changes
```

### Phase 7: Polish & Edge Cases
**Goal**: Production-ready feature

- [ ] Loading states and error boundaries
- [ ] Empty states (no projects, no meetings)
- [ ] Retry UI for failed LLM calls
- [ ] Mobile responsive layout
- [ ] Dashboard statistics (meeting count, requirement count)
- [ ] Full E2E happy path test
- [ ] Documentation update

---

## Testing Strategy

### Backend (pytest)

**Unit Tests**:
- `test_parser.py` - File parsing for .txt, .md
- `test_chunker.py` - Long input splitting
- `test_extractor.py` - Meeting extraction (mocked LLM)
- `test_conflict.py` - Conflict classification logic

**Integration Tests**:
- `test_projects.py` - Project CRUD API
- `test_meetings.py` - Meeting upload/retrieval API
- `test_requirements.py` - Requirements CRUD API

**Fixtures** (`conftest.py`):
- Test database (in-memory SQLite)
- Sample meeting text
- Mock LLM responses

### Frontend (Vitest + React Testing Library)

**Component Tests**:
- ProjectCard renders correctly
- UploadForm handles file drop
- RecapEditor allows inline editing
- ConflictCard shows resolution options

### E2E (Playwright)

**Happy Path Test**:
1. Navigate to /app
2. Create new project
3. Upload meeting notes
4. Wait for streaming to complete
5. Edit one item
6. Apply to requirements
7. Verify requirement appears
8. Export markdown

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
httpx>=0.26.0
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
    ANTHROPIC_API_KEY: str | None = None  # Optional, for Claude fallback
    LLM_TIMEOUT: int = 60
    LLM_MAX_RETRIES: int = 1
    CHUNK_SIZE: int = 4000  # Characters per chunk
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
2. Upload meeting 1 (initial requirements)
3. Apply → creates Working Requirements
4. Upload meeting 2 (some overlapping content)
5. Apply → detects conflicts
6. Resolve: keep one, replace one, merge one
7. Verify history shows all changes
8. Export as Markdown
9. Verify export contains all requirements with proper formatting

### Ollama Setup
```bash
# Install Ollama (if not installed)
curl -fsSL https://ollama.com/install.sh | sh

# Pull recommended model
ollama pull llama3

# Verify running
curl http://localhost:11434/api/tags
```
