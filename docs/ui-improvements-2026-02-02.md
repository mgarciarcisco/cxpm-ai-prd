# UI Improvements Document - E2E Testing Findings

**Date:** 2026-02-02
**Testing Flow:** Convert Meeting Notes to Requirements
**Screenshots Location:** `screenshots/e2e-testing/`

---

## 🐛 CRITICAL BUG: Apply/Conflict Resolution Page Infinite Loading

### Bug Description
The Apply/Conflict Resolution page gets stuck in an infinite loading state showing "Analyzing meeting items..." forever.

### Reproduction Steps
1. Go to Dashboard → "Convert Meeting Notes to Requirements"
2. Fill in meeting title and paste meeting notes
3. Click "Process Meeting Notes" - extraction works correctly
4. Click "Save & Apply"
5. Select existing project (e.g., "Project Test")
6. Click "Continue to Review Conflicts →"
7. **BUG**: Page shows "Analyzing meeting items..." indefinitely, never completes

### Technical Investigation

#### Root Cause
The `post()` function call to `/api/meetings/{mid}/apply` is not completing (hanging), causing `response.json()` in the api.js service to never resolve. As a result, the `loading` state is never set to `false`.

#### Files Involved

**Frontend (Primary Issue)**:
| File | Lines | Description |
|------|-------|-------------|
| `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/ConflictResolverPage.jsx` | 27-56 | `fetchData` function where API calls happen |
| `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/ConflictResolverPage.jsx` | 41 | `const results = await post(...)` - **This is where it hangs** |
| `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/ConflictResolverPage.jsx` | 54 | `setLoading(false)` - **Never gets called** |
| `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/services/api.js` | 31-44 | The `post()` function |
| `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/services/api.js` | 43 | `return response.json()` - If this doesn't complete, the caller never resolves |

**Backend (Works Correctly)**:
| File | Lines | Description |
|------|-------|-------------|
| `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/backend/app/routers/meetings.py` | 467-533 | The `/api/meetings/{id}/apply` endpoint |
| `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/backend/app/routers/meetings.py` | 523 | Response returned correctly with `ApplyResponse` |

#### Code Analysis

**ConflictResolverPage.jsx - The fetchData function:**
```javascript
const fetchData = async () => {
  try {
    setLoading(true);
    setError(null);

    // Fetch meeting details first
    const meetingData = await get(`/api/meetings/${mid}`);
    setMeeting(meetingData);

    // Call POST /api/meetings/{id}/apply to get conflict detection results
    const results = await post(`/api/meetings/${mid}/apply`, {});  // <-- HANGS HERE
    setApplyResults(results);

    // Check if there are no conflicts - show the no conflicts modal
    const hasConflicts = results?.conflicts?.length > 0;
    const hasItems = (results?.added?.length > 0) || (results?.skipped?.length > 0) || hasConflicts;

    if (hasItems && !hasConflicts) {
      setShowNoConflictsModal(true);
    }
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);  // <-- NEVER REACHED
  }
};
```

**api.js - The post function:**
```javascript
export async function post(endpoint, data) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }
  return response.json();  // <-- IF THIS DOESN'T COMPLETE, CALLER HANGS
}
```

#### Why It Happens
1. Backend returns 200 OK (verified in logs: `POST /api/meetings/{id}/apply HTTP/1.1" 200 OK`)
2. Response body might not be properly consumed or there's a streaming/response handling issue
3. The `response.json()` promise never resolves
4. The `finally` block with `setLoading(false)` never executes
5. Component stays in loading state forever

### Proposed Fixes

#### Option 1: Add Timeout Wrapper (Quick Fix)
Add a timeout to the API call to prevent infinite hanging:

```javascript
// In ConflictResolverPage.jsx
const fetchWithTimeout = async (promise, timeoutMs = 30000) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
  );
  return Promise.race([promise, timeout]);
};

// Usage in fetchData:
const results = await fetchWithTimeout(post(`/api/meetings/${mid}/apply`, {}));
```

#### Option 2: Add Timeout to api.js (Better Fix)
Modify the `post()` function to include AbortController timeout:

```javascript
export async function post(endpoint, data, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }
    return response.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  }
}
```

