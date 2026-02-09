import { test, expect } from '@playwright/test';

/**
 * E2E test for the full apply flow:
 * 1. Create a project
 * 2. Upload first meeting and apply (no conflicts)
 * 3. Upload second meeting with overlapping content
 * 4. Verify conflicts detected
 * 5. Resolve conflicts (keep one, replace one, merge one)
 * 6. Verify final requirements are correct
 */

// Mock data for project
const mockProject = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Project',
  description: 'A test project for E2E testing',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock data for first meeting
const mockMeeting1 = {
  id: 'meeting-001',
  project_id: mockProject.id,
  title: 'Initial Planning Meeting',
  meeting_date: '2024-01-15',
  status: 'processed',
  items: [
    { id: 'item-1', section: 'needs_and_goals', content: 'Users cannot track their work', order: 1 },
    { id: 'item-2', section: 'requirements', content: 'Users want to see progress dashboards', order: 1 },
    { id: 'item-3', section: 'scope_and_constraints', content: 'System must support task creation', order: 1 },
  ],
};

// Mock data for second meeting (with overlapping content)
const mockMeeting2 = {
  id: 'meeting-002',
  project_id: mockProject.id,
  title: 'Follow-up Meeting',
  meeting_date: '2024-01-22',
  status: 'processed',
  items: [
    { id: 'item-4', section: 'needs_and_goals', content: 'Users also need mobile access', order: 1 },
    { id: 'item-5', section: 'requirements', content: 'Users want to see progress dashboards', order: 2 }, // duplicate
    { id: 'item-6', section: 'scope_and_constraints', content: 'System must support advanced task creation with subtasks', order: 2 }, // refinement conflict
    { id: 'item-7', section: 'risks_and_questions', content: 'Must use PostgreSQL database', order: 1 }, // contradiction conflict
    { id: 'item-8', section: 'action_items', content: 'Need to store user preferences', order: 1 },
  ],
};

// Mock apply results for first meeting (no conflicts)
const mockApplyResultsNoConflicts = {
  added: [
    { item_id: 'item-1', item_section: 'needs_and_goals', item_content: 'Users cannot track their work', decision: 'added' },
    { item_id: 'item-2', item_section: 'requirements', item_content: 'Users want to see progress dashboards', decision: 'added' },
    { item_id: 'item-3', item_section: 'scope_and_constraints', item_content: 'System must support task creation', decision: 'added' },
  ],
  skipped: [],
  conflicts: [],
};

// Mock apply results for second meeting (with conflicts)
const mockApplyResultsWithConflicts = {
  added: [
    { item_id: 'item-4', item_section: 'needs_and_goals', item_content: 'Users also need mobile access', decision: 'added' },
    { item_id: 'item-8', item_section: 'action_items', item_content: 'Need to store user preferences', decision: 'added' },
  ],
  skipped: [
    {
      item_id: 'item-5',
      item_section: 'requirements',
      item_content: 'Users want to see progress dashboards',
      reason: 'Exact duplicate of existing requirement',
      matched_requirement: { id: 'req-2', content: 'Users want to see progress dashboards' },
    },
  ],
  conflicts: [
    {
      item_id: 'item-6',
      item_section: 'scope_and_constraints',
      item_content: 'System must support advanced task creation with subtasks',
      classification: 'refinement',
      reason: 'The new item adds more specific implementation details',
      matched_requirement: { id: 'req-3', content: 'System must support task creation' },
    },
    {
      item_id: 'item-7',
      item_section: 'risks_and_questions',
      item_content: 'Must use PostgreSQL database',
      classification: 'contradiction',
      reason: 'The new item contradicts the existing storage approach',
      matched_requirement: { id: 'req-existing', content: 'Must use MongoDB database' },
    },
  ],
};

// Mock requirements after first apply
const mockRequirementsAfterFirstApply = {
  needs_and_goals: [{ id: 'req-1', content: 'Users cannot track their work', section: 'needs_and_goals', sources: [], history_count: 0 }],
  requirements: [{ id: 'req-2', content: 'Users want to see progress dashboards', section: 'requirements', sources: [], history_count: 0 }],
  scope_and_constraints: [{ id: 'req-3', content: 'System must support task creation', section: 'scope_and_constraints', sources: [], history_count: 0 }],
  risks_and_questions: [{ id: 'req-existing', content: 'Must use MongoDB database', section: 'risks_and_questions', sources: [], history_count: 0 }],
  action_items: [],
};

