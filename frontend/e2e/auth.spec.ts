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
  // DON'T use any storage state - we want completely fresh browser
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ request, page }) => {
    // Reset to fresh install state before each test
    await resetToFreshInstall(request);

    // Clear any browser storage that might have tokens
    // This is critical because auth.setup.ts may have stored tokens
    await page.context().clearCookies();
  });

  test.afterEach(async ({ request }) => {
    // Restore test user for other tests
    await setupTestUser(request);
  });

  test('fresh database redirects root to /setup immediately', async ({ page }) => {
    // Enable console logging for debugging
    page.on('console', msg => console.log(`[BROWSER ${msg.type()}]: ${msg.text()}`));

    // Verify backend is in fresh state
    const statusRes = await page.request.get(`${BACKEND_URL}/api/v1/auth/status`);
    const status = await statusRes.json();
    console.log('[TEST] Backend auth status:', status);
    expect(status.initialized).toBe(false);

    const startTime = Date.now();

    // Navigate to root - middleware should redirect to /setup
    const response = await page.goto('/');
    console.log('[TEST] Initial response status:', response?.status());
    console.log('[TEST] Current URL after goto:', page.url());

    // Should end up on /setup within 5 seconds (middleware redirect)
    await expect(page).toHaveURL(/\/setup/, { timeout: 5000 });
    console.log('[TEST] URL after waiting:', page.url());

    // Verify the setup form is visible (not "Redirecting..." or "Loading...")
    await expect(page.locator('[data-testid="setup-username"]')).toBeVisible({ timeout: 5000 });
    console.log('[TEST] Setup form is visible');

    const elapsed = Date.now() - startTime;
    console.log('[TEST] Total elapsed time:', elapsed, 'ms');
    // Should complete quickly - middleware redirects server-side
    expect(elapsed).toBeLessThan(5000);
  });

  test('fresh database shows setup form when navigating directly to /setup', async ({ page }) => {
    // Enable console logging for debugging
    page.on('console', msg => console.log(`[BROWSER ${msg.type()}]: ${msg.text()}`));

    // This tests the EXACT user scenario: fresh install, navigate to /setup
    // Should show the setup form, NOT "Redirecting..." or "Loading..."

    // Verify backend is in fresh state
    const statusRes = await page.request.get(`${BACKEND_URL}/api/v1/auth/status`);
    const status = await statusRes.json();
    console.log('[TEST] Backend auth status:', status);
    expect(status.initialized).toBe(false);

    // Navigate directly to /setup
    await page.goto('/setup');
    console.log('[TEST] URL after goto:', page.url());

    // Wait for page to settle
    await page.waitForLoadState('networkidle');
    console.log('[TEST] Page content:', await page.content());

    // Should NOT see "Redirecting..." text
    const redirectingLocator = page.getByText('Redirecting...');
    await expect(redirectingLocator).not.toBeVisible({ timeout: 1000 });

    // Should NOT see "Loading..." text for extended time
    const loadingLocator = page.getByText('Loading...');
    // Brief loading is okay, but shouldn't persist
    await page.waitForTimeout(1000);
    const loadingVisible = await loadingLocator.isVisible();
    if (loadingVisible) {
      // If still loading after 1 second, wait a bit more
      await expect(loadingLocator).not.toBeVisible({ timeout: 3000 });
    }

    // Setup form MUST be visible
    await expect(page.locator('[data-testid="setup-username"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="setup-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="setup-confirm-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="setup-submit"]')).toBeVisible();
    console.log('[TEST] Setup form elements are visible');
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

    // Should redirect to dashboard (match full URL ending with / or containing /dashboard)
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/?$|\/dashboard/, { timeout: 10000 });

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

    // Should redirect to home/dashboard (match full URL ending with /)
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/, { timeout: 5000 });
  });

  test('authenticated user on /setup redirects to /', async ({ page }) => {
    // Navigate to setup while authenticated
    await page.goto('/setup');

    // Should redirect to home/dashboard (match full URL ending with /)
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/, { timeout: 5000 });
  });
});

test.describe('Unauthenticated User Redirects', () => {
  // Use empty storage state to ensure no auth token
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ request }) => {
    // Ensure user exists but we're not authenticated
    await setupTestUser(request);
  });

  test('unauthenticated user on protected route redirects to /login', async ({ page }) => {
    // Clear any auth state (cookies + localStorage)
    await page.context().clearCookies();

    // Navigate to a protected route
    await page.goto('/transactions');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