#### Option 3: Investigate Backend Response (Root Cause Fix)
Check if the backend is properly closing the response stream after sending the JSON. Look at:
- `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/backend/app/routers/meetings.py` lines 467-533
- Ensure the response is not accidentally a streaming response
- Check if there are any middleware issues affecting response completion

### Impact
- **Severity**: Critical
- **User Impact**: Users cannot complete the "Apply" step to save extracted requirements to their project
- **Workaround**: None - users are stuck and must manually navigate away

### Testing After Fix
1. Process meeting notes
2. Click Save & Apply
3. Select a project
4. Click Continue to Review Conflicts
5. **Expected**: Page should show conflict resolution UI or "No conflicts" modal
6. **Actual Now**: Infinite loading

---

## Priority Matrix

| Priority | Count | Description |
|----------|-------|-------------|
| Critical | 3 | Blocks user workflows or causes confusion |
| High | 12 | Significant UX friction, should fix soon |
| Medium | 18 | Improves experience but not blocking |
| Low | 8 | Polish items and nice-to-haves |

---

## Critical Issues

### 1. Extraction Results Page - Save Button Not Visible

#### Issue: Save button only visible at bottom of very long page
- **Severity**: Critical
- **Current**: The "Save & Apply" button is positioned only at the absolute bottom of the page. With 9 sections expanded, users must scroll through the entire page to find the primary action button.
- **Expected**: Save button should be visible at all times, either as a sticky footer or with a floating action button.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RecapEditorPage.jsx`
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RecapEditorPage.css`
- **Suggested Fix**: Add a sticky footer with the Save & Apply button that remains visible while scrolling. Include a summary of total items count.

### 2. Project Selection Page - Redundant Back Navigation

#### Issue: Two "Back" options create navigation confusion
- **Severity**: Critical
- **Current**: Page shows both "Back to Review" in the top right corner AND "Back" button in bottom left form actions. Users are confused about which to use.
- **Expected**: Single, clear navigation path back to the previous page.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/SelectProjectPage.jsx`
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/SelectProjectPage.css`
- **Suggested Fix**: Remove the top-right "Back to Review" link. Keep only the bottom "Back" button that matches the "Continue" button placement. Alternatively, implement proper breadcrumbs.

### 3. Title Inconsistency Between Dashboard and Upload Page

#### Issue: Mismatched terminology confuses users
- **Severity**: Critical
- **Current**: Dashboard card says "Convert Meeting Notes to Requirements" but the page header says "Upload Meeting Notes". Users may think they navigated to the wrong page.
- **Expected**: Consistent terminology throughout the flow.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/DashboardPage.jsx` (line 237)
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/UploadMeetingPage.jsx` (line 115)
- **Suggested Fix**: Change upload page header to "Convert Meeting Notes to Requirements" or add a subtitle explaining this is the first step of the conversion process.

---

## High Priority Issues

### Dashboard Page

#### Issue: "Coming Soon" cards lack visual distinction
- **Severity**: High
- **Current**: Coming Soon cards (Generate PRD, Recommend Features, Mockups) look almost identical to active cards. Only a small "COMING SOON" badge differentiates them.
- **Expected**: Disabled cards should be visually muted with grayscale icons, reduced opacity, and muted colors.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/DashboardPage.jsx`
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/DashboardPage.css`
- **Suggested Fix**: Add CSS class `task-card--disabled` with: opacity: 0.6, grayscale filter on icons, cursor: not-allowed, and remove hover effects.

#### Issue: Progress bar colors lack legend/explanation
- **Severity**: High
- **Current**: Project cards show a progress bar with green (completed) and blue (in progress) segments, but there's no legend explaining what the colors mean.
- **Expected**: Either add a legend or use more intuitive visual indicators.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/projects/ProjectCard.jsx`
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/projects/ProjectCard.css`
- **Suggested Fix**: Add a tooltip on hover explaining "Green = completed stages, Blue = current stage" or add small label beneath progress bar.

