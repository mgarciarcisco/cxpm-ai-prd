# Project Journey UI Design

**Date:** 2026-01-26
**Status:** Approved for v1
**Author:** Altaf Karim + Claude

## Overview

Redesign the PM Co-Pilot UI to show project progress through a guided journey: Requirements → PRD → User Stories → Mockups → Export. Replace disconnected feature pages with a unified, project-centric experience.

## User Personas

**Primary:** Product Manager
- Owns the full journey from requirements to Jira export
- Manages multiple projects simultaneously
- Needs visibility into progress across stages

**Secondary:**
- Startup Founder / Solo Builder - doing everything themselves, needs guidance
- Team Collaborator - works on specific stages, needs handoff visibility

## Design Principles

1. **Project as container** - Everything lives within a project context
2. **Suggested flow with flexibility** - Show recommended order but allow jumping between stages
3. **Progressive disclosure** - Dashboard shows overview, project view shows details
4. **Minimal friction** - Single-page views, no unnecessary navigation depth

## Stages (v1)

```
Requirements → PRD → User Stories → Mockups → Export
```

| Stage | Description | States |
|-------|-------------|--------|
| Requirements | Extract from meetings, manual entry | Empty → Has Items → Reviewed |
| PRD | Generate draft or detailed document | Empty → Draft → Ready |
| User Stories | Generate from requirements | Empty → Generated → Refined |
| Mockups | AI-generated UI mockups | Empty → Generated |
| Export | Push to Jira, export markdown | Not Exported → Exported |

**Future stages** (post-v1):
- Test Cases (branch from User Stories)
- Technical Spec
- Roadmap
- Review Checkpoints

## UI Structure

### Dashboard (Home)

The dashboard is the entry point showing all projects at a glance.

**Components:**
- Welcome header with user name
- Single quick action: "New Project"
- Project cards grid

**Project Card contains:**
- Project name + description
- Mini stepper showing stage progress (● ── ● ── ◐ ── ○ ── ○)
- Current stage badge (e.g., "User Stories")
- Progress percentage (e.g., "60%")
- Last updated timestamp + author

**Not included in v1:**
- Activity feed (requires team features)
- Quick stats sidebar
- Additional quick actions (future: AI agent/copilot)

```
┌─────────────────────────────────────────────────────────────────┐
│  Welcome back, [User]                                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ➕  New Project                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Your Projects                                                  │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Project Name        │  │ Project Name        │              │
│  │ Description         │  │ Description         │              │
│  │ ● ── ● ── ◐ ── ○ ── ○ │  │ ● ── ◐ ── ○ ── ○ ── ○ │              │
│  │ [User Stories] 60%  │  │ [PRD]        40%   │              │
│  │ 2 hours ago · User  │  │ 1 day ago · User   │              │
│  └─────────────────────┘  └─────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Project View (Inside a Project)

Clicking a project card opens the project view with horizontal stepper navigation.

**Components:**
- Back to Projects link
- Project name + description header
- Horizontal stepper showing all stages with states
- Single-page content area for selected stage
- Stage-specific actions

**Stepper Visual States:**
- ○ Empty - stage not started
- ◐ In Progress - stage has content but not complete
- ● Ready - stage complete, can proceed

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Projects                                             │
│                                                                 │
│  Project Name                                                   │
│  Description                                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │    ●────────────●────────────◐────────────○────────────○ │   │
│  │ Requirements   PRD     User Stories   Mockups     Export │   │
│  │   Ready       Ready    In Progress    Empty       Empty  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  [Stage Content - Single Page View]                            │
│                                                                 │
│  - Summary stats (e.g., "12 stories generated")                │
│  - List of items with edit/delete actions                      │
│  - Primary action button (e.g., "Generate More")               │
│  - Stage completion action (e.g., "Mark as Refined")           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Stage Content Views

Each stage has a single-page view with consistent structure:

**Requirements Stage:**
- Summary: X items across Y sections
- Grouped list by section (Problems, Goals, Features, etc.)
- Actions: Add Meeting, Add Manually, Mark as Reviewed

**PRD Stage:**
- Summary: Version X, Draft/Ready status
- PRD document preview (collapsible sections)
- Actions: Generate PRD, Edit, Export, Mark as Ready

**User Stories Stage:**
- Summary: X stories generated
- Story cards with title, description, size, labels
- Actions: Generate Stories, Edit, Reorder, Mark as Refined

**Mockups Stage:**
- Summary: X mockups generated
- Mockup gallery/grid
- Actions: Generate Mockups, Regenerate, Download

**Export Stage:**
- Summary: Export status per destination
- Export options (Jira, Markdown, JSON)
- Actions: Export to Jira, Download Markdown, Download JSON

## Navigation Changes

### Pages to Remove
- PRDLandingPage - replaced by Dashboard
- StoriesLandingPage - replaced by Dashboard
- Separate feature entry points

### Pages to Modify
- ProjectDashboard → becomes Project View with stepper
- RequirementsPage → becomes Requirements stage view
- PRDGeneratorPage → becomes PRD stage view
- PRDEditorPage → accessible from PRD stage
- UserStoriesPage → becomes User Stories stage view

### New Pages
- Dashboard (Home) - project list with cards
- Mockups stage view (new feature)
- Export stage view (consolidated exports)

## Data Model Changes

### Project Model Updates
Add fields to track stage progress:

```python
class Project:
    # Existing fields...

    # Stage tracking (v1 - simple approach)
    requirements_status: str  # "empty" | "has_items" | "reviewed"
    prd_status: str           # "empty" | "draft" | "ready"
    stories_status: str       # "empty" | "generated" | "refined"
    mockups_status: str       # "empty" | "generated"
    export_status: str        # "not_exported" | "exported"
```

Alternative: Compute status dynamically from related records (more accurate but more queries).

## API Changes

### New Endpoints
- `GET /api/projects/{id}/progress` - Returns all stage statuses for stepper
- `PATCH /api/projects/{id}/stages/{stage}` - Update stage status manually

### Endpoint Modifications
- Existing endpoints remain but are accessed within project context
- Streaming endpoints unchanged (already project-scoped)

## Migration Path

### Phase 1: Dashboard + Project View Shell
1. Create new Dashboard page with project cards
2. Add stepper component to project view
3. Route existing pages as stage views
4. Update navigation

### Phase 2: Stage Status Tracking
1. Add status fields to Project model
2. Implement progress calculation
3. Wire up stepper states

### Phase 3: Stage View Refinements
1. Standardize stage view layouts
2. Add "mark as complete" actions
3. Implement stage transition logic

### Phase 4: New Features
1. Mockups stage (AI generation)
2. Export stage (consolidated)
3. Remove legacy pages

## Success Criteria

1. User can see all projects with progress at a glance
2. User can navigate between stages without leaving project context
3. Progress accurately reflects work completed
4. Existing functionality remains accessible
5. New users understand the journey without documentation

## Future Considerations

- **Team collaboration:** Activity feed, comments, assignments
- **AI Copilot:** Smart suggestions, "what should I do next?"
- **Templates:** Start projects from predefined templates
- **Integrations:** Deeper Jira/Figma/GitHub connections
- **Analytics:** Time per stage, completion rates
