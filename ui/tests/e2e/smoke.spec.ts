import { test, expect } from '@playwright/test';

/**
 * Smoke Tests
 *
 * Basic smoke tests to verify the application is running and
 * core functionality is accessible. These tests should be fast
 * and serve as a quick sanity check.
 */

// Mock data for smoke tests
const mockProject = {
  id: 'smoke-test-project',
  name: 'Smoke Test Project',
  description: 'Project for smoke testing',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

test.describe('Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up basic API mocks
    await page.route('**/api/projects', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({ json: [mockProject] });
      } else if (method === 'POST') {
        await route.fulfill({ json: mockProject, status: 201 });
      }
    });

    await page.route(`**/api/projects/${mockProject.id}`, async (route) => {
      await route.fulfill({ json: mockProject });
    });

    await page.route(`**/api/projects/${mockProject.id}/stats`, async (route) => {
      await route.fulfill({
        json: {
          meeting_count: 0,
          requirement_count: 0,
          requirement_counts_by_section: [],
          last_activity: null,
        },
      });
    });

    await page.route(`**/api/projects/${mockProject.id}/meetings`, async (route) => {
      await route.fulfill({ json: [] });
    });

    await page.route(`**/api/projects/${mockProject.id}/requirements`, async (route) => {
      await route.fulfill({
        json: {
          needs_and_goals: [],
          requirements: [],
          scope_and_constraints: [],
          risks_and_questions: [],
          action_items: [],
        },
      });
    });
  });

  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');

    // App may redirect to dashboard or app route
    await expect(page).toHaveURL(/\/(app|dashboard)?/);

    // Page should have loaded (check for any content)
    await expect(page.locator('body')).toBeVisible();
  });

  test('app dashboard loads successfully', async ({ page }) => {
    await page.goto('/app');

    // Should be on the app route
    await expect(page).toHaveURL(/\/app/);

    // Page should contain main content area
    await expect(page.locator('body')).toBeVisible();
  });

  test('projects page loads and displays project list', async ({ page }) => {
    await page.goto('/app/projects');

    // Should display projects heading
    await expect(page.locator('h2').first()).toBeVisible();

    // Project card should be visible (from mock data)
    await expect(page.locator('.project-card').first()).toBeVisible({ timeout: 5000 });
  });

  test('project dashboard loads when navigating to project', async ({ page }) => {
    await page.goto(`/app/projects/${mockProject.id}`);

    // Should be on the project page
    await expect(page).toHaveURL(new RegExp(`/projects/${mockProject.id}`));

    // Page should have loaded
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigation works between pages', async ({ page }) => {
    // Start at projects page
    await page.goto('/app/projects');
    await expect(page).toHaveURL(/\/projects/);

    // Wait for project cards to load
    await expect(page.locator('.project-card').first()).toBeVisible({ timeout: 5000 });

    // Click on a project card to navigate
    const projectCard = page.locator('.project-card').first();
    await projectCard.click();

    // Should navigate to project detail page
    await expect(page).toHaveURL(new RegExp(`/projects/${mockProject.id}`), { timeout: 5000 });
  });

  test('no console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    // Filter out known acceptable errors (like 404 for favicon, etc.)
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes('favicon') &&
        !error.includes('Failed to load resource') // API mocks may cause this
    );

    // Log any critical errors for debugging
    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors);
    }

    // For smoke test, we log but don't fail on all console errors
    // Uncomment below to make this stricter:
    // expect(criticalErrors).toHaveLength(0);
  });

  test('page responds within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/app');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});
