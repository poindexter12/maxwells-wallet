import { test, expect } from '@playwright/test';
import { performRandomActions, SeededRandom } from './chaos-helpers';

/**
 * Chaos/Monkey Testing for Import Flow and Custom CSV Management
 *
 * Uses Fibonacci ramp-up: 1, 2, 3, 5, 8, 13 actions per test.
 * Tests cover: import page, tools page, and cross-page navigation.
 */

// Fibonacci sequence for progressive stress testing
const FIBONACCI_ROUNDS = [1, 2, 3, 5, 8, 13];

test.describe('Import Page Chaos - Fibonacci Ramp @chaos', () => {
  const baseSeed = 88888;

  for (const [index, actionCount] of FIBONACCI_ROUNDS.entries()) {
    test(`import chaos round ${index + 1} - ${actionCount} actions`, async ({ page }) => {
      test.setTimeout(15000 + actionCount * 2000);

      await page.goto('/import');
      await page.waitForLoadState('networkidle');

      // Dismiss help if visible
      const closeBtn = page.locator('button:has-text("Close"), a:has-text("Close")').first();
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
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
        ],
      });

      if (result.errors.length > 0) {
        console.log(`\n🔥 Failed at round ${index + 1} (${actionCount} actions), seed: ${seed}`);
        await page.screenshot({ path: `test-results/chaos-import-r${index + 1}-${seed}.png` });
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
    test(`tools chaos round ${index + 1} - ${actionCount} actions`, async ({ page }) => {
      test.setTimeout(15000 + actionCount * 2000);

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
        ],
      });

      if (result.errors.length > 0) {
        console.log(`\n🔥 Failed at round ${index + 1} (${actionCount} actions), seed: ${seed}`);
        await page.screenshot({ path: `test-results/chaos-tools-r${index + 1}-${seed}.png` });
      }

      expect(result.errors).toEqual([]);
    });
  }
});

test.describe('Cross-page Navigation Chaos @chaos', () => {
  test('navigate between pages with actions', async ({ page }) => {
    test.setTimeout(45000);
    const seed = 44444;
    const rng = new SeededRandom(seed);
    const errors: string[] = [];

    page.on('pageerror', (err) => errors.push(err.message));

    const pages = ['/import', '/tools', '/transactions'];

    // 4 rounds of page navigation + 3 actions each
    for (let round = 0; round < 4; round++) {
      const targetPage = rng.pick(pages);
      await page.goto(targetPage);
      await page.waitForLoadState('networkidle');

      const result = await performRandomActions(page, {
        actions: 3,
        seed: seed + round,
        minDelay: 25,
        maxDelay: 50,
        excludeSelectors: [
          'button:has-text("Delete")',
          'button:has-text("Purge")',
          'button:has-text("Confirm")',
          'input[type="file"]',
        ],
      });

      if (result.errors.length > 0) {
        errors.push(...result.errors);
        break;
      }
    }

    if (errors.length > 0) {
      await page.screenshot({ path: `test-results/chaos-crosspage-${seed}.png` });
    }

    expect(errors).toEqual([]);
  });
});
