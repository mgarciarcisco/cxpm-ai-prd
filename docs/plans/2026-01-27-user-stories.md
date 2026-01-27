# User Stories: Project Journey UI

**Date:** 2026-01-27
**Branch:** feature/project-journey-ui
**Related:**
- [Implementation Plan](./2026-01-27-implementation-plan.md)
- [Ralph Sizing Analysis](./2026-01-27-ralph-sizing-analysis.md)

**Note:** Stories marked with 🔷 have been broken down into Ralph-sized subtasks.

---

## Phase 1: Foundation

### P1-001: Add Stage Status Fields to Project Model

**As a** developer
**I want** stage status fields on the Project model
**So that** we can track progress through the project journey

**Acceptance Criteria:**
- [ ] Project model has `requirements_status` field (enum: empty, has_items, reviewed)
- [ ] Project model has `prd_status` field (enum: empty, draft, ready)
- [ ] Project model has `stories_status` field (enum: empty, generated, refined)
- [ ] Project model has `mockups_status` field (enum: empty, generated)
- [ ] Project model has `export_status` field (enum: not_exported, exported)
- [ ] Database migration creates fields with sensible defaults for existing projects
- [ ] API returns stage statuses when fetching project(s)

**Size:** M | **Priority:** P1

---

### P1-002: Add Computed Progress Field

**As a** user
**I want** to see an overall progress percentage for each project
**So that** I can quickly understand how far along a project is

**Acceptance Criteria:**
- [ ] Progress calculated from stage statuses (0-100%)
- [ ] Each stage contributes 20% when complete
- [ ] Partial credit for in-progress stages (e.g., "has_items" = 10%, "reviewed" = 20%)
- [ ] Progress returned in project API response

**Size:** S | **Priority:** P1

---

### P1-003: Create Breadcrumbs Component

**As a** user
**I want** breadcrumb navigation
**So that** I can understand where I am and navigate back easily

**Acceptance Criteria:**
- [ ] Component accepts array of `{label, href}` items
- [ ] Displays as: Item1 / Item2 / Item3
- [ ] All items except last are clickable links
- [ ] Last item is plain text (current location)
- [ ] Responsive - truncates middle items on small screens if needed

**Size:** S | **Priority:** P1

---

### P1-004: Create Stage Stepper Component

**As a** user
**I want** a horizontal stepper showing all project stages
**So that** I can see progress and navigate between stages

**Acceptance Criteria:**
- [ ] Displays 5 stages: Requirements, PRD, User Stories, Mockups, Export
- [ ] Shows status indicator for each: ○ (empty), ◐ (in progress), ● (complete)
- [ ] Current stage is visually highlighted
- [ ] All stages are clickable (non-linear navigation)
- [ ] Stage labels visible on all screen sizes
- [ ] Clicking a stage triggers `onStageClick` callback

**Size:** M | **Priority:** P1

---

### P1-005: Create Project Card Component

**As a** user
**I want** project cards that show key info at a glance
**So that** I can quickly scan my projects on the dashboard

**Acceptance Criteria:**
- [ ] Displays project name (bold)
- [ ] Displays description (truncated if long)
- [ ] Shows mini stepper with dots only (no labels)
- [ ] Shows current stage badge (e.g., "User Stories")
- [ ] Shows progress percentage
- [ ] Shows "Updated X ago" timestamp
- [ ] Hover state with subtle highlight
- [ ] Entire card is clickable

**Size:** M | **Priority:** P1

---

### P1-006: Create Empty State Component

**As a** user
**I want** friendly empty states throughout the app
**So that** I know what to do when there's no content

**Acceptance Criteria:**
- [ ] Component accepts: icon/illustration, title, description, action buttons
- [ ] Centered layout
- [ ] Action buttons displayed below description
- [ ] Reusable across all empty states in the app

**Size:** S | **Priority:** P1

---

### P1-007: Create Status Badge Component

**As a** user
**I want** visual badges showing status
**So that** I can quickly see the state of things

**Acceptance Criteria:**
- [ ] Supports variants: empty, in_progress, complete
- [ ] Different colors per variant (gray, yellow, green)
- [ ] Displays text label (e.g., "Draft", "Ready", "Has Items")
- [ ] Compact size suitable for inline display

**Size:** S | **Priority:** P1

---

### 🔷 P1-008: Create Dashboard Page

**As a** user
**I want** a dashboard showing all my projects
**So that** I can see everything at a glance and take action

**Acceptance Criteria:**
- [ ] Route: `/dashboard`
- [ ] Welcome header with user's name
- [ ] Two action cards side by side: "New Project" and "Quick Convert"
- [ ] "Your Projects" section heading
- [ ] Grid of project cards
- [ ] Default sort: by last updated (most recent first)
- [ ] Filter dropdown: by current stage (All, Requirements, PRD, etc.)
- [ ] Search input: filters by project name
- [ ] Empty state when no projects exist

**Size:** L | **Priority:** P1

#### Ralph Subtasks:

**P1-008a: Dashboard Route and Layout**
- Create `/dashboard` route
- Welcome header with user's name
- Two action card placeholders: "New Project" and "Quick Convert"
- "Your Projects" section heading
- Basic page structure

**P1-008b: Dashboard Project Grid**
- Fetch projects API call
- Grid layout for ProjectCard components
- Default sort by last updated
- Loading state while fetching

**P1-008c: Dashboard Filter Dropdown**
- Filter dropdown component (All, Requirements, PRD, User Stories, Mockups, Export)
- Filter logic to show only matching projects
- Persist filter in URL query param

