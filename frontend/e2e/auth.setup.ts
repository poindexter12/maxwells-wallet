/**
 * Authentication setup for E2E tests.
 * This runs before all test projects and saves the authenticated state.
 *
 * Uses API-based authentication to avoid UI dependencies, then creates
 * a storage state file that includes the auth token in localStorage.
 */
import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_USER = {
  username: 'testuser',
  password: 'testpass123',
};

const authFile = 'e2e/.auth/user.json';
const authDir = 'e2e/.auth';

setup('authenticate', async ({ page, request, context }) => {
  // Ensure auth directory exists
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

  // Create a minimal HTML page to set localStorage without loading the app
  console.log('Setting localStorage via about:blank...');

  // Navigate to about:blank first (has no content to load)
  await page.goto('about:blank');

  // We can't set localStorage on about:blank, so use a data: URL
  // Actually, let's navigate to the app but intercept and stub responses
  // to make it load instantly

  // Simpler approach: navigate to a non-existent path to get the app domain,
  // then set localStorage before the app fully loads
  console.log('Navigating to app domain...');

  // Use a simple endpoint that loads quickly
  await page.goto('http://localhost:3000/', { waitUntil: 'commit' });

  // Set localStorage immediately (before JS executes)
  await page.evaluate((authToken) => {
    localStorage.setItem('auth_token', authToken);
  }, token);

  console.log('Token set in localStorage, reloading...');

  // Now reload to let the app pick up the token
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Give the app time to hydrate and check auth
  console.log('Waiting for app to authenticate...');

  // Wait for dashboard-selector or check URL
  const maxWait = 45000;
  const startTime = Date.now();
  let authenticated = false;

  while (Date.now() - startTime < maxWait && !authenticated) {
    const url = page.url();
    console.log(`Current URL: ${url}`);

    // Check if we're on the dashboard
    if (!url.includes('/login') && !url.includes('/setup')) {
      // Try to find the dashboard selector
      const dashboardSelector = page.locator('[data-testid="dashboard-selector"]');
      const isVisible = await dashboardSelector.isVisible().catch(() => false);
      if (isVisible) {
        authenticated = true;
        console.log('Dashboard is visible - authentication successful!');
        break;
      }
    }

    // Wait a bit before checking again
    await page.waitForTimeout(1000);
  }

  if (!authenticated) {
    // Take screenshot for debugging
    console.log('Authentication failed, taking screenshot...');
    await page.screenshot({ path: path.join(authDir, 'auth-failed.png') }).catch(() => {});

    const url = page.url();
    const content = await page.content().catch(() => 'Failed to get content');
    console.error('Final URL:', url);
    console.error('Page content (first 2000 chars):', content.substring(0, 2000));

    throw new Error(`Dashboard did not appear after ${maxWait}ms. Final URL: ${url}`);
  }

  // Save storage state
  await context.storageState({ path: authFile });
  console.log('Auth setup complete - storage state saved to', authFile);
});
