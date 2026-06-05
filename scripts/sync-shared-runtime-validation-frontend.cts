import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const sharedSourcePath = resolve(projectRoot, "shared", "runtime-validation.cts");
const frontendTargetPath = resolve(
  projectRoot,
  "frontend",
  "src",
  "generated",
  "shared-runtime-validation.mts"
);

function syncSharedValidationModule() {
  const sharedSource = readFileSync(sharedSourcePath, "utf8");
  const content =
    "// Generated from shared/runtime-validation.cts. Do not edit manually.\n" + sharedSource;

  mkdirSync(dirname(frontendTargetPath), { recursive: true });
  writeFileSync(frontendTargetPath, content);
}

syncSharedValidationModule();
