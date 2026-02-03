# CXPM AI PRD

CX AI Assistant for Product Management — An AI-powered application that helps Product Managers create PRDs.

## Quick Start (Docker Required)

This application runs in Docker containers for consistent development across all platforms.

### Prerequisites

1. **Install Docker Desktop**: https://www.docker.com/products/docker-desktop/
2. **Configure LLM credentials**: Copy `backend/.env.example` to `backend/.env` and add your Circuit API keys:
   ```env
   CIRCUIT_CLIENT_ID=your-client-id
   CIRCUIT_CLIENT_SECRET=your-client-secret
   CIRCUIT_APP_KEY=your-app-key
   ```

### Start the Application

**Windows (PowerShell):**
```powershell
.\start_dev.ps1
```

**macOS/Linux:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000

### Common Commands

| Command | Windows | macOS/Linux |
|---------|---------|-------------|
| Start | `.\start_dev.ps1` | `docker-compose -f docker-compose.dev.yml up -d` |
| Stop | `.\start_dev.ps1 -Stop` | `docker-compose -f docker-compose.dev.yml down` |
| View logs | `.\start_dev.ps1 -Logs` | `docker-compose -f docker-compose.dev.yml logs -f` |
| Restart | `.\start_dev.ps1 -Restart` | `docker-compose -f docker-compose.dev.yml restart` |
| Rebuild | `.\start_dev.ps1 -Build` | `docker-compose -f docker-compose.dev.yml up --build -d` |

### Development Features

- **Hot-reloading**: Code changes in `ui/src/` and `backend/app/` apply automatically
- **Database persistence**: SQLite database persists across container restarts
- **LLM fallback**: Uses Circuit (Cisco AI) if configured, falls back to Ollama

### Production Deployment

For production deployment with Nginx and Ollama:

```bash
docker-compose up --build -d
```

For detailed Docker documentation, see [DOCKER.md](DOCKER.md)

---

## Production Deployment

### Prerequisites

- Access to the production VM (AlmaLinux)
- SSH key: `cxpm-ai-prd-key`
- VM IP: `10.226.185.129`

### Step 1: Build the Production Bundle

On your local machine (Windows):

```powershell
cd ui
npm run build
```

This creates optimized static files in `ui/dist/`.

### Step 2: Copy Files to VM

```powershell
scp -i cxpm-ai-prd-key -r ui/dist/* root@10.226.185.129:/var/www/cxpm-ai-prd/
```

### Step 3: Fix Permissions on VM

SSH into the VM:

```powershell
ssh -i cxpm-ai-prd-key root@10.226.185.129
```

Then run:

```bash
# Fix SELinux context
restorecon -Rv /var/www/cxpm-ai-prd

# Ensure proper ownership
chown -R nginx:nginx /var/www/cxpm-ai-prd

# Restart nginx
systemctl restart nginx
```

### Step 4: Verify Deployment

Visit: **http://10.226.185.129**

---

## First-Time VM Setup

If setting up a fresh AlmaLinux VM for the first time:

### 1. Install Nginx

```bash
dnf update -y
dnf install -y epel-release
dnf install -y nginx policycoreutils-python-utils
```

### 2. Create App Directory

```bash
mkdir -p /var/www/cxpm-ai-prd
```

### 3. Configure Nginx

Create `/etc/nginx/conf.d/cxpm-ai-prd.conf`:

```bash
cat > /etc/nginx/conf.d/cxpm-ai-prd.conf << 'EOF'
server {
    listen 80;
    server_name _;
    
    root /var/www/cxpm-ai-prd;
    index index.html;
    
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
```

### 4. Configure SELinux

```bash
semanage fcontext -a -t httpd_sys_content_t "/var/www/cxpm-ai-prd(/.*)?"
restorecon -Rv /var/www/cxpm-ai-prd
chown -R nginx:nginx /var/www/cxpm-ai-prd
chmod -R 755 /var/www/cxpm-ai-prd
```

### 5. Start Nginx

```bash
nginx -t
systemctl enable nginx
systemctl start nginx
```

