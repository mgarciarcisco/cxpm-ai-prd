# Code Review - 2026-01-28

## Summary

Total issues identified: **23**
- Critical: 1 (1 fixed)
- High: 4 (4 fixed)
- Medium: 10 (6 fixed, 4 deferred)
- Low: 8 (0 fixed - not in scope)

**Progress: 11 of 15 Critical/High/Medium bugs fixed**

---

## Fixed Issues

| Priority | Issue | File(s) | Status | Commit |
|----------|-------|---------|--------|--------|
| Critical | Story generation `handleGenerate` does not call backend API | `ui/src/components/stages/UserStoriesStage.jsx` | **FIXED** | `cf1c73b` |
| High | Incorrect navigation path `/app/projects/:id` should be `/projects/:id` | `ui/src/components/projects/ProjectCard.jsx` | **FIXED** | `62aa02f` |
| High | Priority is modeled in UI/API but not persisted | `backend/app/models/user_story.py`, `backend/app/routers/stories.py`, `backend/app/schemas/user_story.py` | **FIXED** | `0ebedc5` |
| High | Manual story creation fails to update `stories_status` due to enum vs string comparison | `backend/app/routers/stories.py` | **FIXED** | `4502daf` |
| High | Sequential API calls for each item (N+1) in SaveToProjectModal | `ui/src/components/quick-convert/SaveToProjectModal.jsx` | **FIXED** | `0e1a825` |
| Medium | Race condition in delete: `remainingTotal` computed from stale snapshot | `ui/src/components/stages/RequirementsStage.jsx` | **FIXED** | `b5f4d8e` |
| Medium | Missing `loadPRDFromId` dependency in effect | `ui/src/components/stages/PRDStage.jsx` | **FIXED** | `7c9bb3c` |
| Medium | PRD restore creates READY PRD but does not update project `prd_status` | `backend/app/routers/prds.py` | **FIXED** | `21624be` |
| Medium | Quick Convert PRD "Save to Project" ignores edits | `ui/src/pages/QuickConvertPRDPage.jsx` | **FIXED** | `409ed8c` |
| Medium | Requirements stage can remain in empty state after first add | `ui/src/components/stages/RequirementsStage.jsx` | **FIXED** | `f1570e4` |
| Medium | Manifest marks P3-006 as blocked even though delete works | `ralph/manifest.json` | **FIXED** | `07f7c78` |

---

## Deferred Issues (Larger Scope)

These issues require implementing new backend API integrations or significant new functionality:

| Priority | Issue | File(s) | Reason Deferred |
|----------|-------|---------|-----------------|
| Medium | Quick Convert requirements uses simulated extraction | `ui/src/pages/QuickConvertRequirementsPage.jsx` | Requires new backend API integration for requirements extraction - essentially a new feature |
| Medium | Quick Convert PRD uses simulated generation | `ui/src/pages/QuickConvertPRDPage.jsx` | Requires integrating with existing PRD SSE streaming API - needs project context handling |
| Medium | Quick Convert Stories uses simulated generation | `ui/src/pages/QuickConvertStoriesPage.jsx` | Requires integrating with existing Stories SSE streaming API - needs PRD/requirements context |
| Medium | No per-item progress indicator during multi-item save | `ui/src/components/quick-convert/SaveToProjectModal.jsx` | UX enhancement - parallel saves make progress harder to track; would need different approach |

---

## Low Priority Issues (Not Addressed)

These are refactoring/cleanup items that don't affect functionality:

| Priority | Issue | File(s) | Notes |
|----------|-------|---------|-------|
| Low | `formatTimeAgo` duplicated across files | Multiple files | Refactor candidate - extract to shared utility |
| Low | `getStageStatus`, `getCurrentStage` duplicated | Multiple files | Refactor candidate - extract to shared utility |
| Low | `SECTION_CONFIG`, `SECTION_ORDER` duplicated | Multiple files | Refactor candidate - extract to constants file |
| Low | SQLAlchemy boolean comparisons use `== True` | Backend files | Lint warning - use `is True` instead |
| Low | `jobId` not reset on new extraction if upload fails | `ui/src/components/requirements/AddMeetingModal.jsx` | Edge case - stale job ID after failed upload |
| Low | Unused stub methods `handleEditProject`, `handleDeleteProject` | `ui/src/pages/DashboardPage.jsx` | Dead code - can be removed |
| Low | Quick Convert "Save Stories" defaults size to `"M"` | `ui/src/components/quick-convert/SaveToProjectModal.jsx` | Case mismatch - now fixed in N+1 fix (uses lowercase) |
| Low | PRD edit parser drops content before first `##` header | `ui/src/components/stages/PRDStage.jsx` | Edge case - content before first header is lost |

