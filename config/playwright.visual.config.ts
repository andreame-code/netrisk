import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../tests/visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
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
