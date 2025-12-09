import { test, expect } from '@playwright/test';
import {
  performTimedRandomActions,
  performTimedDemonActions,
  SeededRandom,
} from './chaos-helpers';

/**
 * Endurance Chaos Tests - Time-Based Long-Running Tests
 *
 * These tests run for a specified duration rather than a fixed action count.
 * They're designed for weekly CI runs to catch memory leaks, performance
 * degradation, and edge cases that only appear after extended use.
 *
 * Test durations (in CI):
 * - @endurance-short: 1 minute (quick validation)
 * - @endurance-medium: 5 minutes (standard weekly)
 * - @endurance-long: 15 minutes (extended weekly)
 *
 * Run with:
 *   npx playwright test --grep "@endurance"
 */

// Duration constants (milliseconds)
const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

test.describe('Timed Roaming Endurance @endurance @endurance-short', () => {
  test('1-minute roaming endurance (chromium only)', async ({ page }) => {
    test.setTimeout(ONE_MINUTE + 30000); // Test timeout = duration + buffer

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const seed = Date.now();
    const pagesVisited = new Set<string>();

    const result = await performTimedRandomActions(page, {
      durationMs: ONE_MINUTE,
      seed,
      minDelay: 50,
      maxDelay: 150,
      excludeSelectors: [
        '[data-testid="purge-button"]',
        'button:has-text("Delete")',
        'button:has-text("Purge")',
        'button:has-text("Remove")',
        'button:has-text("Confirm")',
        'input[type="file"]',
      ],
      onAction: () => {
        const path = new URL(page.url()).pathname;
        pagesVisited.add(path);
      },
    });

    console.log(`\n📊 Endurance summary:`);
    console.log(`  Duration: ${ONE_MINUTE / 1000}s`);
    console.log(`  Actions: ${result.actionsPerformed}`);
    console.log(`  Pages visited: ${Array.from(pagesVisited).join(', ')}`);
    console.log(`  Actions/second: ${(result.actionsPerformed / (ONE_MINUTE / 1000)).toFixed(1)}`);

    if (result.errors.length > 0) {
      await page.screenshot({ path: `test-results/endurance-roaming-1min-${seed}.png` });
    }

    expect(result.errors).toEqual([]);
    await expect(
      page.locator('text=Application error: a client-side exception has occurred')
    ).not.toBeVisible();
  });
});

test.describe('Timed Roaming Endurance @endurance @endurance-medium', () => {
  test('5-minute roaming endurance', async ({ page }) => {
    test.setTimeout(FIVE_MINUTES + 60000);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const seed = Date.now();
    const pagesVisited = new Set<string>();

    const result = await performTimedRandomActions(page, {
      durationMs: FIVE_MINUTES,
      seed,
      minDelay: 50,
      maxDelay: 200,
      excludeSelectors: [
        '[data-testid="purge-button"]',
        'button:has-text("Delete")',
        'button:has-text("Purge")',
        'button:has-text("Remove")',
        'button:has-text("Confirm")',
        'input[type="file"]',
      ],
      onAction: () => {
        const path = new URL(page.url()).pathname;
        pagesVisited.add(path);
      },
    });

    console.log(`\n📊 Endurance summary:`);
    console.log(`  Duration: ${FIVE_MINUTES / 1000}s`);
    console.log(`  Actions: ${result.actionsPerformed}`);
    console.log(`  Pages visited: ${Array.from(pagesVisited).join(', ')}`);
    console.log(`  Actions/second: ${(result.actionsPerformed / (FIVE_MINUTES / 1000)).toFixed(1)}`);

    if (result.errors.length > 0) {
      await page.screenshot({ path: `test-results/endurance-roaming-5min-${seed}.png` });
    }

    expect(result.errors).toEqual([]);
    await expect(
      page.locator('text=Application error: a client-side exception has occurred')
    ).not.toBeVisible();
  });
});

test.describe('Timed Roaming Endurance @endurance @endurance-long', () => {
  test('15-minute roaming endurance', async ({ page }) => {
    test.setTimeout(FIFTEEN_MINUTES + 120000);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const seed = Date.now();
    const pagesVisited = new Set<string>();

    const result = await performTimedRandomActions(page, {
      durationMs: FIFTEEN_MINUTES,
      seed,
      minDelay: 100,
      maxDelay: 300,
      excludeSelectors: [
        '[data-testid="purge-button"]',
        'button:has-text("Delete")',
        'button:has-text("Purge")',
        'button:has-text("Remove")',
        'button:has-text("Confirm")',
        'input[type="file"]',
      ],
      onAction: () => {
        const path = new URL(page.url()).pathname;
        pagesVisited.add(path);
      },
    });

    console.log(`\n📊 Endurance summary:`);
    console.log(`  Duration: ${FIFTEEN_MINUTES / 1000}s`);
    console.log(`  Actions: ${result.actionsPerformed}`);
    console.log(`  Pages visited: ${Array.from(pagesVisited).join(', ')}`);
    console.log(`  Actions/second: ${(result.actionsPerformed / (FIFTEEN_MINUTES / 1000)).toFixed(1)}`);

    if (result.errors.length > 0) {
      await page.screenshot({ path: `test-results/endurance-roaming-15min-${seed}.png` });
    }

    expect(result.errors).toEqual([]);
    await expect(
      page.locator('text=Application error: a client-side exception has occurred')
    ).not.toBeVisible();
  });
});