**P1-008d: Dashboard Search**
- Search input component
- Filter projects by name (client-side)
- Debounced search
- Clear search button

**P1-008e: Dashboard Empty State**
- Show EmptyState when no projects exist
- Different message for "no projects" vs "no results"

---

### P1-009: Create New Project Modal

**As a** user
**I want** to create a new project from the dashboard
**So that** I can start a new product journey

**Acceptance Criteria:**
- [ ] Modal opens when clicking "New Project" action card
- [ ] Name field (required)
- [ ] Description field (optional)
- [ ] Cancel button closes modal
- [ ] Create button creates project and navigates to project view
- [ ] Validation: name cannot be empty
- [ ] Loading state while creating

**Size:** M | **Priority:** P1

---

### P1-010: Update Navigation to Dashboard

**As a** user
**I want** the app to use Dashboard as the home page
**So that** I have a central place to access everything

**Acceptance Criteria:**
- [ ] `/` redirects to `/dashboard`
- [ ] Header has Dashboard link/logo that goes to `/dashboard`
- [ ] Existing navigation items still work

**Size:** S | **Priority:** P1

---

### P1-011: Auto-Update Stage Status on Content Change

**As a** user
**I want** stage statuses to update automatically when I add/remove content
**So that** I don't have to manually track progress

**Acceptance Criteria:**
- [ ] Adding first requirement updates requirements_status from "empty" to "has_items"
- [ ] Removing all requirements updates to "empty"
- [ ] Generating PRD updates prd_status from "empty" to "draft"
- [ ] Generating stories updates stories_status from "empty" to "generated"
- [ ] Generating mockups updates mockups_status from "empty" to "generated"
- [ ] First export updates export_status to "exported"

**Size:** M | **Priority:** P1

---

### P1-012: Create Stage Status API Endpoints

**As a** developer
**I want** dedicated API endpoints for stage status
**So that** the frontend can efficiently fetch and update progress

**Acceptance Criteria:**
- [ ] GET /api/projects/{id}/progress returns all stage statuses
- [ ] PATCH /api/projects/{id}/stages/{stage} updates individual stage status
- [ ] Status changes trigger progress recalculation

**Size:** S | **Priority:** P1

---

### P1-013: Dashboard Archive Filter

**As a** user
**I want** to view and manage archived projects
**So that** I can find old projects or unarchive them

**Acceptance Criteria:**
- [ ] Filter dropdown includes "Archived" option
- [ ] Archived projects show with visual indicator
- [ ] Can unarchive from project settings
- [ ] Archived projects hidden from default view

**Size:** S | **Priority:** P2

---

### P1-014: Create Confirmation Dialog Component

**As a** developer
**I want** a reusable confirmation dialog
**So that** destructive actions have consistent UX

**Acceptance Criteria:**
- [ ] Supports title, message, confirm/cancel buttons
- [ ] Supports "type to confirm" pattern (for delete project)
- [ ] Supports warning/danger variants
- [ ] Accessible (focus trap, escape to close)

**Size:** S | **Priority:** P1

---

## Phase 2: Project View Shell

### 🔷 P2-001: Create Project View Shell

**As a** user
**I want** a project detail view with stage navigation
**So that** I can work through the project journey

**Acceptance Criteria:**
- [ ] Route: `/projects/{id}`
- [ ] Breadcrumbs: Dashboard / Project Name / Stage Name
- [ ] Project header: name, description
- [ ] Settings gear icon in header
- [ ] Stage stepper below header
- [ ] Content area below stepper for stage content
- [ ] Defaults to first incomplete stage (or Requirements if all empty)

**Size:** L | **Priority:** P1

#### Ralph Subtasks:

**P2-001a: Project View Route and Header**
- Create `/projects/{id}` route
- Fetch project by ID
- Display project name and description
- Settings gear icon (placeholder action)
- Loading and error states

**P2-001b: Project View Breadcrumbs**
- Integrate Breadcrumbs component
- Dynamic breadcrumbs: Dashboard / {Project Name} / {Stage Name}
- Update on stage change

**P2-001c: Project View Stepper Integration**
- Add StageStepper component
- Pass stage statuses from project data
- Highlight current stage
- Handle stage click navigation

**P2-001d: Project View Content Area**
- Content area that renders based on current stage
- Stage component switching logic
- Default to first incomplete stage on load

---

### P2-002: Implement Stage Routing

**As a** user
**I want** URLs for each stage
**So that** I can bookmark or share links to specific stages

**Acceptance Criteria:**
- [ ] `/projects/{id}/requirements` - Requirements stage
- [ ] `/projects/{id}/prd` - PRD stage
- [ ] `/projects/{id}/stories` - User Stories stage
- [ ] `/projects/{id}/mockups` - Mockups stage
- [ ] `/projects/{id}/export` - Export stage
- [ ] `/projects/{id}` redirects to current/first incomplete stage
- [ ] Stepper highlights correct stage based on URL
- [ ] Clicking stepper updates URL

**Size:** M | **Priority:** P1

---

### P2-003: Create Project Settings Modal

**As a** user
**I want** to manage project settings
**So that** I can rename, archive, or delete projects

**Acceptance Criteria:**
- [ ] Opens when clicking settings gear
- [ ] Rename: inline edit for name and description
- [ ] Archive: button to archive project (removes from main list)
- [ ] Delete: button with confirmation dialog
- [ ] Delete confirmation requires typing project name
- [ ] Changes save immediately (or explicit save button)

**Size:** M | **Priority:** P2

---

### P2-004: Create Stage Header Component

**As a** developer
**I want** a consistent stage header component
**So that** all stages have uniform layout

