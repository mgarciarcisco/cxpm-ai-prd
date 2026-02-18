# Docker Setup Guide

This guide covers the current Docker setup for the CXPM AI PRD app.

## Compose Files

- `docker-compose.dev.yml` (development: hot reload, source mounts)
- `docker-compose.yml` (production-style local run)

## Services

Both compose files use PostgreSQL, backend, and frontend services:

- `postgres` (PostgreSQL 16)
- `migrate` (one-off Alembic migrations)
- `backend` (FastAPI)
- `frontend` (React app; Vite in dev, Nginx-served build in prod compose)

## Development Mode

Start:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

Rebuild:

```bash
docker-compose -f docker-compose.dev.yml up --build -d
```

Stop:

```bash
docker-compose -f docker-compose.dev.yml down
```

Logs:

```bash
docker-compose -f docker-compose.dev.yml logs -f
```

## Production-Style Mode

Start:

```bash
docker-compose up --build -d
```

Stop:

```bash
docker-compose down
```

Logs:

```bash
docker-compose logs -f
```

## Ports

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- Postgres: `localhost:5432`

## Migrations

Run migrations explicitly:

```bash
docker-compose run --rm migrate
```

Recommended first-time sequence:

```bash
docker-compose up -d postgres
docker-compose run --rm migrate
docker-compose up -d backend frontend
```

## Useful Commands

Service-specific logs:

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

Container shell:

```bash
docker exec -it cxpm-backend /bin/sh
docker exec -it cxpm-frontend /bin/sh
docker exec -it cxpm-postgres /bin/sh
```

## Environment Variables

Set runtime values in `backend/.env`.

Important values commonly overridden by compose:

- `DATABASE_URL`
- `CIRCUIT_CLIENT_ID`
- `CIRCUIT_CLIENT_SECRET`
- `CIRCUIT_APP_KEY`
- `CIRCUIT_MODEL`

## Volumes

Persistent Docker volumes in use:

- `postgres_data` (PostgreSQL data)
- `backend_data` (backend app data)
- `uploads_data` (uploaded files in prod compose)

## Troubleshooting

If backend fails due to schema issues:

```bash
docker-compose run --rm migrate
docker-compose logs -f backend
```

If frontend cannot reach backend:

- Confirm backend is healthy: `docker-compose ps`
- Check backend logs: `docker-compose logs backend`
- In dev compose, frontend uses `VITE_API_URL=http://localhost:8000`
