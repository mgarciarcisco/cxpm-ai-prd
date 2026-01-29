import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Custom test fixtures for E2E tests
 *
 * These fixtures provide common setup and utilities for E2E tests,
 * reducing boilerplate and ensuring consistent test patterns.
 */

// Mock data shared across tests
export const mockProject = {
  id: 'test-project-id',
  name: 'Test Project',
  description: 'A test project for E2E testing',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const mockMeeting = {
  id: 'test-meeting-id',
  project_id: mockProject.id,
  title: 'Test Meeting',
  meeting_date: '2024-01-15',
  status: 'processed',
  items: [
    { id: 'item-1', section: 'problems', content: 'Test problem', order: 1 },
    { id: 'item-2', section: 'user_goals', content: 'Test goal', order: 1 },
  ],
};

export const mockRequirements = {
  problems: [],
  user_goals: [],
  functional_requirements: [],
  data_needs: [],
  constraints: [],
  non_goals: [],
  risks_assumptions: [],
  open_questions: [],
  action_items: [],
};

// Extended test type with custom fixtures
type TestFixtures = {
  /**
   * Page with common API mocks pre-configured
   */
  mockedPage: Page;

  /**
   * Navigate to the dashboard and wait for it to load
   */
  navigateToDashboard: () => Promise<void>;

  /**
   * Navigate to a specific project
   */
  navigateToProject: (projectId?: string) => Promise<void>;

  /**
   * Create a new project via the UI
   */
  createProject: (name: string, description?: string) => Promise<void>;
};

/**
 * Extended test with custom fixtures
 */
export const test = base.extend<TestFixtures>({
  // Mocked page with common API routes
  mockedPage: async ({ page }, use) => {
    // Mock common API endpoints
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
      await route.fulfill({ json: mockRequirements });
    });

    await use(page);
  },

  // Navigate to dashboard fixture
  navigateToDashboard: async ({ page }, use) => {
    const navigate = async () => {
      await page.goto('/app');
      await expect(page).toHaveURL(/\/app/);
    };
    await use(navigate);
  },

  // Navigate to project fixture
  navigateToProject: async ({ page }, use) => {
    const navigate = async (projectId = mockProject.id) => {
      await page.goto(`/app/projects/${projectId}`);
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`));
    };
    await use(navigate);
  },

  // Create project fixture
  createProject: async ({ page }, use) => {
    const create = async (name: string, description = '') => {
      await page.goto('/app/projects');
      await page.click('button:has-text("New Project")');
      await expect(page.locator('#project-name')).toBeVisible();
      await page.fill('#project-name', name);
      if (description) {
        await page.fill('#project-description', description);
      }
      await page.click('button[type="submit"]:has-text("Create Project")');
      await expect(page.locator('.project-card').first()).toBeVisible();
    };
    await use(create);
  },
});

export { expect } from '@playwright/test';
