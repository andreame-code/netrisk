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

const playwrightOptionsWithRequiredValues = new Set([
  "--browser",
  "-c",
  "--config",
  "-g",
  "--grep",
  "-G",
  "--grep-invert",
  "--global-timeout",
  "-j",
  "--workers",
  "--last-failed-file",
  "--max-failures",
  "--output",
  "--project",
  "--repeat-each",
  "--reporter",
  "--retries",
  "--run-agents",
  "--shard",
  "--test-list",
  "--test-list-invert",
  "--timeout",
  "--trace",
  "--tsconfig",
  "--ui-host",
  "--ui-port",
  "--update-source-method"
]);

const playwrightOptionsWithOptionalValues = new Set([
  "--debug",
  "--only-changed",
  "-u",
  "--update-snapshots"
]);

const playwrightBooleanOptions = new Set([
  "--fail-on-flaky-tests",
  "--forbid-only",
  "--fully-parallel",
  "--headed",
  "--ignore-snapshots",
  "--last-failed",
  "--list",
  "--no-deps",
  "--pass-with-no-tests",
  "--quiet",
  "--ui",
  "-x"
]);

function getLiteralTestFilters(args: string[]): string[] | null {
  const filters: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      filters.push(...args.slice(index + 1));
      break;
    }

    if (!arg.startsWith("-")) {
      filters.push(arg);
      continue;
    }

    const optionName = arg.split("=", 1)[0];
    if (arg.includes("=")) {
      if (
        !playwrightOptionsWithRequiredValues.has(optionName) &&
        !playwrightOptionsWithOptionalValues.has(optionName)
      ) {
        return null;
      }
      continue;
    }

    if (playwrightOptionsWithRequiredValues.has(optionName)) {
      if (index + 1 >= args.length) {
        return null;
      }
      index += 1;
      continue;
    }

    if (playwrightOptionsWithOptionalValues.has(optionName)) {
      return null;
    }

    if (!playwrightBooleanOptions.has(optionName)) {
      return null;
    }
  }

  return filters;
}

export function requiresVisualEnvironmentPreflight(args: string[]): boolean {
  const filters = getLiteralTestFilters(args);
  if (!filters || filters.length === 0) {
    return true;
  }

  return !filters.every((filter) => {
    const normalized = filter.replace(/^\.\//, "");
    return /^e2e\/(?!00-visual(?:\/|$))[A-Za-z0-9._/-]+$/.test(normalized);
  });
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
    errors.push(
      `Visual snapshots require Linux ${supportedVisualEnvironment.linux.osId} ${supportedVisualEnvironment.linux.osVersionId}; found ${snapshot.platform}.`
    );
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
