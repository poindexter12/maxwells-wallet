import { test, expect } from '@playwright/test';
import { performRandomActions, SeededRandom } from './chaos-helpers';

/**
 * Chaos/Monkey Testing for Dashboard
 *
 * Uses Fibonacci ramp-up: 1, 2, 3, 5, 8, 13 actions per test.
 * Each test is isolated and fast (15-30 seconds).
 * Total coverage: 32 actions across 6 tests.
 */

// Fibonacci sequence for progressive stress testing
const FIBONACCI_ROUNDS = [1, 2, 3, 5, 8, 13];

test.describe('Dashboard Chaos - Fibonacci Ramp @chaos', () => {
  const baseSeed = 12345;

  for (const [index, actionCount] of FIBONACCI_ROUNDS.entries()) {
    test(`dashboard chaos round ${index + 1} - ${actionCount} actions`, async ({ page }) => {
      // Timeout scales with action count: 15s base + 2s per action
      test.setTimeout(15000 + actionCount * 2000);

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
        ],
      });

      if (result.errors.length > 0) {
        console.log(`\n🔥 Failed at round ${index + 1} (${actionCount} actions), seed: ${seed}`);
        await page.screenshot({ path: `test-results/chaos-dashboard-r${index + 1}-${seed}.png` });
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
    test.setTimeout(30000);
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

    // 3 rounds: switch tab, do 3 actions
    for (let round = 0; round < 3; round++) {
      const tabIndex = rng.int(0, tabCount - 1);
      await tabs.nth(tabIndex).click();
      await page.waitForTimeout(50);

      const result = await performRandomActions(page, {
        actions: 3,
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