---

## Project Structure

```
cxpm-ai-prd/
├── backend/                         # FastAPI application
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── config.py               # Settings (pydantic-settings)
│   │   ├── database.py             # SQLAlchemy engine, Session, Base
│   │   ├── models/                 # SQLAlchemy models
│   │   │   ├── project.py          # Project model
│   │   │   ├── meeting_recap.py    # MeetingRecap model
│   │   │   ├── meeting_item.py     # MeetingItem model
│   │   │   ├── requirement.py      # Requirement model
│   │   │   ├── requirement_source.py    # RequirementSource model
│   │   │   └── requirement_history.py   # RequirementHistory model
│   │   ├── schemas/                # Pydantic schemas
│   │   │   ├── project.py          # Project request/response schemas
│   │   │   ├── meeting.py          # Meeting request/response schemas
│   │   │   └── requirement.py      # Requirement request/response schemas
│   │   ├── routers/                # API route handlers
│   │   │   ├── projects.py         # /api/projects endpoints
│   │   │   ├── meetings.py         # /api/meetings endpoints
│   │   │   ├── meeting_items.py    # /api/meeting-items endpoints
│   │   │   └── requirements.py     # /api/requirements endpoints
│   │   └── services/               # Business logic
│   │       ├── parser.py           # File parsing service
│   │       ├── chunker.py          # Text chunking service
│   │       ├── extractor.py        # LLM extraction service
│   │       ├── merger.py           # Requirement merging service
│   │       ├── markdown_export.py  # Markdown export service
│   │       └── llm/                # LLM providers
│   │           ├── base.py         # Abstract LLMProvider
│   │           ├── ollama.py       # Ollama provider
│   │           ├── circuit.py      # Circuit (Cisco AI) provider
│   │           └── factory.py      # Provider factory with fallback
│   ├── prompts/                    # LLM prompt templates
│   │   └── extract_meeting_v1.txt  # Extraction prompt
│   ├── alembic/                    # Database migrations
│   ├── tests/                      # Backend tests
│   └── requirements.txt            # Python dependencies
├── ui/                              # React application
│   ├── src/
│   │   ├── main.jsx                # Entry point (BrowserRouter)
│   │   ├── App.jsx                 # Routes configuration
│   │   ├── pages/                  # Page components
│   │   │   ├── LandingPage.jsx     # Home page
│   │   │   ├── ProjectsPage.jsx    # Project list
│   │   │   ├── ProjectDashboard.jsx # Project detail with meetings
│   │   │   ├── UploadMeetingPage.jsx # Upload meeting notes
│   │   │   ├── RecapEditorPage.jsx  # View/edit extracted items
│   │   │   └── ApplyPage.jsx       # Conflict resolution
│   │   ├── components/             # Reusable components
│   │   │   ├── common/             # Shared components
│   │   │   │   ├── Modal.jsx       # Modal dialog
│   │   │   │   ├── FileDropzone.jsx # File upload dropzone
│   │   │   │   ├── StatusBadge.jsx # Status badge
│   │   │   │   ├── CollapsibleSection.jsx
│   │   │   │   └── ItemRow.jsx     # Editable item row
│   │   │   ├── projects/           # Project components
│   │   │   │   ├── ProjectCard.jsx
│   │   │   │   └── ProjectForm.jsx
│   │   │   └── meetings/           # Meeting components
│   │   │       ├── MeetingsList.jsx
│   │   │       ├── StreamingPreview.jsx
│   │   │       └── RecapEditor.jsx
│   │   ├── hooks/                  # React hooks
│   │   │   └── useStreaming.js     # SSE streaming hook
│   │   └── services/               # API services
│   │       └── api.js              # HTTP client wrapper
│   ├── tests/                      # Frontend tests
│   ├── package.json                # npm dependencies
│   └── vite.config.js              # Vite configuration
├── Dockerfile                       # Docker image definition
├── docker-compose.yml               # Docker Compose configuration
├── .dockerignore                    # Docker ignore patterns
├── deploy_to_vm.sh                  # Deployment script
└── README.md                        # This file
```

