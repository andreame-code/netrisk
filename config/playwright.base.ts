import { defineConfig } from '@playwright/test';

export const baseConfig = defineConfig({
  use: {
    baseURL: 'http://localhost:8080',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'dummy-key',
      VITE_COMMIT_SHA: 'dev',
    },
  },
});
