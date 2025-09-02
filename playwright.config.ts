import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;
const STORAGE_STATE = 'playwright/.auth/user.json';

export default defineConfig({
  testDir: './tests/e2e',
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: BASE_URL,
    storageState: existsSync(STORAGE_STATE) ? STORAGE_STATE : undefined,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'dummy-key',
      VITE_COMMIT_SHA: 'dev',
    },
  },
});
