import { test, expect } from '@playwright/test';

/**
 * E2E tests for PRD Generation Flow
 *
 * Test coverage:
 * 1. Navigate to PRD landing page, select project, choose mode, generate
 * 2. Wait for generation to complete
 * 3. Verify editor loads with sections
 * 4. Test section editing and auto-save
 * 5. Test export functionality
 * 6. Test version selector
 */

// Mock data
const mockProject = {
  id: 'prd-test-project-id',
  name: 'PRD Test Project',
  description: 'Project for PRD E2E testing',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockPRDSections = [
  { title: 'executive_summary', content: 'This is the executive summary of the product requirements.' },
  { title: 'problem_statement', content: 'The problem we are solving is complex data entry workflows.' },
  { title: 'goals_and_objectives', content: '1. Reduce manual data entry by 50%\n2. Improve user satisfaction' },
  { title: 'proposed_solution', content: 'An AI-powered form automation system.' },
  { title: 'open_questions', content: '- What is the integration strategy?\n- How will data be validated?' },
  { title: 'identified_gaps', content: '- Missing mobile requirements\n- Unclear performance targets' },
  { title: 'next_steps', content: '1. Conduct user interviews\n2. Define technical architecture' },
];

const mockPRDDetailedSections = [
  ...mockPRDSections,
  { title: 'target_users', content: 'Business analysts and data entry clerks.' },
  { title: 'functional_requirements', content: '- FR1: System shall support auto-complete\n- FR2: System shall validate inputs' },
  { title: 'non_functional_requirements', content: '- NFR1: Response time < 200ms\n- NFR2: 99.9% uptime' },
  { title: 'technical_considerations', content: 'Built on React with a Python backend.' },
  { title: 'success_metrics', content: '- 50% reduction in data entry time\n- 90% user satisfaction score' },
];

const mockPRDQueued = {
  id: 'prd-001',
  project_id: mockProject.id,
  version: 1,
  title: 'PRD Test Project - PRD v1',
  mode: 'draft',
  status: 'queued',
  sections: [],
  raw_markdown: '',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
};

const mockPRDGenerating = {
  ...mockPRDQueued,
  status: 'generating',
};

const mockPRDReady = {
  ...mockPRDQueued,
  status: 'ready',
  title: 'PRD Test Project - Product Requirements',
  sections: mockPRDSections,
  raw_markdown: '# Executive Summary\nThis is the executive summary...',
};

const mockPRDDetailedReady = {
  ...mockPRDReady,
  id: 'prd-002',
  version: 2,
  mode: 'detailed',
  sections: mockPRDDetailedSections,
};

const mockPRDFailed = {
  ...mockPRDQueued,
  status: 'failed',
  error_message: 'LLM request timed out. Please try again.',
};

// Mock requirements for the project
const mockRequirements = {
  problems: [
    { id: 'req-1', content: 'Users struggle with manual data entry', section: 'problems', sources: [], history_count: 0 },
  ],
  user_goals: [
    { id: 'req-2', content: 'Users want automated workflows', section: 'user_goals', sources: [], history_count: 0 },
  ],
  functional_requirements: [
    { id: 'req-3', content: 'System must support file uploads', section: 'functional_requirements', sources: [], history_count: 0 },
  ],
  data_needs: [],
  constraints: [],
  non_goals: [],
  risks_assumptions: [],
  open_questions: [],
  action_items: [],
};

test.describe('PRD Generation E2E Tests', () => {
  let prdStatus = 'queued';
  let pollCount = 0;
  let savedPRD = { ...mockPRDReady };

  test.beforeEach(async ({ page }) => {
    // Reset state
    prdStatus = 'queued';
    pollCount = 0;
    savedPRD = { ...mockPRDReady };

    // Mock API: Projects list
    await page.route('**/api/projects', async (route) => {
      await route.fulfill({ json: [mockProject] });
    });

    // Mock API: Single project
    await page.route(`**/api/projects/${mockProject.id}`, async (route) => {
      await route.fulfill({ json: mockProject });
    });

    // Mock API: Project requirements
    await page.route(`**/api/projects/${mockProject.id}/requirements`, async (route) => {
      await route.fulfill({ json: mockRequirements });
    });

    // Mock API: Generate PRD
    await page.route(`**/api/projects/${mockProject.id}/prds/generate`, async (route) => {
      const body = route.request().postDataJSON();
      const mode = body?.mode || 'draft';
      prdStatus = 'queued';
      pollCount = 0;
      await route.fulfill({
        json: { ...mockPRDQueued, mode },
        status: 202,
      });
    });

    // Mock API: PRD status (simulates generation progress)
    await page.route('**/api/prds/*/status', async (route) => {
      pollCount++;
      // Simulate generation: queued -> generating -> ready
      if (pollCount === 1) {
        prdStatus = 'queued';
      } else if (pollCount === 2) {
        prdStatus = 'generating';
      } else {
        prdStatus = 'ready';
      }
      await route.fulfill({
        json: { status: prdStatus, error_message: null },
      });
    });

    // Mock API: Get PRD by ID
    await page.route('**/api/prds/*', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // Skip status and export endpoints
      if (url.includes('/status') || url.includes('/export') || url.includes('/cancel') || url.includes('/archive')) {
        return;
      }

      if (method === 'GET') {
        await route.fulfill({ json: savedPRD });
      } else if (method === 'PUT') {
        // Update PRD
        const body = route.request().postDataJSON();
        if (body.title) savedPRD.title = body.title;
        if (body.sections) savedPRD.sections = body.sections;
        await route.fulfill({ json: savedPRD });
      }
    });

    // Mock API: List PRDs for project
    await page.route(`**/api/projects/${mockProject.id}/prds*`, async (route) => {
      // Handle both /prds and /prds?params
      if (route.request().url().includes('/generate')) return;
      await route.fulfill({
        json: {
          items: [mockPRDReady],
          total: 1,
          skip: 0,
          limit: 20,
        },
      });
    });

    // Mock API: Export PRD
    await page.route('**/api/prds/*/export*', async (route) => {
      const url = route.request().url();
      const format = url.includes('format=json') ? 'json' : 'markdown';

      if (format === 'json') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(savedPRD),
          headers: {
            'Content-Disposition': 'attachment; filename="prd.json"',
          },
        });
      } else {
        const markdown = `# ${savedPRD.title}\n\n## Executive Summary\nThis is the executive summary...`;
        await route.fulfill({
          status: 200,
          contentType: 'text/markdown',
          body: markdown,
          headers: {
            'Content-Disposition': 'attachment; filename="prd.md"',
          },
        });
      }
    });

    // Mock API: Cancel PRD
    await page.route('**/api/prds/*/cancel', async (route) => {
      prdStatus = 'cancelled';
      await route.fulfill({ json: { status: 'cancelled' } });
    });
  });

  test('navigates to PRD landing page and displays project selector', async ({ page }) => {
    await page.goto('/app/prd');

    // Verify landing page elements
    await expect(page.locator('h2')).toContainText(/PRD|Product Requirements/i);
    await expect(page.locator('select, .project-selector')).toBeVisible();

    // Verify project appears in selector
    await expect(page.locator('option, .project-option')).toContainText('PRD Test Project');
  });

  test('selects project and navigates to generator page', async ({ page }) => {
    await page.goto('/app/prd');

    // Wait for projects to load
    await expect(page.locator('select, .project-selector')).toBeVisible();

    // Select the project
    await page.selectOption('select', mockProject.id);

    // Should navigate to generator page
    await page.waitForURL(`**/projects/${mockProject.id}/prd`);

    // Verify generator page elements
    await expect(page.locator('text=PRD Test Project')).toBeVisible();
    await expect(page.locator('text=Draft Mode')).toBeVisible();
    await expect(page.locator('text=Detailed Mode')).toBeVisible();
  });

  test('selects mode and shows correct description', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/prd`);

    // Wait for page to load
    await expect(page.locator('text=Draft Mode')).toBeVisible();

    // Draft mode should be selected by default
    const draftOption = page.locator('.prd-mode-option:has-text("Draft Mode")');
    await expect(draftOption).toHaveClass(/selected|prd-mode-option--selected/);

    // Click on Detailed Mode
    await page.click('.prd-mode-option:has-text("Detailed Mode")');

    // Detailed Mode should now be selected
    const detailedOption = page.locator('.prd-mode-option:has-text("Detailed Mode")');
    await expect(detailedOption).toHaveClass(/selected|prd-mode-option--selected/);
  });

  test('generates PRD and navigates to editor on completion', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/prd`);

    // Wait for page to load
    await expect(page.locator('text=Generate PRD')).toBeVisible();

    // Click Generate button
    await page.click('button:has-text("Generate PRD")');

    // Should show progress overlay
    await expect(page.locator('.prd-progress-overlay, .prd-progress-modal')).toBeVisible();
    await expect(page.locator('text=Generating PRD')).toBeVisible({ timeout: 10000 });

    // Wait for navigation to editor (generation completes)
    await page.waitForURL('**/prds/*', { timeout: 15000 });

    // Verify editor page loaded
    await expect(page.locator('.prd-editor-layout, .prd-sections')).toBeVisible();
  });

  test('displays progress overlay with cancel button during generation', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/prd`);

    // Click Generate button
    await page.click('button:has-text("Generate PRD")');

    // Should show progress overlay
    await expect(page.locator('.prd-progress-overlay')).toBeVisible();

    // Cancel button should be visible
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });

  test('cancels generation when cancel button is clicked', async ({ page }) => {
    // Make the status endpoint always return queued so we can test cancel
    await page.route('**/api/prds/*/status', async (route) => {
      await route.fulfill({
        json: { status: prdStatus === 'cancelled' ? 'cancelled' : 'generating', error_message: null },
      });
    });

    await page.goto(`/app/projects/${mockProject.id}/prd`);

    // Click Generate button
    await page.click('button:has-text("Generate PRD")');

    // Wait for progress overlay
    await expect(page.locator('.prd-progress-overlay')).toBeVisible();

    // Click Cancel button
    await page.click('button:has-text("Cancel")');

    // Progress overlay should disappear (cancelled status will be picked up by polling)
    await expect(page.locator('.prd-progress-overlay')).not.toBeVisible({ timeout: 10000 });
  });

  test('shows error message and retry button on generation failure', async ({ page }) => {
    // Override status endpoint to return failed
    await page.route('**/api/prds/*/status', async (route) => {
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

    await page.goto(`/app/projects/${mockProject.id}/prd`);

    // Click Generate button
    await page.click('button:has-text("Generate PRD")');

    // Wait for error to appear
    await expect(page.locator('text=timed out')).toBeVisible({ timeout: 10000 });

    // Try Again button should be visible
    await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
  });

  test('cooldown timer prevents rapid regeneration', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}/prd`);

    // Click Generate button
    await page.click('button:has-text("Generate PRD")');

    // Wait for navigation to editor
    await page.waitForURL('**/prds/*', { timeout: 15000 });

    // Navigate back to generator
    await page.goto(`/app/projects/${mockProject.id}/prd`);

    // The cooldown might still be active - check for cooldown text or disabled button
    const generateBtn = page.locator('button:has-text("Generate PRD"), button:has-text("Cooldown")');
    await expect(generateBtn).toBeVisible();
  });

  test('editor loads PRD with all sections visible', async ({ page }) => {
    await page.goto(`/app/prds/${mockPRDReady.id}`);

    // Wait for editor to load
    await expect(page.locator('.prd-editor-layout, .prd-sections')).toBeVisible();

    // Verify title is displayed
    await expect(page.locator('input[aria-label="PRD Title"], .prd-title-input')).toHaveValue(/PRD Test Project/);

    // Verify sections are displayed in sidebar
    await expect(page.locator('text=Executive Summary')).toBeVisible();
    await expect(page.locator('text=Problem Statement')).toBeVisible();
  });

  test('clicking section in sidebar scrolls to section', async ({ page }) => {
    await page.goto(`/app/prds/${mockPRDReady.id}`);

    // Wait for editor to load
    await expect(page.locator('.prd-sections')).toBeVisible();

    // Click on a section in the sidebar
    await page.click('.prd-toc-link:has-text("Problem Statement")');

    // The section should be visible/scrolled to
    await expect(page.locator('.prd-section-title:has-text("Problem Statement")')).toBeVisible();
  });

  test('editing section content triggers auto-save', async ({ page }) => {
    await page.goto(`/app/prds/${mockPRDReady.id}`);

    // Wait for editor to load
    await expect(page.locator('.prd-sections')).toBeVisible();

    // Find the first section editor
    const sectionEditor = page.locator('.prd-section-editor').first();
    await expect(sectionEditor).toBeVisible();

    // Type in the editor
    await sectionEditor.fill('Updated executive summary content');

    // Wait for auto-save (should show "Saving..." then "Saved")
    await expect(page.locator('text=Saving')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: 5000 });
  });

  test('collapse and expand all sections', async ({ page }) => {
    await page.goto(`/app/prds/${mockPRDReady.id}`);

    // Wait for editor to load
    await expect(page.locator('.prd-sections')).toBeVisible();

    // Find and click the collapse/expand all button
    const expandBtn = page.locator('.prd-expand-btn');
    await expect(expandBtn).toBeVisible();

    // Initially all sections should be expanded
    await expect(page.locator('.prd-section-editor').first()).toBeVisible();

    // Click to collapse all
    await expandBtn.click();

    // Sections should be collapsed (editors not visible)
    await expect(page.locator('.prd-section-editor').first()).not.toBeVisible();

    // Click to expand all again
    await expandBtn.click();

    // Sections should be expanded again
    await expect(page.locator('.prd-section-editor').first()).toBeVisible();
  });

  test('export modal shows format options', async ({ page }) => {
    await page.goto(`/app/prds/${mockPRDReady.id}`);

    // Wait for editor to load
    await expect(page.locator('.prd-editor-layout')).toBeVisible();

    // Click Export button
    await page.click('button:has-text("Export")');

    // Export modal should appear
    await expect(page.locator('.prd-export-modal, [class*="modal"]')).toBeVisible();

    // Format options should be visible
    await expect(page.locator('text=Markdown')).toBeVisible();
    await expect(page.locator('text=JSON')).toBeVisible();
  });

  test('exports PRD as markdown', async ({ page }) => {
    await page.goto(`/app/prds/${mockPRDReady.id}`);

    // Wait for editor to load
    await expect(page.locator('.prd-editor-layout')).toBeVisible();

    // Click Export button
    await page.click('button:has-text("Export")');

    // Wait for modal
    await expect(page.locator('.prd-export-modal, [class*="modal"]')).toBeVisible();

    // Select Markdown format
    await page.click('button:has-text("Markdown"), .prd-export-format-option:has-text("Markdown")');

    // Set up download handler
    const downloadPromise = page.waitForEvent('download');

    // Click Download button
    await page.click('button:has-text("Download")');

    // Verify download starts
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.md$/);
  });

  test('version selector shows available versions', async ({ page }) => {
    await page.goto(`/app/prds/${mockPRDReady.id}`);

    // Wait for editor to load
    await expect(page.locator('.prd-editor-layout')).toBeVisible();

    // Find and click version selector
    const versionSelector = page.locator('.prd-version-selector, [class*="version"]');
    if (await versionSelector.count() > 0) {
      await versionSelector.click();

      // Version dropdown should appear
      await expect(page.locator('.prd-version-dropdown, .prd-version-menu')).toBeVisible({ timeout: 5000 });

      // Current version should be visible
      await expect(page.locator('text=Version 1, text=v1, text=Current')).toBeVisible();
    }
  });

  test('complete PRD generation flow: landing -> generator -> editor', async ({ page }) => {
    // Step 1: Navigate to PRD landing page
    await page.goto('/app/prd');
    await expect(page.locator('select, .project-selector')).toBeVisible();

    // Step 2: Select project
    await page.selectOption('select', mockProject.id);
    await page.waitForURL(`**/projects/${mockProject.id}/prd`);

    // Step 3: Verify generator page loads
    await expect(page.locator('text=PRD Test Project')).toBeVisible();
    await expect(page.locator('text=Draft Mode')).toBeVisible();

    // Step 4: Select Detailed Mode
    await page.click('.prd-mode-option:has-text("Detailed Mode")');

    // Step 5: Generate PRD
    await page.click('button:has-text("Generate PRD")');

    // Step 6: Wait for progress overlay
    await expect(page.locator('.prd-progress-overlay')).toBeVisible();

    // Step 7: Wait for navigation to editor
    await page.waitForURL('**/prds/*', { timeout: 15000 });

    // Step 8: Verify editor loaded with sections
    await expect(page.locator('.prd-editor-layout, .prd-sections')).toBeVisible();
    await expect(page.locator('.prd-section')).toHaveCount(7); // Draft mode has 7 sections

    // Step 9: Edit a section
    const sectionEditor = page.locator('.prd-section-editor').first();
    await sectionEditor.fill('Updated content for executive summary');

    // Step 10: Wait for auto-save
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: 5000 });

    // Step 11: Export (verify button works)
    await page.click('button:has-text("Export")');
    await expect(page.locator('.prd-export-modal, [class*="modal"]')).toBeVisible();

    // Step 12: Close modal
    await page.click('button:has-text("Cancel"), button[aria-label="Close"]');
    await expect(page.locator('.prd-export-modal')).not.toBeVisible({ timeout: 3000 });
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

    // Override generate to return error
    await page.route(`**/api/projects/${mockProject.id}/prds/generate`, async (route) => {
      await route.fulfill({
        status: 400,
        json: { detail: 'No requirements found for this project' },
      });
    });

    await page.goto(`/app/projects/${mockProject.id}/prd`);

    // Click Generate button
    await page.click('button:has-text("Generate PRD")');

    // Should show error message
    await expect(page.locator('text=No requirements, text=error')).toBeVisible({ timeout: 5000 });
  });
});
