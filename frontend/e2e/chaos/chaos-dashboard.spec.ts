import { test, expect } from '@playwright/test';
import { performRandomActions, SeededRandom } from './chaos-helpers';

/**
 * Chaos/Monkey Testing for Dashboard
 *
 * These tests perform random actions to find crashes and unexpected errors.
 * Each test logs its seed - use the same seed to reproduce failures.
 */
test.describe('Dashboard Chaos Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for dashboard to be interactive
    await expect(
      page.locator('[data-testid="dashboard-selector"]')
    ).toBeVisible({ timeout: 15000 });
  });

  test('dashboard survives 50 random interactions', async ({ page }) => {
    const seed = 12345; // Fixed seed for reproducibility

    const result = await performRandomActions(page, {
      actions: 50,
      seed,
      excludeSelectors: [
        '[data-testid="purge-button"]', // Don't purge data
        'button:has-text("Delete")',
        'button:has-text("Remove")',
      ],
    });

    console.log('\n📋 Actions performed:');
    result.actions.forEach((a) => console.log(`  ${a}`));

    // Check for crash overlay
    const errorOverlay = page.locator(
      'text=Application error: a client-side exception has occurred'
    );
    const hasCrash = await errorOverlay.isVisible();

    if (hasCrash || result.errors.length > 0) {
      console.log(`\n🔥 CRASH DETECTED with seed: ${result.seed}`);
      console.log('Errors:', result.errors);
      await page.screenshot({
        path: `test-results/chaos-crash-${result.seed}.png`,
      });
    }

    expect(result.errors).toEqual([]);
    await expect(errorOverlay).not.toBeVisible();
  });

  test('chaos with tab switching - seed 11111', async ({ page }) => {
    const seed = 11111;
    const rng = new SeededRandom(seed);

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

    console.log(`🐒 Tab chaos starting with seed: ${seed}`);

    // Interleave tab switches with random actions
    for (let round = 0; round < 5; round++) {
      // Ensure we're on the dashboard before clicking tabs
      if (!page.url().endsWith('/') && page.url().indexOf('/?') === -1) {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
      }

      // Click a random tab
      const tabIndex = rng.int(0, tabCount - 1);
      console.log(`  Round ${round + 1}: switching to tab ${tabIndex}`);
      await tabs.nth(tabIndex).click();
      await page.waitForTimeout(rng.int(100, 300));

      // Perform a few random actions (but stay on dashboard)
      const result = await performRandomActions(page, {
        actions: rng.int(3, 8),
        seed: seed + round,
        excludeSelectors: [
          '[data-testid="purge-button"]',
          'button:has-text("Delete")',
          'a[href]:not([href="/"])', // Don't navigate away from dashboard
          'button:has-text("Manage")',
        ],
      });

      if (result.errors.length > 0) {
        errors.push(...result.errors);
        break;
      }
    }

    // Final state check
    const errorOverlay = page.locator(
      'text=Application error: a client-side exception has occurred'
    );

    if (errors.length > 0 || (await errorOverlay.isVisible())) {
      console.log(`\n🔥 CRASH with seed: ${seed}`);
      console.log('Errors:', errors);
      await page.screenshot({
        path: `test-results/chaos-tab-crash-${seed}.png`,
      });
    }

    expect(errors).toEqual([]);
    await expect(errorOverlay).not.toBeVisible();
  });

  test('rapid random clicking - stress test', async ({ page }) => {
    const seed = 99999;

    // Fast clicking with minimal delays
    const result = await performRandomActions(page, {
      actions: 100,
      seed,
      minDelay: 10,
      maxDelay: 50,
      actionTypes: ['click-button', 'click-link', 'press-key'],
      excludeSelectors: [
        '[data-testid="purge-button"]',
        'button:has-text("Delete")',
        'button:has-text("Remove")',
        'a[href="/admin"]', // Stay on dashboard for this test
      ],
    });

    console.log(`\n📊 Stress test results:`);
    console.log(`  Seed: ${result.seed}`);
    console.log(`  Actions: ${result.actionsPerformed}`);
    console.log(`  Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('  Error details:', result.errors);
      await page.screenshot({
        path: `test-results/chaos-stress-${seed}.png`,
      });
    }

    expect(result.errors).toEqual([]);
  });

  test('form filling chaos', async ({ page }) => {
    // Navigate to a page with forms
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const seed = 77777;

    const result = await performRandomActions(page, {
      actions: 30,
      seed,
      actionTypes: ['fill-input', 'click-button', 'select-option', 'press-key'],
      excludeSelectors: [
        'button:has-text("Delete")',
        'button:has-text("Import")', // Don't start imports with garbage data
      ],
    });

    console.log(`\n📝 Form chaos results:`);
    console.log(`  Seed: ${result.seed}`);
    console.log(`  Actions: ${result.actionsPerformed}`);

    if (result.errors.length > 0) {
      console.log('  Errors:', result.errors);
      await page.screenshot({
        path: `test-results/chaos-form-${seed}.png`,
      });
    }

    // Page should still be functional
    const errorOverlay = page.locator(
      'text=Application error: a client-side exception has occurred'
    );
    expect(result.errors).toEqual([]);
    await expect(errorOverlay).not.toBeVisible();
  });
});

/**
 * Run with different seeds to explore more paths.
 * If a test fails, note the seed and add it as a specific test case.
 */
test.describe('Chaos with random seeds', () => {
  // Generate a few random seeds for broader coverage
  const randomSeeds = [Date.now(), Date.now() + 1, Date.now() + 2];

  for (const seed of randomSeeds) {
    test(`chaos exploration - seed ${seed}`, async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(
        page.locator('[data-testid="dashboard-selector"]')
      ).toBeVisible({ timeout: 15000 });

      const result = await performRandomActions(page, {
        actions: 25,
        seed,
        excludeSelectors: [
          '[data-testid="purge-button"]',
          'button:has-text("Delete")',
        ],
      });

      if (result.errors.length > 0) {
        console.log(`\n🐛 Found bug with seed: ${seed}`);
        console.log('Reproduce with: test.only(`chaos exploration - seed ${seed}`...)');
        await page.screenshot({
          path: `test-results/chaos-explore-${seed}.png`,
        });
      }

      expect(result.errors).toEqual([]);
    });
  }
});
