export const supportedMobileEnvironment = Object.freeze({
  playwrightVersion: "1.61.1",
  browserNames: Object.freeze(["chromium", "webkit"]),
  projectNames: Object.freeze([
    "mobile-chromium-360",
    "mobile-chromium-390",
    "mobile-chromium-430",
    "mobile-chromium-landscape",
    "mobile-webkit-390"
  ])
});

const optionsWithRequiredValues = new Set([
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

const optionsWithOptionalValues = new Set([
  "--debug",
  "--only-changed",
  "-u",
  "--update-snapshots"
]);
const booleanOptions = new Set([
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

type ParsedRunnerSelection = {
  filters: string[];
  projects: string[];
};

function parseRunnerSelection(args: string[]): ParsedRunnerSelection | null {
  const filters: string[] = [];
  const projects: string[] = [];

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
        !optionsWithRequiredValues.has(optionName) &&
        !optionsWithOptionalValues.has(optionName)
      ) {
        return null;
      }
      if (optionName === "--project") {
        projects.push(arg.slice(arg.indexOf("=") + 1));
      }
      continue;
    }

    if (optionsWithRequiredValues.has(optionName)) {
      if (index + 1 >= args.length) {
        return null;
      }
      const value = args[index + 1];
      if (optionName === "--project") {
        projects.push(value);
      }
      index += 1;
      continue;
    }

    if (optionsWithOptionalValues.has(optionName)) {
      return null;
    }

    if (!booleanOptions.has(optionName)) {
      return null;
    }
  }

  return { filters, projects };
}

export function requiresMobileEnvironmentPreflight(args: string[]): boolean {
  const selection = parseRunnerSelection(args);
  if (!selection) {
    return true;
  }

  if (
    selection.projects.some((project) =>
      supportedMobileEnvironment.projectNames.some((projectName) => projectName === project)
    )
  ) {
    return true;
  }

  if (selection.projects.length > 0) {
    return false;
  }

  if (selection.filters.length === 0) {
    return true;
  }

  return selection.filters.some((filter) => {
    const normalized = filter.replace(/^\.\//, "");
    return /^e2e\/mobile(?:\/|$)/.test(normalized);
  });
}

export type MobileBrowserInspection = {
  browserName: string;
  browserVersion: string;
  executablePath: string;
  maxTouchPoints: number;
  touchEventReceived: boolean;
  coarsePointer: boolean;
  mobileUserAgent: boolean;
};

export function validateMobileEnvironment(
  playwrightVersion: string,
  inspections: MobileBrowserInspection[]
): string[] {
  const errors: string[] = [];
  if (playwrightVersion !== supportedMobileEnvironment.playwrightVersion) {
    errors.push(
      `Playwright ${playwrightVersion} is unsupported; expected ${supportedMobileEnvironment.playwrightVersion}.`
    );
  }

  for (const browserName of supportedMobileEnvironment.browserNames) {
    const inspection = inspections.find((candidate) => candidate.browserName === browserName);
    if (!inspection) {
      errors.push(`Required mobile browser is unavailable: ${browserName}.`);
      continue;
    }
    if (!inspection.touchEventReceived) {
      errors.push(`${browserName} did not dispatch touch input.`);
    }
    if (!inspection.coarsePointer) {
      errors.push(`${browserName} did not expose a coarse primary pointer.`);
    }
    if (!inspection.mobileUserAgent) {
      errors.push(`${browserName} did not expose a mobile user agent.`);
    }
  }

  return errors;
}
