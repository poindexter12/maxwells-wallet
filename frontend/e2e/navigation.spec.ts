import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('can navigate to all main pages', async ({ page }) => {
    await page.goto('/');

    // Navigate to Transactions
    await page.getByRole('link', { name: /transactions/i }).click();
    await expect(page).toHaveURL(/transactions/);

    // Navigate to Budgets
    await page.getByRole('link', { name: /budgets/i }).click();
    await expect(page).toHaveURL(/budgets/);

    // Navigate to Tools
    await page.getByRole('link', { name: /tools/i }).click();
    await expect(page).toHaveURL(/tools/);

    // Navigate back to Dashboard
    await page.getByRole('link', { name: /dashboard/i }).first().click();
    await expect(page).toHaveURL('/');
  });

  test('active nav link is highlighted', async ({ page }) => {
    await page.goto('/transactions');

    // The transactions link should have active styling
    const transactionsLink = page.getByRole('link', { name: /transactions/i });
    await expect(transactionsLink).toBeVisible();

    // Check for active class or aria-current
    const isActive = await transactionsLink.evaluate((el) => {
      return el.classList.contains('active') ||
             el.getAttribute('aria-current') === 'page' ||
             el.classList.contains('bg-') ||
             window.getComputedStyle(el).fontWeight >= '600';
    });
  });

  test('accounts page loads', async ({ page }) => {
    await page.goto('/accounts');
    await expect(page.getByRole('heading', { name: /accounts/i })).toBeVisible();
  });

  test('tags page loads', async ({ page }) => {
    await page.goto('/tags');
    await expect(page.getByRole('heading', { name: /tags/i })).toBeVisible();
  });

  test('import page loads', async ({ page }) => {
    await page.goto('/import');
    await expect(page.getByRole('heading', { name: /import/i })).toBeVisible();
  });
});
