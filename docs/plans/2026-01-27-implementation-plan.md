# Implementation Plan: Project Journey UI

**Date:** 2026-01-27
**Status:** Draft
**Related:**
- [UI Design](./2026-01-26-project-journey-ui-design.md)
- [Screen Designs](./2026-01-27-screen-designs.md)

---

## Overview

This plan breaks the Project Journey UI implementation into phases, prioritizing foundational work first, then building features incrementally. Each phase delivers usable functionality.

**Total Screens:** 12
**Total New Components:** ~25
**Estimated Phases:** 5

---

## Phase 1: Foundation

**Goal:** Core infrastructure, navigation, and Dashboard with project cards.

### 1.1 Data Model Updates

| Task | Description |
|------|-------------|
| Add stage status fields to Project | `requirements_status`, `prd_status`, `stories_status`, `mockups_status`, `export_status` |
| Add computed progress field | Calculate percentage from stage statuses |
| Create migration | Add new fields with defaults for existing projects |

**Status enum values:**
```
requirements: "empty" | "has_items" | "reviewed"
prd: "empty" | "draft" | "ready"
stories: "empty" | "generated" | "refined"
mockups: "empty" | "generated"
export: "not_exported" | "exported"
```

### 1.2 API Updates

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET | Add stage statuses and progress to response |
| `/api/projects/{id}/status` | PATCH | Update individual stage status |

### 1.3 Shared Components

| Component | Props | Notes |
|-----------|-------|-------|
| `<Breadcrumbs />` | `items: {label, href}[]` | Dashboard > Project > Stage |
| `<StageStepper />` | `stages`, `currentStage`, `onStageClick` | Horizontal with ○ ◐ ● states |
| `<ProjectCard />` | `project`, `onClick` | Mini stepper, status badge, progress |
| `<EmptyState />` | `icon`, `title`, `description`, `actions` | Reusable empty state |
| `<StatusBadge />` | `status`, `variant` | Has Items, Draft, Ready, etc. |

### 1.4 Dashboard Page

| Task | Description |
|------|-------------|
| Create `/dashboard` route | New page component |
| Welcome header | User name from auth |
| Action cards | "New Project" + "Quick Convert" side by side |
| Project grid | Cards with mini stepper, sorted by last updated |
| Filter bar | Filter by current stage |
| Search | Filter by project name |
| Empty state | First-time user experience |
| New Project modal | Name, description, create |

### 1.5 Navigation Updates

| Task | Description |
|------|-------------|
| Update header | Add Dashboard link |
| Set Dashboard as default | Redirect `/` to `/dashboard` |
| Update sidebar (if exists) | Reflect new structure |

### 1.6 Deliverables

- [ ] Database migration for stage status fields
- [ ] API endpoints updated
- [ ] 5 shared components built
- [ ] Dashboard page functional
- [ ] New Project flow working
- [ ] Navigation updated

---

## Phase 2: Project View Shell & Stage Navigation

**Goal:** Project detail view with stepper navigation, content area routing.

### 2.1 Project View Shell

| Task | Description |
|------|-------------|
| Create `/projects/{id}` route | Shell component |
| Breadcrumbs | Dashboard > Project Name > Stage |
| Project header | Name, description, settings gear |
| Stage stepper | All 5 stages, clickable |
| Content area | Dynamic based on selected stage |
| Settings modal | Rename, archive, delete project |

### 2.2 Stage Routing

| Route | Stage |
|-------|-------|
| `/projects/{id}` | Redirect to current/first incomplete stage |
| `/projects/{id}/requirements` | Requirements stage |
| `/projects/{id}/prd` | PRD stage |
| `/projects/{id}/stories` | User Stories stage |
| `/projects/{id}/mockups` | Mockups stage |
| `/projects/{id}/export` | Export stage |

### 2.3 Stage Shell Components

| Component | Props | Notes |
|-----------|-------|-------|
| `<StageHeader />` | `title`, `subtitle`, `status`, `actions` | Consistent stage header |
| `<StageActions />` | `primary`, `secondary`, `tertiary` | Bottom action bar |
| `<StageContent />` | `children` | Scrollable content area |

