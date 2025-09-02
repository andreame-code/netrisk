import { defineConfig } from '@playwright/test';
import { baseConfig } from './playwright.base';

export default defineConfig({
  ...baseConfig,
  testDir: '../tests/e2e',
  testMatch: /smoke\.spec\.ts/,
});
