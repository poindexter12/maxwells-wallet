import { test, expect } from '@playwright/test';
import { performRandomActions, SeededRandom } from './chaos-helpers';

/**
 * Chaos/Monkey Testing for Import Flow and Tools Page
 *
 * Uses Fibonacci ramp-up starting at 13: 13, 21, 34, 55, 89 actions per test.
 */

// Fibonacci sequence starting at meaningful scale
const FIBONACCI_ROUNDS = [13, 21, 34, 55, 89];

test.describe('Import Page Chaos - Fibonacci Ramp @chaos', () => {
  const baseSeed = 88888;

  for (const [index, actionCount] of FIBONACCI_ROUNDS.entries()) {
    test(`import chaos - ${actionCount} actions`, async ({ page }) => {
      test.setTimeout(30000 + actionCount * 1000);

      await page.goto('/import');
      await page.waitForLoadState('networkidle');

      // Dismiss help if visible
      const gotItBtn = page.locator('button:has-text("Got it")').first();
      if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await gotItBtn.click();
      }

      const seed = baseSeed + index;
      const result = await performRandomActions(page, {
        actions: actionCount,
        seed,
        minDelay: 25,
        maxDelay: 75,
        excludeSelectors: [
          'button:has-text("Confirm")',
          'button:has-text("Import")',
          'button:has-text("Delete")',
          'input[type="file"]',
          'nav a', // Stay on import page
        ],
      });

      if (result.errors.length > 0) {
        console.log(`\n🔥 Failed at ${actionCount} actions, seed: ${seed}`);
        await page.screenshot({ path: `test-results/chaos-import-${actionCount}-${seed}.png` });
      }

      expect(result.errors).toEqual([]);
      await expect(
        page.locator('text=Application error: a client-side exception has occurred')
      ).not.toBeVisible();
    });
  }
});

test.describe('Tools Page Chaos - Fibonacci Ramp @chaos', () => {
  const baseSeed = 33333;

  for (const [index, actionCount] of FIBONACCI_ROUNDS.entries()) {
    test(`tools chaos - ${actionCount} actions`, async ({ page }) => {
      test.setTimeout(30000 + actionCount * 1000);

      await page.goto('/tools');
      await page.waitForLoadState('networkidle');

      const seed = baseSeed + index;
      const result = await performRandomActions(page, {
        actions: actionCount,
        seed,
        minDelay: 25,
        maxDelay: 75,
        excludeSelectors: [
          'button:has-text("Delete")',
          'button:has-text("Remove")',
          'button:has-text("Save")',
          'input[type="file"]',
          'nav a', // Stay on tools page
        ],
      });

      if (result.errors.length > 0) {
        console.log(`\n🔥 Failed at ${actionCount} actions, seed: ${seed}`);
        await page.screenshot({ path: `test-results/chaos-tools-${actionCount}-${seed}.png` });
      }

      expect(result.errors).toEqual([]);
    });
  }
});