### 2.4 Deliverables

- [ ] Project View shell with stepper
- [ ] Stage routing working
- [ ] Settings modal (rename, archive, delete)
- [ ] Breadcrumbs functional
- [ ] Stage shell components built

---

## Phase 3: Project Mode - Core Stages

**Goal:** Requirements, PRD, and User Stories stages within project context.

### 3.1 Requirements Stage

**Adapt existing RequirementsPage functionality.**

| Task | Description |
|------|-------------|
| Empty state | Illustration, "Add Meeting" / "Add Manually" buttons |
| Add Meeting modal | Textarea for transcript, file upload (.txt, .md) |
| Add Manually modal | Single item form with section selector |
| Requirements list | Collapsible sections (Problems, Goals, Features, Constraints) |
| Inline edit | Click to edit requirement text |
| Delete item | Confirm and remove |
| Add item per section | Button at bottom of each section |
| Mark as Reviewed | Update status, show "Generate PRD" action |
| Unmark Reviewed | Revert status |

| Component | Notes |
|-----------|-------|
| `<RequirementSection />` | Collapsible, fixed order |
| `<RequirementItem />` | Inline edit, delete |
| `<AddMeetingModal />` | Textarea + file upload |
| `<AddRequirementModal />` | Section dropdown, text input |

### 3.2 PRD Stage

**Adapt existing PRDGeneratorPage and PRDEditorPage functionality.**

| Task | Description |
|------|-------------|
| Empty state | "Generate from Reqs" / "Write Manually" buttons |
| Generate PRD modal | PRD type selector (Detailed/Brief) |
| Section streaming | Show progress during generation |
| Preview tab | Rendered markdown |
| Edit tab | Simple textarea |
| Version history | Dropdown to view/restore previous versions |
| Regenerate | Confirm dialog, then regenerate |
| Mark as Ready | Update status, show "Generate Stories" action |
| Unmark Ready | Revert status |

| Component | Notes |
|-----------|-------|
| `<PRDPreview />` | Rendered markdown |
| `<PRDEditor />` | Simple textarea |
| `<VersionHistory />` | Dropdown with restore |
| `<GeneratePRDModal />` | Type selector |
| `<RegenerateConfirm />` | Warning dialog |

**Data model addition:**
- PRD version history (store previous versions)

### 3.3 User Stories Stage

**Adapt existing UserStoriesPage functionality.**

| Task | Description |
|------|-------------|
| Empty state | "Generate from PRD" / "Add Manually" buttons |
| Generate Stories modal | Format, include options, story selection |
| Story list | Cards with drag handle, checkbox, content |
| Drag-and-drop reorder | Update order on drop |
| Filters | Status, Size, Priority dropdowns |
| Search | Filter by story text |
| Inline edit | Edit story details |
| Delete story | Confirm and remove |
| Add manually | Story form modal |
| Generate more | Append to existing |
| Labels | User-defined, add/remove |
| Mark as Refined | Update status, show "Gen Mockups" / "Export" |

| Component | Notes |
|-----------|-------|
| `<StoryCard />` | Drag handle, checkbox, size/priority badges |
| `<StoryFilters />` | Dropdowns for status, size, priority |
| `<StoryEditor />` | Modal for edit/add |
| `<GenerateStoriesModal />` | Format, options |
| `<LabelInput />` | Add/remove labels |

### 3.4 Deliverables

- [ ] Requirements stage fully functional
- [ ] PRD stage with version history
- [ ] User Stories stage with reorder and filters
- [ ] All stage transitions working (mark complete → next stage)
- [ ] Status updates reflected in stepper

---

## Phase 4: Quick Convert Mode

**Goal:** Standalone conversion tools without project context.

### 4.1 Quick Convert Landing

| Task | Description |
|------|-------------|
| Create `/quick-convert` route | Landing page |
| 2x2 grid | Requirements, PRD, User Stories, Mockups |
| Conversion type cards | Icon, title, description |
| Back to Dashboard | Link |

### 4.2 Quick Convert - Requirements

| Route | `/quick-convert/requirements` |
|-------|-------------------------------|

