import { test, expect } from '@playwright/test';
import { performRandomActions, SeededRandom } from './chaos-helpers';

/**
 * Chaos/Monkey Testing for Transactions Page
 *
 * Uses Fibonacci ramp-up: 1, 2, 3, 5, 8, 13 actions per test.
 * Tests cover: general interactions, filtering, scrolling, and selection.
 */

// Fibonacci sequence for progressive stress testing
const FIBONACCI_ROUNDS = [1, 2, 3, 5, 8, 13];

test.describe('Transactions Chaos - Fibonacci Ramp @chaos', () => {
  const baseSeed = 22222;

  for (const [index, actionCount] of FIBONACCI_ROUNDS.entries()) {
    test(`transactions chaos round ${index + 1} - ${actionCount} actions`, async ({ page }) => {
      test.setTimeout(15000 + actionCount * 2000);

      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');

      // Dismiss help overlay if visible
      const gotItBtn = page.locator('button:has-text("Got it")').first();
      if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await gotItBtn.click();
      }

      // Wait for filters to load (indicates page is ready)
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
          'nav a', // Don't navigate away from transactions page
          'a[href="/"]',
          'a[href="/import"]',
          'a[href="/tools"]',
          'a[href="/admin"]',
        ],
      });

      if (result.errors.length > 0) {
        console.log(`\n🔥 Failed at round ${index + 1} (${actionCount} actions), seed: ${seed}`);
        await page.screenshot({ path: `test-results/chaos-tx-r${index + 1}-${seed}.png` });
      }

      expect(result.errors).toEqual([]);
      await expect(
        page.locator('text=Application error: a client-side exception has occurred')
      ).not.toBeVisible();
    });
  }
});

test.describe('Transactions Filter Chaos @chaos', () => {
  test('filter combinations - seed 55555', async ({ page }) => {
    test.setTimeout(30000);
    const seed = 55555;
    const rng = new SeededRandom(seed);
    const errors: string[] = [];

    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // Dismiss help overlay if visible
    const gotItBtn = page.locator('button:has-text("Got it")').first();
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
    }

    await page.waitForSelector('input[placeholder*="Search merchant"]', { timeout: 10000 });

    // 5 rounds: interact with filters, then do 2 general actions
    for (let round = 0; round < 5; round++) {
      // Interact with filter controls
      const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill(rng.string(rng.int(0, 8)));
        await page.waitForTimeout(50);
      }

      // Toggle some filter checkboxes or dropdowns
      const result = await performRandomActions(page, {
        actions: 2,
        seed: seed + round,
        minDelay: 25,
        maxDelay: 50,
        actionTypes: ['click-button', 'select-option', 'fill-input'],
        excludeSelectors: [
          'button:has-text("Delete")',
          'button:has-text("Import")',
          'nav a',
        ],
      });

      if (result.errors.length > 0) {
        errors.push(...result.errors);
        break;
      }
    }

    if (errors.length > 0) {
      await page.screenshot({ path: `test-results/chaos-tx-filter-${seed}.png` });
    }

    expect(errors).toEqual([]);
  });
});

test.describe('Transactions Scroll Chaos @chaos', () => {
  test('scroll stress with actions - seed 66666', async ({ page }) => {
    test.setTimeout(45000);
    const seed = 66666;
    const rng = new SeededRandom(seed);
    const errors: string[] = [];

    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // Dismiss help overlay if visible
    const gotItBtn = page.locator('button:has-text("Got it")').first();
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
    }

    await page.waitForSelector('input[placeholder*="Search merchant"]', { timeout: 10000 });

    // 8 rounds: scroll, then 2 actions
    for (let round = 0; round < 8; round++) {
      // Scroll in random direction
      const direction = rng.pick(['down', 'up']);
      const amount = rng.int(200, 600);
      await page.mouse.wheel(0, direction === 'down' ? amount : -amount);
      await page.waitForTimeout(rng.int(50, 100));

      const result = await performRandomActions(page, {
        actions: 2,
        seed: seed + round,
        minDelay: 25,
        maxDelay: 50,
        excludeSelectors: [
          'button:has-text("Delete")',
          'nav a',
        ],
      });

      if (result.errors.length > 0) {
        errors.push(...result.errors);
        break;
      }
    }

    if (errors.length > 0) {
      await page.screenshot({ path: `test-results/chaos-tx-scroll-${seed}.png` });
    }

    expect(errors).toEqual([]);
  });
});

test.describe('Transactions Selection Chaos @chaos', () => {
  test('multi-select chaos - seed 77777', async ({ page }) => {
    test.setTimeout(30000);
    const seed = 77777;
    const rng = new SeededRandom(seed);
    const errors: string[] = [];

    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // Dismiss help overlay if visible
    const gotItBtn = page.locator('button:has-text("Got it")').first();
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
    }

    await page.waitForSelector('input[placeholder*="Search merchant"]', { timeout: 10000 });

    // 4 rounds of selection actions
    for (let round = 0; round < 4; round++) {
      // Try to click checkboxes
      const checkboxes = page.locator('input[type="checkbox"]:visible');
      const count = await checkboxes.count();

      if (count > 0) {
        const target = checkboxes.nth(rng.int(0, Math.min(count - 1, 5)));
        try {
          await target.scrollIntoViewIfNeeded();
          await target.click({ timeout: 2000 });
        } catch {
          // Element might have become stale
        }
      }

      const result = await performRandomActions(page, {
        actions: 2,
        seed: seed + round,
        minDelay: 25,
        maxDelay: 50,
        excludeSelectors: [
          'button:has-text("Delete")',
          'nav a',
        ],
      });

      if (result.errors.length > 0) {
        errors.push(...result.errors);
        break;
      }
    }

    if (errors.length > 0) {
      await page.screenshot({ path: `test-results/chaos-tx-select-${seed}.png` });
    }

    expect(errors).toEqual([]);
  });
});
