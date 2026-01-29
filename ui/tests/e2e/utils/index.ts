/**
 * E2E Test Utilities
 *
 * This module exports all test helper functions for E2E tests.
 * Import from this file to get access to common testing utilities.
 *
 * Usage:
 * ```typescript
 * import { waitForToast, createMockFile } from './utils';
 *
 * test('my test', async ({ page }) => {
 *   await waitForToast(page, 'Success');
 * });
 * ```
 */

export {
  waitForRequest,
  createMockFile,
  waitForToast,
  fillWithDebounce,
  clickAndNavigate,
  setupSequentialMock,
  setupSSEMock,
  waitForText,
  debugScreenshot,
  enableRequestLogging,
  waitForNetworkIdle,
  elementExists,
  retry,
} from './test-helpers';
