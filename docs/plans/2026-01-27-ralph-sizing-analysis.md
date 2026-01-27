# Ralph Sizing Analysis: Project Journey UI

**Date:** 2026-01-27
**Purpose:** Determine which user stories can be completed in one Ralph loop vs need breakdown

---

## Sizing Criteria

Ralph requires tasks completable in **one iteration** (~one context window):

**Right-sized tasks:**
- Add a database column + migration
- Create a single UI component
- Implement one server action
- Add a filter to an existing list
- Write tests for one module

**Too big (need splitting):**
- Multiple components in one task
- Full page with many features
- Features requiring both backend + frontend + tests

---

## Analysis by Phase

### Phase 1: Foundation

| Story | Size | Ralph-Ready? | Notes |
|-------|------|--------------|-------|
| P1-001: Stage Status Fields | M | ✅ Yes | Single migration + model update |
| P1-002: Computed Progress Field | S | ✅ Yes | One utility function + API update |
| P1-003: Breadcrumbs Component | S | ✅ Yes | Single UI component |
| P1-004: Stage Stepper Component | M | ✅ Yes | Single component, but complex - borderline |
| P1-005: Project Card Component | M | ✅ Yes | Single component |
| P1-006: Empty State Component | S | ✅ Yes | Simple reusable component |
| P1-007: Status Badge Component | S | ✅ Yes | Simple component |
| P1-008: Dashboard Page | L | ❌ **Split** | Too many features: routing, layout, cards, filters, search, empty state |
| P1-009: New Project Modal | M | ✅ Yes | Single modal component + action |
| P1-010: Update Navigation | S | ✅ Yes | Configuration change |

**P1-008 Breakdown:**
- P1-008a: Dashboard route and basic layout (welcome header, action cards placement)
- P1-008b: Dashboard project grid with ProjectCard integration
- P1-008c: Dashboard filter dropdown (by stage)
- P1-008d: Dashboard search input
- P1-008e: Dashboard empty state (no projects)

---

### Phase 2: Project View Shell

| Story | Size | Ralph-Ready? | Notes |
|-------|------|--------------|-------|
| P2-001: Project View Shell | L | ❌ **Split** | Layout + breadcrumbs + stepper + content area |
| P2-002: Stage Routing | M | ✅ Yes | Route configuration + redirect logic |
| P2-003: Project Settings Modal | M | ✅ Yes | Single modal, manageable scope |
| P2-004: Stage Header Component | S | ✅ Yes | Simple component |
| P2-005: Stage Actions Component | S | ✅ Yes | Simple component |

**P2-001 Breakdown:**
- P2-001a: Project View route and basic layout (fetch project, display header)
- P2-001b: Project View integrate breadcrumbs
- P2-001c: Project View integrate stage stepper
- P2-001d: Project View content area with stage switching

---

### Phase 3: Core Stages - Requirements

| Story | Size | Ralph-Ready? | Notes |
|-------|------|--------------|-------|
| P3-001: Requirements Empty State | S | ✅ Yes | Use EmptyState component |
| P3-002: Add Meeting Modal | L | ❌ **Split** | Modal + file upload + AI extraction + results display |
| P3-003: Add Manually | S | ✅ Yes | Simple modal |
| P3-004: Display List | M | ✅ Yes | List rendering with sections |
| P3-005: Inline Edit | S | ✅ Yes | Single interaction pattern |
| P3-006: Delete Item | S | ✅ Yes | Simple action |
| P3-007: Mark as Reviewed | S | ✅ Yes | Status update + UI change |

**P3-002 Breakdown:**
- P3-002a: Add Meeting Modal UI (textarea + file upload zone)
- P3-002b: Add Meeting file upload handling
- P3-002c: Add Meeting AI extraction integration
- P3-002d: Add Meeting results display with selection

---

### Phase 3: Core Stages - PRD

| Story | Size | Ralph-Ready? | Notes |
|-------|------|--------------|-------|
| P3-008: PRD Empty State | S | ✅ Yes | Use EmptyState component |
| P3-009: Generate PRD Modal | S | ✅ Yes | Simple options modal |
| P3-010: Section Streaming | M | ✅ Yes | Adapt existing streaming logic |
| P3-011: Preview and Edit Tabs | M | ✅ Yes | Tab component + textarea |
| P3-012: Version History | M | ❌ **Split** | Backend storage + dropdown + restore logic |
| P3-013: Regenerate with Warning | S | ✅ Yes | Confirmation dialog |
| P3-014: Mark as Ready | S | ✅ Yes | Status update |

**P3-012 Breakdown:**
- P3-012a: PRD version storage (database + API)
- P3-012b: PRD version history dropdown UI
- P3-012c: PRD version restore functionality

---

### Phase 3: Core Stages - User Stories

| Story | Size | Ralph-Ready? | Notes |
|-------|------|--------------|-------|
| P3-015: User Stories Empty State | S | ✅ Yes | Use EmptyState component |
| P3-016: Generate Stories Modal | M | ✅ Yes | Options modal |
| P3-017: Story Card Component | M | ✅ Yes | Single component |
| P3-018: Drag and Drop Reorder | M | ✅ Yes | Add dnd library + integrate |
| P3-019: Filters | S | ✅ Yes | Dropdown + filter logic |
| P3-020: Edit Story | M | ✅ Yes | Modal with form |
| P3-021: Add Story Manually | S | ✅ Yes | Reuse edit modal |
| P3-022: Generate More Stories | S | ✅ Yes | Reuse generation modal |
| P3-023: Labels | M | ✅ Yes | Tag input component |
| P3-024: Mark as Refined | S | ✅ Yes | Status update |
| P3-025: Summary with Priority Count | S | ✅ Yes | Header calculation |

