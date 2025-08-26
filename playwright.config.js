const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npx http-server . -p 3000',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