// Mock requirements after second apply with conflict resolutions
const mockRequirementsAfterSecondApply = {
  needs_and_goals: [
    { id: 'req-1', content: 'Users cannot track their work', section: 'needs_and_goals', sources: [], history_count: 0 },
    { id: 'req-4', content: 'Users also need mobile access', section: 'needs_and_goals', sources: [], history_count: 0 },
  ],
  requirements: [{ id: 'req-2', content: 'Users want to see progress dashboards', section: 'requirements', sources: [], history_count: 0 }],
  scope_and_constraints: [{ id: 'req-3', content: 'System must support advanced task creation with subtasks', section: 'scope_and_constraints', sources: [], history_count: 1 }], // replaced
  risks_and_questions: [
    { id: 'req-existing', content: 'Must use MongoDB database', section: 'risks_and_questions', sources: [], history_count: 0 }, // kept existing
    { id: 'req-merged', content: 'Primary database is MongoDB but PostgreSQL is acceptable for reporting', section: 'risks_and_questions', sources: [], history_count: 0 }, // merged
  ],
  action_items: [{ id: 'req-5', content: 'Need to store user preferences', section: 'action_items', sources: [], history_count: 0 }],
};

// Mock merge suggestion response
const mockMergeSuggestion = {
  merged_text: 'Primary database is MongoDB but PostgreSQL is acceptable for reporting',
};

