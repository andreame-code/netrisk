import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  supportedVisualEnvironment,
  validateVisualEnvironment,
  type VisualEnvironmentSnapshot
} from "./playwright-visual-environment.cjs";

type BrowserRegistryEntry = {
  name?: string;
  revision?: string;
  browserVersion?: string;
};

function readOsRelease(): Record<string, string> {
  if (process.platform !== "linux") {
    return {};
  }

  return Object.fromEntries(
    readFileSync("/etc/os-release", "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1].toLowerCase(), match[2].replace(/^['"]|['"]$/g, "")])
  );
}

function installedFontPackages(): Record<string, boolean> {
  if (process.platform !== "linux") {
    return {};
  }

  return Object.fromEntries(
    supportedVisualEnvironment.linux.fontPackages.map((packageName) => {
      try {
        const status = execFileSync("dpkg-query", ["-W", "-f=${db:Status-Abbrev}", packageName], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"]
        }).trim();
        return [packageName, status === "ii"];
      } catch (_error) {
        return [packageName, false];
      }
    })
  );
}

function installedFontFamilies(): string[] {
  if (process.platform !== "linux") {
    return [];
  }

  const output = execFileSync("fc-list", ["--format=%{family}\n"], { encoding: "utf8" });
  return Array.from(
    new Set(
      output
        .split(/\r?\n/)
        .flatMap((line) => line.split(","))
        .map((family) => family.trim())
        .filter(Boolean)
    )
  ).sort();
}

function browserRegistryEntry(): BrowserRegistryEntry {
  const corePackagePath = require.resolve("playwright-core/package.json");
  const registry = JSON.parse(
    readFileSync(join(dirname(corePackagePath), "browsers.json"), "utf8")
  ) as { browsers?: BrowserRegistryEntry[] };
  return (
    registry.browsers?.find((entry) => entry.name === supportedVisualEnvironment.browserName) || {}
  );
}

export async function inspectVisualEnvironment(): Promise<VisualEnvironmentSnapshot> {
  const { chromium } = require("@playwright/test");
  const packagePath = require.resolve("@playwright/test/package.json");
  const playwrightPackage = JSON.parse(readFileSync(packagePath, "utf8")) as {
    version?: string;
  };
  const registryEntry = browserRegistryEntry();
  const osRelease = readOsRelease();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    return {
      platform: process.platform,
      playwrightVersion: playwrightPackage.version || "unknown",
      browserVersion: browser.version(),
      browserRevision: registryEntry.revision || "unknown",
      browserExecutablePath: chromium.executablePath(),
      osId: osRelease.id,
      osVersionId: osRelease.version_id,
      fontPackages: installedFontPackages(),
      fontFamilies: installedFontFamilies()
    };
  } finally {
    await browser?.close();
  }
}

export async function runVisualEnvironmentPreflight(): Promise<void> {
  let snapshot: VisualEnvironmentSnapshot;
  try {
    snapshot = await inspectVisualEnvironment();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Visual-test browser preflight failed before snapshots started. Run \`npm run e2e:visual:install\` or use ${supportedVisualEnvironment.linux.containerImage}.\n${detail}`,
      { cause: error }
    );
  }

  console.log("Visual regression environment preflight:");
  console.log(`- Playwright: ${snapshot.playwrightVersion}`);
  console.log(`- Chromium: ${snapshot.browserVersion} (revision ${snapshot.browserRevision})`);
  console.log(`- Executable: ${snapshot.browserExecutablePath}`);
  if (snapshot.platform === "linux") {
    console.log(`- Linux: ${snapshot.osId} ${snapshot.osVersionId}`);
    console.log(
      `- Required font packages: ${supportedVisualEnvironment.linux.fontPackages.join(", ")}`
    );
  }

  const errors = validateVisualEnvironment(snapshot);
  if (errors.length > 0) {
    throw new Error(
      `Unsupported visual regression environment:\n${errors.map((error) => `- ${error}`).join("\n")}\nUse the documented container command before generating or comparing Linux baselines.`
    );
  }

  console.log("Visual regression environment is supported.");
}

if (require.main === module) {
  void runVisualEnvironmentPreflight().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
