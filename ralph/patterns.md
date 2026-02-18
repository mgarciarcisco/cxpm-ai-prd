# Codebase Patterns

> Curated patterns discovered during implementation. Keep this small and relevant.
> Only add patterns that are **general and reusable**, not task-specific details.

## Critical Bug Prevention Patterns

### React Hooks - Temporal Dead Zone
**Problem:** Using a callback in useEffect before it's defined causes "Cannot access X before initialization"
```javascript
// BAD - will crash
useEffect(() => {
  loadData();
}, [loadData]);

const loadData = useCallback(() => { ... }, []);

// GOOD - define callback BEFORE useEffect
const loadData = useCallback(() => { ... }, []);

useEffect(() => {
  loadData();
}, [loadData]);
```

### SSE/EventSource - Dependency Arrays
**Problem:** Including streaming state in useEffect deps causes reconnection loops
```javascript
// BAD - reconnects every time status changes
useEffect(() => {
  const eventSource = new EventSource(url);
  eventSource.onmessage = (e) => setStatus(e.data.status);
  return () => eventSource.close();
}, [jobId, status]); // status in deps = infinite loop!

// GOOD - only depend on connection identifiers
useEffect(() => {
  const eventSource = new EventSource(url);
  let completed = false; // local variable instead of state
  eventSource.onmessage = (e) => { ... };
  return () => eventSource.close();
}, [jobId]); // only jobId
```

### Backend Status Handling
**Problem:** Frontend computing status instead of using backend's authoritative status
```javascript
// BAD - ignores backend status
setStatus(data.failed_count > 0 ? 'partial' : 'complete');

// GOOD - respect backend status
if (data.status === 'failed') {
  setStatus('error');
  setError('Generation failed');
} else {
  setStatus(data.failed_count > 0 ? 'partial' : 'complete');
}
```

### Database Status Consistency
**Problem:** Status field not updated when related timestamp is set
```python
# BAD - status can get out of sync
meeting.processed_at = datetime.utcnow()
db.commit()
# status still shows 'processing'!

# GOOD - update status atomically with timestamp
meeting.processed_at = datetime.utcnow()
meeting.status = MeetingStatus.processed
db.commit()
```

### Backend Idempotency for Streaming
**Problem:** Streaming endpoint re-processes on reconnection
```python
# BAD - no idempotency check
async def stream_extraction(job_id):
    meeting.status = 'processing'
    async for item in extract(): yield item

# GOOD - check status before processing
async def stream_extraction(job_id):
    if meeting.status == 'processed':
        for item in meeting.items: yield item
        return
    if meeting.status == 'processing':
        return  # already in progress
    meeting.status = 'processing'
    async for item in extract(): yield item
```

## Project Structure

- Backend uses Python FastAPI in `backend/app/`
- Models in `app/models/`, Schemas in `app/schemas/`, Routers in `app/routers/`
- Export models and enums from `app/models/__init__.py` and schemas from `app/schemas/__init__.py`
- UI uses React + Vite in `ui/`

## Database & API

- Use SQLAlchemy with PostgreSQL, migrations via Alembic in `backend/alembic/versions/`
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

### Critical Test Scenarios (MUST TEST)

**SSE Streaming Features:**
1. Test successful completion - stream completes, UI updates
2. Test error during stream - error message shown to user
3. Test reconnection scenarios - page doesn't loop infinitely
4. Test LLM unavailable - clear error message shown

**Example SSE test with error:**
```typescript
test('shows error when LLM unavailable', async ({ page }) => {
  await page.route('**/api/stream', route => {
    route.fulfill({
      contentType: 'text/event-stream',
      body: [
        'event: status\ndata: {"status":"generating"}\n\n',
        'event: complete\ndata: {"status":"failed","failed_count":7}\n\n',
      ].join(''),
    });
  });

  await page.click('[data-testid="generate-btn"]');
  await expect(page.locator('.error-message')).toBeVisible();
  await expect(page.locator('.error-message')).toContainText('failed');
});
```

**Database Status Consistency:**
```python
# In backend tests, always verify status matches timestamps
def test_meeting_status_consistency(db):
    meeting = create_meeting(...)
    process_meeting(meeting)

    assert meeting.status == 'processed'
    assert meeting.processed_at is not None
    # Status and timestamp must be in sync
```

### Pre-commit Checklist for SSE/Streaming Features
- [ ] useEffect deps don't include state that changes during streaming
- [ ] Callbacks defined BEFORE useEffects that use them
- [ ] Backend status values are respected (not recomputed)
- [ ] Endpoint is idempotent (handles reconnection gracefully)
- [ ] Error states show user-friendly messages
- [ ] E2E test covers error scenario