| Task | Description |
|------|-------------|
| Input state | Textarea + file upload (.txt, .md) |
| Processing state | Spinner with message |
| Results state | Collapsible sections with checkboxes |
| Inline edit | Edit requirement text |
| Actions | Save to Project (primary), Generate PRD, Download |

### 4.3 Quick Convert - PRD

| Route | `/quick-convert/prd` |
|-------|----------------------|

| Task | Description |
|------|-------------|
| Input source toggle | Paste Text / From Requirements |
| Paste text input | Textarea with placeholder |
| From Reqs input | JSON or bullet points |
| PRD type toggle | Detailed / Brief |
| Section streaming | Progress indicator |
| Preview/Edit tabs | View or edit result |
| Actions | Save to Project (primary), Generate Stories, Download |

### 4.4 Quick Convert - User Stories

| Route | `/quick-convert/stories` |
|-------|--------------------------|

| Task | Description |
|------|-------------|
| Input source toggle | Paste Text / From PRD / From Reqs |
| Format options | Standard, Gherkin, Jobs-to-be-done |
| Include options | Acceptance criteria, Size, Priority |
| Story cards | Checkbox, drag handle, size/priority badges |
| Reorder | Drag-and-drop |
| Inline edit | Edit story |
| Actions | Save to Project (primary), Gen Mockups, Download |

### 4.5 Quick Convert - Mockups

| Route | `/quick-convert/mockups` |
|-------|--------------------------|

| Task | Description |
|------|-------------|
| Input source toggle | Describe UI / From Stories |
| Describe UI input | Textarea with example |
| From Stories input | Paste stories |
| Style options | Wireframe, Low-fi, High-fi |
| Device options | Multi-select: Desktop, Tablet, Mobile |
| Generated result | Image preview |
| Refine input | Textarea for changes |
| Regenerate | Apply refinements |
| Variations | Generate 3 alternatives |
| Actions | Save to Project (primary), Variations, Download |

### 4.6 Save to Project Modal

**Shared across all Quick Convert pages.**

| Task | Description |
|------|-------------|
| Create new project option | Name, description fields |
| Add to existing option | Project dropdown |
| Warning text | "This will replace existing..." |
| Save & Open | Create/update and navigate to project |

| Component | Notes |
|-----------|-------|
| `<SaveToProjectModal />` | Shared modal |

### 4.7 Deliverables

- [ ] Quick Convert landing page
- [ ] Requirements conversion working
- [ ] PRD conversion working
- [ ] User Stories conversion working
- [ ] Mockups conversion working (depends on mockup generation backend)
- [ ] Save to Project modal functional
- [ ] All download actions working

---

## Phase 5: Mockups & Export Stages

**Goal:** Complete the project journey with Mockups and Export.

### 5.1 Mockups Stage (Project Mode)

| Task | Description |
|------|-------------|
| Empty state | "Gen from Stories" / "Describe UI" buttons |
| Generate from Stories modal | Story selection, style, multi-device |
| Describe UI modal | Textarea, style, device |
| Mockup grid | Thumbnails with metadata |
| Mockup card | Name, device icon, style, actions |
| Rename mockup | Click to edit name |
| View detail modal | Full image, story links, refine, variations |
| Refine | Textarea + Regenerate |
| 3 Variations | Generate alternatives |
| Delete mockup | Confirm and remove |
| Download individual | PNG/JPG |
| Download all | Zip file |

| Component | Notes |
|-----------|-------|
| `<MockupGrid />` | Responsive gallery |
| `<MockupCard />` | Thumbnail + metadata |
| `<MockupDetailModal />` | Full view with refine |
| `<GenerateMockupModal />` | Story selection, options |

**Backend dependency:** Mockup generation API (may need separate implementation)

### 5.2 Export Stage (Project Mode)

| Task | Description |
|------|-------------|
| Markdown export card | Checkboxes for what to include |
| Download .zip | Multiple markdown files |
| JSON export card | Download all data |
| Download .json | Structured export |
| Jira card | "Coming Soon" placeholder |
| Export history | List of previous exports |
| Clear history | Delete history entries |
| Status update | Mark as "exported" on first export |

| Component | Notes |
|-----------|-------|
| `<ExportCard />` | Destination with options |
| `<ExportHistory />` | List with clear button |

