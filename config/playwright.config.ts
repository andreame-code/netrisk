import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../tests/uat',
  use: {
    baseURL: 'http://localhost:8080',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: { VITE_COMMIT_SHA: 'dev' },
  },
});
