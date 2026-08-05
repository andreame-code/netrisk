export type VisualEnvironmentSnapshot = {
  platform: NodeJS.Platform;
  playwrightVersion: string;
  browserVersion: string;
  browserRevision: string;
  browserExecutablePath: string;
  osId?: string;
  osVersionId?: string;
  fontPackages?: Record<string, boolean>;
  fontFamilies?: string[];
};

export const supportedVisualEnvironment = Object.freeze({
  playwrightVersion: "1.61.1",
  browserName: "chromium",
  browserVersion: "149.0.7827.55",
  browserRevision: "1228",
  linux: Object.freeze({
    osId: "ubuntu",
    osVersionId: "24.04",
    containerImage: "mcr.microsoft.com/playwright:v1.61.1-noble",
    fontPackages: Object.freeze([
      "fonts-freefont-ttf",
      "fonts-ipafont-gothic",
      "fonts-liberation",
      "fonts-noto-color-emoji",
      "fonts-tlwg-loma-otf",
      "fonts-unifont",
      "fonts-wqy-zenhei",
      "libfontconfig1",
      "libfreetype6"
    ]),
    requiredFontFamilies: Object.freeze([
      "Liberation Mono",
      "Liberation Sans",
      "Liberation Serif",
      "Noto Color Emoji"
    ]),
    forbiddenFontFamilies: Object.freeze([
      "Arial",
      "Georgia",
      "Helvetica Neue",
      "Inter",
      "Segoe UI",
      "Trebuchet MS"
    ])
  })
});

export function requiresVisualEnvironmentPreflight(args: string[]): boolean {
  const explicitE2ePaths = args
    .map((arg) => arg.replace(/^\.\//, ""))
    .filter((arg) => arg === "e2e" || arg.startsWith("e2e/"));

  if (explicitE2ePaths.length === 0) {
    return true;
  }

  return explicitE2ePaths.some(
    (arg) => arg === "e2e/00-visual" || arg.startsWith("e2e/00-visual/")
  );
}

export function validateVisualEnvironment(snapshot: VisualEnvironmentSnapshot): string[] {
  const errors: string[] = [];

  if (snapshot.playwrightVersion !== supportedVisualEnvironment.playwrightVersion) {
    errors.push(
      `Playwright ${snapshot.playwrightVersion} is unsupported; expected ${supportedVisualEnvironment.playwrightVersion}.`
    );
  }

  if (snapshot.browserVersion !== supportedVisualEnvironment.browserVersion) {
    errors.push(
      `Chromium ${snapshot.browserVersion} is unsupported; expected ${supportedVisualEnvironment.browserVersion}.`
    );
  }

  if (snapshot.browserRevision !== supportedVisualEnvironment.browserRevision) {
    errors.push(
      `Chromium revision ${snapshot.browserRevision} is unsupported; expected ${supportedVisualEnvironment.browserRevision}.`
    );
  }

  if (snapshot.platform !== "linux") {
    return errors;
  }

  const linux = supportedVisualEnvironment.linux;
  if (snapshot.osId !== linux.osId || snapshot.osVersionId !== linux.osVersionId) {
    errors.push(
      `Linux visual snapshots require ${linux.osId} ${linux.osVersionId}; found ${snapshot.osId || "unknown"} ${snapshot.osVersionId || "unknown"}.`
    );
  }

  const fontPackages = snapshot.fontPackages || {};
  for (const packageName of linux.fontPackages) {
    if (!fontPackages[packageName]) {
      errors.push(`Required visual-test font package is missing: ${packageName}.`);
    }
  }

  const fontFamilies = new Set(snapshot.fontFamilies || []);
  for (const family of linux.requiredFontFamilies) {
    if (!fontFamilies.has(family)) {
      errors.push(`Required visual-test font family is missing: ${family}.`);
    }
  }

  for (const family of linux.forbiddenFontFamilies) {
    if (fontFamilies.has(family)) {
      errors.push(
        `Unsupported host font ${family} is installed and can change screenshot rasterization.`
      );
    }
  }

  return errors;
}
