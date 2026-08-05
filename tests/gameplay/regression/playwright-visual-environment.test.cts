const assert = require("node:assert/strict");
const {
  requiresVisualEnvironmentPreflight,
  supportedVisualEnvironment,
  validateVisualEnvironment
} = require("../../../scripts/playwright-visual-environment.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function supportedSnapshot(overrides: Record<string, unknown> = {}) {
  const linux = supportedVisualEnvironment.linux;
  return {
    platform: "linux",
    playwrightVersion: supportedVisualEnvironment.playwrightVersion,
    browserVersion: supportedVisualEnvironment.browserVersion,
    browserRevision: supportedVisualEnvironment.browserRevision,
    browserExecutablePath: "/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell",
    osId: linux.osId,
    osVersionId: linux.osVersionId,
    fontPackages: Object.fromEntries(linux.fontPackages.map((name: string) => [name, true])),
    fontFamilies: [...linux.requiredFontFamilies],
    ...overrides
  };
}

register("visual environment accepts the pinned browser and Linux font stack", () => {
  assert.deepEqual(validateVisualEnvironment(supportedSnapshot()), []);
});

register("visual environment rejects browser, OS, and font drift before snapshots", () => {
  const errors = validateVisualEnvironment(
    supportedSnapshot({
      browserVersion: "149.0.7827.0",
      osVersionId: "22.04",
      fontPackages: {},
      fontFamilies: ["Arial"]
    })
  );

  assert.ok(errors.some((error: string) => error.includes("149.0.7827.0")));
  assert.ok(errors.some((error: string) => error.includes("ubuntu 24.04")));
  assert.ok(errors.some((error: string) => error.includes("font package is missing")));
  assert.ok(errors.some((error: string) => error.includes("font family is missing")));
  assert.ok(errors.some((error: string) => error.includes("Unsupported host font Arial")));
});

register("visual preflight cannot be bypassed by grep or snapshot-update selectors", () => {
  assert.equal(requiresVisualEnvironmentPreflight([]), true);
  assert.equal(requiresVisualEnvironmentPreflight(["--grep", "battlefield layout"]), true);
  assert.equal(
    requiresVisualEnvironmentPreflight(["--update-snapshots", "--grep", "battlefield layout"]),
    true
  );
  assert.equal(requiresVisualEnvironmentPreflight(["e2e/smoke", "--grep", "app loads"]), false);
  assert.equal(requiresVisualEnvironmentPreflight(["./e2e/00-visual/main-screen.spec.ts"]), true);
});
