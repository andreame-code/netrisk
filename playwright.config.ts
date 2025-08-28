import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/uat',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run build && cp -r src dist/src && npx http-server dist -p 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
