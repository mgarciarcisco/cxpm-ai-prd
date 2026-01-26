# Future Features: PRD Generation & User Stories

This document tracks features deferred from v1 for future consideration.

---

## v2 Candidates (High Priority)

### Durable Job Queue (Celery/RQ)

**Deferred from v1:** Replace FastAPI BackgroundTasks with Celery or RQ

**Current v1 limitations:**
- Jobs lost on server restart (user must manually retry)
- No automatic retries on failure
- No visibility into pending jobs

**What's needed:**
- Redis as message broker
- Celery worker process(es)
- Task definitions with retry policies
- Idempotency keys to prevent duplicate generations
- Job status dashboard (Flower or similar)

**Why deferred:** Adds infrastructure complexity (Redis, worker processes). v1 with BackgroundTasks is acceptable for single-tenant, low-volume usage.

**Consider adding when:** Moving to production with reliability requirements, or experiencing lost jobs due to restarts.

---

### Access Control / Authorization

**Deferred from v1:** Explicit project access checks on all endpoints

**Current v1 state:** Single-tenant, no explicit access checks (if logged in, can access anything)

**What's needed:**
- Project membership/ownership model
- Middleware or decorator for access checks
- Consistent enforcement on all read/write endpoints
- 403 responses for unauthorized access

**Why deferred:** Existing codebase has no access control pattern. Single-tenant deployment with trusted users reduces risk.

**Consider adding when:** Moving to multi-tenant, or adding team/organization features.

---

### PRD List/History Page

**Deferred from v1:** Dedicated page showing all PRD versions

**Current v1 state:** Version dropdown on PRD editor page only

**What's needed:**
- `/app/projects/{id}/prds` page
- Card or table view of all versions
- Status badges, dates, actions (view, delete, archive)
- Search/filter by status

**Why deferred:** Version dropdown on editor is sufficient for v1. Users typically work with latest version.

---

### LLM Output Validation & Robustness

**Deferred from v1:** Schema validation, repair retries, model fallback

**Current v1 state:** Parse JSON, catch errors, set status=failed

**What's needed:**
- JSON schema validation (Pydantic or jsonschema)
- Repair attempts (re-prompt asking to fix malformed output)
- Retry with lower temperature on parse failure
- Model fallback (try GPT-4, fall back to GPT-3.5)
- Prompt/response versioning for debugging

**Why deferred:** Simple error handling sufficient for v1. Users can retry manually.

**Consider adding when:** Generation failure rate becomes problematic.

---

### True Cancellation (Cooperative)

**Deferred from v1:** Actually stop LLM calls mid-generation

**Current v1 state:** Best-effort cancellation (LLM call completes, result discarded)

**What's needed:**
- Async cancellation tokens
- Streaming response interruption
- Partial result cleanup

**Why deferred:** Complex implementation. Current approach wastes some tokens but works.

---

### Export Formats

**Deferred from v1:** PDF, DOCX, Jira CSV export

**What's needed:**
- PDF export: WeasyPrint or similar library, CSS styling for print
- DOCX export: python-docx library, template styling
- Jira CSV: Field mapping to Jira import format, handling of custom fields

**Why deferred:** Requires additional dependencies and formatting work. Markdown/JSON/CSV covers most immediate needs.

---

### PRD Version Comparison

**Deferred from v1:** `/compare` endpoint and `PRDComparePage`

**What's needed:**
- Diff algorithm (unified diff or side-by-side)
- Section-by-section comparison
- UI to display additions/removals/changes
- Handle section reordering

**Why deferred:** Users can manually compare versions or use external diff tools. Core generation flow is higher priority.

---

### Custom PRD Templates

**Deferred from v1:** User-created templates with custom sections

**What's needed:**
- `PRDTemplate` model (already designed)
- Template CRUD endpoints
- Template management UI (`PRDTemplatesPage`)
- Template validation (required fields, unique IDs, placeholder syntax)
- Template preview

**Why deferred:** Built-in Draft and Detailed templates cover most use cases. Custom templates add significant UI complexity.

---

### Backend Rate Limiting / Quotas

**Deferred from v1:** Server-side generation quotas

**What's needed:**
- Quota tracking per project/user
- Rate limit middleware
- Quota exceeded error responses
- Admin UI for quota management

**Why deferred:** UI cooldown (30s) provides basic protection. Single-tenant deployment with trusted users reduces abuse risk.

**Consider adding when:** Moving to multi-tenant SaaS, or if abuse becomes an issue.

---

## v3+ Candidates (Lower Priority)

### Story Dependencies

**Feature:** Mark stories as "blocked by" other stories

**What's needed:**
- `blocked_by` relationship on UserStory model
- Dependency visualization (graph or tree view)
- Circular dependency detection
- Impact on reordering logic

