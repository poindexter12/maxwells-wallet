/**
 * Global setup for E2E tests.
 * Creates a test user and saves auth state for all tests.
 */
import { type FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_USER = {
  username: 'testuser',
  password: 'testpass123',
};

const TOKEN_KEY = 'maxwells-wallet-token';

async function globalSetup(config: FullConfig) {
  const backendURL = 'http://localhost:3001';

  // Check auth status
  const statusRes = await fetch(`${backendURL}/api/v1/auth/status`);
  const status = await statusRes.json();

  let token: string;

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

    const setupData = await setupRes.json();
    token = setupData.token;
    console.log('Created test user for E2E tests');
  } else {
    // User exists - login to get token
    const loginRes = await fetch(`${backendURL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });

    if (!loginRes.ok) {
      throw new Error(`Failed to login test user: ${await loginRes.text()}`);
    }

    const loginData = await loginRes.json();
    token = loginData.token;
    console.log('Logged in test user for E2E tests');
  }

  // Create storage state file with the token in localStorage
  const authDir = path.join(__dirname, '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:3000',
        localStorage: [
          {
            name: TOKEN_KEY,
            value: token,
          },
        ],
      },
    ],
  };

  fs.writeFileSync(
    path.join(authDir, 'user.json'),
    JSON.stringify(storageState, null, 2)
  );

  console.log('E2E auth setup complete');
}

export default globalSetup;
