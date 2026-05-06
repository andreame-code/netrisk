import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  assertValidModuleVersionManifest,
  findModuleVersionChangeRequirements,
  listFunctionalModuleVersions
} from "../shared/module-versions.cjs";

type PushEventPayload = {
  before?: unknown;
};

const moduleVersionsPath = "shared/module-versions.cts";

function runGit(args: string[]): string {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function fileAtRef(ref: string, filePath: string): string | null {
  try {
    return runGit(["show", `${ref}:${filePath}`]);
  } catch {
    return null;
  }
}

function readPushEventBeforeRef(): string | null {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) {
    return null;
  }

  try {
    const payload = JSON.parse(readFileSync(eventPath, "utf8")) as PushEventPayload;
    if (
      typeof payload.before === "string" &&
      /^[0-9a-f]{40}$/i.test(payload.before) &&
      !/^0+$/.test(payload.before)
    ) {
      return payload.before;
    }
  } catch {
    return null;
  }

  return null;
}

function resolveBaseRef(): string | null {
  if (process.env.NETRISK_MODULE_VERSION_BASE_REF) {
    return process.env.NETRISK_MODULE_VERSION_BASE_REF;
  }

  if (process.env.GITHUB_EVENT_NAME === "pull_request" && process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }

  if (process.env.GITHUB_EVENT_NAME === "push") {
    const beforeRef = readPushEventBeforeRef();
    if (beforeRef) {
      return beforeRef;
    }
  }

  try {
    runGit(["rev-parse", "--verify", "origin/main"]);
    return "origin/main";
  } catch {
    return null;
  }
}

function changedFilesSince(baseRef: string): string[] {
  try {
    return parseChangedFilePathsFromNameStatus(
      runGit(["diff", "--name-status", "-M", `${baseRef}...HEAD`])
    );
  } catch {
    return parseChangedFilePathsFromNameStatus(
      runGit(["diff", "--name-status", "-M", baseRef, "HEAD"])
    );
  }
}

export function parseChangedFilePathsFromNameStatus(output: string): string[] {
  const paths = new Set<string>();

  output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((line) => {
      const fields = line
        .split("\t")
        .map((entry) => entry.trim())
        .filter(Boolean);
      fields.slice(1).forEach((filePath) => paths.add(filePath));
    });

  return Array.from(paths);
}

function extractModuleVersions(source: string): Record<string, string> {
  const versions: Record<string, string> = {};
  const entryPattern = /\{\s*id:\s*"([^"]+)"[\s\S]*?version:\s*"([^"]+)"/g;
  let match = entryPattern.exec(source);

  while (match) {
    versions[match[1]] = match[2];
    match = entryPattern.exec(source);
  }

  return versions;
}

function changedModuleIdsFromManifestSource(
  currentSource: string,
  baseSource: string | null
): string[] {
  const currentVersions = extractModuleVersions(currentSource);
  const baseVersions = baseSource ? extractModuleVersions(baseSource) : {};

  return Object.entries(currentVersions)
    .filter(([moduleId, version]) => baseVersions[moduleId] !== version)
    .map(([moduleId]) => moduleId);
}

function validateRuntimeManifestVersionMirrors(): string[] {
  return listFunctionalModuleVersions().flatMap((moduleEntry) => {
    const runtimeModulePath = `modules/${moduleEntry.id}/`;
    if (!moduleEntry.ownerPaths.includes(runtimeModulePath)) {
      return [];
    }

    const manifestPath = join(process.cwd(), runtimeModulePath, "module.json");
    if (!existsSync(manifestPath)) {
      return [];
    }

    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: unknown };
      return manifest.version === moduleEntry.version
        ? []
        : [
            `${runtimeModulePath}module.json version ${String(
              manifest.version
            )} does not match central version ${moduleEntry.version}.`
          ];
    } catch (error: unknown) {
      return [
        `${runtimeModulePath}module.json could not be parsed: ${
          error instanceof Error ? error.message : String(error)
        }`
      ];
    }
  });
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function main(): void {
  assertValidModuleVersionManifest();
  const runtimeManifestErrors = validateRuntimeManifestVersionMirrors();
  if (runtimeManifestErrors.length) {
    fail(
      `Runtime module manifest versions must match ${moduleVersionsPath}:\n- ${runtimeManifestErrors.join("\n- ")}`
    );
  }

  const currentSource = readFileSync(join(process.cwd(), moduleVersionsPath), "utf8");
  const baseRef = resolveBaseRef();
  if (!baseRef) {
    console.log("Module version manifest validation passed. Skipping bump detection: no base ref.");
    return;
  }

  const baseSource = fileAtRef(baseRef, moduleVersionsPath);
  if (!baseSource) {
    console.log(
      `Module version manifest validation passed. Skipping bump detection: ${moduleVersionsPath} is not available at ${baseRef}.`
    );
    return;
  }

  const changedFiles = changedFilesSince(baseRef);
  const changedModuleIds = changedModuleIdsFromManifestSource(currentSource, baseSource);
  const requirements = findModuleVersionChangeRequirements(changedFiles, changedModuleIds);
  const missingBumps = requirements.filter((entry) => !entry.versionChanged);

  if (missingBumps.length) {
    const report = missingBumps
      .map(
        (entry) =>
          `- ${entry.moduleId} (${entry.moduleName}) still at ${entry.version}; changed paths: ${entry.changedPaths.join(", ")}`
      )
      .join("\n");
    fail(
      `Module-owned files changed without a module version bump in ${moduleVersionsPath}:\n${report}`
    );
  }

  console.log(
    `Module versioning check passed for ${requirements.length} touched module(s). Base: ${baseRef}.`
  );
}

if (require.main === module) {
  main();
}