### 5.3 Deliverables

- [ ] Mockups stage functional (pending backend)
- [ ] Export stage with Markdown and JSON
- [ ] Export history tracking
- [ ] Jira placeholder for future

---

## Phase 6: Polish & Migration

**Goal:** Remove legacy pages, polish UI, complete migration.

### 6.1 Legacy Page Removal

| Page | Action |
|------|--------|
| PRDLandingPage | Remove, redirect to Dashboard |
| StoriesLandingPage | Remove, redirect to Dashboard |
| Old project routes | Redirect to new routes |

### 6.2 Navigation Cleanup

| Task | Description |
|------|-------------|
| Remove old sidebar items | If applicable |
| Update all internal links | Point to new routes |
| 404 handling | Graceful redirects |

### 6.3 UI Polish

| Task | Description |
|------|-------------|
| Loading states | Skeletons for all pages |
| Error states | Consistent error handling |
| Empty states | Illustrations for all |
| Animations | Stepper transitions, card hover |
| Mobile responsive | All screens tested |
| Keyboard navigation | Accessibility |

### 6.4 Deliverables

- [ ] Legacy pages removed
- [ ] All redirects in place
- [ ] Loading/error states complete
- [ ] Mobile responsive verified
- [ ] Accessibility pass

---

## Component Inventory

### New Components (25)

| Component | Phase | Priority |
|-----------|-------|----------|
| `<Breadcrumbs />` | 1 | High |
| `<StageStepper />` | 1 | High |
| `<ProjectCard />` | 1 | High |
| `<EmptyState />` | 1 | High |
| `<StatusBadge />` | 1 | High |
| `<StageHeader />` | 2 | High |
| `<StageActions />` | 2 | High |
| `<StageContent />` | 2 | High |
| `<RequirementSection />` | 3 | High |
| `<RequirementItem />` | 3 | High |
| `<AddMeetingModal />` | 3 | High |
| `<AddRequirementModal />` | 3 | Medium |
| `<PRDPreview />` | 3 | High |
| `<PRDEditor />` | 3 | High |
| `<VersionHistory />` | 3 | Medium |
| `<GeneratePRDModal />` | 3 | High |
| `<StoryCard />` | 3 | High |
| `<StoryFilters />` | 3 | Medium |
| `<StoryEditor />` | 3 | High |
| `<GenerateStoriesModal />` | 3 | High |
| `<LabelInput />` | 3 | Medium |
| `<SaveToProjectModal />` | 4 | High |
| `<MockupGrid />` | 5 | High |
| `<MockupCard />` | 5 | High |
| `<MockupDetailModal />` | 5 | High |
| `<ExportCard />` | 5 | High |
| `<ExportHistory />` | 5 | Medium |

### Existing Components to Adapt

| Component | Adaptation Needed |
|-----------|-------------------|
| Requirements extraction | Move to modal, add to stage |
| PRD generation/streaming | Add version history, move to stage |
| User stories list | Add drag-drop, filters, labels |

---

## Dependencies & Risks

### Dependencies

| Dependency | Blocks | Mitigation |
|------------|--------|------------|
| Mockup generation API | Phase 5 mockups | Can build UI first, mock data |
| PRD version storage | Phase 3 PRD | Add database table |
| File upload handling | Phase 3 Requirements | Verify existing capability |

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Mockup AI quality | User adoption | Set expectations, iterate |
| Migration breaks existing flows | User disruption | Feature flag, gradual rollout |
| Mobile responsiveness | Usability | Test early, not just at end |

---

## Phase Summary

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| 1 | Foundation | Dashboard, Project Cards, Data Model |
| 2 | Project Shell | Stepper, Stage Routing, Settings |
| 3 | Core Stages | Requirements, PRD, User Stories (Project Mode) |
| 4 | Quick Convert | All 4 Quick Convert pages + Save Modal |
| 5 | New Features | Mockups Stage, Export Stage |
| 6 | Polish | Legacy removal, Responsive, Accessibility |

---

## Next Steps

1. Review and approve this plan
2. Create PRD/user stories for Phase 1
3. Begin implementation

