const assert = require("node:assert/strict");
const {
  requiresMobileEnvironmentPreflight,
  supportedMobileEnvironment,
  validateMobileEnvironment
} = require("../../../scripts/playwright-mobile-environment.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function supportedInspections() {
  return supportedMobileEnvironment.browserNames.map((browserName: string) => ({
    browserName,
    browserVersion: "test",
    executablePath: `/ms-playwright/${browserName}`,
    maxTouchPoints: 1,
    coarsePointer: true,
    mobileUserAgent: true
  }));
}

register("mobile environment accepts Chromium and WebKit touch profiles", () => {
  assert.deepEqual(
    validateMobileEnvironment(supportedMobileEnvironment.playwrightVersion, supportedInspections()),
    []
  );
});

register("mobile environment rejects missing browsers and desktop input", () => {
  const errors = validateMobileEnvironment(supportedMobileEnvironment.playwrightVersion, [
    {
      ...supportedInspections()[0],
      maxTouchPoints: 0,
      coarsePointer: false,
      mobileUserAgent: false
    }
  ]);

  assert.ok(errors.some((error: string) => error.includes("did not expose touch input")));
  assert.ok(errors.some((error: string) => error.includes("coarse primary pointer")));
  assert.ok(errors.some((error: string) => error.includes("mobile user agent")));
  assert.ok(errors.some((error: string) => error.includes("webkit")));
});

register("mobile browser preflight is mandatory only when mobile projects can run", () => {
  assert.equal(requiresMobileEnvironmentPreflight([]), true);
  assert.equal(requiresMobileEnvironmentPreflight(["e2e/mobile"]), true);
  assert.equal(
    requiresMobileEnvironmentPreflight(["--project", "mobile-webkit-390", "e2e/mobile"]),
    true
  );
  assert.equal(
    requiresMobileEnvironmentPreflight(["--project=mobile-chromium-390", "e2e/mobile"]),
    true
  );
  assert.equal(requiresMobileEnvironmentPreflight(["e2e/smoke"]), false);
  assert.equal(requiresMobileEnvironmentPreflight(["e2e/smoke/mobile-auth-header.spec.ts"]), false);
  assert.equal(requiresMobileEnvironmentPreflight(["e2e/00-visual"]), false);
  assert.equal(requiresMobileEnvironmentPreflight(["--project", "chromium"]), false);
  assert.equal(requiresMobileEnvironmentPreflight(["--unknown", "e2e/smoke"]), true);
});
