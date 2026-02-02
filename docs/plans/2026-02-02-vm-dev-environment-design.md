# VM Development Environment Design

**Date:** 2026-02-02
**Status:** Approved
**Goal:** Run both dev and production environments on a single VM with full isolation, enabling team collaboration via VS Code Remote SSH.

---

## Overview

Migrate development from local machines to the VM (10.226.185.129) to address:
- **Resource constraints** - VM has better specs for running Ollama and multiple services
- **Team collaboration** - Centralized environment accessible to all team members

## Architecture

```
VM (10.226.185.129)
├── /opt/cxpm-prod/          # Production (git clone, main branch only)
│   └── docker-compose.yml   # Ports: 3000, 8000
├── /opt/cxpm-dev/           # Development (direct editing)
│   └── docker-compose.dev.vm.yml   # Ports: 3001, 8001
└── /opt/cxpm-shared/        # Shared services
    └── docker-compose.ollama.yml   # Port: 11434 (single instance)
```

### Access URLs

| Environment | Frontend | Backend API |
|-------------|----------|-------------|
| Production  | http://10.226.185.129:3000 | http://10.226.185.129:8000 |
| Development | http://10.226.185.129:3001 | http://10.226.185.129:8001 |

---

## Directory Structure

```
/opt/
├── cxpm-prod/                    # Production environment
│   ├── .git/                     # Git repo (main branch)
│   ├── backend/
│   ├── ui/
│   ├── docker-compose.yml        # Prod compose (ports 3000, 8000)
│   └── .env.prod                 # Prod environment variables
│
├── cxpm-dev/                     # Development environment
│   ├── .git/                     # Git repo (any branch)
│   ├── backend/
│   ├── ui/
│   ├── docker-compose.dev.vm.yml # Dev compose (ports 3001, 8001)
│   └── .env.dev                  # Dev environment variables
│
└── cxpm-shared/                  # Shared services
    └── docker-compose.ollama.yml # Ollama only (port 11434)
```

---

## Networking

### Docker Networks

```
┌─────────────────────────────────────────────────────────────┐
│  VM Host                                                    │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ cxpm-prod-net   │  │ cxpm-dev-net    │  │ cxpm-shared │ │
│  │                 │  │                 │  │             │ │
│  │  backend:8000 ──┼──┼─────────────────┼──┼── ollama    │ │
│  │  frontend:3000  │  │  backend:8001 ──┼──┼── :11434    │ │
│  │                 │  │  frontend:3001  │  │             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                             │
│  Host ports exposed: 3000, 3001, 8000, 8001, 11434         │
└─────────────────────────────────────────────────────────────┘
```

### Network Strategy

- Each environment gets its own isolated network (`cxpm-prod-net`, `cxpm-dev-net`)
- Shared network (`cxpm-shared-net`) for Ollama
- Both backend containers join their own network AND the shared network
- Backends reach Ollama via `ollama:11434` internally

### Firewall Rules

```bash
firewall-cmd --permanent --add-port=3000/tcp   # Prod frontend
firewall-cmd --permanent --add-port=3001/tcp   # Dev frontend
firewall-cmd --permanent --add-port=8000/tcp   # Prod backend API
firewall-cmd --permanent --add-port=8001/tcp   # Dev backend API
# Ollama stays internal only (not exposed externally)
```

### Frontend → Backend Communication

- Prod frontend: `VITE_API_URL=http://10.226.185.129:8000`
- Dev frontend: `VITE_API_URL=http://10.226.185.129:8001`

---

## Setup Script Structure

**Script:** `setup_vm_dev.sh`

### Phase 1: Prerequisites
- Check running as root or sudo
- Detect OS (AlmaLinux/RHEL/CentOS)
- Install Docker & Docker Compose if missing
- Install git if missing
- Start Docker service

### Phase 2: Directory Setup
- Create /opt/cxpm-prod/
- Create /opt/cxpm-dev/
- Create /opt/cxpm-shared/
- Clone repo to prod directory (main branch)
- Clone repo to dev directory (main branch, can switch later)
- Set ownership (allow non-root users to edit dev)

### Phase 3: Configuration Files
- Generate /opt/cxpm-shared/docker-compose.ollama.yml
- Copy docker-compose.yml to prod (no changes needed)
- Generate docker-compose.dev.vm.yml for dev (updated ports)
- Create .env.prod with production settings
- Create .env.dev with dev settings

### Phase 4: Networking & Firewall
- Create Docker networks (cxpm-prod-net, cxpm-dev-net, cxpm-shared-net)
- Open firewall ports (3000, 3001, 8000, 8001)
- Reload firewall

### Phase 5: Initial Startup
- Start Ollama (shared)
- Pull Ollama model (llama3.2)
- Start prod environment
- Start dev environment
- Run migrations on both databases
- Seed dev with demo data (optional prompt)

### Phase 6: Verification
- Health check all services
- Print access URLs
- Print next steps for team

**Note:** Script is idempotent - safe to run multiple times (skips already-done steps).

---

## Day-to-Day Workflow

### Initial Setup (one-time per developer)

1. Install VS Code + Remote SSH extension
2. Add SSH config for VM:
   ```
   Host cxpm-vm
       HostName 10.226.185.129
       User your-username
       IdentityFile ~/.ssh/cxpm-key
   ```
3. Connect to VM, open `/opt/cxpm-dev/` as workspace

### Daily Development Flow

```
Developer                          VM
─────────                          ──
1. Open VS Code
2. Connect Remote SSH → cxpm-vm
3. Open /opt/cxpm-dev/
4. Edit code directly              Files saved on VM
5. View changes                    Hot-reload updates browser
6. Test at http://vm-ip:3001
7. Commit & push from VS Code      Git push to remote
```

