import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const rootDir = process.cwd();
const sourceExtensions = [".d.ts", ".cts", ".mts", ".ts", ".tsx"];
const ignoredDirNames = new Set([
  ".git",
  ".next",
  ".tsbuild",
  ".vercel",
  "coverage",
  "data",
  "node_modules",
  "playwright-report",
  "public",
  "test-results"
]);
const ignoredFilePatterns = [
  /^\.tmp.*$/i,
  /^e2e-run\.log$/i,
  /^supabase\/schema\.sql$/i,
  /^tsconfig\.frontend\.tsbuildinfo$/i,
  /^scripts\/tmp-.+$/i,
  /^scripts\/.*\.log$/i,
  /^tmp-e2e-server\.(err|out)\.log$/i
];
const allowedPathPatterns = [
  /^\.codex\/.+\.toml$/,
  /^\.env\.example$/,
  /^\.gitignore$/,
  /^\.vercelignore$/,
  /^\.githooks\/.+$/,
  /^\.github\/.+\.yml$/,
  /^\.prettierignore$/,
  /^\.prettierrc\.json$/,
  /^LICENSE$/,
  /^eslint\.config\.mjs$/,
  /^package(?:-lock)?\.json$/,
  /^tsconfig(?:\.[^/]+)?\.json$/,
  /^vercel\.json$/,
  /^modules\/.+\.(json|css|png|jpg|jpeg|svg|webp)$/i,
  /^frontend\/assets\/.+\.(png|jpg|jpeg|svg|webp)$/i,
  /^frontend\/react-shell\/.+\.(html|css)$/i,
  /^docs\/openapi\.json$/i,
  /^e2e\/.+-snapshots\/.+\.png$/i,
  /(^|\/)[^/]+\.md$/i
];

function isTypeScriptSource(filePath: string): boolean {
  return sourceExtensions.some((extension) => filePath.endsWith(extension));
}

function isAllowlisted(filePath: string): boolean {
  return allowedPathPatterns.some((pattern) => pattern.test(filePath));
}

function isIgnoredFallbackFile(filePath: string): boolean {
  return ignoredFilePatterns.some((pattern) => pattern.test(filePath));
}

function collectSourceTreeFiles(absoluteDir: string): string[] {
  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(absoluteDir, entry.name);
    const relativePath = relative(rootDir, absolutePath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      return ignoredDirNames.has(entry.name) ? [] : collectSourceTreeFiles(absolutePath);
    }

    if (!entry.isFile()) {
      return [];
    }

    if (!statSync(absolutePath).size && relativePath === "package-lock.json") {
      return [relativePath];
    }

    return isIgnoredFallbackFile(relativePath) ? [] : [relativePath];
  });
}

function trackedFilesFromGit(): string[] | null {
  try {
    return execFileSync("git", ["ls-files"], {
      cwd: rootDir,
      encoding: "utf8"
    })
      .split(/\r?\n/)
      .map((filePath) => filePath.trim())
      .filter(Boolean);
  } catch (error) {
    return null;
  }
}

const trackedFiles = trackedFilesFromGit() || collectSourceTreeFiles(rootDir);

const violations = trackedFiles.filter(
  (filePath) => !isTypeScriptSource(filePath) && !isAllowlisted(filePath)
);

if (violations.length > 0) {
  console.error("Found tracked files outside the TS-complete allowlist:");
  violations.sort().forEach((filePath) => console.error(` - ${filePath}`));
  process.exitCode = 1;
} else {
  console.log("Tracked repository sources satisfy the TS-complete allowlist.");
}
