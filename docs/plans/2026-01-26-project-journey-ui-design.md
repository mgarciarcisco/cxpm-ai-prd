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

## Addendum: Quick Mode (v1)

**Date:** 2026-01-27
**Status:** Proposed

### Overview

In addition to the project-centric journey, provide a "Quick Mode" for one-off conversions without project overhead. This serves users who want to experiment, do ad-hoc conversions, or test the AI capabilities before committing to a full project.

### Use Cases

| Mode | Mental Model | When to Use |
|------|--------------|-------------|
| Project Mode | "I'm building something" | Full journey, tracked progress, multiple iterations |
| Quick Mode | "I just want to try this" | One-off conversions, experimentation, no commitment |

**Quick Mode examples:**
- "I have meeting notes, let me quickly see what requirements the AI extracts"
- "I want to test PRD generation before creating a real project"
- "Quick conversion of some bullet points to user stories for a different tool"

### UI Implementation

#### Dashboard Entry Points

The Dashboard offers two distinct entry points:

```
┌─────────────────────────────────────────────────────────────────┐
│  Welcome back, [User]                                           │
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │  ➕  New Project          │  │  ⚡ Quick Convert         │    │
│  │  Full journey with       │  │  One-off conversion,     │    │
│  │  tracked progress        │  │  no project required     │    │
│  └──────────────────────────┘  └──────────────────────────┘    │
│                                                                 │
│  Your Projects                                                  │
│  ...                                                            │
└─────────────────────────────────────────────────────────────────┘
```

#### Quick Convert View

A simplified, single-page conversion interface without the project stepper:

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                            │
│                                                                 │
│  Quick Convert                                                  │
│                                                                 │
│  What do you want to create?                                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ Requirements│ │    PRD     │ │User Stories│ │  Mockups   │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [Selected conversion interface]                                │
│                                                                 │
│  - Input area (paste text, upload file, etc.)                   │
│  - Generate button                                              │
│  - Output preview                                               │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [After generation]                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │  📥 Download         │  │  📁 Save to Project  │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Save to Project Flow

When user clicks "Save to Project" after a quick conversion:

1. **Modal appears** with options:
   - Create new project (with name/description fields)
   - Add to existing project (dropdown of user's projects)

2. **On save:**
   - Creates/updates project with the generated content
   - Navigates to Project View at the relevant stage
   - Stage status updates automatically

```
┌─────────────────────────────────────────┐
│  Save to Project                        │
│                                         │
│  ○ Create new project                   │
│    Name: [________________________]     │
│    Description: [_________________]     │
│                                         │
│  ○ Add to existing project              │
│    [Select project          ▼]          │
│                                         │
│  ┌─────────┐  ┌─────────────────────┐  │
│  │ Cancel  │  │  Save & View Project │  │
│  └─────────┘  └─────────────────────┘  │
└─────────────────────────────────────────┘
```

### Conversion Types

| Output | Input Options | Notes |
|--------|---------------|-------|
| Requirements | Meeting transcript, raw notes, paste text | Extracts structured requirements |
| PRD | Requirements (paste or select), brief description | Generates PRD document |
| User Stories | Requirements, PRD, or brief description | Generates story cards |
| Mockups | User stories, feature description, or sketch | Generates UI mockups |

### Data Handling

- Quick conversions are **not persisted** until explicitly saved
- Browser session storage may hold temporary results for page refresh resilience
- Clear warning if user navigates away with unsaved results

### Benefits

1. **Lower barrier to entry** - Try before committing to a project
2. **Faster experimentation** - No project setup overhead
3. **Flexibility** - Serve both structured and ad-hoc workflows
4. **Conversion funnel** - Users who experiment often convert to project mode

### Migration Notes

- Existing standalone pages (PRDGeneratorPage, etc.) can be adapted for Quick Mode
- No need to maintain two full UIs - Quick Mode is intentionally simpler
- Project Mode is the primary experience; Quick Mode is the on-ramp

## Future Considerations

- **Team collaboration:** Activity feed, comments, assignments
- **AI Copilot:** Smart suggestions, "what should I do next?"
- **Templates:** Start projects from predefined templates
- **Integrations:** Deeper Jira/Figma/GitHub connections
- **Analytics:** Time per stage, completion rates
