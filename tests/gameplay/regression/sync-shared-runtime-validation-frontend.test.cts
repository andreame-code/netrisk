const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("shared runtime validation sync skips writes when target content is current", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-sync-validation-"));
  const sharedDir = path.join(tempRoot, "shared");
  const targetDir = path.join(tempRoot, "frontend", "src", "generated");
  const scriptPath = path.join(
    process.cwd(),
    ".tsbuild",
    "scripts",
    "sync-shared-runtime-validation-frontend.cjs"
  );
  const sharedSource = 'export const marker = "current";\n';
  const generatedContent =
    "// Generated from shared/runtime-validation.cts. Do not edit manually.\n" + sharedSource;
  const targetPath = path.join(targetDir, "shared-runtime-validation.mts");

  fs.mkdirSync(sharedDir, { recursive: true });
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(sharedDir, "runtime-validation.cts"), sharedSource);
  fs.writeFileSync(targetPath, generatedContent);
  fs.chmodSync(targetPath, 0o444);

  try {
    childProcess.execFileSync(process.execPath, [scriptPath], {
      cwd: tempRoot,
      stdio: "pipe"
    });

    assert.equal(fs.readFileSync(targetPath, "utf8"), generatedContent);
  } finally {
    fs.chmodSync(targetPath, 0o666);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
