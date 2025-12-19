/**
 * Auth redirect E2E tests.
 *
 * Tests the server-side middleware redirect behavior for:
 * - Fresh install (no users) → redirects to /setup
 * - Unauthenticated user → redirects to /login
 * - Authenticated user on auth pages → redirects to /
 *
 * These tests verify the fix for the "Redirecting..." hang issue
 * where fresh installs would show a loading state instead of
 * immediately redirecting to /setup.
 */
import { test, expect } from '@playwright/test';

const BACKEND_URL = 'http://localhost:3001';

const TEST_USER = {
  username: 'testuser',
  password: 'testpass123',
};

/**
 * Reset to fresh install state by deleting all users.
 */
async function resetToFreshInstall(request: typeof test extends (fn: infer F) => void ? Parameters<F>[0]['request'] : never) {
  const res = await request.delete(`${BACKEND_URL}/api/v1/auth/test-reset?confirm=RESET_USERS`);
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Failed to reset users: ${res.status()} ${body}`);
  }
}

/**
 * Create a test user via API.
 */
async function setupTestUser(request: typeof test extends (fn: infer F) => void ? Parameters<F>[0]['request'] : never) {
  const statusRes = await request.get(`${BACKEND_URL}/api/v1/auth/status`);
  const status = await statusRes.json();

  if (!status.initialized) {
    const setupRes = await request.post(`${BACKEND_URL}/api/v1/auth/setup`, {
      data: TEST_USER,
    });
    if (!setupRes.ok()) {
      const body = await setupRes.text();
      throw new Error(`Failed to create user: ${setupRes.status()} ${body}`);
    }
  }
}

test.describe('Fresh Install Redirects', () => {
  test.beforeEach(async ({ request }) => {
    // Reset to fresh install state before each test
    await resetToFreshInstall(request);
  });

  test.afterEach(async ({ request }) => {
    // Restore test user for other tests
    await setupTestUser(request);
  });

  test('fresh database redirects root to /setup immediately', async ({ page }) => {
    const startTime = Date.now();

    // Navigate to root
    await page.goto('/');

    // Should end up on /setup within 5 seconds (middleware redirect)
    await expect(page).toHaveURL(/\/setup/, { timeout: 5000 });

    // Verify the setup form is visible
    await expect(page.locator('[data-testid="setup-username"]')).toBeVisible({ timeout: 3000 });

    const elapsed = Date.now() - startTime;
    // Should complete quickly - middleware redirects server-side
    expect(elapsed).toBeLessThan(5000);
  });

  test('fresh database redirects /login to /setup', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Should redirect to /setup since no users exist
    await expect(page).toHaveURL(/\/setup/, { timeout: 5000 });

    // Verify setup form is visible
    await expect(page.locator('[data-testid="setup-username"]')).toBeVisible({ timeout: 3000 });
  });

  test('fresh database does not hang on Redirecting state', async ({ page }) => {
    // This test specifically targets the bug where fresh installs
    // would show "Redirecting..." indefinitely

    await page.goto('/');

    // The "Redirecting..." text might appear briefly, but should disappear quickly
    // Give a short window for the redirect to happen
    const redirectingLocator = page.getByText('Redirecting...');

    // Wait a moment for the page to settle
    await page.waitForTimeout(500);

    // Either we're already on /setup, or "Redirecting..." should not be visible
    const url = page.url();
    if (!url.includes('/setup')) {
      // If not on setup yet, "Redirecting..." should disappear soon
      await expect(redirectingLocator).not.toBeVisible({ timeout: 3000 });
    }

    // Final check: should be on /setup
    await expect(page).toHaveURL(/\/setup/, { timeout: 5000 });
  });

  test('setup flow creates user and redirects to dashboard', async ({ page }) => {
    // Navigate to setup
    await page.goto('/setup');
    await expect(page.locator('[data-testid="setup-username"]')).toBeVisible();

    // Fill in the setup form
    await page.locator('[data-testid="setup-username"]').fill(TEST_USER.username);
    await page.locator('[data-testid="setup-password"]').fill(TEST_USER.password);
    await page.locator('[data-testid="setup-confirm-password"]').fill(TEST_USER.password);

    // Submit
    await page.locator('[data-testid="setup-submit"]').click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/^\/$|\/dashboard/, { timeout: 10000 });

    // Dashboard should be visible
    await expect(page.locator('[data-testid="dashboard-selector"]')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Authenticated User Redirects', () => {
  // Use the authenticated storage state for these tests
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('authenticated user on /login redirects to /', async ({ page }) => {
    // Navigate to login while authenticated
    await page.goto('/login');

    // Should redirect to home/dashboard
    await expect(page).toHaveURL(/^\/$/, { timeout: 5000 });
  });

  test('authenticated user on /setup redirects to /', async ({ page }) => {
    // Navigate to setup while authenticated
    await page.goto('/setup');

    // Should redirect to home/dashboard
    await expect(page).toHaveURL(/^\/$/, { timeout: 5000 });
  });
});

test.describe('Unauthenticated User Redirects', () => {
  test.beforeEach(async ({ request }) => {
    // Ensure user exists but we're not authenticated
    await setupTestUser(request);
  });

  test('unauthenticated user on protected route redirects to /login', async ({ page }) => {
    // Clear any auth state by using a fresh context
    await page.context().clearCookies();

    // Navigate to a protected route
    await page.goto('/transactions');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
