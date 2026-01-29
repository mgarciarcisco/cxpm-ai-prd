# Codebase Patterns

> Curated patterns discovered during implementation. Keep this small and relevant.
> Only add patterns that are **general and reusable**, not task-specific details.

## Project Structure

- Backend uses Python FastAPI in `backend/app/`
- Models in `app/models/`, Schemas in `app/schemas/`, Routers in `app/routers/`
- Export models and enums from `app/models/__init__.py` and schemas from `app/schemas/__init__.py`
- UI uses React + Vite in `ui/`

## Database & API

- Use SQLAlchemy with SQLite, migrations via Alembic in `backend/alembic/versions/`
- For enum columns: use `str, enum.Enum` base class for proper serialization
- Always use `server_default` in migrations for existing row defaults
- Pydantic schemas need separate enum definitions (suffix with `Schema`) for API serialization
- ProjectResponse uses `from_attributes: True` to auto-serialize ORM models

## Components & UI

- Reusable UI components go in `ui/src/components/common/`
- Project uses JSX (not TypeScript) - no typecheck script available
- Use `npm run lint` and `npm run build` for quality checks
- Components use CSS files alongside JSX (e.g., `Breadcrumbs.jsx` + `Breadcrumbs.css`)
- Use `react-router-dom` Link for navigation
- Follow BEM naming convention for CSS classes (e.g., `.breadcrumbs__link`)

## Testing

### Unit Tests
- Unit tests use Vitest in `ui/tests/` directory
- Run with `npm run test` in ui/ directory
- Setup file at `ui/tests/setup.js`

### E2E Tests
- E2E tests use Playwright in `ui/tests/e2e/` directory
- Configuration in `ui/playwright.config.ts`
- Run with `npm run test:e2e` or `npm run test:e2e:ui` for debug mode
- Test fixtures in `ui/tests/e2e/fixtures/` for reusable setup
- Helper utilities in `ui/tests/e2e/utils/` for common actions
- Use `page.route()` to mock API endpoints in tests
- For SSE streaming, mock with `contentType: 'text/event-stream'`
- Dev server runs on port 3000 (configured in vite.config.js)
