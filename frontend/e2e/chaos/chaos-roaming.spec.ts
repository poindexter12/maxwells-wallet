import { test, expect } from '@playwright/test';
import { performRandomActions } from './chaos-helpers';

/**
 * Roaming Chaos Tests
 *
 * These tests navigate randomly across the entire application,
 * clicking links, buttons, and interacting with whatever is visible.
 * No navigation exclusions - let the chaos monkey roam free.
 */

// Fibonacci sequence for roaming tests
const FIBONACCI_ROUNDS = [13, 21, 34, 55, 89];

test.describe('Application-Wide Roaming Chaos @chaos', () => {
  const baseSeed = 99999;

  for (const [index, actionCount] of FIBONACCI_ROUNDS.entries()) {
    test(`roaming chaos - ${actionCount} actions`, async ({ page }) => {
      // Roaming tests need more time due to page navigations
      test.setTimeout(60000 + actionCount * 1500);

      // Start from dashboard
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const seed = baseSeed + index;
      const errors: string[] = [];
      const pagesVisited = new Set<string>();

      // Filter out WebKit-specific CORS warnings that aren't actual app errors
      page.on('pageerror', (err) => {
        const msg = err.message;
        if (msg.includes('due to access control checks') ||
            msg.includes('__nextjs_original-stack-frames')) {
          return;
        }
        errors.push(msg);
      });

      console.log(`\n🐒 Roaming chaos starting with seed: ${seed}`);

      // Perform actions allowing navigation
      const result = await performRandomActions(page, {
        actions: actionCount,
        seed,
        minDelay: 50,
        maxDelay: 150,
        excludeSelectors: [
          // Only exclude truly destructive actions
          '[data-testid="purge-button"]',
          'button:has-text("Delete")',
          'button:has-text("Purge")',
          'button:has-text("Remove")',
          'button:has-text("Confirm")', // Don't confirm destructive dialogs
          'input[type="file"]',
          // Allow navigation - no 'nav a' exclusion!
        ],
        onAction: (_action, _i) => {
          const url = page.url();
          const path = new URL(url).pathname;
          if (!pagesVisited.has(path)) {
            pagesVisited.add(path);
            console.log(`  📍 Visited: ${path}`);
          }
        },
      });

      errors.push(...result.errors);

      console.log(`\n📊 Roaming summary:`);
      console.log(`  Actions: ${result.actionsPerformed}`);
      console.log(`  Pages visited: ${Array.from(pagesVisited).join(', ')}`);
      console.log(`  Errors: ${errors.length}`);

      if (errors.length > 0) {
        console.log(`\n🔥 Crash during roaming, seed: ${seed}`);
        console.log('Errors:', errors);
        await page.screenshot({ path: `test-results/chaos-roaming-${actionCount}-${seed}.png` });
      }

      expect(errors).toEqual([]);
      await expect(
        page.locator('text=Application error: a client-side exception has occurred')
      ).not.toBeVisible();
    });
  }
});

// Smaller Fibonacci for journey tests (multiplied by 6 pages)
const JOURNEY_FIBONACCI = [8, 13, 21, 34];

test.describe('Multi-Page Journey Chaos - Fibonacci @chaos', () => {
  // Run journey tests serially to avoid browser resource exhaustion
  test.describe.configure({ mode: 'serial' });

  const baseSeed = 77777;

  // Define a journey through the app
  const pages = [
    { path: '/', name: 'Dashboard', waitFor: '[data-testid="dashboard-selector"]' },
    { path: '/transactions', name: 'Transactions', waitFor: 'input[placeholder*="Search"]' },
    { path: '/import', name: 'Import', waitFor: 'text=Import Transactions' },
    { path: '/tools', name: 'Tools', waitFor: 'text=Tools' },
    { path: '/admin', name: 'Admin', waitFor: 'text=Admin' },
    { path: '/budgets', name: 'Budgets', waitFor: 'text=Budget' },
  ];

  for (const [index, actionsPerPage] of JOURNEY_FIBONACCI.entries()) {
    test(`multi-page journey - ${actionsPerPage} actions per page`, async ({ page }) => {
      // Total actions = actionsPerPage * pages.length
      const totalActions = actionsPerPage * pages.length;
      test.setTimeout(60000 + totalActions * 500);

      const seed = baseSeed + index;
      const errors: string[] = [];

      // Filter out WebKit-specific CORS warnings that aren't actual app errors
      page.on('pageerror', (err) => {
        const msg = err.message;
        if (msg.includes('due to access control checks') ||
            msg.includes('__nextjs_original-stack-frames')) {
          return;
        }
        errors.push(msg);
      });

      console.log(`\n🚀 Journey: ${actionsPerPage} actions × ${pages.length} pages = ${totalActions} total`);

      for (const [pageIndex, pageConfig] of pages.entries()) {
        await page.goto(pageConfig.path);
        await page.waitForLoadState('networkidle');

        // Dismiss help overlay if visible
        const gotItBtn = page.locator('button:has-text("Got it")').first();
        if (await gotItBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await gotItBtn.click();
        }

        // Wait for page-specific element
        try {
          await page.waitForSelector(pageConfig.waitFor, { timeout: 10000 });
        } catch {
          // Continue anyway
        }

        const result = await performRandomActions(page, {
          actions: actionsPerPage,
          seed: seed + pageIndex,
          minDelay: 25,
          maxDelay: 75,
          excludeSelectors: [
            '[data-testid="purge-button"]',
            'button:has-text("Delete")',
            'button:has-text("Purge")',
            'button:has-text("Remove")',
            'input[type="file"]',
            'nav a', // Stay on current page
          ],
        });

        if (result.errors.length > 0) {
          errors.push(...result.errors);
          await page.screenshot({
            path: `test-results/chaos-journey-${actionsPerPage}-${pageConfig.name.toLowerCase()}-${seed}.png`,
          });
          break;
        }
      }

      if (errors.length > 0) {
        console.log(`\n🔥 Journey failed at ${actionsPerPage} actions/page`);
      }

      expect(errors).toEqual([]);
      await expect(
        page.locator('text=Application error: a client-side exception has occurred')
      ).not.toBeVisible();
    });
  }
});