## Docker Management

### View logs:
```bash
docker-compose logs -f
# or
docker logs -f cxpm-ai-prd-app
```

### Stop the container:
```bash
docker-compose down
# or
docker stop cxpm-ai-prd-app
```

### Restart the container:
```bash
docker-compose restart
# or
docker restart cxpm-ai-prd-app
```

### Access container shell:
```bash
docker-compose exec cxpm-ai-prd /bin/bash
# or
docker exec -it cxpm-ai-prd-app /bin/bash
```

## Technology Stack

- **Backend:** FastAPI (Python 3)
- **Database:** SQLite (SQLAlchemy ORM, Alembic migrations)
- **LLM:** Circuit (Cisco AI) / Ollama (local fallback)
- **Frontend:** React 18.3.1
- **Build Tool:** Vite 6.0.5
- **Testing:** pytest (backend), Vitest (frontend)
- **Web Server:** Nginx (production)
- **Server OS:** AlmaLinux

## Features

- Convert Meeting Notes to Requirements
- Generate PRD (v0)
- Generate Epics & Jira Tickets
- Recommend Features from Feedback
- Generate CX / AI Assistant Mockups

---

## Meeting Notes to Requirements Feature

This feature allows users to upload meeting notes and automatically extract structured requirements using AI (LLM-powered extraction).

### User Flow

1. **Upload** - Upload a meeting notes file (.txt or .md, max 50KB) or paste text directly
2. **Extract** - AI processes the meeting notes and extracts structured items into 9 categories:
   - Problems
   - User Goals
   - Functional Requirements
   - Data Needs
   - Constraints
   - Non-Goals
   - Risks & Assumptions
   - Open Questions
   - Action Items
3. **Edit** - Review extracted items in the Recap Editor:
   - Edit item content inline
   - Delete items (soft-delete)
   - Add new items to any section
   - Drag-and-drop to reorder items within sections
4. **Apply** - Apply reviewed items to the Working Requirements document:
   - AI suggests merges with existing requirements
   - Review and resolve conflicts
   - Confirm or reject suggested changes
5. **View** - View the accumulated Working Requirements document:
   - All requirements organized by section
   - Track sources (which meetings contributed to each requirement)
   - View change history
   - Export to Markdown

### Running the Full Application

The application has two parts: a FastAPI backend and a React frontend.

#### Windows Development (WSL Required)

On Windows, the backend requires WSL (Windows Subsystem for Linux) with Ubuntu because Python 3.12 runs in WSL.

**Quick Start (PowerShell):**
```powershell
# Run the startup script (starts both backend and frontend)
.\start_dev.ps1

# Or start only backend
.\start_dev.ps1 -BackendOnly

# Or start only frontend
.\start_dev.ps1 -FrontendOnly
```

**One-time setup:**
```powershell
# Ensure WSL Ubuntu is installed
wsl --install -d Ubuntu

# Install Python venv package (run in WSL)
wsl -d Ubuntu -- sudo apt update
wsl -d Ubuntu -- sudo apt install -y python3.12-venv python3-pip
```

**Start both servers (recommended approach):**

Open two terminal windows:

**Terminal 1 - Backend (WSL):**
```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/$env:USERNAME/Projects/cxpm-ai-prd/backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt -q && python -m alembic upgrade head && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
```

**Terminal 2 - Frontend (PowerShell):**
```powershell
cd ui
npm install
npm run dev
```

**Alternative (if python3.12-venv is not installed):**
```powershell
# Backend with --break-system-packages (no venv)
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/$env:USERNAME/Projects/cxpm-ai-prd/backend && pip3 install --user --break-system-packages -r requirements.txt -q && python3 -m alembic upgrade head && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
```

The application will be available at:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000

#### Linux/macOS Development

#### Backend (API Server)

```bash
cd backend

# Create virtual environment (recommended)
python3 -m venv .venv
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Run database migrations
python3 -m alembic upgrade head

# Start the API server (runs on port 8000)
python3 -m uvicorn app.main:app --port 8000 --reload
```

