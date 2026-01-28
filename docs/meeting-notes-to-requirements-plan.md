# Meeting Notes to Requirements - Feature Design & Implementation Plan

## Overview

Build the first feature of CXPM AI PRD: converting meeting notes into structured requirements that accumulate over time into a coherent Working Requirements document.

**Core Concept** (from stakeholder spec):
- **Meeting Recaps**: Immutable, point-in-time snapshots of what was discussed
- **Working Requirements**: A living, AI-assisted draft representing current understanding
- **PM Control**: No automatic overwrites; conflicts require human decision

---

## Key Decisions

| Aspect | Decision |
|--------|----------|
| Input Sources | Mix of transcripts, AI summaries, manual notes |
| AI Backend | Ollama (local, primary) + pluggable for Claude/OpenAI |
| Storage | SQLite with SQLAlchemy ORM (easy PostgreSQL migration later) |
| Backend | Python + FastAPI |
| Input Method | File upload (.txt, .docx, .pdf, .md, .rtf) + copy-paste |
| AI Response UX | Streaming with preview, then editable view |
| Editing UX | Inline editing (Notion-style) |
| Conflict Resolution | Section-by-section wizard |
| Collaboration | Single PM per project |
| Auth | Simple email/password login with JWT |
| Projects | Flexible/user-defined (PM decides what a project means) |
| Exports | Markdown, PDF, Word + seamless PRD handoff |
| Change Log | Item-level tracking |
| Empty Sections | AI explains absence |
| Navigation | Dashboard-first (Projects → Project Dashboard → Features) |
| V1 Priority | Workflow polish over AI perfection |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Projects │  │ Meeting  │  │ Working  │  │   Apply      │ │
│  │ Dashboard│  │  Recap   │  │   Reqs   │  │   Wizard     │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API + SSE (streaming)
┌────────────────────────┴────────────────────────────────────┐
│                    FastAPI Backend                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │   Auth   │  │ File     │  │   LLM    │  │  Merge       │ │
│  │  Module  │  │ Parser   │  │ Service  │  │  Engine      │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│  SQLite DB (SQLAlchemy)     │     LLM (Ollama/OpenAI/Claude)│
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Tables

**User**
- id, email, password_hash, created_at

**Project**
- id, user_id (FK), name, description, created_at

**MeetingRecap**
- id, project_id (FK), title, meeting_date, raw_input, input_type
- sections (JSON), applied_status (boolean), created_at

**WorkingRequirements** (1:1 with Project)
- id, project_id (FK), sections (JSON), updated_at

**ChangeLogEntry**
- id, working_req_id (FK), meeting_id (FK), section, action (added/modified/removed)
- item_content, created_at

### Sections Structure (JSON)
Both MeetingRecap and WorkingRequirements use this structure:
```json
{
  "problems": [{"id": "uuid", "content": "...", "source_quote": "..."}],
  "user_goals": [...],
  "functional_requirements": [...],
  "data_needs": [...],
  "constraints": [...],
  "non_goals": [...],
  "risks_assumptions": [...],
  "open_questions": [...],
  "action_items": [...]
}
```

---

## User Interface Flow

### Navigation Hierarchy
1. **My Projects** → Card view of all projects
2. **Project Dashboard** → Meetings list + Working Requirements summary
3. **Upload Meeting** → File upload or paste + process
4. **Review Recap** → Streaming preview → Inline editor
5. **Apply Wizard** → Section-by-section conflict resolution
6. **Working Requirements** → Full view/edit + export

### Key Pages

**My Projects Page**
- Card grid showing all projects
- Each card: project name, meeting count, last activity
- "+ New Project" card

**Project Dashboard**
- Left: Recent meetings with applied/not-applied status
- Right: Working Requirements summary with section counts
- Actions: Add Meeting, View Full Requirements, Export

**Upload Meeting Page**
- Title and date inputs
- Dual input: File dropzone OR textarea
- "Process Meeting Notes" button

**Streaming Preview → Recap Editor**
- AI output streams into preview pane
- On complete: transitions to inline editor
- Each section collapsible with items
- Items have edit/delete icons, "+ Add item" per section
- Empty sections show AI explanation

