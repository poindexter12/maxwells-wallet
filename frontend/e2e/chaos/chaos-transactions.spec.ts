import { test, expect } from '@playwright/test';
import { performRandomActions, SeededRandom } from './chaos-helpers';

/**
 * Chaos/Monkey Testing for Transactions Page
 *
 * The transactions page is the core of the application - test it heavily.
 */
test.describe('Transactions Chaos Testing @chaos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    // Wait for transactions page to load (look for heading or transaction count)
    await expect(
      page.locator('text=/Transactions|Showing.*transactions/i').first()
    ).toBeVisible({ timeout: 15000 });

    // Dismiss help panel if visible
    const gotItBtn = page.locator('button:has-text("Got it")');
    if (await gotItBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await gotItBtn.click();
    }
  });

  test('filter combinations chaos - seed 22222', async ({ page }) => {
    test.setTimeout(60000);
    const seed = 22222;
    const rng = new SeededRandom(seed);
    const errors: string[] = [];

    page.on('pageerror', (err) => errors.push(err.message));

    console.log(`🐒 Filter chaos starting with seed: ${seed}`);

    // Available filter actions
    const filterActions = [
      // Search input
      async () => {
        const search = page.locator('input[placeholder*="Search"]').first();
        if (await search.isVisible()) {
          await search.fill(rng.string(rng.int(3, 12)));
          await search.press('Enter');
          return 'fill search';
        }
        return 'skip search';
      },

      // Clear search
      async () => {
        const search = page.locator('input[placeholder*="Search"]').first();
        if (await search.isVisible()) {
          await search.clear();
          await search.press('Enter');
          return 'clear search';
        }
        return 'skip clear search';
      },

      // Bucket dropdown
      async () => {
        const bucketSelect = page.locator('select').filter({ hasText: /bucket/i }).first();
        if (await bucketSelect.isVisible()) {
          const options = await bucketSelect.locator('option').all();
          if (options.length > 1) {
            const option = rng.pick(options);
            const value = await option.getAttribute('value');
            if (value !== null) {
              await bucketSelect.selectOption(value);
              return `select bucket: ${value}`;
            }
          }
        }
        return 'skip bucket';
      },

      // Status dropdown
      async () => {
        const statusSelect = page.locator('select').filter({ hasText: /status/i }).first();
        if (await statusSelect.isVisible()) {
          const options = await statusSelect.locator('option').all();
          if (options.length > 1) {
            const option = rng.pick(options);
            const value = await option.getAttribute('value');
            if (value !== null) {
              await statusSelect.selectOption(value);
              return `select status: ${value}`;
            }
          }
        }
        return 'skip status';
      },

      // Toggle advanced filters
      async () => {
        const advancedBtn = page.locator('button').filter({ hasText: /advanced|filters/i }).first();
        if (await advancedBtn.isVisible()) {
          await advancedBtn.click();
          return 'toggle advanced filters';
        }
        return 'skip advanced toggle';
      },

      // Amount min
      async () => {
        const amountMin = page.locator('input[placeholder*="Min"]').first();
        if (await amountMin.isVisible()) {
          const value = rng.pick(['', '0', '10', '100', '1000', '-50', '99999']);
          await amountMin.fill(value);
          return `amount min: ${value}`;
        }
        return 'skip amount min';
      },

      // Amount max
      async () => {
        const amountMax = page.locator('input[placeholder*="Max"]').first();
        if (await amountMax.isVisible()) {
          const value = rng.pick(['', '0', '50', '500', '5000', '-100']);
          await amountMax.fill(value);
          return `amount max: ${value}`;
        }
        return 'skip amount max';
      },

      // Date start
      async () => {
        const dateStart = page.locator('input[type="date"]').first();
        if (await dateStart.isVisible()) {
          const dates = ['', '2024-01-01', '2025-06-15', '2020-12-31', '2099-01-01'];
          const value = rng.pick(dates);
          await dateStart.fill(value);
          return `date start: ${value}`;
        }
        return 'skip date start';
      },

      // Date end
      async () => {
        const dateEnd = page.locator('input[type="date"]').nth(1);
        if (await dateEnd.isVisible()) {
          const dates = ['', '2024-12-31', '2025-12-31', '2019-01-01'];
          const value = rng.pick(dates);
          await dateEnd.fill(value);
          return `date end: ${value}`;
        }
        return 'skip date end';
      },

      // Quick filter buttons
      async () => {
        const quickFilters = page.locator('button').filter({
          hasText: /this month|last month|large|unreconciled/i,
        });
        const count = await quickFilters.count();
        if (count > 0) {
          const btn = quickFilters.nth(rng.int(0, count - 1));
          await btn.click();
          const text = await btn.textContent();
          return `quick filter: ${text}`;
        }
        return 'skip quick filter';
      },

      // Clear all filters
      async () => {
        const clearBtn = page.locator('button').filter({ hasText: /clear|reset/i }).first();
        if (await clearBtn.isVisible()) {
          await clearBtn.click();
          return 'clear filters';
        }
        return 'skip clear';
      },
    ];

    // Perform 30 random filter operations
    for (let i = 0; i < 30; i++) {
      const action = rng.pick(filterActions);
      try {
        const result = await action();
        console.log(`  ${i + 1}. ${result}`);
      } catch (e) {
        console.log(`  ${i + 1}. [FAILED] ${e}`);
      }

      await page.waitForTimeout(rng.int(100, 300));

      if (errors.length > 0) {
        console.log(`🔥 Crash after action ${i + 1}`);
        break;
      }
    }

    // Check for crashes
    const errorOverlay = page.locator(
      'text=Application error: a client-side exception has occurred'
    );

    if (errors.length > 0) {
      console.log(`\n🔥 CRASH with seed: ${seed}`);
      console.log('Errors:', errors);
      await page.screenshot({
        path: `test-results/chaos-txn-filter-${seed}.png`,
      });
    }

    expect(errors).toEqual([]);
    await expect(errorOverlay).not.toBeVisible();
  });

  test('inline editing chaos - seed 33333', async ({ page }) => {
    test.setTimeout(60000);
    const seed = 33333;
    const rng = new SeededRandom(seed);
    const errors: string[] = [];

    page.on('pageerror', (err) => errors.push(err.message));

    console.log(`🐒 Inline edit chaos starting with seed: ${seed}`);

    // Wait for rows to be visible
    await page.waitForTimeout(1000);

    for (let i = 0; i < 20; i++) {
      try {
        // Find clickable rows or cells
        const rows = await page.locator('tr, [role="row"]').all();
        const dataRows = rows.slice(1); // Skip header

        if (dataRows.length === 0) {
          console.log('  No data rows found');
          break;
        }

        const action = rng.pick([
          'click-row',
          'click-cell',
          'edit-note',
          'toggle-expand',
          'click-tag',
          'press-escape',
          'press-tab',
        ]);

        switch (action) {
          case 'click-row': {
            const row = rng.pick(dataRows);
            await row.click();
            console.log(`  ${i + 1}. click row`);
            break;
          }

          case 'click-cell': {
            const row = rng.pick(dataRows);
            const cells = await row.locator('td, [role="cell"]').all();
            if (cells.length > 0) {
              const cell = rng.pick(cells);
              await cell.click();
              console.log(`  ${i + 1}. click cell`);
            }
            break;
          }

          case 'edit-note': {
            // Look for note edit button or textarea
            const noteBtn = page.locator('button').filter({ hasText: /note|edit/i }).first();
            if (await noteBtn.isVisible()) {
              await noteBtn.click();
              const textarea = page.locator('textarea').first();
              if (await textarea.isVisible()) {
                await textarea.fill(rng.string(rng.int(5, 50)));
              }
              console.log(`  ${i + 1}. edit note`);
            }
            break;
          }

          case 'toggle-expand': {
            const expandBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
            if (await expandBtn.isVisible()) {
              await expandBtn.click();
              console.log(`  ${i + 1}. toggle expand`);
            }
            break;
          }

          case 'click-tag': {
            const tags = page.locator('[class*="tag"], [class*="badge"], [class*="chip"]');
            const count = await tags.count();
            if (count > 0) {
              await tags.nth(rng.int(0, count - 1)).click();
              console.log(`  ${i + 1}. click tag`);
            }
            break;
          }

          case 'press-escape': {
            await page.keyboard.press('Escape');
            console.log(`  ${i + 1}. press Escape`);
            break;
          }

          case 'press-tab': {
            await page.keyboard.press('Tab');
            console.log(`  ${i + 1}. press Tab`);
            break;
          }
        }
      } catch (e) {
        console.log(`  ${i + 1}. [FAILED] ${e}`);
      }

      await page.waitForTimeout(rng.int(50, 200));

      if (errors.length > 0) break;
    }

    if (errors.length > 0) {
      console.log(`\n🔥 CRASH with seed: ${seed}`);
      console.log('Errors:', errors);
      await page.screenshot({
        path: `test-results/chaos-txn-edit-${seed}.png`,
      });
    }

    expect(errors).toEqual([]);
  });

  test('bulk operations chaos - seed 44444', async ({ page }) => {
    test.setTimeout(60000);
    const seed = 44444;
    const rng = new SeededRandom(seed);
    const errors: string[] = [];

    page.on('pageerror', (err) => errors.push(err.message));

    console.log(`🐒 Bulk operations chaos starting with seed: ${seed}`);

    for (let i = 0; i < 15; i++) {
      try {
        const action = rng.pick([
          'select-checkbox',
          'select-all',
          'deselect-all',
          'bulk-action-dropdown',
          'click-apply',
        ]);

        switch (action) {
          case 'select-checkbox': {
            // Only target visible checkboxes to handle virtualized lists
            const checkboxes = page.locator('input[type="checkbox"]:visible');
            const count = await checkboxes.count();
            if (count > 1) {
              // Skip first (select-all) and pick from visible ones
              const target = checkboxes.nth(rng.int(1, Math.min(count - 1, 5)));
              await target.scrollIntoViewIfNeeded();
              await target.click({ timeout: 5000 });
              console.log(`  ${i + 1}. select checkbox`);
            }
            break;
          }

          case 'select-all': {
            const selectAll = page.locator('input[type="checkbox"]').first();
            if (await selectAll.isVisible()) {
              await selectAll.check();
              console.log(`  ${i + 1}. select all`);
            }
            break;
          }

          case 'deselect-all': {
            const selectAll = page.locator('input[type="checkbox"]').first();
            if (await selectAll.isVisible()) {
              await selectAll.uncheck();
              console.log(`  ${i + 1}. deselect all`);
            }
            break;
          }

          case 'bulk-action-dropdown': {
            const bulkSelect = page.locator('select').filter({ hasText: /action|bulk/i }).first();
            if (await bulkSelect.isVisible()) {
              const options = await bulkSelect.locator('option').all();
              if (options.length > 1) {
                const opt = rng.pick(options);
                const val = await opt.getAttribute('value');
                if (val) {
                  await bulkSelect.selectOption(val);
                  console.log(`  ${i + 1}. bulk action: ${val}`);
                }
              }
            }
            break;
          }

          case 'click-apply': {
            // Don't actually apply dangerous bulk actions
            console.log(`  ${i + 1}. skip apply (safety)`);
            break;
          }
        }
      } catch (e) {
        console.log(`  ${i + 1}. [FAILED] ${e}`);
      }

      await page.waitForTimeout(rng.int(100, 300));

      if (errors.length > 0) break;
    }

    if (errors.length > 0) {
      console.log(`\n🔥 CRASH with seed: ${seed}`);
      console.log('Errors:', errors);
      await page.screenshot({
        path: `test-results/chaos-txn-bulk-${seed}.png`,
      });
    }

    expect(errors).toEqual([]);
  });

  test('deep scroll stress test - seed 55555', async ({ page }) => {
    test.setTimeout(60000);
    const seed = 55555;
    const errors: string[] = [];

    page.on('pageerror', (err) => errors.push(err.message));

    console.log(`🐒 Deep scroll stress test with seed: ${seed}`);

    // Scroll down aggressively to load many rows
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(200);

      if (errors.length > 0) {
        console.log(`🔥 Crash after scroll ${i + 1}`);
        break;
      }
    }

    // Now interact with elements after deep scroll
    if (errors.length === 0) {
      const result = await performRandomActions(page, {
        actions: 20,
        seed,
        excludeSelectors: ['button:has-text("Delete")', 'button:has-text("Purge")'],
      });

      errors.push(...result.errors);
    }

    if (errors.length > 0) {
      console.log(`\n🔥 CRASH with seed: ${seed}`);
      console.log('Errors:', errors);
      await page.screenshot({
        path: `test-results/chaos-txn-scroll-${seed}.png`,
      });
    }

    expect(errors).toEqual([]);
  });

  test('rapid pagination stress - seed 66666', async ({ page }) => {
    test.setTimeout(60000);
    const seed = 66666;
    const rng = new SeededRandom(seed);
    const errors: string[] = [];

    page.on('pageerror', (err) => errors.push(err.message));

    console.log(`🐒 Rapid pagination stress with seed: ${seed}`);

    // Rapidly scroll and interact
    for (let i = 0; i < 30; i++) {
      const action = rng.pick(['scroll-down', 'scroll-up', 'scroll-random', 'click']);

      try {
        switch (action) {
          case 'scroll-down':
            await page.mouse.wheel(0, rng.int(500, 2000));
            break;
          case 'scroll-up':
            await page.mouse.wheel(0, -rng.int(500, 2000));
            break;
          case 'scroll-random':
            await page.mouse.wheel(rng.int(-500, 500), rng.int(-1000, 1000));
            break;
          case 'click': {
            const buttons = await page.locator('button:visible').all();
            if (buttons.length > 0) {
              const btn = rng.pick(buttons);
              const text = await btn.textContent();
              if (
                !text?.toLowerCase().includes('delete') &&
                !text?.toLowerCase().includes('purge')
              ) {
                await btn.click({ timeout: 1000 }).catch(() => {});
              }
            }
            break;
          }
        }

        console.log(`  ${i + 1}. ${action}`);
      } catch (e) {
        console.log(`  ${i + 1}. [FAILED] ${action}`);
      }

      await page.waitForTimeout(rng.int(30, 100));

      if (errors.length > 0) break;
    }

    // Settle and verify
    await page.waitForTimeout(500);

    if (errors.length > 0) {
      console.log(`\n🔥 CRASH with seed: ${seed}`);
      console.log('Errors:', errors);
      await page.screenshot({
        path: `test-results/chaos-txn-pagination-${seed}.png`,
      });
    }

    expect(errors).toEqual([]);
  });

  test('general transactions chaos - seed 77777', async ({ page }) => {
    test.setTimeout(90000); // 50 actions need more time
    const seed = 77777;

    const result = await performRandomActions(page, {
      actions: 50,
      seed,
      excludeSelectors: [
        'button:has-text("Delete")',
        'button:has-text("Purge")',
        'button:has-text("Import")', // Don't navigate away
        'a[href="/import"]',
      ],
    });

    console.log(`\n📋 Actions: ${result.actionsPerformed}, Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('Errors:', result.errors);
      await page.screenshot({
        path: `test-results/chaos-txn-general-${seed}.png`,
      });
    }

    expect(result.errors).toEqual([]);
  });
});