#### Frontend (React UI)

```bash
cd ui

# Install npm dependencies
npm install

# Start the development server (runs on port 3000)
npm run dev
```

The application will be available at `http://localhost:3000` with the API at `http://localhost:8000`.

### API Endpoints

#### Health Check
```
GET /api/health
Response: {"status": "ok"}
```

#### Projects
```
POST   /api/projects              # Create project
GET    /api/projects              # List all projects
GET    /api/projects/{id}         # Get project details
PUT    /api/projects/{id}         # Update project
DELETE /api/projects/{id}         # Delete project
```

#### Meetings
```
POST   /api/meetings/upload                  # Upload meeting notes
GET    /api/projects/{id}/meetings           # List meetings for project
GET    /api/meetings/{id}                    # Get meeting with items
GET    /api/meetings/{job_id}/stream         # SSE stream for extraction progress
DELETE /api/meetings/{id}                    # Delete meeting
POST   /api/meetings/{id}/items              # Add item to meeting
PUT    /api/meetings/{id}/items/reorder      # Reorder items in section
POST   /api/meetings/{id}/retry              # Retry failed extraction
```

#### Meeting Items
```
PUT    /api/meeting-items/{id}    # Update item content
DELETE /api/meeting-items/{id}    # Soft-delete item
```

#### Requirements
```
GET    /api/projects/{id}/requirements           # List active requirements
PUT    /api/requirements/{id}                    # Update requirement
DELETE /api/requirements/{id}                    # Soft-delete requirement
PUT    /api/projects/{id}/requirements/reorder   # Reorder requirements
GET    /api/requirements/{id}/history            # Get change history
GET    /api/projects/{id}/requirements/export    # Export as Markdown
```

#### Apply (Conflict Resolution)
```
GET    /api/meetings/{id}/apply/preview          # Preview items to apply
POST   /api/meetings/{id}/apply                  # Apply items to requirements
```

### API Examples

**Create a Project:**
```bash
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "My Product", "description": "Product requirements"}'
```

**Upload Meeting Notes (file):**
```bash
curl -X POST http://localhost:8000/api/meetings/upload \
  -F "project_id=<project-uuid>" \
  -F "title=Sprint Planning Meeting" \
  -F "file=@meeting-notes.txt"
```

**Upload Meeting Notes (text):**
```bash
curl -X POST http://localhost:8000/api/meetings/upload \
  -F "project_id=<project-uuid>" \
  -F "title=Sprint Planning Meeting" \
  -F "text=Today we discussed the user login feature..."
```

**Stream Extraction Results (SSE):**
```bash
curl -N http://localhost:8000/api/meetings/<meeting-uuid>/stream
```

### Running Tests

#### Backend Tests
```bash
cd backend
python3 -m pytest tests/ -v
```

#### Frontend Tests
```bash
cd ui
npm test
```

### LLM Configuration

The extraction feature supports two LLM providers with automatic fallback:

1. **Circuit (Cisco AI)** - Primary provider
   - Set `CIRCUIT_CLIENT_ID`, `CIRCUIT_CLIENT_SECRET`, `CIRCUIT_APP_KEY` in `.env`
   - Optionally set `CIRCUIT_BASE_URL` and `CIRCUIT_MODEL`

2. **Ollama (Local)** - Fallback, runs locally
   - Set `OLLAMA_BASE_URL` (default: `http://localhost:11434`)
   - Set `OLLAMA_MODEL` (default: `llama3.2`)

The system automatically tries Circuit first and falls back to Ollama if unavailable.

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Database (default: SQLite)
DATABASE_URL=sqlite:///./cxpm.db

# Circuit (Cisco AI - primary)
CIRCUIT_CLIENT_ID=your-client-id
CIRCUIT_CLIENT_SECRET=your-client-secret
CIRCUIT_APP_KEY=your-app-key
CIRCUIT_MODEL=gpt-4.1

# Ollama (local LLM - fallback)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# File upload limit
MAX_FILE_SIZE_KB=50
```