**Why deferred:** Most teams manage dependencies in external tools (Jira, Linear). Adding here duplicates functionality.

---

### Real-time Collaboration

**Feature:** Multiple users editing PRD simultaneously

**What's needed:**
- WebSocket infrastructure
- Operational transformation or CRDT for conflict resolution
- Presence indicators (who's editing what)
- Cursor positions

**Why deferred:** Significant infrastructure investment. Single-tenant with small teams reduces collision likelihood.

---

### AI-Assisted Story Refinement

**Feature:** "Improve this story" button that refines wording, adds acceptance criteria

**What's needed:**
- Refinement prompt templates
- Per-story LLM calls
- Before/after comparison UI
- Accept/reject workflow

**Why deferred:** Core generation provides good starting point. Manual editing sufficient for v1.

---

### External Integrations

**Feature:** Push stories to Jira, Linear, GitHub Issues

**What's needed:**
- OAuth integration with each platform
- Field mapping configuration
- Sync status tracking
- Two-way sync (optional)

**Why deferred:** Each integration is significant work. CSV/JSON export allows manual import.

**Consider adding when:** Users request specific integrations frequently.

---

### PRD Approval Workflow

**Feature:** Submit PRD for review, approval states, comments

**What's needed:**
- Workflow states (draft, in_review, approved, rejected)
- Reviewer assignment
- Comment threads on sections
- Notification system

**Why deferred:** Most teams have existing review processes (Google Docs comments, Slack threads). Adding workflow duplicates effort.

---

### Story Estimation (Planning Poker)

**Feature:** Collaborative story point estimation

**What's needed:**
- Real-time voting UI
- Point scales (Fibonacci, T-shirt)
- Reveal mechanism
- Consensus tracking

**Why deferred:** Specialized tools (Pointing Poker, Jira) handle this well. Out of scope for requirements tool.

---

## Quality & Operations (Continuous Improvement)

### Accessibility (A11y)

**What's needed:**
- WCAG 2.1 AA compliance audit
- Keyboard navigation for all interactions
- Screen reader testing
- Color contrast validation
- Focus management

**Approach:** Add incrementally. Prioritize critical flows (generation, editing) first.

---

### Internationalization (i18n)

**What's needed:**
- String extraction to translation files
- RTL language support
- Date/number formatting
- Translation management

**Consider adding when:** International user base grows.

---

### Observability

**What's needed:**
- Structured logging for generation events
- Metrics: generation duration, success rate, token usage
- Error dashboards
- Alerting on failure spikes

**Approach:** Follow existing codebase patterns. Add as operational needs arise.

---

### Feature Flags

**What's needed:**
- Flag management system (LaunchDarkly, or simple DB-backed)
- Per-feature toggles
- Gradual rollout capability

**Consider adding when:** Team grows, or need controlled rollout of risky changes.

---

### Audit Logging

**What's needed:**
- Log all create/update/delete actions
- User attribution
- Timestamp and change details
- Retention policy

**Consider adding when:** Compliance requirements emerge (SOC2, GDPR audit trail).

---

## From Critique (Addressed in v1)

The following items from the critique were addressed in the v1 plan:

| Item | Resolution |
|------|------------|
| Async job architecture | Added BackgroundTasks with status polling, documented limitations |
| Cancel/fail states | Added QUEUED, GENERATING, READY, FAILED, CANCELLED states |
| Cancellation semantics | Documented best-effort behavior (LLM completes, result discarded) |
| Story numbering race condition | Added `with_for_update()` row lock |
| PRD version race condition | Single locked transaction for version increment + record creation |
| Requirements model linkage | Documented link to existing Requirement model |
| Export format specs | Added detailed schemas for Markdown, JSON, CSV exports |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2024-01-XX | Built-in templates only for v1 | Reduce UI complexity, covers 90% of use cases |
| 2024-01-XX | Markdown/JSON/CSV export only | Avoid extra dependencies, users can convert markdown |
| 2024-01-XX | Defer PRD comparison | External diff tools available, core flow priority |
| 2024-01-XX | UI cooldown over backend quotas | Simpler implementation, trusted single-tenant users |
| 2024-01-XX | Skip A11y/i18n for v1 | Add incrementally post-launch |
| 2024-01-XX | BackgroundTasks over Celery | No existing task queue, accept limitations for v1 simplicity |
| 2024-01-XX | No access control for v1 | No existing pattern, single-tenant with trusted users |
| 2024-01-XX | Version dropdown over list page | Sufficient UX for v1, users work with latest version |
| 2024-01-XX | Best-effort cancellation | True cancellation is complex, wasted tokens acceptable |