### Common Commands

```bash
# Check service status
cd /opt/cxpm-dev && docker compose -f docker-compose.dev.vm.yml ps

# View logs
docker compose -f docker-compose.dev.vm.yml logs -f backend
docker compose -f docker-compose.dev.vm.yml logs -f frontend

# Restart after config changes
docker compose -f docker-compose.dev.vm.yml restart backend

# Rebuild after dependency changes
docker compose -f docker-compose.dev.vm.yml up --build -d

# Run backend tests
docker compose -f docker-compose.dev.vm.yml exec backend pytest

# Reset dev database
docker compose -f docker-compose.dev.vm.yml exec backend alembic downgrade base
docker compose -f docker-compose.dev.vm.yml exec backend alembic upgrade head
docker compose -f docker-compose.dev.vm.yml exec backend python seed_demo_data.py
```

### Deploying to Production

```bash
cd /opt/cxpm-prod
git pull origin main
docker compose down
docker compose up --build -d
```

### Branch Switching (dev only)

```bash
cd /opt/cxpm-dev
git fetch origin
git checkout feature/my-feature
docker compose -f docker-compose.dev.vm.yml up --build -d
```

---

## Helper CLI

**Script:** `/usr/local/bin/cxpm`

### Commands

```bash
# Development environment
cxpm dev logs [service]      # View dev logs (backend, frontend, or all)
cxpm dev restart [service]   # Restart dev services
cxpm dev rebuild             # Rebuild dev containers
cxpm dev status              # Show dev container status
cxpm dev test                # Run backend tests
cxpm dev shell               # Open bash in backend container
cxpm dev db reset            # Reset dev database + seed
cxpm dev db migrate          # Run migrations only

# Production environment
cxpm prod logs [service]     # View prod logs
cxpm prod restart [service]  # Restart prod services
cxpm prod deploy             # Git pull + rebuild prod
cxpm prod status             # Show prod container status

# Shared services
cxpm ollama status           # Check Ollama status
cxpm ollama pull <model>     # Pull a new model
cxpm ollama restart          # Restart Ollama

# Utilities
cxpm urls                    # Print all access URLs
cxpm doctor                  # Run health checks
```

### Shell Aliases

Added to `/etc/profile.d/cxpm.sh` for all users:

```bash
alias cdev='cd /opt/cxpm-dev'
alias cprod='cd /opt/cxpm-prod'
alias dclogs='cxpm dev logs'
alias dcps='cxpm dev status'
```

---

## Troubleshooting

### Common Issues

| Problem | Symptom | Solution |
|---------|---------|----------|
| Port already in use | `Bind for 0.0.0.0:3001 failed: port is already allocated` | `cxpm dev restart` or check for orphan containers: `docker ps -a` |
| Container won't start | Exit code 1, container restarts repeatedly | Check logs: `cxpm dev logs backend` |
| Database locked | `sqlite3.OperationalError: database is locked` | Restart backend: `cxpm dev restart backend` |
| Hot-reload not working | Code changes not reflected | Check volume mounts: `docker inspect cxpm-dev-backend` |
| Ollama timeout | LLM requests hang or fail | Check Ollama: `cxpm ollama status`, restart if needed |
| Permission denied | Can't edit files in VS Code | Fix ownership: `sudo chown -R $USER:$USER /opt/cxpm-dev` |
| Network unreachable | Frontend can't reach backend | Check firewall: `firewall-cmd --list-ports` |

### Health Check

```bash
$ cxpm doctor

Checking CXPM environment health...

[✓] Docker daemon running
[✓] Ollama container healthy (model: llama3.2)
[✓] Dev backend responding (http://localhost:8001/health)
[✓] Dev frontend responding (http://localhost:3001)
[✓] Prod backend responding (http://localhost:8000/health)
[✓] Prod frontend responding (http://localhost:3000)
[✓] Firewall ports open (3000, 3001, 8000, 8001)
[✓] Disk space OK (45GB free)

All checks passed!
```

### Log Locations

```
/opt/cxpm-dev/backend/data/        # Dev database + app data
/opt/cxpm-prod/backend/data/       # Prod database + app data
/var/log/                          # System logs
docker logs cxpm-dev-backend       # Container stdout/stderr
```

### Emergency Reset

```bash
# Stop everything
cxpm dev restart && cxpm prod restart

# Full dev reset (keeps prod intact)
cd /opt/cxpm-dev
docker compose -f docker-compose.dev.vm.yml down -v  # -v removes volumes
git checkout main && git pull
docker compose -f docker-compose.dev.vm.yml up --build -d
cxpm dev db reset
```

---

## Implementation Deliverables

1. **`setup_vm_dev.sh`** - Automated provisioning script (idempotent)
2. **`docker-compose.dev.vm.yml`** - Dev compose file with offset ports (3001, 8001)
3. **`docker-compose.ollama.yml`** - Shared Ollama service
4. **`/usr/local/bin/cxpm`** - Helper CLI script
5. **`/etc/profile.d/cxpm.sh`** - Shell aliases for all users

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Port strategy | Offset (dev +1) | Simple, easy to remember |
| Environment isolation | Separate directories | Full isolation, independent branches |
| Database strategy | Completely separate | Zero risk of dev affecting prod |
| Ollama | Single shared instance | Conserves RAM/VRAM |
| Code editing | VS Code Remote SSH | Full IDE features, files on VM |
| Workflow | Hybrid (direct dev, git-only prod) | Flexible dev, controlled prod |
| Automation | Script + docs | Fast setup + team understanding |
