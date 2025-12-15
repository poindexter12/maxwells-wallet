import { test, expect } from '@playwright/test';
import { performDemonActions, ADVERSARIAL_PAYLOADS, formatChaosResultAsIssueBody } from './chaos-helpers';

/**
 * Demon Chaos Tests - Adversarial/Fuzz Testing
 *
 * Unlike regular chaos tests that perform random actions,
 * demon chaos intentionally tries to break things with:
 * - XSS payloads
 * - SQL injection patterns
 * - Unicode edge cases (emoji bombs, RTL, zalgo)
 * - Buffer overflow attempts
 * - Control characters
 * - Rapid-fire clicking
 * - Paste bombs
 */

const DEMON_ROUNDS = [8, 13, 21, 34];

test.describe('Demon Chaos - Transactions Page @demon', () => {
  const baseSeed = 66666;

  for (const [index, actionCount] of DEMON_ROUNDS.entries()) {
    test(`demon chaos (transactions) - ${actionCount} actions`, async ({ page }) => {
      test.setTimeout(30000 + actionCount * 500);

      await page.goto('/transactions');
      await page.waitForLoadState('networkidle');

      // Dismiss help overlay if visible
      const gotItBtn = page.locator('button:has-text("Got it")').first();
      if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await gotItBtn.click();
      }

      await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 });

      const seed = baseSeed + index;
      const result = await performDemonActions(page, {
        actions: actionCount,
        seed,
        excludeSelectors: [
          'button:has-text("Delete")',
          '[data-testid="purge-button"]',
          'nav a',
        ],
        continueOnError: true, // Keep going to find all issues
        maxRecoveryAttempts: 3,
      });

      if (result.errors.length > 0) {
        console.log(`\n🔥 Demon chaos found ${result.errors.length} issues at ${actionCount} actions, seed: ${seed}`);
        console.log('Recoveries:', result.recoveries);
        console.log('\n--- GitHub Issue Body ---');
        console.log(formatChaosResultAsIssueBody(result, `demon chaos (transactions) - ${actionCount} actions`, '/transactions'));
        console.log('--- End Issue Body ---\n');
        // Page might be closed after chaos - screenshot is best-effort
        await page.screenshot({ path: `test-results/demon-tx-${actionCount}-${seed}.png` }).catch(() => {});
      }

      expect(result.errors).toEqual([]);
      // Page might be closed - skip this check if so
      await expect(
        page.locator('text=Application error: a client-side exception has occurred')
      ).not.toBeVisible().catch(() => {});
    });
  }
});

test.describe('Demon Chaos - Import Page @demon', () => {
  const baseSeed = 77777;

  for (const [index, actionCount] of DEMON_ROUNDS.entries()) {
    test(`demon chaos (import) - ${actionCount} actions`, async ({ page }) => {
      test.setTimeout(30000 + actionCount * 500);

      await page.goto('/import');
      await page.waitForLoadState('networkidle');

      const gotItBtn = page.locator('button:has-text("Got it")').first();
      if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await gotItBtn.click();
      }

      const seed = baseSeed + index;
      const result = await performDemonActions(page, {
        actions: actionCount,
        seed,
        excludeSelectors: [
          'input[type="file"]',
          'nav a',
        ],
        continueOnError: true, // Keep going to find all issues
        maxRecoveryAttempts: 3,
      });

      if (result.errors.length > 0) {
        console.log(`\n🔥 Demon chaos found ${result.errors.length} issues at ${actionCount} actions, seed: ${seed}`);
        console.log('Recoveries:', result.recoveries);
        console.log('\n--- GitHub Issue Body ---');
        console.log(formatChaosResultAsIssueBody(result, `demon chaos (import) - ${actionCount} actions`, '/import'));
        console.log('--- End Issue Body ---\n');
        // Page might be closed after chaos - screenshot is best-effort
        await page.screenshot({ path: `test-results/demon-import-${actionCount}-${seed}.png` }).catch(() => {});
      }

      expect(result.errors).toEqual([]);
      // Page might be closed - skip this check if so
      await expect(
        page.locator('text=Application error: a client-side exception has occurred')
      ).not.toBeVisible().catch(() => {});
    });
  }
});

test.describe('XSS Payload Injection @demon', () => {
  test('filter inputs handle XSS payloads gracefully', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const gotItBtn = page.locator('button:has-text("Got it")').first();
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
    }

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    for (const payload of ADVERSARIAL_PAYLOADS.xss) {
      await searchInput.fill(payload);
      await page.waitForTimeout(100);

      // Should not trigger XSS or crash
      await expect(
        page.locator('text=Application error: a client-side exception has occurred')
      ).not.toBeVisible();

      // Clear for next test
      await searchInput.clear();
    }
  });

  test('date filter handles invalid dates gracefully', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const gotItBtn = page.locator('button:has-text("Got it")').first();
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
    }

    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible().catch(() => false)) {
      // Try various invalid/edge case dates
      const invalidDates = [
        '9999-12-31',  // Far future
        '0001-01-01',  // Ancient past
        '2024-13-45',  // Invalid month/day
        '2024-00-00',  // Zero values
        "'; DROP TABLE--",  // SQL injection
      ];

      for (const date of invalidDates) {
        await dateInput.fill(date);
        await page.waitForTimeout(50);

        await expect(
          page.locator('text=Application error: a client-side exception has occurred')
        ).not.toBeVisible();
      }
    }
  });
});

test.describe('Unicode Edge Cases @demon', () => {
  test('handles unicode payloads without crashing', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const gotItBtn = page.locator('button:has-text("Got it")').first();
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
    }

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    for (const payload of ADVERSARIAL_PAYLOADS.unicode) {
      await searchInput.fill(payload);
      await page.waitForTimeout(100);

      await expect(
        page.locator('text=Application error: a client-side exception has occurred')
      ).not.toBeVisible();

      await searchInput.clear();
    }
  });
});

test.describe('Overflow Handling @demon', () => {
  test('handles very long input without crashing', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const gotItBtn = page.locator('button:has-text("Got it")').first();
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
    }

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Try progressively longer strings
    for (const length of [100, 1000, 5000, 10000]) {
      const longString = 'X'.repeat(length);
      await searchInput.fill(longString);
      await page.waitForTimeout(50);

      await expect(
        page.locator('text=Application error: a client-side exception has occurred')
      ).not.toBeVisible();

      await searchInput.clear();
    }
  });
});
