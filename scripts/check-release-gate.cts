import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type LongVersion = {
  raw: string;
  major: number;
  minor: number;
  patch: number;
};

type PushEventPayload = {
  before?: unknown;
};

const versionManifestPath = "shared/version-manifest.cts";
const changelogPath = "CHANGELOG.md";
const longVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(\d{3,})$/;
const legacyVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function runGit(args: string[]): string {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function currentFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function fileAtRef(ref: string, path: string): string | null {
  try {
    return runGit(["show", `${ref}:${path}`]);
  } catch {
    return null;
  }
}

function readPushEventBeforeRef(): string | null {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
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
  if (process.env.NETRISK_RELEASE_BASE_REF) {
    return process.env.NETRISK_RELEASE_BASE_REF;
  }

  if (process.env.GITHUB_EVENT_NAME === "pull_request" && process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }

  if (process.env.GITHUB_EVENT_NAME === "push") {
    const beforeRef = readPushEventBeforeRef();
    if (beforeRef) {
      return beforeRef;
    }

    try {
      return runGit(["rev-parse", "HEAD^1"]);
    } catch {
      return null;
    }
  }

  try {
    runGit(["rev-parse", "--verify", "origin/main"]);
    return "origin/main";
  } catch {
    return null;
  }
}

function extractAppVersion(source: string): string | null {
  const match = source.match(/export\s+const\s+appVersion\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function parseVersion(version: string, requireLongPatch: boolean): LongVersion | null {
  const match = requireLongPatch
    ? version.match(longVersionPattern)
    : version.match(longVersionPattern) || version.match(legacyVersionPattern);
  if (!match) {
    return null;
  }

  return {
    raw: version,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareVersions(left: LongVersion, right: LongVersion): number {
  const leftParts = [left.major, left.minor, left.patch];
  const rightParts = [right.major, right.minor, right.patch];

  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index] - rightParts[index];
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function hasChangelogReport(changelog: string, version: string): boolean {
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingPattern = new RegExp(
    `^##\\s+(?:\\[${escapedVersion}\\]|${escapedVersion})(?:\\s+-\\s+\\d{4}-\\d{2}-\\d{2})?\\s*$`,
    "m"
  );
  const headingMatch = headingPattern.exec(changelog);
  if (!headingMatch) {
    return false;
  }

  const sectionStart = headingMatch.index + headingMatch[0].length;
  const nextHeading = changelog.slice(sectionStart).search(/^##\s+/m);
  const section =
    nextHeading >= 0
      ? changelog.slice(sectionStart, sectionStart + nextHeading)
      : changelog.slice(sectionStart);

  return /^\s*-\s+\S+/m.test(section);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function main(): void {
  if (!existsSync(join(process.cwd(), versionManifestPath))) {
    fail(`Missing ${versionManifestPath}.`);
  }

  const currentVersionText = currentFile(versionManifestPath);
  const currentVersionValue = extractAppVersion(currentVersionText);
  if (!currentVersionValue) {
    fail(`${versionManifestPath} must export appVersion.`);
  }

  const currentVersion = parseVersion(currentVersionValue, true);
  if (!currentVersion) {
    fail(
      `${versionManifestPath} appVersion must use MAJOR.MINOR.PATCH with a padded patch, for example 0.1.001.`
    );
  }

  const baseRef = resolveBaseRef();
  const baseVersionText = baseRef ? fileAtRef(baseRef, versionManifestPath) : null;
  const baseVersionValue = baseVersionText ? extractAppVersion(baseVersionText) : null;
  if (baseVersionValue) {
    const baseVersion = parseVersion(baseVersionValue, false);
    if (!baseVersion) {
      fail(`Base appVersion "${baseVersionValue}" is not comparable.`);
    }

    if (compareVersions(currentVersion, baseVersion) <= 0) {
      fail(
        `${versionManifestPath} appVersion must increase for every merge to main. Base: ${baseVersion.raw}; current: ${currentVersion.raw}.`
      );
    }
  }

  if (!existsSync(join(process.cwd(), changelogPath))) {
    fail(`Missing ${changelogPath}. Add a release report for ${currentVersion.raw}.`);
  }

  const changelog = currentFile(changelogPath);
  if (!hasChangelogReport(changelog, currentVersion.raw)) {
    fail(
      `${changelogPath} must include a section with at least one bullet for ${currentVersion.raw}.`
    );
  }

  console.log(`Release gate passed for ${currentVersion.raw}.`);
}

main();
