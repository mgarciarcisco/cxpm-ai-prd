# User Stories Page — UX Analysis & Mockup Proposals

## Current Page Analysis (`ui/src/pages/jira_epic/JiraEpicPage.jsx`)

### What the page does today
- **Entry:** User lands on "User Stories" with optional project name in title (from localStorage).
- **Input:** Single path — "Add Project Functional Requirements" opens project selector → requirements selector → selected requirements appear in a textarea. No requirements = Generate disabled.
- **Action:** "Generate JIRA Stories" (long-running, up to 5 min). Optional replace-confirmation if stories already exist.
- **Output:** Success banner + scroll; table of stories (ID, name) on the left; selected story details (Title, Description, Problem Statement, etc.) on the right; "Save Jira Stories" at bottom (disabled when loaded from DB).

### UX pain points

| Issue | Impact |
|-------|--------|
| **Unclear first step** | New users see one button and a subtitle. No obvious "pick a project first" or order of operations. |
| **Hidden project context** | Project only appears in title and a small hint after requirements are added. Easy to forget which project you're in. |
| **Single long page** | Form, tips, then (after generate) table + detail + save all on one scroll. Heavy scrolling and context switching. |
| **Dense results** | Table is ID + name only; detail panel has many sections. Feels like a document, not a workflow. |
| **Modal-heavy flow** | Project picker and requirements picker are modals. Easy to lose context; "Add Project Functional Requirements" does two different things (pick project vs pick requirements). |
| **No sense of progress** | No steps or progress indicator. User doesn’t know if they’re at "setup" or "review" or "done." |
| **Empty state** | When no project/requirements, the page is mostly empty except one button. Doesn’t guide or reassure. |

### Design direction for proposals
- **Clear steps or phases** so the user knows where they are.
- **Project always visible** so context is never lost.
- **Less scrolling** — either steps/wizard or a more compact summary + focus area.
- **Friendlier results** — card-based or list-based story browsing instead of a bare table + long detail block.
- **Obvious empty state** with a single primary action and short explanation.

---

## Mockup Proposals (fake data only, no app integration)

**Location:** All mockup files are in the **`mockups/`** folder.

**Design constraints used:**
- **Same colors and style** as the current User Stories page (teal primary #4ECDC4, white/gray panels, #E5E7EB borders, etc.).
- **"Tips for Best Results"** is included in every proposal (same content and styling as the live page).
- **Large lists:** Mockups show support for many requirements and many stories (scrollable areas, pagination, e.g. "87 requirements", "47 stories", "Page 1 of 5").

Open each HTML file in a browser. All content is static.

| File | Concept | Best for |
|------|--------|----------|
| **user-stories-proposal-a-wizard-step1.html** | Wizard Step 1: Select project. Single focused card, clear "Continue." Tips panel on the right. | Shows entry point for Proposal A. |
| **user-stories-proposal-a-wizard.html** | Wizard Step 3: Review generated stories. Scrollable table (47 stories), pagination "Page 1 of 5", detail panel, Save/Generate again. Tips panel below. | Teams that want a guided, linear flow. |
| **user-stories-proposal-b-dashboard.html** | Project bar at top; two cards — "Requirements" (87 selected, scrollable list) and "Generated stories" (47 stories). Tips panel on the right. | Users who think in terms of project + tasks. |
| **user-stories-proposal-c-focus.html** | Compact top bar (project, "87 requirements · 47 stories", actions). Scrollable story cards + pagination "Stories 1–10 of 47". Tips panel on the right. | Users who want minimal chrome and focus on the story list. |

---

## How to use these mockups
1. Open the HTML files in the **mockups/** folder in Chrome, Firefox, or Edge.
2. Click through any fake buttons/links to see intended transitions (where simulated).
3. Use the mockups as a reference for layout, copy, and flow — not for exact pixels or integration.
