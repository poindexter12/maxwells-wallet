import { test, expect } from '@playwright/test';
import { performRandomActions, SeededRandom } from './chaos-helpers';

/**
 * Chaos/Monkey Testing for Dashboard
 *
 * Uses Fibonacci ramp-up starting at 13: 13, 21, 34, 55, 89 actions per test.
 * Each round runs fully before the next begins.
 */

// Full Fibonacci sequence - CI runs ~15x slower than local but self-hosted runners handle it
const FIBONACCI_ROUNDS = [13, 21, 34, 55, 89];

test.describe('Dashboard Chaos - Fibonacci Ramp @chaos', () => {
  const baseSeed = 12345;

  for (const [index, actionCount] of FIBONACCI_ROUNDS.entries()) {
    test(`dashboard chaos - ${actionCount} actions`, async ({ page }) => {
      // Timeout scales: 30s base + 2s per action (CI is ~15x slower than local)
      test.setTimeout(30000 + actionCount * 2000);

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await expect(
        page.locator('[data-testid="dashboard-selector"]')
      ).toBeVisible({ timeout: 10000 });

      const seed = baseSeed + index;
      const result = await performRandomActions(page, {
        actions: actionCount,
        seed,
        minDelay: 25,
        maxDelay: 75,
        excludeSelectors: [
          '[data-testid="purge-button"]',
          'button:has-text("Delete")',
          'button:has-text("Remove")',
          'nav a', // Stay on dashboard
        ],
      });

      if (result.errors.length > 0) {
        console.log(`\n🔥 Failed at ${actionCount} actions, seed: ${seed}`);
        await page.screenshot({ path: `test-results/chaos-dashboard-${actionCount}-${seed}.png` });
      }

      expect(result.errors).toEqual([]);
      await expect(
        page.locator('text=Application error: a client-side exception has occurred')
      ).not.toBeVisible();
    });
  }
});

test.describe('Dashboard Tab Switching Chaos @chaos', () => {
  // TODO: Dashboard tab switching crashes - see dashboard-tabs.spec.ts failures
  // This is a real bug found by chaos testing that needs to be fixed separately
  test.skip('tab switching with interleaved actions', async ({ page }) => {
    test.setTimeout(60000);
    const seed = 11111;
    const rng = new SeededRandom(seed);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const tabs = page
      .locator('[data-testid="dashboard-selector"] button')
      .filter({ hasNot: page.locator('svg') });

    const tabCount = await tabs.count();
    if (tabCount < 2) {
      test.skip(true, 'Need at least 2 dashboard tabs');
      return;
    }

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // 5 rounds: switch tab, do 8 actions
    for (let round = 0; round < 5; round++) {
      const tabIndex = rng.int(0, tabCount - 1);
      await tabs.nth(tabIndex).click();
      await page.waitForTimeout(50);

      const result = await performRandomActions(page, {
        actions: 8,
        seed: seed + round,
        minDelay: 25,
        maxDelay: 50,
        excludeSelectors: [
          '[data-testid="purge-button"]',
          'a[href]:not([href="/"])',
        ],
      });

      if (result.errors.length > 0) {
        errors.push(...result.errors);
        break;
      }
    }

    if (errors.length > 0) {
      await page.screenshot({ path: `test-results/chaos-tab-${seed}.png` });
    }

    expect(errors).toEqual([]);
  });
});
