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
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
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
        // Skip migrations in CI - schema already created by init_db.py
        SKIP_MIGRATIONS: process.env.CI ? '1' : '',
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
