const { defineConfig, devices } = require("@playwright/test");

const e2ePort = Number(process.env.E2E_PORT || process.env.PORT || 3100);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${e2ePort}`;

module.exports = defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 960 }
  },
  webServer: {
    command: "node scripts/start-e2e.cjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      PORT: String(e2ePort),
      E2E_PORT: String(e2ePort),
      E2E_BASE_URL: baseURL
    }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});