**Apply Wizard**
- Progress bar showing current section (1 of 8)
- Section name header
- "New Items to Add" with checkboxes
- "Possible Conflicts" with keep/replace/merge options
- Previous/Next section navigation
- Final review before applying

---

## LLM Integration

### Provider Abstraction
```
backend/app/services/llm/
├── base.py       # Abstract LLMProvider class
├── ollama.py     # Ollama implementation (default)
├── openai.py     # OpenAI implementation
└── claude.py     # Anthropic implementation
```

### Configurable Prompts
Stored in `backend/app/prompts/` as text files for easy iteration:
- `extract_meeting.txt` - Meeting notes → structured sections
- `detect_conflicts.txt` - Compare new vs existing items

### Streaming
- Backend: FastAPI StreamingResponse with SSE
- Frontend: EventSource API to consume stream

---

## Project Structure

```
cxpm-ai-prd/
├── ui/src/
│   ├── components/
│   │   ├── common/          # Button, Input, Card, Modal
│   │   ├── auth/            # LoginForm, RegisterForm
│   │   ├── projects/        # ProjectCard, ProjectForm
│   │   ├── meetings/        # UploadForm, RecapViewer, RecapEditor
│   │   ├── requirements/    # RequirementsViewer, SectionEditor
│   │   └── wizard/          # WizardStep, ConflictResolver
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── ProjectsPage.jsx
│   │   ├── ProjectDashboard.jsx
│   │   ├── UploadMeetingPage.jsx
│   │   ├── RecapEditorPage.jsx
│   │   ├── RequirementsPage.jsx
│   │   └── ApplyWizardPage.jsx
│   ├── services/api.js
│   ├── context/AuthContext.jsx
│   └── App.jsx
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── routers/         # API routes
│   │   ├── services/
│   │   │   ├── llm/         # Provider implementations
│   │   │   ├── parser.py    # File parsing
│   │   │   ├── extractor.py # Meeting extraction
│   │   │   └── merger.py    # Conflict detection
│   │   └── prompts/         # Editable prompt templates
│   ├── requirements.txt
│   └── alembic/             # DB migrations
│
└── docker-compose.yml       # Optional: full stack
```

---

## Implementation Phases

### Phase 1: Foundation
**Goal**: Backend skeleton with auth
- [ ] Create `backend/` directory structure
- [ ] Set up FastAPI with SQLAlchemy + SQLite
- [ ] Implement User model and auth routes (register, login, JWT)
- [ ] Create basic Pydantic schemas
- [ ] Test auth endpoints with curl/Postman

**Files to create**:
- `backend/app/main.py`
- `backend/app/config.py`
- `backend/app/models/user.py`
- `backend/app/schemas/user.py`
- `backend/app/routers/auth.py`
- `backend/requirements.txt`

### Phase 2: Projects & Meetings CRUD
**Goal**: Basic data management without AI
- [ ] Project and MeetingRecap models
- [ ] CRUD endpoints for projects
- [ ] CRUD endpoints for meetings (store raw input only)
- [ ] React: Login/Register pages
- [ ] React: Projects list page
- [ ] React: Project dashboard (basic)
- [ ] File upload endpoint (store file, no processing)

**Files to create/modify**:
- `backend/app/models/project.py`, `meeting.py`
- `backend/app/routers/projects.py`, `meetings.py`
- `ui/src/pages/LoginPage.jsx`, `ProjectsPage.jsx`, `ProjectDashboard.jsx`
- `ui/src/context/AuthContext.jsx`
- `ui/src/services/api.js`

### Phase 3: LLM Integration
**Goal**: AI-powered meeting extraction with streaming
- [ ] LLM provider abstraction (base class)
- [ ] Ollama provider implementation
- [ ] File parser service (txt, docx, pdf, md, rtf)
- [ ] Meeting extraction service
- [ ] Streaming endpoint for extraction
- [ ] React: Upload page with file/paste input
- [ ] React: Streaming preview component

**Files to create**:
- `backend/app/services/llm/base.py`, `ollama.py`
- `backend/app/services/parser.py`
- `backend/app/services/extractor.py`
- `backend/app/prompts/extract_meeting.txt`
- `ui/src/pages/UploadMeetingPage.jsx`
- `ui/src/components/meetings/StreamingPreview.jsx`