test.describe('Timed Demon Endurance @endurance @endurance-short', () => {
  test('1-minute demon endurance on transactions page', async ({ page }) => {
    test.setTimeout(ONE_MINUTE + 30000);

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // Dismiss help overlay if visible
    const gotItBtn = page.locator('button:has-text("Got it")').first();
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
    }

    await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 });

    const seed = Date.now();

    const result = await performTimedDemonActions(page, {
      durationMs: ONE_MINUTE,
      seed,
      excludeSelectors: [
        'button:has-text("Delete")',
        '[data-testid="purge-button"]',
        'nav a',
      ],
    });

    console.log(`\n📊 Demon endurance summary:`);
    console.log(`  Duration: ${ONE_MINUTE / 1000}s`);
    console.log(`  Actions: ${result.actionsPerformed}`);
    console.log(`  Actions/second: ${(result.actionsPerformed / (ONE_MINUTE / 1000)).toFixed(1)}`);

    if (result.errors.length > 0) {
      await page.screenshot({ path: `test-results/endurance-demon-1min-${seed}.png` });
    }

    expect(result.errors).toEqual([]);
    await expect(
      page.locator('text=Application error: a client-side exception has occurred')
    ).not.toBeVisible();
  });
});

test.describe('Timed Demon Endurance @endurance @endurance-medium', () => {
  test('5-minute demon endurance on transactions page', async ({ page }) => {
    test.setTimeout(FIVE_MINUTES + 60000);

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const gotItBtn = page.locator('button:has-text("Got it")').first();
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
    }

    await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 });

    const seed = Date.now();

    const result = await performTimedDemonActions(page, {
      durationMs: FIVE_MINUTES,
      seed,
      excludeSelectors: [
        'button:has-text("Delete")',
        '[data-testid="purge-button"]',
        'nav a',
      ],
    });

    console.log(`\n📊 Demon endurance summary:`);
    console.log(`  Duration: ${FIVE_MINUTES / 1000}s`);
    console.log(`  Actions: ${result.actionsPerformed}`);
    console.log(`  Actions/second: ${(result.actionsPerformed / (FIVE_MINUTES / 1000)).toFixed(1)}`);

    if (result.errors.length > 0) {
      await page.screenshot({ path: `test-results/endurance-demon-5min-${seed}.png` });
    }

    expect(result.errors).toEqual([]);
    await expect(
      page.locator('text=Application error: a client-side exception has occurred')
    ).not.toBeVisible();
  });
});

test.describe('Page-Cycling Endurance @endurance @endurance-medium', () => {
  test('5-minute page cycling through all routes', async ({ page }) => {
    test.setTimeout(FIVE_MINUTES + 60000);

    const pages = [
      { path: '/', name: 'Dashboard', waitFor: '[data-testid="dashboard-selector"]' },
      { path: '/transactions', name: 'Transactions', waitFor: 'input[placeholder*="Search"]' },
      { path: '/import', name: 'Import', waitFor: 'text=Import Transactions' },
      { path: '/tools', name: 'Tools', waitFor: 'text=Tools' },
      { path: '/admin', name: 'Admin', waitFor: 'text=Admin' },
      { path: '/budgets', name: 'Budgets', waitFor: 'text=Budget' },
    ];

    const seed = Date.now();
    const rng = new SeededRandom(seed);
    const startTime = Date.now();
    const endTime = startTime + FIVE_MINUTES;
    const errors: string[] = [];
    const pageVisits: Record<string, number> = {};

    page.on('pageerror', (err) => errors.push(err.message));

    console.log(`\n🚀 Page cycling endurance starting, seed: ${seed}`);

    let cycles = 0;
    while (Date.now() < endTime && errors.length === 0) {
      const pageConfig = rng.pick(pages);

      try {
        await page.goto(pageConfig.path);
        await page.waitForLoadState('networkidle');

        // Dismiss help if present
        const gotItBtn = page.locator('button:has-text("Got it")').first();
        if (await gotItBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await gotItBtn.click();
        }

        // Try to wait for page-specific element
        await page.waitForSelector(pageConfig.waitFor, { timeout: 5000 }).catch(() => {});

        // Perform a few random actions on each page
        const result = await performTimedRandomActions(page, {
          durationMs: 10000, // 10 seconds per page
          seed: seed + cycles,
          minDelay: 25,
          maxDelay: 100,
          excludeSelectors: [
            '[data-testid="purge-button"]',
            'button:has-text("Delete")',
            'button:has-text("Purge")',
            'nav a', // Stay on current page
            'input[type="file"]',
          ],
        });

        if (result.errors.length > 0) {
          errors.push(...result.errors);
        }

        pageVisits[pageConfig.name] = (pageVisits[pageConfig.name] || 0) + 1;
        cycles++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Navigation error: ${msg}`);
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`\n📊 Page cycling summary:`);
    console.log(`  Duration: ${Math.round(totalDuration / 1000)}s`);
    console.log(`  Cycles: ${cycles}`);
    console.log(`  Page visits:`, pageVisits);
    console.log(`  Errors: ${errors.length}`);

    if (errors.length > 0) {
      await page.screenshot({ path: `test-results/endurance-cycling-5min-${seed}.png` });
    }

    expect(errors).toEqual([]);
    await expect(
      page.locator('text=Application error: a client-side exception has occurred')
    ).not.toBeVisible();
  });
});
