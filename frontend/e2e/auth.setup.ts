/**
 * Authentication setup for E2E tests.
 * This runs before all test projects and saves the authenticated state.
 *
 * The test handles both scenarios:
 * 1. Fresh database - no user exists → redirects to /setup
 * 2. User exists - → shows /login
 */
import { test as setup, expect } from '@playwright/test';

const TEST_USER = {
  username: 'testuser',
  password: 'testpass123',
};

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to app root - it will redirect to /setup or /login
  await page.goto('/');

  // Wait for either setup or login page to load
  // The app redirects unauthenticated users to /setup (if no user) or /login (if user exists)
  await page.waitForURL(/\/(setup|login)/, { timeout: 30000 });

  const currentUrl = page.url();
  console.log(`Auth setup: landed on ${currentUrl}`);

  if (currentUrl.includes('/setup')) {
    // No user exists - create one via setup form
    console.log('No user exists, filling setup form...');

    await page.waitForSelector('[data-testid="setup-username"]', { timeout: 15000 });

    await page.fill('[data-testid="setup-username"]', TEST_USER.username);
    await page.fill('[data-testid="setup-password"]', TEST_USER.password);
    await page.fill('[data-testid="setup-confirm-password"]', TEST_USER.password);
    await page.click('[data-testid="setup-submit"]');

    console.log('Setup form submitted, waiting for redirect...');
  } else if (currentUrl.includes('/login')) {
    // User exists - log in
    console.log('User exists, filling login form...');

    await page.waitForSelector('[data-testid="login-username"]', { timeout: 15000 });

    await page.fill('[data-testid="login-username"]', TEST_USER.username);
    await page.fill('[data-testid="login-password"]', TEST_USER.password);
    await page.click('[data-testid="login-submit"]');

    console.log('Login form submitted, waiting for redirect...');
  }

  // Wait for successful redirect to dashboard
  await page.waitForURL('/', { timeout: 30000 });

  // Verify we're authenticated by checking for a dashboard element
  await expect(page.locator('[data-testid="dashboard-selector"]')).toBeVisible({ timeout: 15000 });

  // Save storage state
  await page.context().storageState({ path: authFile });
  console.log('Auth setup complete - storage state saved');
});
