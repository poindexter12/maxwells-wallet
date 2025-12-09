import { test, expect } from '@playwright/test';
import { performRandomActions } from './chaos-helpers';

/**
 * Chaos/Monkey Testing for Import Flow and Custom CSV Management
 *
 * Tests the import page and the custom format configuration in tools.
 */
test.describe('Import Flow Chaos Testing @chaos', () => {
  test('import page UI chaos - seed 88888', async ({ page }) => {
    // Increase timeout for this test
    test.setTimeout(120000);

    await page.goto('/import');
    await page.waitForLoadState('networkidle');

    // Dismiss help if visible
    const closeBtn = page.locator('button:has-text("Close"), a:has-text("Close")').first();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
    }

    const seed = 88888;
    const errors: string[] = [];

    page.on('pageerror', (err) => errors.push(err.message));

    console.log(`🐒 Import page chaos with seed: ${seed}`);

    // Perform 25 random actions using the general helper (simpler approach)
    const result = await performRandomActions(page, {
      actions: 25,
      seed,
      minDelay: 100,
      maxDelay: 300,
      excludeSelectors: [
        'button:has-text("Confirm")',
        'button:has-text("Import")',
        'button:has-text("Delete")',
        'input[type="file"]',
      ],
    });

    errors.push(...result.errors);

    // Check for crashes
    const errorOverlay = page.locator(
      'text=Application error: a client-side exception has occurred'
    );

    if (errors.length > 0) {
      console.log(`\n🔥 CRASH with seed: ${seed}`);
      console.log('Errors:', errors);
      await page.screenshot({
        path: `test-results/chaos-import-${seed}.png`,
      });
    }

    expect(errors).toEqual([]);
    await expect(errorOverlay).not.toBeVisible();
  });

  test('general import page chaos - seed 99999', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/import');
    await page.waitForLoadState('networkidle');

    const seed = 99999;

    const result = await performRandomActions(page, {
      actions: 30,
      seed,
      excludeSelectors: [
        'button:has-text("Confirm")',
        'button:has-text("Import")',
        'button:has-text("Delete")',
        'input[type="file"]', // Skip file inputs
      ],
    });

    console.log(`\n📋 Actions: ${result.actionsPerformed}, Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('Errors:', result.errors);
      await page.screenshot({
        path: `test-results/chaos-import-general-${seed}.png`,
      });
    }

    expect(result.errors).toEqual([]);
  });
});

test.describe('Custom CSV Format Management Chaos @chaos', () => {
  test('tools formats panel chaos - seed 11111', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/tools');
    await page.waitForLoadState('networkidle');

    // Click on Formats tab/section if available
    const formatsTab = page.locator('button, a').filter({ hasText: /format/i }).first();
    if (await formatsTab.isVisible()) {
      await formatsTab.click();
      await page.waitForTimeout(500);
    }

    const seed = 11111;
    const rng = new SeededRandom(seed);
    const errors: string[] = [];

    page.on('pageerror', (err) => errors.push(err.message));

    console.log(`🐒 Tools/Formats chaos with seed: ${seed}`);

    const formatActions = [
      // Click Create/New format button
      async () => {
        const createBtn = page.locator('button').filter({ hasText: /create|new|add/i }).first();
        if (await createBtn.isVisible()) {
          await createBtn.click();
          return 'click create format';
        }
        return 'skip create';
      },

      // Click edit button on a format
      async () => {
        const editBtn = page.locator('button').filter({ hasText: /edit/i }).first();
        if (await editBtn.isVisible()) {
          await editBtn.click();
          return 'click edit format';
        }
        return 'skip edit';
      },

      // Click test button on a format
      async () => {
        const testBtn = page.locator('button').filter({ hasText: /test/i }).first();
        if (await testBtn.isVisible()) {
          await testBtn.click();
          return 'click test format';
        }
        return 'skip test';
      },

      // Cancel/back button
      async () => {
        const cancelBtn = page.locator('button').filter({ hasText: /cancel|back|close/i }).first();
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
          return 'click cancel';
        }
        return 'skip cancel';
      },

      // Fill name input
      async () => {
        const nameInput = page.locator('input').filter({ hasText: '' }).first();
        if (await nameInput.isVisible()) {
          await nameInput.fill(`Chaos Format ${rng.int(1, 999)}`);
          return 'fill name';
        }
        return 'skip name';
      },

      // Select column mapping dropdown
      async () => {
        const selects = page.locator('select');
        const count = await selects.count();
        if (count > 0) {
          const select = selects.nth(rng.int(0, count - 1));
          if (await select.isVisible()) {
            const options = await select.locator('option').all();
            if (options.length > 1) {
              const opt = rng.pick(options);
              const val = await opt.getAttribute('value');
              if (val !== null) {
                await select.selectOption(val);
                return `select mapping: ${val}`;
              }
            }
          }
        }
        return 'skip mapping';
      },

      // Toggle checkboxes
      async () => {
        const checkboxes = page.locator('input[type="checkbox"]:visible');
        const count = await checkboxes.count();
        if (count > 0) {
          const target = checkboxes.nth(rng.int(0, Math.min(count - 1, 5)));
          await target.scrollIntoViewIfNeeded();
          await target.click({ timeout: 5000 });
          return 'toggle checkbox';
        }
        return 'skip checkbox';
      },

      // Fill text inputs with random values
      async () => {
        const inputs = page.locator('input[type="text"]:visible');
        const count = await inputs.count();
        if (count > 0) {
          const input = inputs.nth(rng.int(0, count - 1));
          await input.fill(rng.string(rng.int(1, 15)));
          return 'fill random text';
        }
        return 'skip text fill';
      },

      // Press keyboard shortcuts
      async () => {
        const key = rng.pick(['Escape', 'Tab', 'Enter']);
        await page.keyboard.press(key);
        return `press ${key}`;
      },
    ];

    // Perform 30 random format management actions
    for (let i = 0; i < 30; i++) {
      const action = rng.pick(formatActions);
      try {
        const result = await action();
        console.log(`  ${i + 1}. ${result}`);
      } catch (e) {
        console.log(`  ${i + 1}. [FAILED] ${e}`);
      }

      await page.waitForTimeout(rng.int(100, 400));

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
        path: `test-results/chaos-formats-${seed}.png`,
      });
    }

    expect(errors).toEqual([]);
    await expect(errorOverlay).not.toBeVisible();
  });

  test('custom format mapper chaos - seed 22222', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/tools');
    await page.waitForLoadState('networkidle');

    const seed = 22222;
    const rng = new SeededRandom(seed);
    const errors: string[] = [];

    page.on('pageerror', (err) => errors.push(err.message));

    // Navigate to format creation
    const formatsTab = page.locator('button, a').filter({ hasText: /format/i }).first();
    if (await formatsTab.isVisible()) {
      await formatsTab.click();
      await page.waitForTimeout(300);
    }

    const createBtn = page.locator('button').filter({ hasText: /create|new|add/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
    }

    console.log(`🐒 Custom format mapper chaos with seed: ${seed}`);

    // Now chaos the mapper UI
    const result = await performRandomActions(page, {
      actions: 40,
      seed,
      excludeSelectors: [
        'button:has-text("Save")',
        'button:has-text("Delete")',
        'button:has-text("Confirm")',
        'input[type="file"]',
      ],
    });

    if (result.errors.length > 0) {
      console.log(`\n🔥 CRASH with seed: ${seed}`);
      console.log('Errors:', result.errors);
      await page.screenshot({
        path: `test-results/chaos-mapper-${seed}.png`,
      });
    }

    expect(result.errors).toEqual([]);
  });

  test('tools page general chaos - seed 33333', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/tools');
    await page.waitForLoadState('networkidle');

    const seed = 33333;
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    console.log(`🐒 Tools page general chaos with seed: ${seed}`);

    // Just use the general chaos helper - simpler and more reliable
    const result = await performRandomActions(page, {
      actions: 40,
      seed,
      excludeSelectors: [
        'button:has-text("Delete")',
        'button:has-text("Remove")',
        'button:has-text("Save")',
        'input[type="file"]',
      ],
    });

    errors.push(...result.errors);

    if (errors.length > 0) {
      console.log(`\n🔥 CRASH with seed: ${seed}`);
      console.log('Errors:', errors);
      await page.screenshot({
        path: `test-results/chaos-tools-${seed}.png`,
      });
    }

    expect(errors).toEqual([]);
  });
});

test.describe('Cross-page Navigation Chaos @chaos', () => {
  test('navigate between import-related pages - seed 44444', async ({ page }) => {
    test.setTimeout(180000); // 8 rounds with page navigations need more time in CI
    const seed = 44444;
    const rng = new SeededRandom(seed);
    const errors: string[] = [];

    page.on('pageerror', (err) => errors.push(err.message));

    const pages = ['/import', '/tools', '/transactions'];

    console.log(`🐒 Cross-page navigation chaos with seed: ${seed}`);

    for (let round = 0; round < 8; round++) {
      const targetPage = rng.pick(pages);
      console.log(`  Round ${round + 1}: navigate to ${targetPage}`);

      await page.goto(targetPage);
      await page.waitForLoadState('networkidle');

      // Brief chaos on each page
      const result = await performRandomActions(page, {
        actions: rng.int(5, 12),
        seed: seed + round,
        excludeSelectors: [
          'button:has-text("Delete")',
          'button:has-text("Purge")',
          'button:has-text("Confirm")',
          'button:has-text("Import")',
          'input[type="file"]',
        ],
      });

      if (result.errors.length > 0) {
        errors.push(...result.errors);
        console.log(`🔥 Crash on ${targetPage}`);
        break;
      }
    }

    if (errors.length > 0) {
      console.log(`\n🔥 CRASH with seed: ${seed}`);
      console.log('Errors:', errors);
      await page.screenshot({
        path: `test-results/chaos-crosspage-${seed}.png`,
      });
    }

    expect(errors).toEqual([]);
  });
});
