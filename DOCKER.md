# Docker Setup Guide

This guide provides detailed information about running the CXPM AI PRD application in Docker.

## Architecture

The application runs as 3 containers:

```
┌─────────────────────────────────────────────────────────────┐
│                    docker-compose.yml                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│    frontend     │     backend     │         ollama          │
│  (React/Nginx)  │    (FastAPI)    │      (LLM Server)       │
│     :3000       │      :8000      │        :11434           │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## Quick Start

### 1. Start All Services (Production Mode)

```bash
docker-compose up --build -d
```

### 2. Pull the Ollama Model (First Time Only)

```bash
docker exec cxpm-ollama ollama pull llama3.2
```

### 3. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Production setup (3 services) |
| `docker-compose.dev.yml` | Development overrides (hot reload) |
| `backend/Dockerfile` | Backend container (FastAPI + Python) |
| `ui/Dockerfile` | Frontend dev container (Vite) |
| `ui/Dockerfile.prod` | Frontend prod container (Nginx) |
| `ui/nginx.conf` | Nginx config for SPA + API proxy |
| `.dockerignore` | Files to exclude from builds |

## Development Mode

For hot-reload development:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

This enables:
- Backend code changes auto-reload
- Frontend code changes auto-reload (Vite HMR)
- Source code mounted as volumes

## Production Mode

```bash
docker-compose up --build -d
```

This:
- Builds optimized React bundle
- Serves static files via Nginx
- Proxies API requests to backend
- Runs with restart policies

## Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f ollama
```

### Stop Services

```bash
docker-compose down
```

### Restart Services

```bash
docker-compose restart
```

### Rebuild After Code Changes

```bash
docker-compose up --build -d
```

### Access Container Shell

```bash
# Backend
docker exec -it cxpm-backend /bin/sh

# Frontend
docker exec -it cxpm-frontend /bin/sh

# Ollama
docker exec -it cxpm-ollama /bin/bash
```

### Ollama Model Management

```bash
# List models
docker exec cxpm-ollama ollama list

# Pull a model
docker exec cxpm-ollama ollama pull llama3.2

# Remove a model
docker exec cxpm-ollama ollama rm llama3.2
```

## Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./data/cxpm.db` | Database connection |
| `CIRCUIT_BASE_URL` | `https://chat-ai.cisco.com/...` | Circuit API URL |
| `CIRCUIT_MODEL` | `gpt-4.1` | Circuit model to use |
| `OLLAMA_BASE_URL` | `http://ollama:11434` | Ollama API URL (fallback) |
| `OLLAMA_MODEL` | `llama3.2` | Ollama model to use |
| `LLM_TIMEOUT` | `120` | LLM request timeout (seconds) |
| `MAX_FILE_SIZE_KB` | `50` | Max upload file size |

### Frontend (Build-time)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API URL |

## GPU Support (Optional)

For faster Ollama inference with NVIDIA GPU:

1. Install [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)

2. Uncomment GPU lines in `docker-compose.yml`:

```yaml
ollama:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

3. Restart:

```bash
docker-compose up -d
```

## Data Persistence

Data is persisted in Docker volumes:

| Volume | Purpose |
|--------|---------|
| `ollama_data` | Ollama models (~2-8GB per model) |
| `backend_data` | SQLite database |

To backup:

```bash
docker run --rm -v cxpm-ai-prd_backend_data:/data -v $(pwd):/backup alpine tar cvf /backup/backup.tar /data
```

## Troubleshooting

### Container won't start

```bash
docker-compose logs <service-name>
```

### Ollama connection refused

Wait for Ollama to fully start (can take 30-60 seconds on first run):

```bash
docker-compose logs -f ollama
# Wait for "Ollama is running"
```

### Frontend can't reach backend

In production mode, Nginx proxies `/api/*` to the backend. Check:
- Backend is running: `docker-compose ps`
- Backend logs: `docker-compose logs backend`

### Out of disk space

Ollama models are large. To free space:

```bash
# Remove unused models
docker exec cxpm-ollama ollama rm <model-name>

# Clean Docker system
docker system prune -a
```

## Database migrations

The backend runs **Alembic migrations** on startup (`alembic upgrade head` then uvicorn). If the backend fails to start or you see errors like **"relation jira_story does not exist"**, the database schema is missing or incomplete.

### Run migrations explicitly (recommended on first deploy or after errors)

1. Start Postgres and wait for it to be healthy:
   ```bash
   docker-compose up -d postgres
   docker-compose ps   # wait until postgres is healthy
   ```

2. Run migrations in a one-off container (same image and env as backend):
   ```bash
   docker-compose run --rm migrate
   ```
   Fix any errors shown (e.g. Python version, duplicate key/column — see `backend/docs/MIGRATIONS.md`).

3. Start the rest of the stack:
   ```bash
   docker-compose up -d backend frontend
   ```

### Why use the migrate service?

- You see migration output directly; failures don’t get lost in backend restart loops.
- You can run migrations once, then start the backend without re-running them on every restart.
- The backend still runs migrations on start by default (with retries), so normal `docker-compose up -d` works if the DB is already ready.

### VM / different machine

- Use the same `DATABASE_URL` the backend uses (e.g. in `docker-compose` or `backend/.env`).
- Ensure the backend image is built from the repo that contains all migration files under `backend/alembic/versions/`.
- If the VM uses Python 3.9 to run Alembic outside Docker, use Python 3.10+ or run migrations inside the container: `docker-compose run --rm migrate`.

## First-Time Setup Checklist

1. [ ] Docker and Docker Compose installed
2. [ ] Run `docker-compose up -d postgres`, then `docker-compose run --rm migrate`
3. [ ] Run `docker-compose up -d backend frontend` (or `docker-compose up --build -d`)
4. [ ] Open http://localhost:3000
5. [ ] Create a project and test extraction
