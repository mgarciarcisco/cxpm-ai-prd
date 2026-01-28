# Meeting Notes to Requirements - Decision Log

This document tracks all key decisions made while developing the implementation plan across three versions.

---

## Version History

| Version | Description |
|---------|-------------|
| v1 | Initial plan based on stakeholder requirements |
| v2 | Refined after self-critique, addressing scope and technical concerns |
| v3 (Final) | Refined after external critique, addressing data model and edge cases |

---

## v1 → v2 Decisions

These decisions addressed scope creep, underspecified areas, and technical feasibility.

### Scope Reduction

| Topic | v1 | v2 Decision | Rationale |
|-------|----|----|-----------|
| **Auth** | JWT + password hashing | Skip for V1 | Single-user local app doesn't need auth overhead |
| **Input formats** | .txt, .docx, .pdf, .md, .rtf | .txt and .md only | PDF parsing is unreliable; .docx and .rtf rarely used |
| **Export formats** | Markdown, PDF, Word | Markdown only | Markdown covers 90% of needs; PDF/Word add dependencies |
| **LLM providers** | Ollama + OpenAI + Claude | Ollama + Claude | Two providers sufficient for fallback |
| **Empty sections** | AI explains absence | Constant "No data found" | Extra LLM call not worth the value |

### Technical Decisions

| Topic | v1 | v2 Decision | Rationale |
|-------|----|----|-----------|
| **Data model** | JSON blobs for sections | Normalized relational schema | Need cross-project queries, traceability, item history |
| **Conflict wizard** | Section-by-section (9 pages) | Conflict-only view + bulk actions | Less tedious; PM only sees sections with actual conflicts |
| **Conflict definition** | Underspecified | Duplicates auto-skip; refinements/contradictions = conflicts | Clear rules for what triggers PM review |
| **Conflict detection** | Underspecified | LLM decides at item level | Start simple, improve later |
| **LLM errors** | Not addressed | Fallback chain + auto-retry once | Ollama → Claude → error; retry once on bad output |
| **Long inputs** | Not addressed | Auto-chunk and process in parts | Handle large meeting transcripts |
| **Testing** | Manual only | Solid from day one (pytest, Vitest, Playwright) | Prevent regressions as complexity grows |
| **Dev approach** | Horizontal layers | Vertical slices | See working features sooner |
| **DB migrations** | Mentioned but not planned | Alembic from day one | Avoid data loss during development |
| **Routing** | Unspecified | Landing at `/`, app at `/app/*` | Clean separation; allows multiple apps later |

---

## v2 → v3 Decisions

These decisions addressed gaps identified in external critique.

### Data Model Additions

| Topic | v2 | v3 Decision | Rationale |
|-------|----|----|-----------|
| **Extracted recap storage** | Only `raw_input` stored | Add `MeetingItem` table | Need to persist AI-extracted items before apply for editing |
| **Skipped items tracking** | Silent skip | Add `MeetingItemDecision` table | Audit trail: PM can see what was skipped and why |
| **Full-text search** | Claimed but not specified | Defer to later phase, use LIKE for V1 | FTS5 adds complexity; LIKE sufficient for V1 |
| **Requirement ordering** | Not specified | Add `order` field | Enable drag-drop reordering within sections |
| **History actor** | Not tracked | Add `actor` field (system/user/ai_extraction/ai_merge) | Distinguish who made changes for audit |
| **Prompt versioning** | Not tracked | Add `prompt_version` to MeetingRecap | Debug/trace which prompt produced which extraction |

### Meeting Status Lifecycle

| Topic | v2 | v3 Decision | Rationale |
|-------|----|----|-----------|
| **Status field** | Boolean `applied_status` | Enum: pending/processing/processed/failed/applied | Support retries, proper UI states |
| **Timestamps** | Only `created_at` | Add `processed_at`, `applied_at`, `failed_at` | Track lifecycle events |
| **Error tracking** | Not specified | Add `error_message` field | Store failure reason for display |

### API & UX Clarifications

| Topic | v2 | v3 Decision | Rationale |
|-------|----|----|-----------|
| **Streaming flow** | SSE mentioned but not specified | Two-step: POST upload → GET stream by job_id | SSE is GET-only; file upload is POST |
| **Merge UX** | Undefined | AI suggests merged text, PM can edit | Clear workflow for merge option |
| **Export format** | "Markdown only" | Defined structure with sections, metadata, sources | Consistent, predictable output |
| **File size limit** | Not specified | 50KB max | Prevent abuse, reasonable for meeting notes |

### Minor Fixes

| Topic | v2 | v3 Decision |
|-------|----|----|
| **httpx duplication** | Duplicated in deps | Removed duplicate |
| **Claude fallback UX** | Not specified | Clear error messages for missing API key vs unavailable |
| **Ollama install** | Linux only | Added Windows note |

---

## Summary of Final Architecture Decisions

### Data Storage
- **Database**: SQLite with SQLAlchemy ORM
- **Migrations**: Alembic from day one
- **Schema**: Fully normalized (no JSON blobs)
- **Search**: LIKE queries for V1 (FTS5 deferred)

### Tables (7 total)
1. `Project` - user's projects
2. `MeetingRecap` - uploaded meetings with status lifecycle
3. `MeetingItem` - AI-extracted items (before apply)
4. `MeetingItemDecision` - audit trail of apply decisions
5. `Requirement` - working requirements
6. `RequirementSource` - traceability to meetings
7. `RequirementHistory` - change audit trail with actor

### LLM Integration
- **Primary**: Ollama (local)
- **Fallback**: Claude (cloud)
- **Error handling**: Auto-retry once, then manual retry
- **Long inputs**: Auto-chunk with section preservation
- **Prompt versioning**: Tracked per extraction

### Conflict Resolution
- **Detection**: Exact match first, then LLM classification
- **Categories**: duplicate (skip), semantic duplicate (skip), refinement (conflict), contradiction (conflict), new (add)
- **Audit**: All decisions recorded in `MeetingItemDecision`
- **Merge**: AI suggests, PM edits before confirming

### UX Approach
- **Streaming**: Two-step job-based SSE
- **Conflict view**: Only show sections with conflicts
- **Bulk actions**: "Accept all new" and "Accept AI recommendations"
- **Ordering**: Manual reorder via drag-drop
- **Export**: Markdown with defined structure

### Testing
- **Backend**: pytest + pytest-asyncio
- **Frontend**: Vitest + React Testing Library
- **E2E**: Playwright
- **Coverage**: Unit tests for critical logic, integration tests for APIs, E2E happy path

### Development
- **Approach**: Vertical slices (full features end-to-end)
- **Phases**: 7 phases, each with verification criteria
- **Routing**: `/app/*` for app, `/` for landing page

---

## Open Items / Future Considerations

These items were explicitly deferred:

1. **Authentication** - Add when multi-user support needed
2. **Full-text search (FTS5)** - Add when cross-project search is priority
3. **Additional input formats** - .docx, .pdf if demand arises
4. **Additional export formats** - PDF, Word if demand arises
5. **OpenAI provider** - Add third LLM option if needed
6. **Token-based chunking** - Refine chunking for different models
7. **Confidence thresholds** - Add LLM confidence scores for conflict classification