---

### Phase 4: Quick Convert

| Story | Size | Ralph-Ready? | Notes |
|-------|------|--------------|-------|
| P4-001: Quick Convert Landing | M | ✅ Yes | Simple page with cards |
| P4-002: QC Requirements Page | L | ❌ **Split** | Full page with multiple states |
| P4-003: QC PRD Page | L | ❌ **Split** | Full page with multiple states |
| P4-004: QC User Stories Page | L | ❌ **Split** | Full page with multiple states |
| P4-005: QC Mockups Page | L | ❌ **Split** | Full page with multiple states |
| P4-006: Save to Project Modal | M | ✅ Yes | Single modal |
| P4-007: Download Functionality | M | ✅ Yes | Utility functions |

**P4-002 Breakdown (Requirements):**
- P4-002a: QC Requirements route + input state UI
- P4-002b: QC Requirements processing + results display
- P4-002c: QC Requirements actions (integrate Save modal, download)

**P4-003 Breakdown (PRD):**
- P4-003a: QC PRD route + input state UI (both modes)
- P4-003b: QC PRD streaming + result display
- P4-003c: QC PRD actions integration

**P4-004 Breakdown (User Stories):**
- P4-004a: QC Stories route + input state UI
- P4-004b: QC Stories generation + card display
- P4-004c: QC Stories reorder + actions

**P4-005 Breakdown (Mockups):**
- P4-005a: QC Mockups route + input state UI
- P4-005b: QC Mockups generation + display
- P4-005c: QC Mockups refine + variations

---

### Phase 5: Mockups & Export

| Story | Size | Ralph-Ready? | Notes |
|-------|------|--------------|-------|
| P5-001: Mockups Empty State | S | ✅ Yes | Use EmptyState |
| P5-002: Generate from Stories Modal | M | ✅ Yes | Selection modal |
| P5-003: Describe UI Modal | S | ✅ Yes | Simple modal |
| P5-004: Mockup Grid | M | ✅ Yes | Grid layout + filters |
| P5-005: Mockup Card | S | ✅ Yes | Single component |
| P5-006: Detail Modal | M | ✅ Yes | Modal with actions |
| P5-007: Rename Mockup | S | ✅ Yes | Inline edit |
| P5-008: Download All | S | ✅ Yes | Zip generation |
| P5-009: Export Default State | M | ✅ Yes | Layout with cards |
| P5-010: Markdown Export | M | ✅ Yes | Zip generation logic |
| P5-011: JSON Export | S | ✅ Yes | JSON serialization |
| P5-012: Export History | S | ✅ Yes | List component |

---

### Phase 6: Polish

| Story | Size | Ralph-Ready? | Notes |
|-------|------|--------------|-------|
| P6-001: Remove Legacy PRD Page | S | ✅ Yes | Delete + redirect |
| P6-002: Remove Legacy Stories Page | S | ✅ Yes | Delete + redirect |
| P6-003: Loading States | M | ❌ **Split** | Multiple pages to update |
| P6-004: Error States | M | ❌ **Split** | Multiple error scenarios |
| P6-005: Mobile Responsive | L | ❌ **Split** | Multiple pages to test/fix |
| P6-006: Keyboard Navigation | L | ❌ **Split** | Multiple components to update |

**P6-003 Breakdown:**
- P6-003a: Dashboard loading skeleton
- P6-003b: Project View loading skeleton
- P6-003c: Stage content loading states

**P6-004 Breakdown:**
- P6-004a: API error toast notifications
- P6-004b: Generation error handling with retry
- P6-004c: 404 and network error handling

**P6-005 Breakdown:**
- P6-005a: Dashboard mobile layout
- P6-005b: Project View mobile layout
- P6-005c: Modals full-screen mobile

**P6-006 Breakdown:**
- P6-006a: Tab order and focus states
- P6-006b: Modal focus trapping
- P6-006c: ARIA labels and screen reader testing

---

## Summary

| Phase | Original Stories | Ralph Tasks | Stories Needing Split |
|-------|-----------------|-------------|----------------------|
| Phase 1 | 10 | 14 | 1 (P1-008) |
| Phase 2 | 5 | 8 | 1 (P2-001) |
| Phase 3 | 25 | 31 | 2 (P3-002, P3-012) |
| Phase 4 | 7 | 18 | 4 (P4-002, P4-003, P4-004, P4-005) |
| Phase 5 | 12 | 12 | 0 |
| Phase 6 | 6 | 14 | 4 (P6-003, P6-004, P6-005, P6-006) |
| **Total** | **65** | **97** | **12** |

---

## Stories That Need Breakdown

### Must Split (12 stories → 44 tasks):

1. **P1-008: Dashboard Page** → 5 tasks
2. **P2-001: Project View Shell** → 4 tasks
3. **P3-002: Add Meeting Modal** → 4 tasks
4. **P3-012: PRD Version History** → 3 tasks
5. **P4-002: QC Requirements Page** → 3 tasks
6. **P4-003: QC PRD Page** → 3 tasks
7. **P4-004: QC User Stories Page** → 3 tasks
8. **P4-005: QC Mockups Page** → 3 tasks
9. **P6-003: Loading States** → 3 tasks
10. **P6-004: Error States** → 3 tasks
11. **P6-005: Mobile Responsive** → 3 tasks
12. **P6-006: Keyboard Navigation** → 3 tasks

---

## Recommended Action

Update the user stories document to break down the 12 large stories into Ralph-sized tasks, bringing the total from 65 to ~97 tasks.

Alternatively, keep the current structure for human planning but create a separate `ralph-tasks.json` or use the task_list system when ready to execute with Ralph.
