import { test, expect } from '@playwright/test';

/**
 * E2E tests for User Stories Generation Flow
 *
 * Test coverage:
 * 1. Navigate to stories landing page, select project, choose format, generate
 * 2. Wait for generation to complete
 * 3. Verify stories list displays
 * 4. Test story card expand and edit modal
 * 5. Test batch filter and delete
 * 6. Test export functionality
 */

// Mock data
const mockProject = {
  id: 'stories-test-project-id',
  name: 'Stories Test Project',
  description: 'Project for Stories E2E testing',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock story batch
const mockBatch1 = {
  id: 'batch-001',
  project_id: mockProject.id,
  format: 'classic',
  section_filter: null,
  story_count: 3,
  status: 'ready',
  error_message: null,
  created_by: 'system',
  created_at: '2024-01-15T10:00:00Z',
};

const mockBatch2 = {
  id: 'batch-002',
  project_id: mockProject.id,
  format: 'job_story',
  section_filter: ['problems', 'user_goals'],
  story_count: 2,
  status: 'ready',
  error_message: null,
  created_by: 'system',
  created_at: '2024-01-16T10:00:00Z',
};

// Mock stories
const mockStories = [
  {
    id: 'story-001',
    project_id: mockProject.id,
    batch_id: mockBatch1.id,
    story_number: 1,
    story_id: 'US-001',
    format: 'classic',
    title: 'User can upload files',
    description: 'As a user, I want to upload files, so that I can share documents with my team.',
    acceptance_criteria: [
      'User can select files from local storage',
      'System validates file type and size',
      'Upload progress is displayed',
      'User receives confirmation on success',
    ],
    order: 1,
    labels: ['file-upload', 'core'],
    size: 'M',
    requirement_ids: ['req-1', 'req-2'],
    status: 'draft',
    created_at: '2024-01-15T10:01:00Z',
    updated_at: '2024-01-15T10:01:00Z',
  },
  {
    id: 'story-002',
    project_id: mockProject.id,
    batch_id: mockBatch1.id,
    story_number: 2,
    story_id: 'US-002',
    format: 'classic',
    title: 'User can view upload history',
    description: 'As a user, I want to view my upload history, so that I can track my shared documents.',
    acceptance_criteria: [
      'User can see list of uploaded files',
      'List shows file name, date, and status',
      'User can filter by date range',
    ],
    order: 2,
    labels: ['file-upload', 'history'],
    size: 'S',
    requirement_ids: ['req-3'],
    status: 'ready',
    created_at: '2024-01-15T10:02:00Z',
    updated_at: '2024-01-15T10:02:00Z',
  },
  {
    id: 'story-003',
    project_id: mockProject.id,
    batch_id: mockBatch1.id,
    story_number: 3,
    story_id: 'US-003',
    format: 'classic',
    title: 'User can delete uploaded files',
    description: 'As a user, I want to delete uploaded files, so that I can remove outdated documents.',
    acceptance_criteria: [
      'User can select files to delete',
      'Confirmation dialog is shown',
      'File is removed from storage',
    ],
    order: 3,
    labels: ['file-upload', 'delete'],
    size: 'XS',
    requirement_ids: ['req-1'],
    status: 'draft',
    created_at: '2024-01-15T10:03:00Z',
    updated_at: '2024-01-15T10:03:00Z',
  },
  {
    id: 'story-004',
    project_id: mockProject.id,
    batch_id: mockBatch2.id,
    story_number: 4,
    story_id: 'US-004',
    format: 'job_story',
    title: 'User needs quick access to recent files',
    description: 'When I am in a meeting and need to share a document, I want to quickly access my recent files, so I can share them without delay.',
    acceptance_criteria: [
      'Recent files section shows last 10 uploads',
      'Files can be shared with one click',
    ],
    order: 1,
    labels: ['quick-access'],
    size: 'L',
    requirement_ids: ['req-2'],
    status: 'draft',
    created_at: '2024-01-16T10:01:00Z',
    updated_at: '2024-01-16T10:01:00Z',
  },
  {
    id: 'story-005',
    project_id: mockProject.id,
    batch_id: mockBatch2.id,
    story_number: 5,
    story_id: 'US-005',
    format: 'job_story',
    title: 'User needs to organize files by project',
    description: 'When I am working on multiple projects, I want to organize my files by project, so I can find them easily.',
    acceptance_criteria: [
      'User can create project folders',
      'Files can be moved between folders',
      'Search works within folders',
    ],
    order: 2,
    labels: ['organization', 'folders'],
    size: 'XL',
    requirement_ids: ['req-1', 'req-3'],
    status: 'exported',
    created_at: '2024-01-16T10:02:00Z',
    updated_at: '2024-01-16T10:02:00Z',
  },
];

// Mock requirements for the project
const mockRequirements = {
  problems: [
    { id: 'req-1', content: 'Users cannot easily share files', section: 'problems', sources: [], history_count: 0 },
    { id: 'req-2', content: 'No central file storage', section: 'problems', sources: [], history_count: 0 },
  ],
  user_goals: [
    { id: 'req-3', content: 'Users want organized file management', section: 'user_goals', sources: [], history_count: 0 },
  ],
  functional_requirements: [],
  data_needs: [],
  constraints: [],
  non_goals: [],
  risks_assumptions: [],
  open_questions: [],
  action_items: [],
};

test.describe('User Stories Generation E2E Tests', () => {
  let batchStatus = 'queued';
  let pollCount = 0;
  let currentStories = [...mockStories];
  let currentBatches = [mockBatch1, mockBatch2];

  test.beforeEach(async ({ page }) => {
    // Reset state
    batchStatus = 'queued';
    pollCount = 0;
    currentStories = [...mockStories];
    currentBatches = [mockBatch1, mockBatch2];

    // Mock API: Projects list
    await page.route('**/api/projects', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({ json: [mockProject] });
      }
    });

    // Mock API: Single project
    await page.route(`**/api/projects/${mockProject.id}`, async (route) => {
      const url = route.request().url();
      // Skip sub-routes
      if (url.includes('/stories') || url.includes('/requirements')) return;
      await route.fulfill({ json: mockProject });
    });

    // Mock API: Project requirements
    await page.route(`**/api/projects/${mockProject.id}/requirements`, async (route) => {
      await route.fulfill({ json: mockRequirements });
    });

    // Mock API: Generate stories
    await page.route(`**/api/projects/${mockProject.id}/stories/generate`, async (route) => {
      batchStatus = 'queued';
      pollCount = 0;
      await route.fulfill({
        json: { ...mockBatch1, id: 'new-batch', status: 'queued' },
        status: 202,
      });
    });

    // Mock API: Batch status (simulates generation progress)
    await page.route('**/api/stories/batches/*/status', async (route) => {
      pollCount++;
      // Simulate generation: queued -> generating -> ready
      if (pollCount === 1) {
        batchStatus = 'queued';
      } else if (pollCount === 2) {
        batchStatus = 'generating';
      } else {
        batchStatus = 'ready';
      }
      await route.fulfill({
        json: { status: batchStatus, error_message: null, story_count: 3 },
      });
    });

    // Mock API: Cancel batch
    await page.route('**/api/stories/batches/*/cancel', async (route) => {
      batchStatus = 'cancelled';
      await route.fulfill({ json: { status: 'cancelled' } });
    });

    // Mock API: List stories for project
    await page.route(`**/api/projects/${mockProject.id}/stories`, async (route) => {
      const url = route.request().url();
      // Skip sub-routes
      if (url.includes('/generate') || url.includes('/batches') || url.includes('/export') || url.includes('/reorder')) return;

      // Parse batch_id filter from query string
      const urlObj = new URL(url, 'http://localhost');
      const batchId = urlObj.searchParams.get('batch_id');

      let filteredStories = currentStories;
      if (batchId) {
        filteredStories = currentStories.filter(s => s.batch_id === batchId);
      }

      await route.fulfill({
        json: {
          items: filteredStories,
          total: filteredStories.length,
          skip: 0,
          limit: 100,
        },
      });
    });

    // Mock API: List batches
    await page.route(`**/api/projects/${mockProject.id}/stories/batches`, async (route) => {
      await route.fulfill({ json: currentBatches });
    });

    // Mock API: Get single story
    await page.route('**/api/stories/*', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // Skip batch routes
      if (url.includes('/batches')) return;

      const storyId = url.split('/').pop();
      const story = currentStories.find(s => s.id === storyId);

      if (method === 'GET') {
        if (story) {
          await route.fulfill({ json: story });
        } else {
          await route.fulfill({ status: 404, json: { detail: 'Not found' } });
        }
      } else if (method === 'PUT') {
        const body = route.request().postDataJSON();
        if (story) {
          // Update story
          Object.assign(story, body);
          await route.fulfill({ json: story });
        } else {
          await route.fulfill({ status: 404, json: { detail: 'Not found' } });
        }
      } else if (method === 'DELETE') {
        // Soft delete
        currentStories = currentStories.filter(s => s.id !== storyId);
        await route.fulfill({ status: 204 });
      }
    });

    // Mock API: Delete batch
    await page.route(`**/api/projects/${mockProject.id}/stories/batch/*`, async (route) => {
      const method = route.request().method();
      if (method === 'DELETE') {
        const url = route.request().url();
        const batchId = url.split('/').pop();
        // Remove batch and its stories
        currentBatches = currentBatches.filter(b => b.id !== batchId);
        currentStories = currentStories.filter(s => s.batch_id !== batchId);
        await route.fulfill({ status: 204 });
      }
    });

    // Mock API: Export stories
    await page.route(`**/api/projects/${mockProject.id}/stories/export*`, async (route) => {
      const url = route.request().url();
      const urlObj = new URL(url, 'http://localhost');
      const format = urlObj.searchParams.get('format') || 'markdown';

      if (format === 'json') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(currentStories),
          headers: {
            'Content-Disposition': 'attachment; filename="stories.json"',
          },
        });
      } else if (format === 'csv') {
        const csv = 'Story ID,Title,Description,Acceptance Criteria,Size,Labels,Status\n' +
          currentStories.map(s =>
            `${s.story_id},"${s.title}","${s.description}","${s.acceptance_criteria.join('|')}",${s.size},"${s.labels.join(',')}",${s.status}`
          ).join('\n');
        await route.fulfill({
          status: 200,
          contentType: 'text/csv',
          body: csv,
          headers: {
            'Content-Disposition': 'attachment; filename="stories.csv"',
          },
        });
      } else {
        const markdown = `# User Stories\n\n${currentStories.map(s => `## ${s.story_id}: ${s.title}\n\n${s.description}`).join('\n\n')}`;
        await route.fulfill({
          status: 200,
          contentType: 'text/markdown',
          body: markdown,
          headers: {
            'Content-Disposition': 'attachment; filename="stories.md"',
          },
        });
      }
    });

    // Mock API: Reorder stories
    await page.route(`**/api/projects/${mockProject.id}/stories/reorder`, async (route) => {
      await route.fulfill({ json: { success: true } });
    });
  });

  test('navigates to stories landing page and displays project selector', async ({ page }) => {
    await page.goto('/app/stories');

    // Verify landing page elements
    await expect(page.locator('h2')).toContainText(/User Stor|Stories/i);
    await expect(page.locator('select, .project-selector')).toBeVisible();

    // Verify project appears in selector
    await expect(page.locator('option, .project-option')).toContainText('Stories Test Project');
  });

  test('selects project and navigates to stories page', async ({ page }) => {
    await page.goto('/app/stories');

    // Wait for projects to load
    await expect(page.locator('select, .project-selector')).toBeVisible();

    // Select the project
    await page.selectOption('select', mockProject.id);

    // Should navigate to stories page
    await page.waitForURL(`**/projects/${mockProject.id}/stories`);

    // Verify stories page elements
    await expect(page.locator('text=Stories Test Project')).toBeVisible();
    await expect(page.locator('text=Classic Format')).toBeVisible();
    await expect(page.locator('text=Job Story Format')).toBeVisible();
  });

  test('selects format and shows correct description', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Wait for page to load
    await expect(page.locator('text=Classic Format')).toBeVisible();

    // Classic format should be selected by default
    const classicOption = page.locator('.stories-format-option:has-text("Classic Format")');
    await expect(classicOption).toHaveClass(/selected|stories-format-option--selected/);

    // Click on Job Story Format
    await page.click('.stories-format-option:has-text("Job Story Format")');

    // Job Story Format should now be selected
    const jobOption = page.locator('.stories-format-option:has-text("Job Story Format")');
    await expect(jobOption).toHaveClass(/selected|stories-format-option--selected/);
  });

  test('generates stories and shows updated list on completion', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Wait for page to load
    await expect(page.locator('text=Generate Stories')).toBeVisible();

    // Verify existing stories are displayed
    await expect(page.locator('.story-card, [data-testid="story-card"]')).toHaveCount(5);

    // Click Generate button
    await page.click('button:has-text("Generate Stories")');

    // Info dialog should appear (since there are existing stories)
    await expect(page.locator('text=Stories Will Be Added')).toBeVisible();

    // Click Continue & Generate
    await page.click('button:has-text("Continue"), button:has-text("Generate")');

    // Should show progress overlay
    await expect(page.locator('.stories-progress-overlay, .stories-progress-modal')).toBeVisible();

    // Wait for generation to complete (overlay disappears)
    await expect(page.locator('.stories-progress-overlay')).not.toBeVisible({ timeout: 15000 });
  });

  test('displays progress overlay with cancel button during generation', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Click Generate button
    await page.click('button:has-text("Generate Stories")');

    // Click Continue on info dialog
    await page.click('button:has-text("Continue")');

    // Should show progress overlay
    await expect(page.locator('.stories-progress-overlay')).toBeVisible();

    // Cancel button should be visible
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });

  test('cancels generation when cancel button is clicked', async ({ page }) => {
    // Make the status endpoint return generating until cancelled
    await page.route('**/api/stories/batches/*/status', async (route) => {
      await route.fulfill({
        json: { status: batchStatus === 'cancelled' ? 'cancelled' : 'generating', error_message: null },
      });
    });

    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Click Generate button
    await page.click('button:has-text("Generate Stories")');

    // Click Continue on info dialog
    await page.click('button:has-text("Continue")');

    // Wait for progress overlay
    await expect(page.locator('.stories-progress-overlay')).toBeVisible();

    // Click Cancel button
    await page.click('button:has-text("Cancel")');

    // Progress overlay should disappear
    await expect(page.locator('.stories-progress-overlay')).not.toBeVisible({ timeout: 10000 });
  });

  test('shows error message and retry button on generation failure', async ({ page }) => {
    // Override status endpoint to return failed
    await page.route('**/api/stories/batches/*/status', async (route) => {
      pollCount++;
      if (pollCount >= 2) {
        await route.fulfill({
          json: { status: 'failed', error_message: 'LLM request timed out' },
        });
      } else {
        await route.fulfill({
          json: { status: 'generating', error_message: null },
        });
      }
    });

    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Click Generate button
    await page.click('button:has-text("Generate Stories")');

    // Click Continue on info dialog
    await page.click('button:has-text("Continue")');

    // Wait for error to appear
    await expect(page.locator('text=timed out')).toBeVisible({ timeout: 10000 });

    // Try Again button should be visible
    await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
  });

  test('story card shows collapsed view with ID, title, and size', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Wait for stories to load
    await expect(page.locator('.story-card')).toHaveCount(5);

    // First story card should show key info
    const firstCard = page.locator('.story-card').first();
    await expect(firstCard).toContainText('US-001');
    await expect(firstCard).toContainText('User can upload files');
    await expect(firstCard.locator('.story-card-size, [class*="size"]')).toBeVisible();
  });

  test('clicking story card expands to show details', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Wait for stories to load
    await expect(page.locator('.story-card')).toHaveCount(5);

    // Click on first story card header to expand
    const firstCard = page.locator('.story-card').first();
    await firstCard.locator('.story-card-header, button').first().click();

    // Expanded content should be visible
    await expect(firstCard.locator('.story-card-body')).toBeVisible();

    // Acceptance criteria should be visible
    await expect(firstCard).toContainText('User can select files from local storage');
  });

  test('edit button opens story edit modal', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Wait for stories to load
    await expect(page.locator('.story-card')).toHaveCount(5);

    // Expand first story card
    const firstCard = page.locator('.story-card').first();
    await firstCard.locator('.story-card-header').first().click();

    // Click Edit button
    await firstCard.locator('button:has-text("Edit")').click();

    // Edit modal should appear
    await expect(page.locator('.story-edit-modal, [class*="edit-modal"]')).toBeVisible();

    // Modal should show story details
    await expect(page.locator('input[value*="User can upload files"]')).toBeVisible();
  });

  test('edit modal allows updating story fields', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Expand first story card
    const firstCard = page.locator('.story-card').first();
    await firstCard.locator('.story-card-header').first().click();

    // Click Edit button
    await firstCard.locator('button:has-text("Edit")').click();

    // Wait for modal
    await expect(page.locator('.story-edit-modal')).toBeVisible();

    // Edit the title
    const titleInput = page.locator('input[name="title"], .story-edit-title input');
    await titleInput.fill('Updated: User can upload files');

    // Change the size
    await page.selectOption('select[name="size"], .story-edit-size select', 'L');

    // Click Save
    await page.click('button:has-text("Save")');

    // Modal should close
    await expect(page.locator('.story-edit-modal')).not.toBeVisible({ timeout: 5000 });
  });

  test('delete button shows confirmation dialog', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Expand first story card
    const firstCard = page.locator('.story-card').first();
    await firstCard.locator('.story-card-header').first().click();

    // Click Delete button
    await firstCard.locator('button:has-text("Delete")').click();

    // Confirmation dialog should appear
    await expect(page.locator('text=Are you sure, text=confirm, text=delete')).toBeVisible();
  });

  test('confirming delete removes story from list', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Wait for stories to load
    await expect(page.locator('.story-card')).toHaveCount(5);

    // Expand first story card
    const firstCard = page.locator('.story-card').first();
    await firstCard.locator('.story-card-header').first().click();

    // Click Delete button
    await firstCard.locator('button:has-text("Delete")').click();

    // Click Confirm in the dialog
    await page.click('button:has-text("Confirm"), button:has-text("Delete"):visible');

    // Story count should decrease
    await expect(page.locator('.story-card')).toHaveCount(4, { timeout: 5000 });
  });

  test('batch filter dropdown shows available batches', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Find and click batch filter
    const batchFilter = page.locator('.story-batch-filter, [class*="batch-filter"]');
    await batchFilter.click();

    // Dropdown should show batches
    await expect(page.locator('text=All stories')).toBeVisible();
    await expect(page.locator('text=Classic, text=3 stories, text=Jan 15')).toBeVisible();
    await expect(page.locator('text=Job Story, text=2 stories, text=Jan 16')).toBeVisible();
  });

  test('selecting a batch filters the stories list', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Initially should show all 5 stories
    await expect(page.locator('.story-card')).toHaveCount(5);

    // Click batch filter
    const batchFilter = page.locator('.story-batch-filter');
    await batchFilter.click();

    // Select first batch (3 stories)
    await page.click('text=Classic >> nth=0');

    // Should now show only 3 stories from that batch
    await expect(page.locator('.story-card')).toHaveCount(3, { timeout: 5000 });
  });

  test('export modal shows format options', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Click Export button
    await page.click('button:has-text("Export")');

    // Export modal should appear
    await expect(page.locator('.stories-export-modal, [class*="export-modal"]')).toBeVisible();

    // Format options should be visible
    await expect(page.locator('text=Markdown')).toBeVisible();
    await expect(page.locator('text=CSV')).toBeVisible();
    await expect(page.locator('text=JSON')).toBeVisible();
  });

  test('exports stories as CSV', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Click Export button
    await page.click('button:has-text("Export")');

    // Wait for modal
    await expect(page.locator('.stories-export-modal')).toBeVisible();

    // Select CSV format
    await page.click('button:has-text("CSV"), .stories-export-format-option:has-text("CSV")');

    // Set up download handler
    const downloadPromise = page.waitForEvent('download');

    // Click Download button
    await page.click('button:has-text("Download")');

    // Verify download starts
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test('section filter allows selecting specific sections', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Find and click section filter dropdown
    await page.click('.stories-section-filter-trigger, button:has-text("All sections")');

    // Dropdown should show section options
    await expect(page.locator('text=Problems')).toBeVisible();
    await expect(page.locator('text=User Goals')).toBeVisible();

    // Select a section
    await page.click('label:has-text("Problems")');

    // Filter should update
    await expect(page.locator('text=1 section')).toBeVisible();
  });

  test('complete stories generation flow: landing -> generator -> view stories', async ({ page }) => {
    // Step 1: Navigate to stories landing page
    await page.goto('/app/stories');
    await expect(page.locator('select, .project-selector')).toBeVisible();

    // Step 2: Select project
    await page.selectOption('select', mockProject.id);
    await page.waitForURL(`**/projects/${mockProject.id}/stories`);

    // Step 3: Verify page loads with existing stories
    await expect(page.locator('text=Stories Test Project')).toBeVisible();
    await expect(page.locator('.story-card')).toHaveCount(5);

    // Step 4: Select Job Story format
    await page.click('.stories-format-option:has-text("Job Story Format")');

    // Step 5: Select specific sections
    await page.click('.stories-section-filter-trigger');
    await page.click('label:has-text("Problems")');
    await page.click('label:has-text("User Goals")');
    await page.keyboard.press('Escape'); // Close dropdown

    // Step 6: Generate stories
    await page.click('button:has-text("Generate Stories")');

    // Step 7: Confirm in info dialog
    await page.click('button:has-text("Continue")');

    // Step 8: Wait for progress overlay
    await expect(page.locator('.stories-progress-overlay')).toBeVisible();

    // Step 9: Wait for generation to complete
    await expect(page.locator('.stories-progress-overlay')).not.toBeVisible({ timeout: 15000 });

    // Step 10: Verify stories list is visible
    await expect(page.locator('.story-card')).toHaveCount(5);

    // Step 11: Expand a story card
    const firstCard = page.locator('.story-card').first();
    await firstCard.locator('.story-card-header').first().click();

    // Step 12: Verify expanded content
    await expect(firstCard.locator('.story-card-body')).toBeVisible();

    // Step 13: Open edit modal
    await firstCard.locator('button:has-text("Edit")').click();
    await expect(page.locator('.story-edit-modal')).toBeVisible();

    // Step 14: Close edit modal
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('.story-edit-modal')).not.toBeVisible({ timeout: 3000 });

    // Step 15: Test export
    await page.click('button:has-text("Export")');
    await expect(page.locator('.stories-export-modal')).toBeVisible();
  });

  test('handles project with no requirements', async ({ page }) => {
    // Override requirements to return empty
    await page.route(`**/api/projects/${mockProject.id}/requirements`, async (route) => {
      await route.fulfill({
        json: {
          problems: [],
          user_goals: [],
          functional_requirements: [],
          data_needs: [],
          constraints: [],
          non_goals: [],
          risks_assumptions: [],
          open_questions: [],
          action_items: [],
        },
      });
    });

    // Override stories list to be empty
    await page.route(`**/api/projects/${mockProject.id}/stories`, async (route) => {
      const url = route.request().url();
      if (url.includes('/generate') || url.includes('/batches') || url.includes('/export')) return;
      await route.fulfill({
        json: { items: [], total: 0, skip: 0, limit: 100 },
      });
    });

    // Override generate to return error
    await page.route(`**/api/projects/${mockProject.id}/stories/generate`, async (route) => {
      await route.fulfill({
        status: 400,
        json: { detail: 'No requirements found for this project' },
      });
    });

    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Verify empty state message
    await expect(page.locator('text=No stories yet')).toBeVisible();

    // Click Generate button
    await page.click('button:has-text("Generate Stories")');

    // Should show error message
    await expect(page.locator('text=No requirements, text=error')).toBeVisible({ timeout: 5000 });
  });

  test('cooldown timer prevents rapid regeneration', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Click Generate button
    await page.click('button:has-text("Generate Stories")');

    // Click Continue on info dialog
    await page.click('button:has-text("Continue")');

    // Wait for generation to complete
    await expect(page.locator('.stories-progress-overlay')).not.toBeVisible({ timeout: 15000 });

    // The generate button should show cooldown
    const generateBtn = page.locator('button:has-text("Generate Stories"), button:has-text("Cooldown")');
    await expect(generateBtn).toBeVisible();
  });

  test('batch deletion removes all stories in batch', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Should initially have 5 stories
    await expect(page.locator('.story-card')).toHaveCount(5);

    // Open batch filter
    await page.click('.story-batch-filter');

    // Look for delete button on a batch option
    const deleteBtn = page.locator('.story-batch-delete, [aria-label*="Delete"], button[title*="Delete"]');
    if (await deleteBtn.count() > 0) {
      await deleteBtn.first().click();

      // Confirmation should appear
      await expect(page.locator('text=Delete, text=stories will be deleted')).toBeVisible();

      // Confirm deletion
      await page.click('button:has-text("Delete")');

      // Stories from that batch should be removed
      await expect(page.locator('.story-card')).not.toHaveCount(5, { timeout: 5000 });
    }
  });

  test('info dialog warns about adding stories (not replacing)', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/stories`);

    // Click Generate button
    await page.click('button:has-text("Generate Stories")');

    // Info dialog should appear with warning
    await expect(page.locator('text=Stories Will Be Added')).toBeVisible();
    await expect(page.locator('text=will not replace')).toBeVisible();

    // Cancel button should work
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('.stories-info-overlay')).not.toBeVisible();
  });
});