**Acceptance Criteria:**
- [ ] Displays stage title
- [ ] Displays subtitle (e.g., "12 items across 4 sections")
- [ ] Displays status badge
- [ ] Slot for action buttons on the right
- [ ] Consistent padding and typography

**Size:** S | **Priority:** P1

---

### P2-005: Create Stage Actions Component

**As a** developer
**I want** a consistent stage actions bar
**So that** all stages have uniform action placement

**Acceptance Criteria:**
- [ ] Fixed to bottom of stage content area
- [ ] Supports primary, secondary, and tertiary actions
- [ ] Primary action styled prominently
- [ ] Helper text below action (e.g., "Marking as ready unlocks...")
- [ ] Responsive layout

**Size:** S | **Priority:** P1

---

## Phase 3: Project Mode - Core Stages

### P3-001: Requirements Stage - Empty State

**As a** user
**I want** clear guidance when Requirements stage is empty
**So that** I know how to get started

**Acceptance Criteria:**
- [ ] Shows empty state illustration
- [ ] Title: "No requirements yet"
- [ ] Description: "Extract from a meeting or add manually"
- [ ] Two action buttons: "Add Meeting", "Add Manually"

**Size:** S | **Priority:** P1

---

### 🔷 P3-002: Requirements Stage - Add Meeting Modal

**As a** user
**I want** to extract requirements from meeting notes
**So that** I can quickly populate requirements from existing content

**Acceptance Criteria:**
- [ ] Modal with textarea for pasting content
- [ ] File upload zone accepting .txt and .md files
- [ ] "Extract Requirements" button
- [ ] Processing state with spinner
- [ ] Results shown in modal before adding to project
- [ ] User can deselect items before saving
- [ ] "Add to Project" saves selected items

**Size:** L | **Priority:** P1

#### Ralph Subtasks:

**P3-002a: Add Meeting Modal UI**
- Modal component with textarea
- File upload zone (.txt, .md)
- "Extract Requirements" button
- Basic modal open/close logic

**P3-002b: Add Meeting File Upload**
- File upload handling
- Read file contents
- Populate textarea from file
- File type validation

**P3-002c: Add Meeting AI Extraction**
- Call AI extraction API
- Processing state with spinner
- Error handling

**P3-002d: Add Meeting Results Display**
- Display extracted requirements in sections
- Checkboxes for selection/deselection
- "Add to Project" button
- Save selected items to project

---

### P3-003: Requirements Stage - Add Manually

**As a** user
**I want** to add requirements one at a time
**So that** I can manually build my requirements list

**Acceptance Criteria:**
- [ ] Modal with section dropdown (Problems, Goals, Features, Constraints)
- [ ] Text input for requirement content
- [ ] "Add" button adds item and keeps modal open for more
- [ ] "Add & Close" adds item and closes modal
- [ ] New items appear in appropriate section

**Size:** S | **Priority:** P1

---

### P3-004: Requirements Stage - Display List

**As a** user
**I want** to see all requirements organized by section
**So that** I can review and manage them

**Acceptance Criteria:**
- [ ] Four collapsible sections: Problems, Goals, Features, Constraints (fixed order)
- [ ] Section header shows count (e.g., "Problems (3)")
- [ ] Items listed as bullets within each section
- [ ] Each item has edit (✎) and delete (✕) buttons on hover
- [ ] "Add Item" button at bottom of each section
- [ ] Stage header shows total count and status

**Size:** M | **Priority:** P1

---

### P3-005: Requirements Stage - Inline Edit

**As a** user
**I want** to edit requirement text inline
**So that** I can quickly make changes without modals

**Acceptance Criteria:**
- [ ] Clicking edit icon (or double-click text) enters edit mode
- [ ] Text becomes editable input
- [ ] Enter or blur saves changes
- [ ] Escape cancels edit
- [ ] Optimistic update with error handling

**Size:** S | **Priority:** P1

---

### P3-006: Requirements Stage - Delete Item

**As a** user
**I want** to delete requirements I don't need
**So that** I can keep my list clean

**Acceptance Criteria:**
- [ ] Clicking delete icon shows confirmation
- [ ] Confirmation can be inline (e.g., "Delete? Yes/No") or small popover
- [ ] Item removed immediately on confirm
- [ ] Section count updates
- [ ] Cannot delete if it's the last item (optional - or allow empty sections)

**Size:** S | **Priority:** P2

---

### P3-007: Requirements Stage - Mark as Reviewed

**As a** user
**I want** to mark requirements as reviewed
**So that** I can proceed to PRD generation

**Acceptance Criteria:**
- [ ] "Mark as Reviewed" button in stage actions (when status is "has_items")
- [ ] Clicking updates status to "reviewed"
- [ ] Stepper updates to show ● for Requirements
- [ ] Stage actions change to show "Unmark Reviewed" + "Generate PRD" (primary)
- [ ] Status badge updates to "Reviewed"

**Size:** S | **Priority:** P1

---

### P3-008: PRD Stage - Empty State

**As a** user
**I want** clear guidance when PRD stage is empty
**So that** I know how to get started

**Acceptance Criteria:**
- [ ] Shows empty state illustration
- [ ] Title: "No PRD generated yet"
- [ ] Description: "Generate from requirements or write manually"
- [ ] Two action buttons: "Generate from Reqs", "Write Manually"
- [ ] Warning if Requirements stage not complete: "Complete Requirements stage first for best results"

**Size:** S | **Priority:** P1

---

### P3-009: PRD Stage - Generate PRD Modal

**As a** user
**I want** to configure PRD generation options
**So that** I get the right type of document