---

## Fix Details & Commentary

### Critical Fix: Story Generation API Integration

**Problem:** The `handleGenerate` function in `UserStoriesStage.jsx` was a stub that only logged options without calling the backend API. Users clicking "Generate from PRD" saw no real stories generated.

**Solution:** Integrated the existing `useStoriesStreaming` hook to connect to the backend SSE streaming endpoint. Added state management for generation progress and a real-time UI showing stories as they stream in. The format selection from the modal is now properly mapped to backend formats (`classic` or `job_story`).

### High Fix: Priority Field Persistence

**Problem:** The UI had priority fields (P1, P2, P3) for stories, but the backend model lacked the field entirely. Edits were silently dropped, and priority filters/summaries showed incorrect data.

**Solution:** Added `StoryPriority` enum to the model with values `p1`, `p2`, `p3`. Updated the schema to use the enum type instead of string. Modified the router to persist priority on create/update and include it in responses. This required changes to 4 files across backend model, schema, router, and model exports.

### High Fix: Enum vs String Comparison

**Problem:** When creating a story manually, the code compared `project.stories_status == "empty"` but `stories_status` is a SQLAlchemy enum, not a string. The comparison always failed, so the project status never updated from "empty" to "generated".

**Solution:** Changed to use the proper enum: `StoriesStatus.empty` and `StoriesStatus.generated`. This is a common Python/SQLAlchemy gotcha - enum values need to be compared with enum members, not strings.

### High Fix: N+1 API Calls

**Problem:** SaveToProjectModal looped through items and awaited each API call sequentially. Saving 10 requirements made 10 serial requests, taking ~10x longer than necessary.

**Solution:** Refactored to build arrays of promises and use `Promise.all()` for parallel execution. Also fixed the story size/priority to use lowercase values as expected by the backend enum. This is a significant UX improvement for Quick Convert saves.

### Medium Fix: Stale Closure in Delete

**Problem:** After optimistic UI update, the code computed `remainingTotal` using the old `requirements` state from the closure. This could cause incorrect "empty" detection if React hadn't yet updated the state.

**Solution:** Moved the remaining count computation *before* the optimistic update, using the current state to calculate what the count will be after deletion. This ensures the value is correct regardless of React's state update timing.

### Medium Fix: PRD Restore Status

**Problem:** Restoring a historical PRD version created a new PRD with READY status but never updated the project's `prd_status` field. The project could show "empty" or "draft" even with a restored PRD.

**Solution:** Added code to update `project.prd_status = PRDStageStatus.ready` during the restore operation, ensuring the project stage status stays in sync with the actual PRD state.

### Medium Fix: Quick Convert Save Ignores Edits

**Problem:** Users could edit the generated PRD in the "Edit" tab, but clicking "Save to Project" always saved the original generated sections, discarding their edits.

**Solution:** Added a `parseMarkdownToSections()` function that parses the edited markdown back into section objects. The save now uses `getSectionsForSave()` which returns parsed sections when in edit mode or original sections otherwise.

---

## Recommendations for Future Work

1. **Quick Convert Backend Integration:** The simulated generation in Quick Convert pages should be replaced with real backend API calls. This would leverage the existing SSE streaming infrastructure already used in the project journey.

2. **Code Deduplication:** Consider extracting duplicated utilities (`formatTimeAgo`, stage status helpers, section configs) into a shared module.

3. **Database Migration:** The new `priority` field on UserStory needs a migration to add the column to existing databases. Run alembic migration before deployment.

4. **Test Coverage:** The fixes should be covered by integration tests, particularly the story generation streaming and priority persistence.