#### Issue: "No description" text displayed for projects
- **Severity**: High
- **Current**: Projects without descriptions show "No description" as visible placeholder text, adding visual noise.
- **Expected**: Either hide the description line entirely when empty or show a meaningful default like the creation date.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/projects/ProjectCard.jsx` (line 205-207)
- **Suggested Fix**: Conditionally render description only when present: `{project.description && <p>...</p>}`

#### Issue: Large gap between task cards and projects section
- **Severity**: High
- **Current**: There's excessive white space between the task cards section and "Your Projects" section, making the page feel disconnected.
- **Expected**: Tighter vertical rhythm with appropriate spacing.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/DashboardPage.css`
- **Suggested Fix**: Reduce margin-bottom on `.task-section` and margin-top on `.dashboard__projects-section`.

### Upload Meeting Notes Page

#### Issue: Half the page is empty white space
- **Severity**: High
- **Current**: The form is left-aligned with significant empty space on the right side of the page, poor use of screen real estate.
- **Expected**: Either center the form or use a two-column layout with helpful content on the right.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/UploadMeetingPage.jsx`
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/UploadMeetingPage.css`
- **Suggested Fix**: Add a right-side panel with: example input formats, tips for best results, or a preview of what extraction produces.

#### Issue: Disabled submit button lacks explanation
- **Severity**: High
- **Current**: "Process Meeting Notes" button is disabled when title or content is missing, but there's no tooltip or message explaining why.
- **Expected**: Users should understand what's needed to enable the button.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/UploadMeetingPage.jsx` (lines 194-214)
- **Suggested Fix**: Add title attribute: `title={isSubmitDisabled ? 'Please enter a meeting title and either upload a file or paste notes' : ''}` or show inline validation messages.

#### Issue: "Back" link placement far right could be missed
- **Severity**: High
- **Current**: Back link is positioned in the far right of the header, away from the natural reading flow.
- **Expected**: Navigation should follow consistent patterns, preferably breadcrumbs.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/UploadMeetingPage.jsx` (line 116)
- **Suggested Fix**: Replace with breadcrumbs: "Dashboard > Convert Meeting Notes" or move back link to left side.

### Extraction Results Page (RecapEditor)

#### Issue: Very long scrolling page with 9 sections
- **Severity**: High
- **Current**: All 9 sections are expanded by default, creating a very long page that requires extensive scrolling.
- **Expected**: Provide navigation aids for long content.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/meetings/RecapEditor.jsx`
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RecapEditorPage.jsx`
- **Suggested Fix**: Add a sticky side navigation showing all sections with item counts, allowing quick jumps. Alternatively, collapse sections with 0 items by default.

#### Issue: All badge colors are teal - no differentiation
- **Severity**: High
- **Current**: Every section count badge uses the same teal color, missing an opportunity to categorize or prioritize.
- **Expected**: Color-code badges by category type (e.g., red for problems/risks, blue for requirements, green for goals).
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/common/CollapsibleSection.jsx`
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/common/CollapsibleSection.css`
- **Suggested Fix**: Pass a `variant` or `category` prop to CollapsibleSection that determines badge color.

#### Issue: Edit/Delete icons only appear on hover
- **Severity**: High
- **Current**: Item action buttons (edit, delete) only appear when hovering over the row. This is not discoverable on touch devices.
- **Expected**: Actions should be visible or have an obvious affordance (like a kebab menu icon).
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/common/ItemRow.jsx`
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/common/ItemRow.css`
- **Suggested Fix**: Always show action icons (at reduced opacity), brighten on hover. Or add a visible "..." menu button.

### Project Selection Page

#### Issue: Radio buttons have low contrast and are small
- **Severity**: High
- **Current**: Radio buttons are small (default browser styling) and the unchecked state has low contrast against the background.
- **Expected**: Larger, more visible selection controls.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/SelectProjectPage.jsx`
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/SelectProjectPage.css`
- **Suggested Fix**: Use custom-styled radio buttons with larger touch targets (at least 44x44px) and clearer selected state.

#### Issue: Disabled "Continue" button not visually clear
- **Severity**: High
- **Current**: When no project is selected, the Continue button appears disabled but lacks visual feedback explaining why.
- **Expected**: Clear disabled state with tooltip explaining the requirement.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/SelectProjectPage.jsx` (lines 228-241)
- **Suggested Fix**: Add tooltip: "Select a project or create a new one to continue"

---

## Medium Priority Issues

### Dashboard Page

