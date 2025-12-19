import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests.
 *
 * Tests run against the full stack:
 * - Frontend: Next.js on port 3000
 * - Backend: FastAPI on port 3001
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    /* Setup project - runs first to authenticate */
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      timeout: 60000, // Give more time for auth setup
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  /* Run local dev servers before starting tests */
  webServer: [
    {
      command: 'cd ../backend && uv run uvicorn app.main:app --port 3001',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        DATABASE_URL: 'sqlite+aiosqlite:///./data/wallet.db',
        // Skip migrations - schema already created by init_db.py
        // In CI: always skip. Locally: skip if SKIP_MIGRATIONS is set
        SKIP_MIGRATIONS: process.env.CI || process.env.SKIP_MIGRATIONS ? '1' : '',
      },
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        BACKEND_URL: 'http://localhost:3001',
      },
    },
  ],
});
