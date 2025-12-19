/**
 * Authentication setup for E2E tests.
 * This runs before all test projects and saves the authenticated state.
 */
import { test as setup, expect } from '@playwright/test';

const TEST_USER = {
  username: 'testuser',
  password: 'testpass123',
};

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page, request }) => {
  // Check if user needs to be created
  const statusRes = await request.get('http://localhost:3001/api/v1/auth/status');
  const status = await statusRes.json();

  if (!status.initialized) {
    // Create test user via API
    const setupRes = await request.post('http://localhost:3001/api/v1/auth/setup', {
      data: TEST_USER,
    });
    expect(setupRes.ok()).toBeTruthy();
    console.log('Created test user');
  }

  // Navigate to login page
  await page.goto('/login');

  // Fill and submit login form
  await page.fill('[data-testid="login-username"]', TEST_USER.username);
  await page.fill('[data-testid="login-password"]', TEST_USER.password);
  await page.click('[data-testid="login-submit"]');

  // Wait for successful redirect to dashboard
  await page.waitForURL('/', { timeout: 15000 });

  // Verify we're authenticated by checking for a dashboard element
  await expect(page.locator('[data-testid="dashboard-selector"]')).toBeVisible({ timeout: 10000 });

  // Save storage state
  await page.context().storageState({ path: authFile });
  console.log('Auth setup complete');
});
