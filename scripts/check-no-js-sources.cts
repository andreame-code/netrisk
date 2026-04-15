import { execFileSync } from "node:child_process";

const rootDir = process.cwd();
const sourceExtensions = [".d.ts", ".cts", ".mts", ".ts"];
const allowedPathPatterns = [
  /^\.codex\/.+\.toml$/,
  /^\.env\.example$/,
  /^\.gitignore$/,
  /^\.githooks\/.+$/,
  /^\.github\/.+\.yml$/,
  /^LICENSE$/,
  /^package(?:-lock)?\.json$/,
  /^tsconfig(?:\.[^/]+)?\.json$/,
  /^vercel\.json$/,
  /^modules\/.+\.(json|css|png|jpg|jpeg|svg|webp)$/i,
  /^frontend\/assets\/.+\.(png|jpg|jpeg|svg|webp)$/i,
  /^e2e\/.+-snapshots\/.+\.png$/i,
  /(^|\/)[^/]+\.md$/i
];

function isTypeScriptSource(filePath: string): boolean {
  return sourceExtensions.some((extension) => filePath.endsWith(extension));
}

function isAllowlisted(filePath: string): boolean {
  return allowedPathPatterns.some((pattern) => pattern.test(filePath));
}

const trackedFiles = execFileSync("git", ["ls-files"], {
  cwd: rootDir,
  encoding: "utf8"
})
  .split(/\r?\n/)
  .map((filePath) => filePath.trim())
  .filter(Boolean);

const violations = trackedFiles.filter((filePath) => !isTypeScriptSource(filePath) && !isAllowlisted(filePath));

if (violations.length > 0) {
  console.error("Found tracked files outside the TS-complete allowlist:");
  violations.sort().forEach((filePath) => console.error(` - ${filePath}`));
  process.exitCode = 1;
} else {
  console.log("Tracked repository sources satisfy the TS-complete allowlist.");
}
