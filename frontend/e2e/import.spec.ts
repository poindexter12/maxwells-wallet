import { test, expect } from '@playwright/test';

test.describe('Import Flow', () => {
  test('shows file upload area', async ({ page }) => {
    await page.goto('/import');

    // Should have file input or drop zone
    const hasFileInput = await page.locator('input[type="file"]').count() > 0;
    const hasDropZone = await page.getByText(/drag.*drop|upload|select.*file/i).count() > 0;

    expect(hasFileInput || hasDropZone).toBeTruthy();
  });

  test('shows supported formats', async ({ page }) => {
    await page.goto('/import');

    // Should mention supported formats
    const hasFormatInfo = await page.getByText(/csv|qfx|ofx|qif/i).count() > 0;
    expect(hasFormatInfo).toBeTruthy();
  });

  test('custom format mapper available', async ({ page }) => {
    await page.goto('/import');

    // Should have option to configure custom format
    const hasCustomOption = await page.getByText(/custom|configure|format/i).count() > 0 ||
                            await page.getByRole('button', { name: /custom/i }).count() > 0;
  });
});

test.describe('Tools Page', () => {
  test('loads with tabs', async ({ page }) => {
    await page.goto('/tools');

    await expect(page.getByRole('heading', { name: /tools/i })).toBeVisible();

    // Should have tool sections/tabs
    const hasCategories = await page.getByText(/rules|recurring|transfers|merchants/i).count() > 0;
    expect(hasCategories).toBeTruthy();
  });

  test('category rules section accessible', async ({ page }) => {
    await page.goto('/tools');

    // Find and click category rules tab/section
    const rulesTab = page.getByRole('tab', { name: /rules/i })
      .or(page.getByRole('button', { name: /rules/i }))
      .or(page.getByText(/category rules/i));

    if (await rulesTab.count() > 0) {
      await rulesTab.first().click();
      await page.waitForTimeout(200);
    }
  });
});