#### Issue: Visual hierarchy lacks clear primary CTA for new users
- **Severity**: Medium
- **Current**: All task cards have equal visual weight. New users may not know where to start.
- **Expected**: Highlight the primary recommended action for new users.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/DashboardPage.jsx`
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/DashboardPage.css`
- **Suggested Fix**: Add a "Recommended" badge or subtle highlight to the first active task card. Show an onboarding tooltip for first-time users.

#### Issue: Icons are small and lack color consistency
- **Severity**: Medium
- **Current**: Task card icons are 16x16px and all use stroke-only style in the same color.
- **Expected**: Icons should be larger (24px) and could use the card's accent color.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/DashboardPage.jsx` (lines 230-235, etc.)
- **Suggested Fix**: Increase SVG viewBox and display size. Apply card theme color to icons.

#### Issue: Card hover states may not be obvious enough
- **Severity**: Medium
- **Current**: Hover state on task cards is subtle - users may not realize they're clickable.
- **Expected**: Clear interactive affordance.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/DashboardPage.css`
- **Suggested Fix**: Add transform: translateY(-2px), shadow increase, or cursor pointer more prominently.

### Upload Meeting Notes Page

#### Issue: OR divider between upload and paste is faint
- **Severity**: Medium
- **Current**: The "or" text dividing upload and paste options has low contrast and may be missed.
- **Expected**: Clear visual separation between the two input methods.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/UploadMeetingPage.jsx` (lines 159-161)
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/UploadMeetingPage.css`
- **Suggested Fix**: Increase font size and contrast of "or" text, add stronger horizontal lines.

#### Issue: No preview/examples of expected input format
- **Severity**: Medium
- **Current**: Users don't know what format of meeting notes works best.
- **Expected**: Show examples or tips for optimal input.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/UploadMeetingPage.jsx`
- **Suggested Fix**: Add collapsible "Tips for best results" section or example input snippet.

#### Issue: Cancel button destination unclear
- **Severity**: Medium
- **Current**: Cancel button exists but users may not know where it will take them.
- **Expected**: Clear indication of navigation destination.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/UploadMeetingPage.jsx` (lines 190-192)
- **Suggested Fix**: Change button text to "Cancel (Return to Dashboard)" or add tooltip.

### Extraction Results Page

#### Issue: Empty sections still take up space
- **Severity**: Medium
- **Current**: Sections with 0 items (e.g., "Non-Goals 0") are still expanded and take vertical space.
- **Expected**: Minimize visual noise from empty sections.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/meetings/RecapEditor.jsx` (line 207)
- **Suggested Fix**: Collapse sections with 0 items by default, or reduce their height when empty.

#### Issue: Source text is hard to differentiate from content
- **Severity**: Medium
- **Current**: Source quotes are italicized and slightly smaller, but blend with main content.
- **Expected**: Clear visual hierarchy between item content and source attribution.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/meetings/RecapEditor.jsx` (lines 226-230)
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/meetings/RecapEditor.css`
- **Suggested Fix**: Use a distinct background color, border-left accent, or icon prefix for source quotes.

#### Issue: No summary view showing total item count
- **Severity**: Medium
- **Current**: Users must mentally sum all section counts to know total extracted items.
- **Expected**: Display total count prominently.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RecapEditorPage.jsx`
- **Suggested Fix**: Add summary bar: "18 items extracted across 9 categories"

#### Issue: Page title hard to see while scrolling
- **Severity**: Medium
- **Current**: Meeting name/title scrolls off screen on long pages.
- **Expected**: Title should remain visible for context.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RecapEditorPage.jsx`
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RecapEditorPage.css`
- **Suggested Fix**: Make header sticky or add a mini header that appears on scroll.

#### Issue: No feedback/toast when items are edited successfully
- **Severity**: Medium
- **Current**: After editing an item, there's no confirmation that the save succeeded.
- **Expected**: Brief success feedback.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/common/ItemRow.jsx`
- **Suggested Fix**: Show brief toast notification "Item updated" or subtle inline confirmation.

### Project Selection Page

