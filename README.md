# CXPM AI PRD

CX AI Assistant for Product Managers. This repo contains a FastAPI backend and a React (Vite) frontend.

## Architecture

- Frontend: React + Vite, served on `http://localhost:3000`
- Backend: FastAPI, served on `http://localhost:8000`
- Database: PostgreSQL (Docker Compose)
- Migrations: Alembic

## Quick Start (Docker)

### Prerequisites

1. Install Docker Desktop.
2. Create `backend/.env` from `backend/.env.example` and set required values.

### Start Development Stack

Windows (PowerShell):

```powershell
.\start_dev.ps1
```

macOS/Linux:

```bash
./start_dev.sh
```

Equivalent Docker command:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Common Dev Commands

| Action | Windows | macOS/Linux | Docker |
|---|---|---|---|
| Start | `.\start_dev.ps1` | `./start_dev.sh` | `docker-compose -f docker-compose.dev.yml up -d` |
| Stop | `.\start_dev.ps1 -Stop` | `./start_dev.sh stop` | `docker-compose -f docker-compose.dev.yml down` |
| Logs | `.\start_dev.ps1 -Logs` | `./start_dev.sh logs` | `docker-compose -f docker-compose.dev.yml logs -f` |
| Restart | `.\start_dev.ps1 -Restart` | `./start_dev.sh restart` | `docker-compose -f docker-compose.dev.yml restart` |
| Rebuild | `.\start_dev.ps1 -Build` | `./start_dev.sh build` | `docker-compose -f docker-compose.dev.yml up --build -d` |

## Local (Non-Docker) Development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd ui
npm install
npm run dev
```

## Tests

### Backend

```bash
cd backend
pytest -v
```

### Frontend Unit Tests

```bash
cd ui
npm run test
```

### Frontend E2E Tests

```bash
cd ui
npm run test:e2e
```

## API

- API docs (Swagger): `http://localhost:8000/docs`
- Health check: `GET /api/health`

Primary API areas:

- `/api/auth`
- `/api/projects`
- `/api/meetings`
- `/api/meeting-items`
- `/api/requirements`
- `/api/jira-epic`
- `/api/jira-stories`
- `/api/bug-reports`
- `/api/feature-requests`
- `/api/notifications`
- `/api/admin`

## Key Project Structure

```text
cxpm-ai-prd/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── routers/
│   │   ├── models/
│   │   ├── services/
│   │   └── schemas/
│   ├── alembic/
│   └── tests/
├── ui/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── contexts/
│   │   └── services/
│   ├── tests/
│   ├── package.json
│   └── playwright.config.ts
├── docker-compose.yml
├── docker-compose.dev.yml
├── start_dev.ps1
├── start_dev.sh
└── DOCKER.md
```

## Environment Notes

- The backend uses Circuit as the LLM provider for extraction and generation.
- In Docker, the app stack uses PostgreSQL by default.
- Keep secrets in `backend/.env`; do not hardcode credentials in code.

## Docker Details

See `DOCKER.md` for service-level Docker commands and migration workflows.
