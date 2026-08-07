import { defineConfig, devices } from "@playwright/test";

const e2ePort = Number(process.env.E2E_PORT || process.env.PORT || 3100);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${e2ePort}`;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "true";
const includeHtmlReport = process.env.CI || process.env.PLAYWRIGHT_HTML_REPORT === "true";
const mobileTestMatch = /[\\/]mobile[\\/].*\.spec\.ts$/;

function mobileDeviceUse(deviceName: "Pixel 5" | "iPhone 13", width: number, height: number) {
  return {
    ...devices[deviceName],
    screen: { width, height },
    trace: "retain-on-failure" as const,
    viewport: { width, height }
  };
}

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  preserveOutput: "failures-only",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: includeHtmlReport ? [["list"], ["html", { open: "never" }]] : [["list"]],
  reportSlowTests: {
    max: 10,
    threshold: 30000
  },
  use: {
    baseURL,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: process.env.CI ? "retain-on-failure" : "off",
    viewport: { width: 1440, height: 960 }
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: "node .tsbuild/scripts/start-e2e.cjs",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
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
      testIgnore: mobileTestMatch,
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-chromium-360",
      testMatch: mobileTestMatch,
      use: mobileDeviceUse("Pixel 5", 360, 780)
    },
    {
      name: "mobile-chromium-390",
      testMatch: mobileTestMatch,
      use: mobileDeviceUse("Pixel 5", 390, 844)
    },
    {
      name: "mobile-chromium-430",
      testMatch: mobileTestMatch,
      use: mobileDeviceUse("Pixel 5", 430, 932)
    },
    {
      name: "mobile-chromium-landscape",
      testMatch: mobileTestMatch,
      use: mobileDeviceUse("Pixel 5", 844, 390)
    },
    {
      name: "mobile-webkit-390",
      testMatch: mobileTestMatch,
      use: mobileDeviceUse("iPhone 13", 390, 844)
    }
  ]
});
