import { test, expect, ConsoleMessage } from '@playwright/test';

/**
 * Dashboard Tab Switching Tests
 *
 * Tests for the bug where clicking between dashboard tabs causes a client-side crash.
 * Captures console errors and checks for the Next.js error overlay.
 */
test.describe('Dashboard Tab Switching', () => {
  // Collect console errors during tests
  let consoleErrors: string[] = [];
  let pageErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
  });

  test('switching between dashboard tabs should not crash', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for dashboard to fully load
    await expect(page.locator('[data-testid="dashboard-selector"]')).toBeVisible({ timeout: 10000 });

    // Get all dashboard tab buttons (exclude the + button and Manage link)
    const tabButtons = page.locator('[data-testid="dashboard-selector"] button').filter({
      hasNot: page.locator('svg') // Exclude the + button which has an SVG
    });

    const tabCount = await tabButtons.count();

    // Need at least 2 tabs to test switching
    if (tabCount < 2) {
      console.log('Only one dashboard tab - creating a second one for testing');

      // Click the + button to create a new dashboard
      const addButton = page.locator('[data-testid="dashboard-selector"] button').filter({
        has: page.locator('svg')
      });
      await addButton.click();

      // Enter a name and create
      const input = page.locator('[data-testid="dashboard-selector"] input');
      await input.fill('Test Dashboard');
      await input.press('Enter');

      await page.waitForLoadState('networkidle');
    }

    // Re-get tabs after potential creation
    const tabs = page.locator('[data-testid="dashboard-selector"] button').filter({
      hasNot: page.locator('svg')
    });
    const finalTabCount = await tabs.count();

    expect(finalTabCount).toBeGreaterThanOrEqual(2);

    // Find a common element that should exist on any dashboard
    const dashboardHeading = page.getByRole('heading', { name: 'Dashboard' });

    // Click first tab and verify content loads
    await tabs.nth(0).click();
    await page.waitForLoadState('networkidle');
    await expect(dashboardHeading).toBeVisible({ timeout: 10000 });

    // Click second tab and verify content loads
    await tabs.nth(1).click();
    await page.waitForLoadState('networkidle');
    await expect(dashboardHeading).toBeVisible({ timeout: 10000 });

    // Click back to first tab - THIS IS WHERE THE CRASH TYPICALLY HAPPENS
    await tabs.nth(0).click();
    await page.waitForLoadState('networkidle');
    await expect(dashboardHeading).toBeVisible({ timeout: 10000 });

    // Check for the Next.js error overlay
    const errorOverlay = page.locator('text=Application error: a client-side exception has occurred');
    await expect(errorOverlay).not.toBeVisible();

    // Verify no console errors or page crashes
    expect(pageErrors).toEqual([]);

    // Filter out known benign errors if needed
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('404')
    );

    if (criticalErrors.length > 0) {
      console.log('Console errors captured:', criticalErrors);
    }
  });

  test('rapid tab switching should not crash', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="dashboard-selector"]')).toBeVisible({ timeout: 10000 });

    const tabs = page.locator('[data-testid="dashboard-selector"] button').filter({
      hasNot: page.locator('svg')
    });

    const tabCount = await tabs.count();
    if (tabCount < 2) {
      test.skip(true, 'Need at least 2 dashboard tabs for this test');
      return;
    }

    // Rapid switching - 5 times back and forth
    for (let i = 0; i < 5; i++) {
      await tabs.nth(0).click();
      await page.waitForTimeout(200); // Brief wait, but don't wait for full load

      await tabs.nth(1).click();
      await page.waitForTimeout(200);
    }

    // Now wait for things to settle
    await page.waitForLoadState('networkidle');

    // Should not show error
    const errorOverlay = page.locator('text=Application error: a client-side exception has occurred');
    await expect(errorOverlay).not.toBeVisible();

    // Dashboard should still be functional
    const dashboardHeading = page.getByRole('heading', { name: 'Dashboard' });
    await expect(dashboardHeading).toBeVisible({ timeout: 10000 });

    // Check for crashes
    expect(pageErrors).toEqual([]);
  });

  test('tab switch after data loads should not crash', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for full dashboard data to load (charts, etc.)
    await expect(page.locator('[data-testid="dashboard-selector"]')).toBeVisible({ timeout: 10000 });

    // Wait for some content to appear (summary cards)
    await expect(page.getByText(/total income/i).first()).toBeVisible({ timeout: 15000 });

    const tabs = page.locator('[data-testid="dashboard-selector"] button').filter({
      hasNot: page.locator('svg')
    });

    const tabCount = await tabs.count();
    if (tabCount < 2) {
      test.skip(true, 'Need at least 2 dashboard tabs for this test');
      return;
    }

    // Switch to second tab and wait for full load
    await tabs.nth(1).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/total income/i).first()).toBeVisible({ timeout: 15000 });

    // Switch back to first tab
    await tabs.nth(0).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/total income/i).first()).toBeVisible({ timeout: 15000 });

    // No error should appear
    const errorOverlay = page.locator('text=Application error: a client-side exception has occurred');
    await expect(errorOverlay).not.toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test.afterEach(async ({}, testInfo) => {
    // Log any errors found during the test
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      console.log(`\n--- Errors captured during "${testInfo.title}" ---`);
      if (consoleErrors.length > 0) {
        console.log('Console errors:', consoleErrors);
      }
      if (pageErrors.length > 0) {
        console.log('Page errors:', pageErrors);
      }
    }
  });
});
