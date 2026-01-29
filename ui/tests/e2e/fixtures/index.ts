/**
 * E2E Test Fixtures
 *
 * This module exports all test fixtures and mock data for E2E tests.
 * Import from this file to get access to pre-configured test utilities.
 *
 * Usage:
 * ```typescript
 * import { test, expect, mockProject } from './fixtures';
 *
 * test('my test', async ({ mockedPage, navigateToDashboard }) => {
 *   await navigateToDashboard();
 *   // test code...
 * });
 * ```
 */

export {
  test,
  expect,
  mockProject,
  mockMeeting,
  mockRequirements,
} from './test-fixtures';
