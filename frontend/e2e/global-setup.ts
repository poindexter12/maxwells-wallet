/**
 * Global setup for E2E tests.
 * Creates a test user and logs in, saving the auth state for all tests.
 */
import { chromium, type FullConfig } from '@playwright/test';

const TEST_USER = {
  username: 'testuser',
  password: 'testpass123',
};

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';
  const backendURL = 'http://localhost:3001';

  // Check auth status
  const statusRes = await fetch(`${backendURL}/api/v1/auth/status`);
  const status = await statusRes.json();

  if (!status.initialized) {
    // First run - create the test user via setup endpoint
    const setupRes = await fetch(`${backendURL}/api/v1/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });

    if (!setupRes.ok) {
      throw new Error(`Failed to create test user: ${await setupRes.text()}`);
    }

    console.log('Created test user for E2E tests');
  }

  // Login and save storage state
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to login
  await page.goto(`${baseURL}/login`);

  // Fill login form
  await page.fill('[data-testid="login-username"]', TEST_USER.username);
  await page.fill('[data-testid="login-password"]', TEST_USER.password);
  await page.click('[data-testid="login-submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('/', { timeout: 10000 });

  // Save storage state (includes cookies and localStorage with JWT)
  await context.storageState({ path: './e2e/.auth/user.json' });

  await browser.close();

  console.log('E2E auth setup complete');
}

export default globalSetup;
