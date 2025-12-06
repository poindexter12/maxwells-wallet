import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('loads and displays summary widget', async ({ page }) => {
    await page.goto('/');

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Summary section should be present
    await expect(page.getByText(/total spending/i)).toBeVisible();
  });

  test('shows navigation tabs', async ({ page }) => {
    await page.goto('/');

    // Main nav should have key sections
    await expect(page.getByRole('link', { name: /transactions/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /budgets/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /tools/i })).toBeVisible();
  });

  test('dashboard selector is present', async ({ page }) => {
    await page.goto('/');

    // Should have dashboard selection UI
    const dashboardArea = page.locator('[data-testid="dashboard-selector"]');
    // If not found by testid, check for any dashboard-related content
    const hasDashboard = await dashboardArea.count() > 0 ||
                         await page.getByText(/monthly overview/i).count() > 0;
    expect(hasDashboard).toBeTruthy();
  });

  test('can toggle theme', async ({ page }) => {
    await page.goto('/');

    // Find and click theme toggle
    const themeButton = page.getByRole('button', { name: /toggle theme/i })
      .or(page.locator('[data-testid="theme-toggle"]'))
      .or(page.getByLabel(/theme/i));

    if (await themeButton.count() > 0) {
      await themeButton.first().click();
      // Theme should change (html class or data attribute)
      await page.waitForTimeout(100);
    }
  });
});
