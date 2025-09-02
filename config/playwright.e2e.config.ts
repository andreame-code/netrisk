import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: { VITE_COMMIT_SHA: 'dev' },
  },
});
