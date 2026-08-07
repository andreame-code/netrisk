import { readFileSync } from "node:fs";
import {
  supportedMobileEnvironment,
  validateMobileEnvironment,
  type MobileBrowserInspection
} from "./playwright-mobile-environment.cjs";

export async function inspectMobileEnvironment(): Promise<{
  playwrightVersion: string;
  inspections: MobileBrowserInspection[];
}> {
  const { chromium, devices, webkit } = require("@playwright/test");
  const packageJson = JSON.parse(
    readFileSync(require.resolve("@playwright/test/package.json"), "utf8")
  ) as { version?: string };
  const profiles = [
    { browserName: "chromium", browserType: chromium, device: devices["Pixel 5"] },
    { browserName: "webkit", browserType: webkit, device: devices["iPhone 13"] }
  ];
  const inspections: MobileBrowserInspection[] = [];

  for (const profile of profiles) {
    const deviceOptions = { ...profile.device };
    delete deviceOptions.defaultBrowserType;
    const browser = await profile.browserType.launch({ headless: true });
    try {
      const context = await browser.newContext(deviceOptions);
      try {
        const page = await context.newPage();
        await page.goto(
          "data:text/html,<meta name='viewport' content='width=device-width'><button id='touch-probe'>Touch probe</button>"
        );
        await page.evaluate(() => {
          const runtime = globalThis as unknown as {
            document: {
              addEventListener: (
                type: string,
                listener: () => void,
                options: { once: boolean }
              ) => void;
            };
            touchEventReceived?: boolean;
          };
          runtime.document.addEventListener(
            "touchstart",
            () => {
              runtime.touchEventReceived = true;
            },
            { once: true }
          );
        });
        await page.locator("#touch-probe").tap();
        const input = await page.evaluate(() => ({
          maxTouchPoints: (globalThis as unknown as { navigator: { maxTouchPoints: number } })
            .navigator.maxTouchPoints,
          coarsePointer: (
            globalThis as unknown as { matchMedia: (query: string) => { matches: boolean } }
          ).matchMedia("(pointer: coarse)").matches,
          mobileUserAgent: /Android|iPhone|Mobile/i.test(
            (globalThis as unknown as { navigator: { userAgent: string } }).navigator.userAgent
          ),
          touchEventReceived:
            (globalThis as unknown as { touchEventReceived?: boolean }).touchEventReceived === true
        }));
        inspections.push({
          browserName: profile.browserName,
          browserVersion: browser.version(),
          executablePath: profile.browserType.executablePath(),
          ...input
        });
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }

  return {
    playwrightVersion: packageJson.version || "unknown",
    inspections
  };
}

export async function runMobileEnvironmentPreflight(): Promise<void> {
  let environment: Awaited<ReturnType<typeof inspectMobileEnvironment>>;
  try {
    environment = await inspectMobileEnvironment();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Mobile browser preflight failed before UAT started. Run \`npm run e2e:mobile:install\` or use mcr.microsoft.com/playwright:v${supportedMobileEnvironment.playwrightVersion}-noble.\n${detail}`,
      { cause: error }
    );
  }

  console.log(`Mobile UAT environment: Playwright ${environment.playwrightVersion}`);
  for (const inspection of environment.inspections) {
    console.log(
      `- ${inspection.browserName} ${inspection.browserVersion}: touchEvent=${inspection.touchEventReceived}, maxTouchPoints=${inspection.maxTouchPoints}, coarse=${inspection.coarsePointer}`
    );
  }

  const errors = validateMobileEnvironment(environment.playwrightVersion, environment.inspections);
  if (errors.length > 0) {
    throw new Error(
      `Unsupported mobile UAT environment:\n${errors.map((error) => `- ${error}`).join("\n")}`
    );
  }

  console.log("Mobile UAT browsers are installed and expose mobile touch input.");
}

if (require.main === module) {
  void runMobileEnvironmentPreflight().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
