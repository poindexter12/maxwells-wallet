import { test, expect } from '@playwright/test';
import { performRandomActions } from './chaos-helpers';

/**
 * Chaos/Monkey Testing for Transactions Page
 *
 * Uses Fibonacci ramp-up starting at 13: 13, 21, 34, 55, 89 actions per test.
 */

// Fibonacci sequence starting at meaningful scale
const FIBONACCI_ROUNDS = [13, 21, 34, 55, 89];

test.describe('Transactions Chaos - Fibonacci Ramp @chaos', () => {
  const baseSeed = 22222;

  for (const [index, actionCount] of FIBONACCI_ROUNDS.entries()) {
    test(`transactions chaos - ${actionCount} actions`, async ({ page }) => {
      test.setTimeout(30000 + actionCount * 1000);

      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');

      // Dismiss help overlay if visible
      const gotItBtn = page.locator('button:has-text("Got it")').first();
      if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await gotItBtn.click();
      }

      // Wait for page to be ready
      await page.waitForSelector('input[placeholder*="Search merchant"]', { timeout: 10000 });

      const seed = baseSeed + index;
      const result = await performRandomActions(page, {
        actions: actionCount,
        seed,
        minDelay: 25,
        maxDelay: 75,
        excludeSelectors: [
          'button:has-text("Delete")',
          'button:has-text("Import")',
          '[data-testid="purge-button"]',
          'nav a', // Stay on transactions page
        ],
      });

      if (result.errors.length > 0) {
        console.log(`\n🔥 Failed at ${actionCount} actions, seed: ${seed}`);
        await page.screenshot({ path: `test-results/chaos-tx-${actionCount}-${seed}.png` });
      }

      expect(result.errors).toEqual([]);
      await expect(
        page.locator('text=Application error: a client-side exception has occurred')
      ).not.toBeVisible();
    });
  }
});