**Acceptance Criteria:**
- [ ] Modal shows PRD type selection: Detailed / Brief
- [ ] Shows count of requirements being used
- [ ] "Generate PRD" button starts generation
- [ ] Modal closes and content streams into stage view

**Size:** S | **Priority:** P1

---

### P3-010: PRD Stage - Section Streaming

**As a** user
**I want** to see PRD generation progress
**So that** I know the system is working and can see results as they come

**Acceptance Criteria:**
- [ ] Content streams section by section
- [ ] Progress indicator shows "Generating... Section X of Y"
- [ ] Completed sections render as markdown
- [ ] Pending sections show placeholder
- [ ] User can read completed sections while others generate

**Size:** M | **Priority:** P1

---

### P3-011: PRD Stage - Preview and Edit Tabs

**As a** user
**I want** to view and edit the PRD
**So that** I can review the generated content and make changes

**Acceptance Criteria:**
- [ ] Two tabs: Preview and Edit
- [ ] Preview tab shows rendered markdown
- [ ] Edit tab shows simple textarea with raw markdown
- [ ] Changes in Edit tab reflect in Preview
- [ ] Auto-save on blur or after typing pause
- [ ] "Last edited X ago" timestamp updates

**Size:** M | **Priority:** P1

---

### 🔷 P3-012: PRD Stage - Version History

**As a** user
**I want** to see and restore previous PRD versions
**So that** I can recover from unwanted changes

