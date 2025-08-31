import { defineConfig } from '@playwright/test';
import { baseConfig } from './playwright.base';

export default defineConfig({
  ...baseConfig,
  testDir: '../tests',
  testMatch: ['uat/uat.spec.ts', 'e2e/visual.spec.ts'],
});
