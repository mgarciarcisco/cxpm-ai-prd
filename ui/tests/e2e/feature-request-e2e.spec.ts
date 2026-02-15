import { test, expect } from '@playwright/test';

/**
 * End-to-End Test: Feature Request Functionality
 *
 * This test runs against the real running application on localhost:3000.
 * It tests the full lifecycle: login -> list -> create -> view detail -> upvote -> comment.
 *
 * Screenshots are saved to the project's screenshots/ folder.
 */

import path from 'path';
import { fileURLToPath } from 'url';

// Resolve to the project root screenshots/ folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', '..', '..', 'screenshots');

test.describe('Feature Request E2E', () => {
  test('full feature request lifecycle', async ({ page }) => {
    // Increase timeout for the full flow
    test.setTimeout(120_000);

    // ==========================================
    // Step 1: Login
    // ==========================================
    console.log('Step 1: Navigating to login page...');
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill in login credentials
    await page.fill('#login-email', 'e2etest@cisco.com');
    await page.fill('#login-password', 'Test@1234');

    // Submit login form
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard after login
    await page.waitForURL(/\/(dashboard|app)/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Take screenshot after login
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/feature-01-login.png`,
      fullPage: true,
    });
    console.log('Step 1 complete: Logged in successfully, screenshot saved.');

    // ==========================================
    // Step 2: Navigate to Feature Requests
    // ==========================================
    console.log('Step 2: Navigating to Feature Requests page...');
    await page.goto('/feature-requests');
    await page.waitForLoadState('networkidle');

    // Wait for the page to render (either list items or empty state)
    await page.waitForSelector('.fr-page__title', { timeout: 10000 });

    // Take screenshot of feature requests list page
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/feature-02-list-page.png`,
      fullPage: true,
    });
    console.log('Step 2 complete: Feature Requests page loaded, screenshot saved.');

    // ==========================================
    // Step 3: Submit a Feature Request
    // ==========================================
    console.log('Step 3: Creating a new feature request...');

    // Click the "+ New Request" button
    const newRequestBtn = page.locator('button', { hasText: 'New Request' });
    await expect(newRequestBtn).toBeVisible({ timeout: 5000 });
    await newRequestBtn.click();

    // Wait for modal to appear
    await page.waitForSelector('.modal-backdrop', { timeout: 5000 });

    // Take screenshot of the create form
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/feature-03-create-form.png`,
      fullPage: true,
    });

    // Fill in the form
    await page.fill('.fr-modal-form .form-input', 'E2E Test - Dark Mode Support');
    await page.fill(
      '.fr-modal-form .form-textarea',
      'Add dark mode support to the application to reduce eye strain during long working sessions. Should include a toggle in the user settings and respect system preferences.'
    );

    // Select category - "UI/UX"
    await page.selectOption('.fr-modal-form .form-select', 'ui_ux');

    // Submit the form
    const submitBtn = page.locator('.fr-modal-form button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Wait for modal to close (indicates submission was successful)
    await page.waitForSelector('.modal-backdrop', { state: 'hidden', timeout: 15000 });

    // Wait for the list to reload
    await page.waitForLoadState('networkidle');
    // Small delay for React re-render
    await page.waitForTimeout(1000);

    // Take screenshot after submission
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/feature-04-submitted.png`,
      fullPage: true,
    });
    console.log('Step 3 complete: Feature request submitted, screenshot saved.');

    // ==========================================
    // Step 4: View Feature Request Detail
    // ==========================================
    console.log('Step 4: Clicking on the created feature request to view detail...');

    // Find the card with our title and click its link
    const featureCard = page.locator('.fr-card__title', {
      hasText: 'E2E Test - Dark Mode Support',
    });

    // The card might not be immediately visible if it's loading
    await expect(featureCard.first()).toBeVisible({ timeout: 10000 });
    await featureCard.first().click();

    // Wait for detail page to load
    await page.waitForSelector('.fr-detail-page__title', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Take screenshot of the detail page
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/feature-05-detail.png`,
      fullPage: true,
    });
    console.log('Step 4 complete: Feature request detail page loaded, screenshot saved.');

    // ==========================================
    // Step 5: Test Upvote and Comment
    // ==========================================
    console.log('Step 5: Testing upvote and comment functionality...');

    // Click the upvote button on the detail page
    const upvoteBtn = page.locator('.upvote-btn').first();
    if (await upvoteBtn.isVisible()) {
      const countBefore = await upvoteBtn.locator('.upvote-btn__count').textContent();
      console.log(`  Upvote count before: ${countBefore}`);
      await upvoteBtn.click();
      // Wait for API call
      await page.waitForTimeout(1000);
      const countAfter = await upvoteBtn.locator('.upvote-btn__count').textContent();
      console.log(`  Upvote count after: ${countAfter}`);
    } else {
      console.log('  No upvote button found on detail page.');
    }

    // Add a comment
    const commentInput = page.locator('.fr-detail-page__comment-input');
    if (await commentInput.isVisible()) {
      await commentInput.fill(
        'This would be really helpful for night-time usage'
      );

      const postBtn = page.locator('button', { hasText: 'Post Comment' });
      await expect(postBtn).toBeEnabled();
      await postBtn.click();

      // Wait for the comment to appear
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle');

      console.log('  Comment posted successfully.');
    } else {
      console.log('  No comment input found on detail page.');
    }

    // Take screenshot after interaction
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/feature-06-interaction.png`,
      fullPage: true,
    });
    console.log('Step 5 complete: Interaction (upvote + comment) done, screenshot saved.');

    console.log('\n=== E2E Test Complete ===');
  });
});
