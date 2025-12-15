import { test, expect } from '@playwright/test';

test.describe('Import Flow @e2e', () => {
  test('shows file upload area', async ({ page }) => {
    await page.goto('/import');

    // Use test IDs for i18n compatibility
    const fileInput = page.getByTestId('import-file-input');
    await expect(fileInput).toBeAttached();
  });

  test('shows import mode toggle', async ({ page }) => {
    await page.goto('/import');

    // Check for import mode toggle (single/batch)
    const modeToggle = page.getByTestId('import-mode-toggle');
    await expect(modeToggle).toBeVisible();
  });

  test('shows account input area', async ({ page }) => {
    await page.goto('/import');

    // Account select (if accounts exist) or input (for new account) should be visible
    // Use combined locator with auto-retry to handle slower browser rendering (webkit)
    const accountControl = page.locator(
      '[data-testid="import-account-select"], [data-testid="import-account-input"]'
    );
    await expect(accountControl.first()).toBeVisible();
  });
});

test.describe('Tools Page @e2e', () => {
  test('loads with tabs', async ({ page }) => {
    await page.goto('/tools');

    // Page should load with heading (uses role, not text)
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Should have multiple tabs (tool sections)
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);
  });

  test('can switch between tabs', async ({ page }) => {
    await page.goto('/tools');

    // Click on different tabs
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();

    if (tabCount > 1) {
      // Click second tab
      await tabs.nth(1).click();
      await page.waitForTimeout(200);
    }
  });
});