### Phase 4: Recap Editor
**Goal**: Inline editing of AI-generated recap
- [ ] Section-based inline editor component
- [ ] Add/edit/delete item functionality
- [ ] AI absence explanation display
- [ ] Save recap endpoint (update sections)
- [ ] React: Full recap editor page

**Files to create/modify**:
- `ui/src/components/meetings/RecapEditor.jsx`
- `ui/src/components/meetings/SectionEditor.jsx`
- `ui/src/components/meetings/ItemEditor.jsx`
- `ui/src/pages/RecapEditorPage.jsx`

### Phase 5: Working Requirements
**Goal**: Rolling requirements document
- [ ] WorkingRequirements model
- [ ] CRUD endpoints for requirements
- [ ] Export service (Markdown, PDF, Word)
- [ ] React: Requirements viewer/editor page
- [ ] Export download functionality

**Files to create**:
- `backend/app/models/requirements.py`
- `backend/app/routers/requirements.py`
- `backend/app/services/exporter.py`
- `ui/src/pages/RequirementsPage.jsx`

### Phase 6: Apply Wizard
**Goal**: Merge meeting recap into working requirements
- [ ] Conflict detection service
- [ ] ChangeLogEntry model
- [ ] Apply endpoint with merge logic
- [ ] React: Wizard step component
- [ ] React: Conflict resolver component
- [ ] React: Full wizard page with section navigation

**Files to create**:
- `backend/app/services/merger.py`
- `backend/app/prompts/detect_conflicts.txt`
- `backend/app/models/changelog.py`
- `ui/src/components/wizard/WizardStep.jsx`
- `ui/src/components/wizard/ConflictResolver.jsx`
- `ui/src/pages/ApplyWizardPage.jsx`

### Phase 7: Polish & Integration
**Goal**: Production-ready feature
- [ ] Dashboard statistics and visualizations
- [ ] Change log viewer
- [ ] PRD feature handoff (pass requirements as input)
- [ ] Error handling and loading states
- [ ] Mobile responsive design
- [ ] OpenAI and Claude provider implementations

---

## Verification Plan

### Backend Testing
```bash
# Start backend
cd backend && uvicorn app.main:app --reload

# Test auth
curl -X POST http://localhost:8000/auth/register -d '{"email":"test@example.com","password":"test123"}'
curl -X POST http://localhost:8000/auth/login -d '{"email":"test@example.com","password":"test123"}'

# Test projects CRUD
curl -X POST http://localhost:8000/projects -H "Authorization: Bearer {token}" -d '{"name":"Test Project"}'
curl http://localhost:8000/projects -H "Authorization: Bearer {token}"

# Test meeting upload and extraction
curl -X POST http://localhost:8000/meetings -H "Authorization: Bearer {token}" -F "file=@meeting.txt"
```

### Frontend Testing
```bash
# Start frontend
cd ui && npm run dev

# Manual testing flow:
1. Register new user
2. Create a project
3. Upload meeting notes (file or paste)
4. Verify streaming extraction works
5. Edit the generated recap
6. Apply to working requirements
7. Verify conflict resolution works
8. Export requirements in different formats
```

### End-to-End Scenario
1. Create project "Mobile App Redesign"
2. Upload 3 different meeting notes
3. Apply first meeting → creates initial Working Requirements
4. Apply second meeting → test new items added
5. Apply third meeting → test conflict resolution
6. Verify change log shows all changes
7. Export as Markdown and verify content

### Ollama Setup (if not installed)
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model (recommended: llama3 or mistral)
ollama pull llama3

# Verify running
ollama list
```

---

## Dependencies

### Backend (requirements.txt)
```
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
sqlalchemy>=2.0.0
pydantic>=2.0.0
python-jose[cryptography]>=3.3.0  # JWT
passlib[bcrypt]>=1.7.0            # Password hashing
python-multipart>=0.0.6           # File uploads
python-docx>=1.0.0                # .docx parsing
pypdf>=3.0.0                      # PDF parsing
markdown>=3.5.0                   # Markdown export
reportlab>=4.0.0                  # PDF export
httpx>=0.26.0                     # Async HTTP for Ollama
sse-starlette>=1.8.0              # Server-sent events
```

### Frontend (additional to existing)
```
react-router-dom                  # Routing
```
