/**
 * Authentication setup for E2E tests.
 * This runs before all test projects and saves the authenticated state.
 *
 * Uses API-based authentication to avoid UI dependencies, then injects
 * the token into localStorage before saving the storage state.
 */
import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';

const TEST_USER = {
  username: 'testuser',
  password: 'testpass123',
};

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page, request }) => {
  // Ensure auth directory exists
  const authDir = 'e2e/.auth';
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  console.log('Checking backend auth status...');

  // Check if user needs to be created
  const statusRes = await request.get('http://localhost:3001/api/v1/auth/status');
  const status = await statusRes.json();
  console.log('Backend auth status:', JSON.stringify(status));

  let token: string;

  if (!status.initialized) {
    // Create test user via API
    console.log('Creating test user...');
    const setupRes = await request.post('http://localhost:3001/api/v1/auth/setup', {
      data: TEST_USER,
    });

    if (!setupRes.ok()) {
      const body = await setupRes.text();
      throw new Error(`Failed to create user: ${setupRes.status()} ${body}`);
    }

    const setupData = await setupRes.json();
    token = setupData.token;
    console.log('User created, got token');
  } else {
    // User exists, login to get token
    console.log('User exists, logging in...');
    const loginRes = await request.post('http://localhost:3001/api/v1/auth/login', {
      data: TEST_USER,
    });

    if (!loginRes.ok()) {
      const body = await loginRes.text();
      throw new Error(`Failed to login: ${loginRes.status()} ${body}`);
    }

    const loginData = await loginRes.json();
    token = loginData.token;
    console.log('Logged in, got token');
  }

  // Navigate to the app root to establish a browser context
  console.log('Navigating to app to set localStorage...');
  await page.goto('/');

  // Wait a moment for the page to start loading
  await page.waitForTimeout(1000);

  // Inject the auth token into localStorage
  console.log('Injecting auth token into localStorage...');
  await page.evaluate((authToken) => {
    localStorage.setItem('auth_token', authToken);
  }, token);

  // Reload the page so the app picks up the token
  console.log('Reloading page with token...');
  await page.reload();

  // Wait for the dashboard to appear (proving we're authenticated)
  console.log('Waiting for dashboard...');
  try {
    await expect(page.locator('[data-testid="dashboard-selector"]')).toBeVisible({
      timeout: 30000,
    });
    console.log('Dashboard is visible - authentication successful!');
  } catch (error) {
    // Take screenshot for debugging
    await page.screenshot({ path: `${authDir}/auth-failed.png` });
    const content = await page.content();
    console.error('Page URL:', page.url());
    console.error('Page content (first 3000 chars):', content.substring(0, 3000));
    throw new Error('Dashboard did not appear after setting auth token');
  }

  // Save storage state
  await page.context().storageState({ path: authFile });
  console.log('Auth setup complete - storage state saved to', authFile);
});
