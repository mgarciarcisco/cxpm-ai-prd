import type { Page, Route } from '@playwright/test';

/**
 * E2E Test Helper Utilities
 *
 * Common helper functions for E2E tests to reduce boilerplate
 * and ensure consistent testing patterns.
 */

/**
 * Wait for a network request to complete
 */
export async function waitForRequest(
  page: Page,
  urlPattern: string | RegExp,
  options?: { timeout?: number }
): Promise<void> {
  await page.waitForResponse(
    (response) =>
      typeof urlPattern === 'string'
        ? response.url().includes(urlPattern)
        : urlPattern.test(response.url()),
    options
  );
}

/**
 * Create a mock file for upload testing
 */
export function createMockFile(
  name: string,
  content: string,
  mimeType = 'text/plain'
): { name: string; mimeType: string; buffer: Buffer } {
  return {
    name,
    mimeType,
    buffer: Buffer.from(content),
  };
}

/**
 * Wait for toast notification to appear and optionally disappear
 */
export async function waitForToast(
  page: Page,
  textMatch: string | RegExp,
  options?: { waitForDismiss?: boolean; timeout?: number }
): Promise<void> {
  const toast = page.locator('.toast, [class*="toast"]').filter({
    hasText: textMatch,
  });
  await toast.waitFor({ state: 'visible', timeout: options?.timeout ?? 5000 });

  if (options?.waitForDismiss) {
    await toast.waitFor({ state: 'hidden', timeout: options?.timeout ?? 10000 });
  }
}

/**
 * Fill a form field and wait for any debounced updates
 */
export async function fillWithDebounce(
  page: Page,
  selector: string,
  value: string,
  debounceMs = 300
): Promise<void> {
  await page.fill(selector, value);
  await page.waitForTimeout(debounceMs);
}

/**
 * Click and wait for navigation
 */
export async function clickAndNavigate(
  page: Page,
  selector: string,
  urlPattern: string | RegExp
): Promise<void> {
  await page.click(selector);
  await page.waitForURL(urlPattern);
}

/**
 * Setup API mock that responds with different data based on call count
 */
export async function setupSequentialMock(
  page: Page,
  urlPattern: string,
  responses: unknown[]
): Promise<void> {
  let callCount = 0;
  await page.route(urlPattern, async (route: Route) => {
    const response = responses[Math.min(callCount, responses.length - 1)];
    callCount++;
    await route.fulfill({ json: response });
  });
}

/**
 * Setup mock for SSE (Server-Sent Events) streaming endpoint
 */
export async function setupSSEMock(
  page: Page,
  urlPattern: string,
  events: Array<{ event?: string; data: unknown }>
): Promise<void> {
  await page.route(urlPattern, async (route: Route) => {
    const body = events
      .map((e) => {
        const eventLine = e.event ? `event: ${e.event}\n` : '';
        return `${eventLine}data: ${JSON.stringify(e.data)}\n\n`;
      })
      .join('');

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body,
    });
  });
}

/**
 * Wait for a specific element to contain text
 */
export async function waitForText(
  page: Page,
  selector: string,
  text: string | RegExp,
  options?: { timeout?: number }
): Promise<void> {
  const element = page.locator(selector);
  if (typeof text === 'string') {
    await element.filter({ hasText: text }).waitFor({
      state: 'visible',
      timeout: options?.timeout,
    });
  } else {
    await element.filter({ hasText: text }).waitFor({
      state: 'visible',
      timeout: options?.timeout,
    });
  }
}

/**
 * Take a screenshot for debugging (saved to test-results)
 */
export async function debugScreenshot(
  page: Page,
  name: string
): Promise<void> {
  await page.screenshot({ path: `test-results/debug-${name}.png` });
}

/**
 * Log network requests for debugging
 */
export function enableRequestLogging(page: Page): void {
  page.on('request', (request) => {
    console.log(`>> ${request.method()} ${request.url()}`);
  });
  page.on('response', (response) => {
    console.log(`<< ${response.status()} ${response.url()}`);
  });
}

/**
 * Wait for page to be fully loaded (no pending network requests)
 */
export async function waitForNetworkIdle(
  page: Page,
  options?: { timeout?: number }
): Promise<void> {
  await page.waitForLoadState('networkidle', options);
}

/**
 * Check if an element exists on the page
 */
export async function elementExists(
  page: Page,
  selector: string
): Promise<boolean> {
  return (await page.locator(selector).count()) > 0;
}

/**
 * Retry an action until it succeeds or times out
 */
export async function retry<T>(
  action: () => Promise<T>,
  options?: { maxRetries?: number; delay?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const delay = options?.delay ?? 1000;

  let lastError: Error | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
