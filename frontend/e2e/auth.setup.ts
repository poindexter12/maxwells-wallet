/**
 * Authentication setup for E2E tests.
 * This runs before all test projects and saves the authenticated state.
 *
 * The test handles both scenarios:
 * 1. Fresh database - no user exists → redirects to /setup
 * 2. User exists → shows /login
 */
import { test as setup, expect } from '@playwright/test';

const TEST_USER = {
  username: 'testuser',
  password: 'testpass123',
};

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page, request }) => {
  // Capture browser console logs
  page.on('console', (msg) => {
    console.log(`Browser [${msg.type()}]: ${msg.text()}`);
  });

  page.on('pageerror', (error) => {
    console.error('Browser page error:', error.message);
  });

  // First, verify the backend is running by checking the auth status API directly
  console.log('Checking backend auth status...');
  try {
    const statusRes = await request.get('http://localhost:3001/api/v1/auth/status');
    const status = await statusRes.json();
    console.log('Backend auth status:', JSON.stringify(status));
  } catch (error) {
    console.error('Failed to reach backend:', error);
    throw new Error('Backend is not reachable at http://localhost:3001');
  }

  // Navigate to app root - it will redirect to /setup or /login
  console.log('Navigating to app root...');
  await page.goto('/');

  // Wait for either setup or login page to load
  console.log('Waiting for redirect to /setup or /login...');
  await page.waitForURL(/\/(setup|login)/, { timeout: 30000 });

  const currentUrl = page.url();
  console.log(`Landed on: ${currentUrl}`);

  // Take a screenshot to help debug
  await page.screenshot({ path: 'e2e/.auth/initial-page.png' });

  // Wait for loading to complete - look for the main content to be visible
  // Both setup and login pages have a form inside a card with the same structure
  console.log('Waiting for page to finish loading...');

  if (currentUrl.includes('/setup')) {
    // No user exists - create one via setup form
    console.log('No user exists, waiting for setup form...');

    // Wait for the loading state to clear (form becomes visible)
    // The setup page shows loading when: loading || isAuthenticated || isInitialized
    // We need to wait for the form to appear
    try {
      await page.waitForSelector('[data-testid="setup-username"]', {
        state: 'visible',
        timeout: 30000,
      });
    } catch {
      // Take screenshot and dump page content for debugging
      await page.screenshot({ path: 'e2e/.auth/setup-form-timeout.png' });
      const content = await page.content();
      console.error('Page content:', content.substring(0, 2000));
      throw new Error('Setup form did not become visible');
    }

    console.log('Setup form is visible, filling fields...');
    await page.fill('[data-testid="setup-username"]', TEST_USER.username);
    await page.fill('[data-testid="setup-password"]', TEST_USER.password);
    await page.fill('[data-testid="setup-confirm-password"]', TEST_USER.password);

    await page.screenshot({ path: 'e2e/.auth/setup-filled.png' });

    console.log('Submitting setup form...');
    await page.click('[data-testid="setup-submit"]');
  } else if (currentUrl.includes('/login')) {
    // User exists - log in
    console.log('User exists, waiting for login form...');

    try {
      await page.waitForSelector('[data-testid="login-username"]', {
        state: 'visible',
        timeout: 30000,
      });
    } catch {
      await page.screenshot({ path: 'e2e/.auth/login-form-timeout.png' });
      const content = await page.content();
      console.error('Page content:', content.substring(0, 2000));
      throw new Error('Login form did not become visible');
    }

    console.log('Login form is visible, filling fields...');
    await page.fill('[data-testid="login-username"]', TEST_USER.username);
    await page.fill('[data-testid="login-password"]', TEST_USER.password);

    await page.screenshot({ path: 'e2e/.auth/login-filled.png' });

    console.log('Submitting login form...');
    await page.click('[data-testid="login-submit"]');
  }

  // Wait for successful redirect to dashboard
  console.log('Waiting for redirect to dashboard...');
  await page.waitForURL('/', { timeout: 30000 });

  // Verify we're authenticated by checking for a dashboard element
  console.log('Verifying dashboard is visible...');
  await expect(page.locator('[data-testid="dashboard-selector"]')).toBeVisible({
    timeout: 15000,
  });

  await page.screenshot({ path: 'e2e/.auth/dashboard.png' });

  // Save storage state
  await page.context().storageState({ path: authFile });
  console.log('Auth setup complete - storage state saved');
});
