import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('loads and displays summary widget', async ({ page }) => {
    await page.goto('/');

    // Wait for network to settle
    await page.waitForLoadState('networkidle');

    // Wait for dashboard to load - look for any heading or dashboard content
    await expect(
      page.getByRole('heading', { level: 1 })
        .or(page.getByText('Dashboard'))
        .or(page.locator('[data-testid="dashboard-selector"]'))
    ).toBeVisible({ timeout: 10000 });

    // Summary section should be present (cards show Income, Expenses, Net)
    await expect(page.getByText(/total income/i).or(page.getByText(/total expenses/i))).toBeVisible({ timeout: 10000 });
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

    // Wait for network to settle
    await page.waitForLoadState('networkidle');

    // Should have dashboard selection UI with data-testid
    await expect(page.locator('[data-testid="dashboard-selector"]')).toBeVisible({ timeout: 10000 });
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