#### Issue: Project info could show more context
- **Severity**: Medium
- **Current**: Project options only show name and requirement count.
- **Expected**: More context to help users choose the right project.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/SelectProjectPage.jsx` (lines 180-215)
- **Suggested Fix**: Add: last updated date, current stage, or brief description.

#### Issue: Large empty area below options feels unfinished
- **Severity**: Medium
- **Current**: When there are only 1-2 projects, there's significant empty space.
- **Expected**: Page should feel complete regardless of project count.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/SelectProjectPage.css`
- **Suggested Fix**: Center the content vertically or add helpful information in the empty space.

#### Issue: No search/filter if many projects exist
- **Severity**: Medium
- **Current**: No way to filter or search projects on this page.
- **Expected**: Easy project finding for users with many projects.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/SelectProjectPage.jsx`
- **Suggested Fix**: Add search input that filters projects by name.

### Project View Page (ProjectDashboard)

#### Issue: "Processed" vs "Applied" status difference not explained
- **Severity**: Medium
- **Current**: Meeting cards show "Processed" or "Applied" badges but users don't know the difference.
- **Expected**: Clear explanation of status meanings.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/ProjectDashboard.jsx`
- **Suggested Fix**: Add tooltips: "Processed = Ready to apply", "Applied = Added to requirements"

#### Issue: Meeting cards don't indicate they're clickable
- **Severity**: Medium
- **Current**: Meeting cards lack hover state or visual affordance showing they're interactive.
- **Expected**: Clear clickable indication.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/meetings/MeetingsList.jsx`
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/meetings/MeetingsList.css`
- **Suggested Fix**: Add hover state with cursor pointer, slight lift, or arrow icon.

#### Issue: No stage progress indicator
- **Severity**: Medium
- **Current**: Unlike dashboard project cards, the project view page doesn't show stage progress.
- **Expected**: Consistent progress visualization.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/ProjectDashboard.jsx`
- **Suggested Fix**: Add the same progress bar or stage stepper from ProjectCard.

### Requirements View Page

#### Issue: No edit/delete actions visible
- **Severity**: Medium
- **Current**: Requirements page shows items but with hover-only edit/delete actions, similar to RecapEditor.
- **Expected**: Clear indication of available actions.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RequirementsPage.jsx`
- **Suggested Fix**: Always show action icons or add a visible menu button.

#### Issue: Source links not visually obvious as clickable
- **Severity**: Medium
- **Current**: "Source: Meeting 25" links use subtle teal color, may not be recognized as links.
- **Expected**: Clear link affordance.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RequirementsPage.jsx` (lines 316-322)
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RequirementsPage.css`
- **Suggested Fix**: Style as badge/chip with background color, or add underline and arrow icon.

---

## Low Priority Issues

### Dashboard Page

#### Issue: Welcome message uses generic "User" name
- **Severity**: Low
- **Current**: Shows "Welcome back, User" as hardcoded placeholder.
- **Expected**: Either personalize or remove the name.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/DashboardPage.jsx` (line 68)
- **Suggested Fix**: Remove name entirely: "Welcome back" or integrate with auth to show real name.

### Upload Meeting Notes Page

#### Issue: File size limit (50KB) may be too restrictive
- **Severity**: Low
- **Current**: 50KB limit may not accommodate longer meeting transcripts.
- **Expected**: Support typical meeting note sizes.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/UploadMeetingPage.jsx` (line 6)
- **Suggested Fix**: Increase limit to 200KB or make it configurable.

### Project View Page

#### Issue: "Back to Projects" placement
- **Severity**: Low
- **Current**: Link is far right instead of following breadcrumb pattern.
- **Expected**: Consistent navigation pattern.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/ProjectDashboard.jsx` (line 112)
- **Suggested Fix**: Implement breadcrumbs: "Dashboard > Project Name"

#### Issue: Export button grouped with other actions
- **Severity**: Low
- **Current**: Export is in the same row as Add Meeting and View Requirements, but serves different purpose.
- **Expected**: Logical grouping of actions.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/ProjectDashboard.jsx` (lines 135-142)
- **Suggested Fix**: Move Export to a secondary actions area or dropdown menu.

### Requirements View Page