**Acceptance Criteria:**
- [ ] "Version X" with "History" dropdown in stage header
- [ ] Dropdown shows list of versions with timestamps
- [ ] Clicking a version shows preview of that version
- [ ] "Restore" button to make old version current
- [ ] Restoring creates new version (doesn't delete history)
- [ ] New version created on each generation or significant edit

**Size:** M | **Priority:** P2

#### Ralph Subtasks:

**P3-012a: PRD Version Storage**
- Database model for PRD versions
- API to save new version
- API to list versions for a PRD
- Migration

**P3-012b: PRD Version History UI**
- Version indicator in stage header ("Version X")
- History dropdown showing versions with timestamps
- Click to preview a version

**P3-012c: PRD Version Restore**
- "Restore" button on version preview
- Restore logic (creates new version from old content)
- Success feedback

---

### P3-013: PRD Stage - Regenerate with Warning

**As a** user
**I want** to regenerate the PRD
**So that** I can get a fresh version if needed

**Acceptance Criteria:**
- [ ] "Regenerate" button visible when PRD exists
- [ ] Clicking shows confirmation: "This will replace the current PRD. A backup will be saved to version history."
- [ ] Confirm triggers new generation
- [ ] Previous version saved to history
- [ ] Cancel returns without action

**Size:** S | **Priority:** P2

---

### P3-014: PRD Stage - Mark as Ready

**As a** user
**I want** to mark PRD as ready
**So that** I can proceed to User Stories

**Acceptance Criteria:**
- [ ] "Mark as Ready" button in stage actions (when status is "draft")
- [ ] Clicking updates status to "ready"
- [ ] Stepper updates to show ● for PRD
- [ ] Actions change to: "Unmark Ready" + "Generate Stories" (primary) + "Export"
- [ ] Status badge updates to "Ready"

**Size:** S | **Priority:** P1

---

### P3-015: User Stories Stage - Empty State

**As a** user
**I want** clear guidance when User Stories stage is empty
**So that** I know how to get started

**Acceptance Criteria:**
- [ ] Shows empty state illustration
- [ ] Title: "No user stories yet"
- [ ] Description: "Generate from PRD or add manually"
- [ ] Two action buttons: "Generate from PRD", "Add Manually"
- [ ] Warning if PRD stage not complete: "Complete PRD stage first for best results"

**Size:** S | **Priority:** P1

---

### P3-016: User Stories Stage - Generate Stories Modal

**As a** user
**I want** to configure story generation options
**So that** I get stories in my preferred format

**Acceptance Criteria:**
- [ ] Format selection: Standard, Gherkin, Jobs-to-be-done
- [ ] Include checkboxes: Acceptance criteria, Size estimate, Priority
- [ ] All options checked by default
- [ ] "Generate Stories" button starts generation
- [ ] Modal closes and stories appear in list

**Size:** M | **Priority:** P1

---

### P3-017: User Stories Stage - Story Card Component

**As a** user
**I want** to see stories as cards with all relevant info
**So that** I can scan and manage them easily

**Acceptance Criteria:**
- [ ] Card shows: drag handle (⋮⋮), story ID, title
- [ ] Shows user story text ("As a... I want... So that...")
- [ ] Shows acceptance criteria as bullet list
- [ ] Shows size badge: [S], [M], [L]
- [ ] Shows priority badge: [P1], [P2], [P3]
- [ ] Shows labels/tags
- [ ] Edit and Delete buttons

**Size:** M | **Priority:** P1

---

### P3-018: User Stories Stage - Drag and Drop Reorder

**As a** user
**I want** to reorder stories by dragging
**So that** I can prioritize and organize them

**Acceptance Criteria:**
- [ ] Drag handle visible on each card
- [ ] Dragging shows visual feedback (card lifted, drop zone highlighted)
- [ ] Dropping updates order
- [ ] Order persists to database
- [ ] Smooth animation during drag

**Size:** M | **Priority:** P2

---

### P3-019: User Stories Stage - Filters

**As a** user
**I want** to filter stories by size and priority
**So that** I can focus on specific subsets

**Acceptance Criteria:**
- [ ] Filter dropdowns: Size (All, S, M, L), Priority (All, P1, P2, P3)
- [ ] Search input filters by story text
- [ ] Filters apply immediately
- [ ] Show count of filtered results
- [ ] Clear filters option

**Size:** S | **Priority:** P2

---

### P3-020: User Stories Stage - Edit Story

**As a** user
**I want** to edit story details
**So that** I can refine the generated content

**Acceptance Criteria:**
- [ ] Clicking Edit opens story editor modal
- [ ] Can edit: title, description, acceptance criteria, size, priority
- [ ] Can add/remove labels
- [ ] Save updates story
- [ ] Cancel discards changes

**Size:** M | **Priority:** P1

---

### P3-021: User Stories Stage - Add Story Manually

**As a** user
**I want** to add stories manually
**So that** I can include stories not generated by AI

**Acceptance Criteria:**
- [ ] "Add Manually" button opens editor modal
- [ ] Same fields as edit modal
- [ ] Story ID auto-generated
- [ ] New story appears at end of list
- [ ] Can reorder after adding

**Size:** S | **Priority:** P2

---

### P3-022: User Stories Stage - Generate More Stories

**As a** user
**I want** to generate additional stories
**So that** I can expand coverage without losing existing work

**Acceptance Criteria:**
- [ ] "Generate More" button opens generation modal
- [ ] Same options as initial generation
- [ ] New stories appended to existing list (not replaced)
- [ ] Duplicate detection optional (warn if similar story exists)

**Size:** S | **Priority:** P2

---

### P3-023: User Stories Stage - Labels

**As a** user
**I want** to add labels/tags to stories
**So that** I can categorize and filter them

**Acceptance Criteria:**
- [ ] Labels displayed as chips on story card
- [ ] Click to add label (input appears)
- [ ] User types label name, Enter to add
- [ ] Click X on label to remove
- [ ] Labels are user-defined (no predefined list)
- [ ] Autocomplete from previously used labels

**Size:** M | **Priority:** P2

---

### P3-024: User Stories Stage - Mark as Refined

**As a** user
**I want** to mark stories as refined
**So that** I can proceed to Mockups and Export

**Acceptance Criteria:**
- [ ] "Mark as Refined" button in stage actions
- [ ] Clicking updates status to "refined"
- [ ] Stepper updates to show ● for User Stories
- [ ] Actions change to: "Unmark Refined" + "Generate Mockups" (primary) + "Go to Export"

**Size:** S | **Priority:** P1

---

### P3-025: User Stories Stage - Summary with Priority Count

**As a** user
**I want** to see story count breakdown in the header
**So that** I can understand the distribution at a glance

**Acceptance Criteria:**
- [ ] Header shows: "8 stories • 3S 4M 1L • 5P1 2P2 1P3"
- [ ] Updates dynamically as stories change

**Size:** S | **Priority:** P2

---

### P3-026: User Stories Stage - Delete Story

**As a** user
**I want** to delete user stories I don't need
**So that** I can keep my list clean

**Acceptance Criteria:**
- [ ] Delete button on story card (alongside Edit)
- [ ] Confirmation dialog before delete
- [ ] Story removed from list
- [ ] Counts update in header summary
- [ ] Order of remaining stories preserved

**Size:** S | **Priority:** P1

---

### P3-027: PRD Stage - Write Manually

**As a** user
**I want** to write a PRD manually without AI generation
**So that** I can create PRDs from existing content or write from scratch

**Acceptance Criteria:**
- [ ] "Write Manually" button in empty state opens editor directly
- [ ] Empty textarea with helpful placeholder text
- [ ] Can save without AI generation
- [ ] Status updates to "draft" on first save
- [ ] Same Preview/Edit tabs as generated PRD

**Size:** S | **Priority:** P2

---

### P3-028: PRD Stage - Save Status Indicator

**As a** user
**I want** to see when my PRD changes are saved
**So that** I know my work is safe

**Acceptance Criteria:**
- [ ] Shows "Saved" indicator when no pending changes
- [ ] Shows "Saving..." during auto-save
- [ ] Shows "Unsaved changes" when content modified but not saved
- [ ] Visual indicator near edit area (icon + text)
- [ ] Updates in real-time

**Size:** S | **Priority:** P2

---

## Phase 4: Quick Convert Mode

### P4-001: Quick Convert Landing Page

**As a** user
**I want** a landing page to choose conversion type
**So that** I can quickly access the right tool

**Acceptance Criteria:**
- [ ] Route: `/quick-convert`
- [ ] Back link to Dashboard
- [ ] Title: "Quick Convert"
- [ ] Subtitle explaining no project required
- [ ] 2x2 grid of conversion type cards
- [ ] Cards: Requirements, PRD, User Stories, Mockups
- [ ] Each card has icon, title, short description
- [ ] Clicking navigates to specific conversion page

**Size:** M | **Priority:** P1

---

### 🔷 P4-002: Quick Convert - Requirements Page

**As a** user
**I want** to extract requirements without creating a project
**So that** I can quickly test the AI or do one-off conversions

**Acceptance Criteria:**
- [ ] Route: `/quick-convert/requirements`
- [ ] Back link to Quick Convert landing
- [ ] Input state: textarea + file upload (.txt, .md)
- [ ] "Extract Requirements" button
- [ ] Processing state with spinner
- [ ] Results: collapsible sections with checkboxes
- [ ] Inline edit for each requirement
- [ ] Actions: Save to Project (primary), Generate PRD, Download

**Size:** L | **Priority:** P1

#### Ralph Subtasks:

**P4-002a: QC Requirements Route and Input UI**
- Create `/quick-convert/requirements` route
- Back link to Quick Convert landing
- Textarea for input
- File upload zone (.txt, .md)
- "Extract Requirements" button

**P4-002b: QC Requirements Processing and Results**
- Call AI extraction API
- Processing state with spinner
- Display results in collapsible sections
- Checkboxes for selection
- Inline edit capability

**P4-002c: QC Requirements Actions**
- "Save to Project" button (opens SaveToProjectModal)
- "Generate PRD" button (navigates with data)
- "Download" button (JSON/Markdown)

---

### 🔷 P4-003: Quick Convert - PRD Page

**As a** user
**I want** to generate a PRD without creating a project
**So that** I can quickly test the AI or do one-off conversions

**Acceptance Criteria:**
- [ ] Route: `/quick-convert/prd`
- [ ] Back link to Quick Convert landing
- [ ] Input source toggle: Paste Text / From Requirements
- [ ] Paste Text: textarea with placeholder
- [ ] From Reqs: textarea accepting JSON or bullet points
- [ ] PRD type toggle: Detailed / Brief
- [ ] Section streaming during generation
- [ ] Preview/Edit tabs for result
- [ ] Actions: Save to Project (primary), Generate Stories, Download

**Size:** L | **Priority:** P1

#### Ralph Subtasks:

**P4-003a: QC PRD Route and Input UI**
- Create `/quick-convert/prd` route
- Back link to Quick Convert landing
- Input source toggle (Paste Text / From Reqs)
- Appropriate textarea for each mode
- PRD type toggle (Detailed / Brief)
- "Generate PRD" button

**P4-003b: QC PRD Streaming and Result Display**
- Call PRD generation API
- Section streaming display
- Progress indicator
- Preview/Edit tabs for result

**P4-003c: QC PRD Actions**
- "Save to Project" button
- "Generate Stories" button (navigates with data)
- "Download" button (Markdown)

---

### 🔷 P4-004: Quick Convert - User Stories Page

**As a** user
**I want** to generate user stories without creating a project
**So that** I can quickly test the AI or do one-off conversions

**Acceptance Criteria:**
- [ ] Route: `/quick-convert/stories`
- [ ] Back link to Quick Convert landing
- [ ] Input source toggle: Paste Text / From PRD / From Reqs
- [ ] Format options: Standard, Gherkin, Jobs-to-be-done
- [ ] Include options: Acceptance criteria, Size, Priority
- [ ] Story cards with checkbox, drag handle, edit
- [ ] Drag-and-drop reorder
- [ ] Actions: Save to Project (primary), Generate Mockups, Download

**Size:** L | **Priority:** P1

#### Ralph Subtasks:

**P4-004a: QC Stories Route and Input UI**
- Create `/quick-convert/stories` route
- Back link to Quick Convert landing
- Input source toggle (Paste Text / From PRD / From Reqs)
- Format options (Standard, Gherkin, JTBD)
- Include options checkboxes
- "Generate Stories" button

**P4-004b: QC Stories Generation and Display**
- Call stories generation API
- Display story cards with all details
- Checkbox for selection
- Inline edit capability

**P4-004c: QC Stories Reorder and Actions**
- Drag-and-drop reorder
- "Save to Project" button
- "Generate Mockups" button
- "Download" button (JSON/Markdown)

---

### 🔷 P4-005: Quick Convert - Mockups Page

**As a** user
**I want** to generate mockups without creating a project
**So that** I can quickly visualize UI ideas

**Acceptance Criteria:**
- [ ] Route: `/quick-convert/mockups`
- [ ] Back link to Quick Convert landing
- [ ] Input source toggle: Describe UI / From Stories
- [ ] Describe UI: textarea with example placeholder
- [ ] Style options: Wireframe, Low-fi, High-fi
- [ ] Device multi-select: Desktop, Tablet, Mobile
- [ ] Generated mockup preview
- [ ] Refine input + Regenerate button
- [ ] Variations button (generates 3 alternatives)
- [ ] Actions: Save to Project (primary), Variations, Download

**Size:** L | **Priority:** P2 (depends on mockup API)

#### Ralph Subtasks:

**P4-005a: QC Mockups Route and Input UI**
- Create `/quick-convert/mockups` route
- Back link to Quick Convert landing
- Input source toggle (Describe UI / From Stories)
- Textarea with example placeholder
- Style options (Wireframe, Low-fi, High-fi)
- Device multi-select
- "Generate Mockup" button

**P4-005b: QC Mockups Generation and Display**
- Call mockup generation API
- Display generated mockup image
- Loading state

**P4-005c: QC Mockups Refine and Actions**
- Refine textarea
- "Regenerate" button
- "3 Variations" button
- "Save to Project", "Download" buttons

---

### P4-006: Save to Project Modal

**As a** user
**I want** to save Quick Convert results to a project
**So that** I can continue working in project context

**Acceptance Criteria:**
- [ ] Modal with two options: "Create new project" / "Add to existing project"
- [ ] Create new: name and description fields
- [ ] Add to existing: project dropdown
- [ ] Warning: "This will replace existing [type] in the selected project"
- [ ] "Save & Open Project" button
- [ ] Navigates to project view at relevant stage
- [ ] Stage status updates automatically

**Size:** M | **Priority:** P1

---

### P4-007: Quick Convert - Download Functionality

**As a** user
**I want** to download Quick Convert results
**So that** I can use them outside the app

**Acceptance Criteria:**
- [ ] Requirements: download as JSON or Markdown
- [ ] PRD: download as Markdown
- [ ] User Stories: download as JSON or Markdown
- [ ] Mockups: download as PNG
- [ ] Download triggers browser save dialog

**Size:** M | **Priority:** P1

---

### P4-008: Quick Convert - Session Storage

**As a** user
**I want** my Quick Convert data to persist in session storage
**So that** I don't lose work if I accidentally navigate away

**Acceptance Criteria:**
- [ ] Results saved to sessionStorage after generation
- [ ] Restored on page revisit (within same session)
- [ ] Clear button to reset and start fresh
- [ ] Warning if navigating away with unsaved changes

**Size:** S | **Priority:** P2

---

### P4-009: Quick Convert - Navigation Warning

**As a** user
**I want** to be warned before leaving with unsaved work
**So that** I don't accidentally lose my generated content

**Acceptance Criteria:**
- [ ] Browser beforeunload warning when data exists
- [ ] In-app navigation shows confirmation dialog
- [ ] No warning if data was saved to project or downloaded
- [ ] Clear way to dismiss and proceed

**Size:** S | **Priority:** P2

---

### P4-010: Quick Convert - Data Chaining Between Pages

**As a** user
**I want** to chain conversions together
**So that** I can go from Requirements → PRD → Stories without re-entering data

**Acceptance Criteria:**
- [ ] "Generate PRD" from Requirements passes data to PRD page
- [ ] "Generate Stories" from PRD passes data to Stories page
- [ ] "Generate Mockups" from Stories passes data to Mockups page
- [ ] Data passed via URL params or sessionStorage
- [ ] Pre-populated input shows "Using data from previous step"

**Size:** M | **Priority:** P1

---

## Phase 5: Mockups & Export Stages

### P5-001: Mockups Stage - Empty State

**As a** user
**I want** clear guidance when Mockups stage is empty
**So that** I know how to get started

**Acceptance Criteria:**
- [ ] Shows empty state illustration
- [ ] Title: "No mockups yet"
- [ ] Description: "Generate from user stories or describe a UI"
- [ ] Two action buttons: "Generate from Stories", "Describe UI"

**Size:** S | **Priority:** P2

---

### P5-002: Mockups Stage - Generate from Stories Modal

**As a** user
**I want** to select stories to visualize
**So that** I get mockups for specific features

**Acceptance Criteria:**
- [ ] Modal shows list of stories with checkboxes
- [ ] Can select/deselect individual stories
- [ ] Style selection: Wireframe, Low-fi, High-fi
- [ ] Device multi-select: Desktop, Tablet, Mobile
- [ ] "Generate Mockups" button starts generation
- [ ] Generates one mockup per selected combination

**Size:** M | **Priority:** P2

---

### P5-003: Mockups Stage - Describe UI Modal

**As a** user
**I want** to describe a UI to generate
**So that** I can create mockups for ideas not tied to stories

**Acceptance Criteria:**
- [ ] Modal with textarea for description
- [ ] Example placeholder text
- [ ] Style and device options (same as above)
- [ ] "Generate Mockup" button

**Size:** S | **Priority:** P2

---

### P5-004: Mockups Stage - Mockup Grid

**As a** user
**I want** to see all mockups in a gallery
**So that** I can browse and manage them

**Acceptance Criteria:**
- [ ] Responsive grid of mockup cards
- [ ] Filter by device, filter by style
- [ ] Search by name
- [ ] Count shown: "4 mockups • 2 Desktop, 1 Tablet, 1 Mobile"

**Size:** M | **Priority:** P2

---

### P5-005: Mockups Stage - Mockup Card

**As a** user
**I want** to see mockup thumbnail with key info
**So that** I can quickly identify mockups

**Acceptance Criteria:**
- [ ] Thumbnail image
- [ ] Name (editable on click)
- [ ] Device icon and label
- [ ] Style label
- [ ] Actions: View, Download, Delete

**Size:** S | **Priority:** P2

---

### P5-006: Mockups Stage - Detail Modal

**As a** user
**I want** to view mockup in detail and refine it
**So that** I can iterate on the design

**Acceptance Criteria:**
- [ ] Full-size mockup image
- [ ] Name, device, style info
- [ ] "Based on:" shows linked story IDs
- [ ] Refine textarea for describing changes
- [ ] "Regenerate" applies refinements
- [ ] "3 Variations" generates alternatives
- [ ] Download, Delete buttons

**Size:** M | **Priority:** P2

---

### P5-007: Mockups Stage - Rename Mockup

**As a** user
**I want** to rename mockups
**So that** I can give them meaningful names

**Acceptance Criteria:**
- [ ] Click on name enters edit mode
- [ ] Enter or blur saves
- [ ] Escape cancels

**Size:** S | **Priority:** P3

---

### P5-008: Mockups Stage - Download All

**As a** user
**I want** to download all mockups at once
**So that** I can share or archive them

**Acceptance Criteria:**
- [ ] "Download All" button in stage actions
- [ ] Downloads as zip file
- [ ] Files named: {mockup-name}-{device}.png

**Size:** S | **Priority:** P3

---

### P5-009: Export Stage - Default State

**As a** user
**I want** to see all export options
**So that** I can choose how to export my project

**Acceptance Criteria:**
- [ ] Stage header shows status
- [ ] Markdown export card with include checkboxes
- [ ] JSON export card
- [ ] Jira placeholder card ("Coming Soon")

**Size:** M | **Priority:** P1

---

### P5-010: Export Stage - Markdown Export

**As a** user
**I want** to download project as Markdown files
**So that** I can use content in other tools

**Acceptance Criteria:**
- [ ] Checkboxes: Requirements, PRD, User Stories, Mockups (as links)
- [ ] "Download .zip" button
- [ ] Zip contains separate .md files for each selected type
- [ ] Mockups included as image links if selected

**Size:** M | **Priority:** P1

---

### P5-011: Export Stage - JSON Export

**As a** user
**I want** to download project as JSON
**So that** I can import data elsewhere or back it up

**Acceptance Criteria:**
- [ ] "Download .json" button
- [ ] Single JSON file with all project data
- [ ] Includes: project info, requirements, PRD, stories, mockup metadata

**Size:** S | **Priority:** P1

---

### P5-012: Export Stage - Export History

**As a** user
**I want** to see what I've exported before
**So that** I can track what's been shared

**Acceptance Criteria:**
- [ ] List of previous exports
- [ ] Shows: type (Markdown/JSON), timestamp
- [ ] "Clear" button to delete history
- [ ] Status updates to "exported" on first export

**Size:** S | **Priority:** P2

---

## Phase 6: Polish & Migration

### P6-001: Remove Legacy PRD Landing Page

**As a** developer
**I want** to remove the old PRD landing page
**So that** users use the new Dashboard

**Acceptance Criteria:**
- [ ] Old route redirects to `/dashboard`
- [ ] No dead links in app
- [ ] Component files removed

**Size:** S | **Priority:** P3

---

### P6-002: Remove Legacy Stories Landing Page

**As a** developer
**I want** to remove the old Stories landing page
**So that** users use the new Dashboard

**Acceptance Criteria:**
- [ ] Old route redirects to `/dashboard`
- [ ] No dead links in app
- [ ] Component files removed

**Size:** S | **Priority:** P3

---

### 🔷 P6-003: Loading States

**As a** user
**I want** to see loading indicators throughout the app
**So that** I know the system is working

**Acceptance Criteria:**
- [ ] Dashboard: skeleton cards while loading
- [ ] Project View: skeleton while loading project
- [ ] Each stage: appropriate loading state
- [ ] Consistent loading spinner/skeleton style

**Size:** M | **Priority:** P2

#### Ralph Subtasks:

**P6-003a: Dashboard Loading Skeleton**
- Skeleton cards for project grid
- Loading state for action cards

**P6-003b: Project View Loading Skeleton**
- Skeleton for project header
- Skeleton for stage content

**P6-003c: Stage Content Loading States**
- Loading indicators for each stage
- Consistent spinner/skeleton components

---

### 🔷 P6-004: Error States

**As a** user
**I want** to see helpful error messages
**So that** I know what went wrong and how to fix it

**Acceptance Criteria:**
- [ ] API errors show toast notification
- [ ] Failed generations show error with retry option
- [ ] 404 pages redirect gracefully
- [ ] Network errors handled with offline message

**Size:** M | **Priority:** P2

#### Ralph Subtasks:

**P6-004a: API Error Toast Notifications**
- Toast component for errors
- Integrate with API calls
- Dismissable notifications

**P6-004b: Generation Error Handling**
- Error state for PRD generation
- Error state for story generation
- Retry button functionality

**P6-004c: 404 and Network Errors**
- 404 page with redirect
- Network offline detection
- Offline message display

---

### 🔷 P6-005: Mobile Responsive

**As a** user
**I want** the app to work well on mobile
**So that** I can use it on any device

**Acceptance Criteria:**
- [ ] Dashboard: single column on mobile
- [ ] Project View: stepper scrollable horizontally, labels visible
- [ ] All modals: full screen on mobile
- [ ] Touch-friendly tap targets
- [ ] No horizontal scroll on any page

**Size:** L | **Priority:** P2

#### Ralph Subtasks:

**P6-005a: Dashboard Mobile Layout**
- Single column project cards
- Stacked action cards
- Responsive search/filter

**P6-005b: Project View Mobile Layout**
- Horizontal scrollable stepper
- Responsive stage content
- Mobile-friendly header

**P6-005c: Modals Full-Screen Mobile**
- Full-screen modals on mobile
- Touch-friendly form inputs
- Mobile-optimized buttons

---

### 🔷 P6-006: Keyboard Navigation & Accessibility

**As a** user
**I want** to navigate with keyboard
**So that** the app is accessible

**Acceptance Criteria:**
- [ ] Tab order is logical
- [ ] Focus states visible
- [ ] Modals trap focus
- [ ] Escape closes modals
- [ ] ARIA labels on interactive elements
- [ ] Screen reader tested on key flows

**Size:** L | **Priority:** P2

#### Ralph Subtasks:

**P6-006a: Tab Order and Focus States**
- Logical tab order throughout app
- Visible focus indicators
- Skip links where appropriate

**P6-006b: Modal Focus Trapping**
- Focus trap in all modals
- Escape key closes modals
- Focus returns to trigger on close

**P6-006c: ARIA Labels and Screen Reader**
- ARIA labels on buttons, inputs
- ARIA live regions for dynamic content
- Screen reader testing

---

## Summary

| Phase | Stories | Ralph Tasks | P1 | P2 | P3 |
|-------|---------|-------------|----|----|-----|
| Phase 1: Foundation | 14 | 18 | 17 | 1 | 0 |
| Phase 2: Project Shell | 5 | 8 | 7 | 1 | 0 |
| Phase 3: Core Stages | 28 | 34 | 20 | 14 | 0 |
| Phase 4: Quick Convert | 10 | 21 | 13 | 8 | 0 |
| Phase 5: Mockups & Export | 12 | 12 | 3 | 7 | 2 |
| Phase 6: Polish | 6 | 14 | 0 | 12 | 2 |
| **Total** | **75** | **107** | **60** | **43** | **4** |

---

## Next Steps

1. Create ralph-tasks.json for Ralph execution
2. Begin Phase 1 implementation
3. Track progress in project management tool
