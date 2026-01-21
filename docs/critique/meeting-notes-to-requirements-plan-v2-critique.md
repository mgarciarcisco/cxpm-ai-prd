## Critique: Meeting Notes to Requirements Plan (v2)

Below is a gap analysis and critique of the plan as written (no edits made).

## Critical gaps
- **Data model missing extracted recap structure**: `MeetingRecap` stores only `raw_input`; there’s no table for extracted sections/items, edits, or per-item status. The Recap Editor flow needs persisted structured items (e.g., `MeetingItem` with section, content, order, deleted flag) to support editing, “Save & Apply,” and conflict detection.
- **Conflict detection data lifecycle unclear**: “duplicate → skip silently” loses traceability. You’ll want an audit record for skipped items (e.g., in `RequirementHistory` or a `MeetingItemDecision` table) so the PM can see what was ignored and why.
- **SQLite full-text index assumption**: `Requirement(content)` index won’t give full-text search in SQLite; it requires FTS5 virtual tables. If full-text is required, the plan should specify FTS schema and sync strategy.
- **Streaming + upload flow is under-specified**: EventSource uses GET only; file upload is POST. You need a two-step flow (upload → job id, then SSE by job id) or switch to SSE over POST via fetch/ReadableStream.
- **Concurrency and idempotency not addressed**: Re-applying a meeting, re-running extraction, and concurrent edits need idempotent endpoints and state transitions (e.g., `status: pending|processed|applied`, `applied_at`, optimistic locking).

## Major gaps / risks
- **LLM conflict classification reliability**: The plan depends on LLM to classify `duplicate/refinement/contradiction`. There’s no confidence threshold, human-readable rationale, or deterministic fallback logic, which risks inconsistent behavior and difficult debugging.
- **Chunking strategy uses characters, not tokens**: `CHUNK_SIZE` in characters is brittle across models. Needs token-based limits and a “preserve section headers” strategy to avoid mixed sections.
- **Requirement ordering and section semantics undefined**: How are items ordered within a section (created_at, manual ordering, rank)? Without explicit ordering, editing and exports will be inconsistent.
- **History lacks actor attribution**: `RequirementHistory` doesn’t store who made the change. Even in “single-user local,” a future multi-user path or audit trail needs an `actor` (system vs user, or user id).
- **Conflicts “Merge” option needs spec**: How does merge happen (AI-suggested, manual inline editor)? The plan doesn’t define UX or backend representation for merged content.
- **API surface not enumerated**: The plan lists routers but not endpoint contracts, request/response shapes, or error codes. That creates integration risks for streaming, conflict handling, and edit persistence.

## Medium gaps
- **MeetingRecap missing updated_at / applied_at**: You’ll need `updated_at`, `processed_at`, `applied_at`, and likely `status` to support retries and UI badges beyond a boolean.
- **RequirementSource doesn’t include project_id**: This makes some queries more expensive; adding `project_id` avoids joins for common “project → sources” lookups.
- **LLM prompt versioning and experiments**: Prompts are files but there’s no versioning or a way to record which prompt produced which extraction (important for traceability).
- **Export format spec**: “Markdown only” is too vague. Define section headers, ordering, inclusion of metadata (project name, date range, meeting sources), and stable identifiers.
- **Testing gaps**: There’s no explicit test for conflict resolution logic application (e.g., merge outcomes, history entries) or streaming error behavior (retry logic, timeouts).
- **Security + data limits**: File upload limits, sanitization, and encoding handling aren’t specified. A local app still needs size limits and safe parsing.

## Minor issues / inconsistencies
- **`httpx` is duplicated** in dependencies list.
- **Claude fallback is optional but not guarded** in UX: the plan should ensure the UI explains missing API key vs “LLM unavailable.”
- **Ollama install commands** use `curl | sh`, which may be unsuitable for Windows; the plan should mention Windows-native install.

## Suggestions to close gaps (without changing plan content)
- Add a structured recap storage model and decisions table to support editing and conflict traceability.
- Define job-based processing for uploads and SSE streaming.
- Specify ordering and IDs for requirement items for stable edits and exports.
- Add idempotency and status lifecycle to `MeetingRecap`.
- Define FTS5 or remove “full-text” indexing claim.

## Rule compliance notes
- **No hardcoded credentials**: The only credential shown is `ANTHROPIC_API_KEY` as an environment variable placeholder (`sk-ant-...`), which is acceptable and not a real secret. I did not introduce any secrets.
- **Digital certificates**: No PEM/CRT/DER data appears in the plan, so no certificate checks are applicable.
- **Crypto algorithms**: No crypto code is specified; no insecure algorithms were introduced.