#### Issue: Only Markdown export available
- **Severity**: Low
- **Current**: Single export format (Markdown) offered.
- **Expected**: Multiple export formats for different use cases.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RequirementsPage.jsx` (line 258)
- **Suggested Fix**: Add dropdown with options: Markdown, JSON, CSV, DOCX.

#### Issue: No filters for requirements
- **Severity**: Low
- **Current**: No way to filter requirements by source meeting, date, or search.
- **Expected**: Filtering capability for large requirement sets.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RequirementsPage.jsx`
- **Suggested Fix**: Add search input and filter dropdowns for source meeting.

#### Issue: No bulk actions available
- **Severity**: Low
- **Current**: Can only operate on one requirement at a time.
- **Expected**: Ability to select multiple items for bulk operations.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RequirementsPage.jsx`
- **Suggested Fix**: Add checkboxes and bulk action bar (delete, move, export selected).

#### Issue: Visual monotony - all requirements look the same
- **Severity**: Low
- **Current**: All requirements have identical visual treatment regardless of type or importance.
- **Expected**: Visual differentiation options.
- **Files**:
  - `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RequirementsPage.jsx`
- **Suggested Fix**: Add priority indicators, status badges, or color-coded borders.

---

## Cross-Cutting Issues

### Issue: Inconsistent navigation patterns
- **Severity**: High
- **Current**: Some pages use "Back to X" links, others have breadcrumb-like patterns, placement varies (top-left, top-right, bottom-left).
- **Expected**: Consistent navigation pattern throughout the app.
- **Files**: Multiple pages
- **Suggested Fix**: Implement a unified Breadcrumbs component and use it consistently across all pages. Breadcrumbs component exists at `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/common/Breadcrumbs.jsx` but isn't used everywhere.

### Issue: Loading states could show more context
- **Severity**: Medium
- **Current**: Loading states show generic spinner with "Loading..." text.
- **Expected**: More informative loading states.
- **Files**: Various pages
- **Suggested Fix**: Add contextual messages: "Extracting requirements from your notes...", "Analyzing for conflicts..."

### Issue: Error states need better UX
- **Severity**: Medium
- **Current**: Error states show message and retry button, but no guidance on what went wrong or alternative actions.
- **Expected**: Helpful error recovery guidance.
- **Files**: Various pages
- **Suggested Fix**: Add error-specific messages, suggest alternative actions, provide support contact.

### Issue: Mobile responsiveness verification needed
- **Severity**: Medium
- **Current**: Unknown mobile experience quality.
- **Expected**: Fully responsive design.
- **Files**: All CSS files
- **Suggested Fix**: Conduct mobile testing, add breakpoints, ensure touch targets are adequate (44x44px minimum).

### Issue: Accessibility improvements needed
- **Severity**: Medium
- **Current**: Focus states may not be visible, keyboard navigation may be incomplete.
- **Expected**: WCAG 2.1 AA compliance.
- **Files**: All components
- **Suggested Fix**:
  - Add visible focus rings to all interactive elements
  - Ensure proper ARIA labels
  - Test with screen reader
  - Verify color contrast ratios

### Issue: Empty states could be more helpful
- **Severity**: Low
- **Current**: Empty states show icon and message but limited guidance.
- **Expected**: Actionable empty states that guide users.
- **Files**: Various pages using EmptyState component
- **Suggested Fix**: Add specific next-step guidance and call-to-action buttons in empty states.

---

## Implementation Recommendations

### Phase 1 - Critical Fixes (1-2 days)
1. Add sticky footer for Save & Apply button on RecapEditorPage
2. Fix navigation redundancy on SelectProjectPage
3. Align page titles with dashboard card names

### Phase 2 - High Priority UX (3-5 days)
1. Implement consistent breadcrumb navigation
2. Make "Coming Soon" cards visually distinct
3. Add progress bar legend/tooltips
4. Fix disabled button explanations
5. Always show edit/delete actions (not hover-only)
6. Add side navigation for long RecapEditor page

### Phase 3 - Polish & Enhancement (1 week)
1. Add input examples/tips to upload page
2. Color-code section badges by category
3. Add toast notifications for successful operations
4. Improve empty space usage
5. Add search/filter to project selection
6. Enhance source link visibility

### Phase 4 - Advanced Features (2 weeks)
1. Multiple export formats
2. Bulk actions for requirements
3. Priority/status indicators
4. Mobile optimization pass
5. Accessibility audit and fixes

---

## Related Files Index

| Component | File Path |
|-----------|-----------|
| DashboardPage | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/DashboardPage.jsx` |
| ProjectDashboard | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/ProjectDashboard.jsx` |
| QuickConvertPage | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/QuickConvertPage.jsx` |
| UploadMeetingPage | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/UploadMeetingPage.jsx` |
| RecapEditorPage | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RecapEditorPage.jsx` |
| RecapEditor | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/meetings/RecapEditor.jsx` |
| SelectProjectPage | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/SelectProjectPage.jsx` |
| ProjectViewPage | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/ProjectViewPage.jsx` |
| RequirementsPage | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/pages/RequirementsPage.jsx` |
| ProjectCard | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/projects/ProjectCard.jsx` |
| ItemRow | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/common/ItemRow.jsx` |
| CollapsibleSection | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/common/CollapsibleSection.jsx` |
| StageStepper | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/common/StageStepper.jsx` |
| Breadcrumbs | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/common/Breadcrumbs.jsx` |
| EmptyState | `/mnt/c/Users/ravigar/Projects/cxpm-ai-prd/ui/src/components/common/EmptyState.jsx` |

---

## Completed Fixes (2026-02-02)

### Dashboard Page - COMPLETED

**Files Modified:**
- `ui/src/pages/DashboardPage.jsx`
- `ui/src/pages/DashboardPage.css`
- `ui/src/components/projects/ProjectCard.jsx`
- `ui/src/components/projects/ProjectCard.css`

**Changes Implemented:**
1. **Welcome message simplified** - Removed generic "User" name, now just "Welcome back"
2. **"Recommended" badge added** - First active task card has teal "Recommended" badge for new user guidance
3. **Larger icons** - Task card icons increased from 16px to 24px
4. **Stronger disabled styling** - "Coming Soon" cards now have opacity 0.55 + grayscale filter
5. **Reduced section gap** - Task section margin reduced from 2rem to 1.25rem, projects section top margin reduced
6. **Progress bar legend** - Added inline legend next to "Your Projects" showing green=Completed, blue=In Progress
7. **Progress bar tooltip** - Hovering progress bar shows tooltip with completion details
8. **"No description" removed** - Projects without descriptions no longer show "No description" placeholder

### Upload Meeting Notes Page - COMPLETED

**Files Modified:**
- `ui/src/pages/UploadMeetingPage.jsx`
- `ui/src/pages/UploadMeetingPage.css`

**Changes Implemented:**
1. **Title aligned with Dashboard** - Changed from "Upload Meeting Notes" to "Convert Meeting Notes to Requirements"
2. **Breadcrumb navigation** - Added breadcrumbs replacing far-right "Back" link
3. **Two-column layout** - Form on left, Tips panel on right (better use of screen space)
4. **Tips panel added** - Shows tips for best results + example format
5. **File + text both allowed** - Users can now upload a file AND paste notes (no longer mutually exclusive)
6. **Divider updated** - Changed from "or" to "and / or" to indicate both inputs are allowed
7. **Textarea label updated** - Changed to "Paste Additional Notes" to clarify both can be used
8. **Tooltip on disabled button** - Shows explanation when button is disabled
9. **Stronger divider styling** - Made "and / or" divider more visible

### Mockups Created

HTML mockup files created in `mockups/` folder for review:
- `dashboard-option-a.html` - Selected for Dashboard redesign
- `dashboard-option-b.html` - Alternative Dashboard design (not used)
- `upload-meeting-option-a.html` - Selected for Upload page redesign
- `upload-meeting-option-b.html` - Alternative Upload design (not used)
- `recap-editor-option-a.html` - Selected for Extraction Results (pending implementation)
- `recap-editor-option-b.html` - Alternative Extraction Results (not used)

### Pending Implementation

**Extraction Results Page (RecapEditorPage)** - Option A selected:
- Sticky header with meeting title + summary count
- Sticky side navigation with section jump links
- Sticky footer with Save & Apply button
- Color-coded section badges by category
- Empty sections collapsed by default
- Always visible action icons
- Better source quote styling with left border accent