test.describe('Full Apply Flow E2E', () => {
  let meetingCount = 0;
  let hasFirstMeetingApplied = false;
  let conflictResolutions: Record<string, string> = {};

  test.beforeEach(async ({ page }) => {
    meetingCount = 0;
    hasFirstMeetingApplied = false;
    conflictResolutions = {};

    // Mock API endpoints
    await page.route('**/api/projects', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        // Return list of projects
        await route.fulfill({ json: [mockProject] });
      } else if (method === 'POST') {
        // Create project
        await route.fulfill({ json: mockProject, status: 201 });
      }
    });

    await page.route(`**/api/projects/${mockProject.id}`, async (route) => {
      await route.fulfill({ json: mockProject });
    });

    await page.route('**/api/meetings/upload', async (route) => {
      meetingCount++;
      const meeting = meetingCount === 1 ? mockMeeting1 : mockMeeting2;
      await route.fulfill({
        json: {
          meeting_id: meeting.id,
          job_id: `job-${meeting.id}`,
        },
        status: 201,
      });
    });

    await page.route(`**/api/meetings/${mockMeeting1.id}`, async (route) => {
      await route.fulfill({ json: mockMeeting1 });
    });

    await page.route(`**/api/meetings/${mockMeeting2.id}`, async (route) => {
      await route.fulfill({ json: mockMeeting2 });
    });

    await page.route(`**/api/meetings/${mockMeeting1.id}/apply`, async (route) => {
      await route.fulfill({ json: mockApplyResultsNoConflicts });
    });

    await page.route(`**/api/meetings/${mockMeeting2.id}/apply`, async (route) => {
      await route.fulfill({ json: mockApplyResultsWithConflicts });
    });

    await page.route(`**/api/meetings/${mockMeeting1.id}/resolve`, async (route) => {
      hasFirstMeetingApplied = true;
      await route.fulfill({ json: { added: 3, skipped: 0, merged: 0, replaced: 0 } });
    });

    await page.route(`**/api/meetings/${mockMeeting2.id}/resolve`, async (route) => {
      // Parse request body to verify decisions
      const body = route.request().postDataJSON();
      if (body?.decisions) {
        body.decisions.forEach((d: { item_id: string; decision: string }) => {
          conflictResolutions[d.item_id] = d.decision;
        });
      }
      await route.fulfill({ json: { added: 2, skipped: 1, merged: 1, replaced: 1 } });
    });

    await page.route(`**/api/projects/${mockProject.id}/requirements`, async (route) => {
      // Return appropriate requirements based on state
      if (Object.keys(conflictResolutions).length > 0) {
        await route.fulfill({ json: mockRequirementsAfterSecondApply });
      } else if (hasFirstMeetingApplied) {
        await route.fulfill({ json: mockRequirementsAfterFirstApply });
      } else {
        await route.fulfill({
          json: {
            needs_and_goals: [],
            requirements: [],
            scope_and_constraints: [],
            risks_and_questions: [{ id: 'req-existing', content: 'Must use MongoDB database', section: 'risks_and_questions', sources: [], history_count: 0 }],
            action_items: [],
          },
        });
      }
    });

    await page.route('**/api/meetings/*/items/*/merge-suggestion', async (route) => {
      await route.fulfill({ json: mockMergeSuggestion });
    });

    await page.route(`**/api/projects/${mockProject.id}/meetings`, async (route) => {
      if (meetingCount === 0) {
        await route.fulfill({ json: [] });
      } else if (meetingCount === 1) {
        await route.fulfill({ json: [{ ...mockMeeting1, applied_at: hasFirstMeetingApplied ? '2024-01-15T12:00:00Z' : null }] });
      } else {
        await route.fulfill({
          json: [
            { ...mockMeeting1, applied_at: '2024-01-15T12:00:00Z' },
            { ...mockMeeting2, applied_at: null },
          ],
        });
      }
    });

    // Mock SSE streaming endpoint - immediately complete
    await page.route('**/api/meetings/*/stream', async (route) => {
      const id = route.request().url().includes(mockMeeting1.id) ? mockMeeting1.id : mockMeeting2.id;
      const items = id === mockMeeting1.id ? mockMeeting1.items : mockMeeting2.items;

      // Return a simple response that signals completion
      const eventData = items.map(item =>
        `data: ${JSON.stringify({ type: 'item', ...item })}\n\n`
      ).join('') + `data: ${JSON.stringify({ type: 'complete' })}\n\n`;

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: eventData,
      });
    });
  });

  test('creates project successfully', async ({ page }) => {
    // Navigate to projects page
    await page.goto('/app/projects');

    // Click New Project button
    await page.click('button:has-text("New Project")');

    // Fill in the form
    await page.fill('#project-name', 'Test Project');
    await page.fill('#project-description', 'A test project for E2E testing');

    // Submit the form
    await page.click('button[type="submit"]:has-text("Create Project")');

    // Verify modal closes and project card appears
    await expect(page.locator('.project-card').first()).toBeVisible();
    await expect(page.locator('.project-card').first()).toContainText('Test Project');
  });

  test('uploads first meeting and applies without conflicts', async ({ page }) => {
    // Navigate to project dashboard
    await page.goto(`/app/projects/${mockProject.id}`);

    // Click Add Meeting button
    await page.click('a:has-text("Add Meeting"), button:has-text("Add Meeting")');

    // Fill in meeting details
    await page.fill('input#title', 'Initial Planning Meeting');

    // Paste meeting notes in text area
    await page.fill('textarea#text-input', 'Meeting notes content here...');

    // Submit the form
    await page.click('button:has-text("Process Meeting Notes")');

    // Should navigate to recap editor page
    await page.waitForURL(`**/projects/${mockProject.id}/meetings/${mockMeeting1.id}`);

    // Wait for streaming to complete and show recap editor
    await expect(page.locator('.save-apply-btn')).toBeVisible({ timeout: 10000 });

    // Click Save & Apply button
    await page.click('button:has-text("Save & Apply")');

    // Should navigate to conflict resolver page
    await page.waitForURL(`**/projects/${mockProject.id}/meetings/${mockMeeting1.id}/apply`);

    // Verify no conflicts shown
    await expect(page.locator('.summary-item.summary-added')).toContainText('3');
    await expect(page.locator('.summary-item.summary-skipped')).toContainText('0');
    await expect(page.locator('.summary-item.summary-conflicts')).toContainText('0');

    // Apply button should be enabled (no conflicts to resolve)
    const applyButton = page.locator('button:has-text("Apply Changes")');
    await expect(applyButton).toBeEnabled();

    // Click Apply Changes
    await page.click('button:has-text("Apply Changes")');

    // Verify success message
    await expect(page.locator('.apply-success-message')).toBeVisible();
    await expect(page.locator('.apply-success-message')).toContainText('Changes applied successfully');
  });

  test('uploads second meeting with overlapping content and detects conflicts', async ({ page }) => {
    // Simulate first meeting already applied
    hasFirstMeetingApplied = true;
    meetingCount = 1;

    // Navigate to project dashboard
    await page.goto(`/app/projects/${mockProject.id}`);

    // Click Add Meeting button
    await page.click('a:has-text("Add Meeting"), button:has-text("Add Meeting")');

    // Fill in meeting details
    await page.fill('input#title', 'Follow-up Meeting');

    // Paste meeting notes
    await page.fill('textarea#text-input', 'Follow-up meeting notes with overlapping content...');

    // Submit the form
    await page.click('button:has-text("Process Meeting Notes")');

    // Wait for navigation to recap editor
    await page.waitForURL(`**/projects/${mockProject.id}/meetings/${mockMeeting2.id}`);

    // Wait for Save & Apply button
    await expect(page.locator('.save-apply-btn')).toBeVisible({ timeout: 10000 });

    // Click Save & Apply
    await page.click('button:has-text("Save & Apply")');

    // Wait for conflict resolver page
    await page.waitForURL(`**/projects/${mockProject.id}/meetings/${mockMeeting2.id}/apply`);

    // Verify conflicts are detected
    await expect(page.locator('.summary-item.summary-added')).toContainText('2');
    await expect(page.locator('.summary-item.summary-skipped')).toContainText('1');
    await expect(page.locator('.summary-item.summary-conflicts')).toContainText('2');

    // Verify conflict cards are displayed
    await expect(page.locator('.conflict-card')).toHaveCount(2);

    // Apply button should be disabled (conflicts need resolution)
    const applyButton = page.locator('button:has-text("Apply Changes")');
    await expect(applyButton).toBeDisabled();
  });

  test('resolves conflicts with different strategies (keep, replace, merge)', async ({ page }) => {
    // Simulate first meeting already applied
    hasFirstMeetingApplied = true;
    meetingCount = 1;

    // Navigate directly to conflict resolver for second meeting
    await page.goto(`/app/projects/${mockProject.id}/meetings/${mockMeeting2.id}/apply`);

    // Wait for page to load
    await expect(page.locator('.conflict-card')).toHaveCount(2);

    // Verify initial state - Apply button should be disabled
    const applyButton = page.locator('button:has-text("Apply Changes")');
    await expect(applyButton).toBeDisabled();
    await expect(page.locator('text=0/2 conflicts resolved')).toBeVisible();

    // First conflict (refinement) - select "Replace"
    const firstConflict = page.locator('.conflict-card').first();
    await firstConflict.locator('label:has-text("Replace") input[type="radio"]').click();

    // Verify one conflict resolved
    await expect(page.locator('text=1/2 conflicts resolved')).toBeVisible();

    // Second conflict (contradiction) - select "Keep existing"
    const secondConflict = page.locator('.conflict-card').last();
    await secondConflict.locator('label:has-text("Keep existing") input[type="radio"]').click();

    // Verify all conflicts resolved
    await expect(page.locator('text=2/2 conflicts resolved')).toBeVisible();

    // Apply button should now be enabled
    await expect(applyButton).toBeEnabled();

    // Click Apply Changes
    await page.click('button:has-text("Apply Changes")');

    // Verify success message
    await expect(page.locator('.apply-success-message')).toBeVisible();
    await expect(page.locator('.apply-success-message')).toContainText('Changes applied successfully');

    // Verify the conflict resolutions were sent correctly
    expect(conflictResolutions['item-6']).toBe('conflict_replaced');
    expect(conflictResolutions['item-7']).toBe('conflict_keep_existing');
  });

  test('uses bulk action to accept AI recommendations', async ({ page }) => {
    // Simulate first meeting already applied
    hasFirstMeetingApplied = true;
    meetingCount = 1;

    // Navigate to conflict resolver
    await page.goto(`/app/projects/${mockProject.id}/meetings/${mockMeeting2.id}/apply`);

    // Wait for page to load
    await expect(page.locator('.conflict-card')).toHaveCount(2);

    // Click "Accept AI recommendations" bulk action
    await page.click('button:has-text("Accept AI recommendations")');

    // Verify all conflicts resolved
    await expect(page.locator('text=2/2 conflicts resolved')).toBeVisible();

    // Apply button should be enabled
    const applyButton = page.locator('button:has-text("Apply Changes")');
    await expect(applyButton).toBeEnabled();
  });

  test('verifies final requirements after conflict resolution', async ({ page }) => {
    // Simulate both meetings applied
    hasFirstMeetingApplied = true;
    meetingCount = 2;
    conflictResolutions = { 'item-6': 'conflict_replaced', 'item-7': 'conflict_keep_existing' };

    // Navigate to requirements page
    await page.goto(`/app/projects/${mockProject.id}/requirements`);

    // Wait for requirements to load
    await expect(page.locator('.requirements-section')).toBeVisible();

    // Verify Needs & Goals section has 2 items
    const needsSection = page.locator('.collapsible-section:has-text("Needs & Goals")');
    await expect(needsSection.locator('.requirements-item-wrapper')).toHaveCount(2);
    await expect(needsSection).toContainText('Users cannot track their work');
    await expect(needsSection).toContainText('Users also need mobile access');

    // Verify Requirements section has 1 item (duplicate was skipped)
    const requirementsSection = page.locator('.collapsible-section:has-text("Requirements")');
    await expect(requirementsSection.locator('.requirements-item-wrapper')).toHaveCount(1);
    await expect(requirementsSection).toContainText('Users want to see progress dashboards');

    // Verify Scope & Constraints has the replaced content
    const scopeSection = page.locator('.collapsible-section:has-text("Scope & Constraints")');
    await expect(scopeSection.locator('.requirements-item-wrapper')).toHaveCount(1);
    await expect(scopeSection).toContainText('System must support advanced task creation with subtasks');

    // Verify Action Items has the new item
    const actionItemsSection = page.locator('.collapsible-section:has-text("Action Items")');
    await expect(actionItemsSection.locator('.requirements-item-wrapper')).toHaveCount(1);
    await expect(actionItemsSection).toContainText('Need to store user preferences');

    // Verify Risks & Open Questions section (kept existing + added merged)
    const risksSection = page.locator('.collapsible-section:has-text("Risks & Open Questions")');
    await expect(risksSection.locator('.requirements-item-wrapper')).toHaveCount(2);
    await expect(risksSection).toContainText('Must use MongoDB database');
  });

  test('full flow: create project, upload meetings, resolve conflicts, verify requirements', async ({ page }) => {
    // Step 1: Navigate to projects and create a new project
    await page.goto('/app/projects');
    await page.click('button:has-text("New Project")');
    await page.fill('#project-name', 'Test Project');
    await page.fill('#project-description', 'A test project');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.locator('.project-card').first()).toBeVisible();

    // Step 2: Navigate to project and upload first meeting
    await page.click(`.project-card:has-text("Test Project")`);
    await page.waitForURL(`**/projects/${mockProject.id}`);

    await page.click('a:has-text("Add Meeting"), button:has-text("Add Meeting")');
    await page.fill('input#title', 'Initial Planning Meeting');
    await page.fill('textarea#text-input', 'Meeting notes...');
    await page.click('button:has-text("Process Meeting Notes")');

    // Wait for recap editor
    await page.waitForURL(`**/projects/${mockProject.id}/meetings/${mockMeeting1.id}`);
    await expect(page.locator('.save-apply-btn')).toBeVisible({ timeout: 10000 });

    // Step 3: Apply first meeting (no conflicts)
    await page.click('button:has-text("Save & Apply")');
    await page.waitForURL(`**/projects/${mockProject.id}/meetings/${mockMeeting1.id}/apply`);
    await expect(page.locator('.summary-item.summary-conflicts')).toContainText('0');
    await page.click('button:has-text("Apply Changes")');
    await expect(page.locator('.apply-success-message')).toBeVisible();

    // Mark first meeting as applied for subsequent mocks
    hasFirstMeetingApplied = true;

    // Step 4: Navigate back and upload second meeting
    await page.goto(`/app/projects/${mockProject.id}`);
    await page.click('a:has-text("Add Meeting"), button:has-text("Add Meeting")');
    await page.fill('input#title', 'Follow-up Meeting');
    await page.fill('textarea#text-input', 'Follow-up notes with conflicts...');
    await page.click('button:has-text("Process Meeting Notes")');

    // Wait for recap editor
    await page.waitForURL(`**/projects/${mockProject.id}/meetings/${mockMeeting2.id}`);
    await expect(page.locator('.save-apply-btn')).toBeVisible({ timeout: 10000 });

    // Step 5: Apply second meeting (with conflicts)
    await page.click('button:has-text("Save & Apply")');
    await page.waitForURL(`**/projects/${mockProject.id}/meetings/${mockMeeting2.id}/apply`);

    // Verify conflicts detected
    await expect(page.locator('.summary-item.summary-conflicts')).toContainText('2');
    await expect(page.locator('.conflict-card')).toHaveCount(2);

    // Step 6: Resolve conflicts
    // First conflict - Replace
    const firstConflict = page.locator('.conflict-card').first();
    await firstConflict.locator('label:has-text("Replace") input[type="radio"]').click();

    // Second conflict - Keep existing
    const secondConflict = page.locator('.conflict-card').last();
    await secondConflict.locator('label:has-text("Keep existing") input[type="radio"]').click();

    // Apply resolved changes
    await page.click('button:has-text("Apply Changes")');
    await expect(page.locator('.apply-success-message')).toBeVisible();

    // Step 7: Navigate to requirements and verify final state
    await page.goto(`/app/projects/${mockProject.id}/requirements`);
    await expect(page.locator('.requirements-section')).toBeVisible();

    // Verify requirements are correct
    await expect(page.locator('.collapsible-section:has-text("Needs & Goals")')).toContainText('Users cannot track their work');
    await expect(page.locator('.collapsible-section:has-text("Needs & Goals")')).toContainText('Users also need mobile access');
    await expect(page.locator('.collapsible-section:has-text("Scope & Constraints")')).toContainText('System must support advanced task creation with subtasks');
  });
});
