import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const sharedSourcePath = resolve(projectRoot, "shared", "runtime-validation.cts");
const frontendTargetPath = resolve(
  projectRoot,
  "frontend",
  "src",
  "generated",
  "shared-runtime-validation.mts"
);
const zodSourceRoot = resolve(projectRoot, "node_modules", "zod");
const zodPublicRoot = resolve(projectRoot, "public", "vendor", "zod");

function syncSharedValidationModule() {
  const sharedSource = readFileSync(sharedSourcePath, "utf8");
  const content = "// Generated from shared/runtime-validation.cts. Do not edit manually.\n"
    + sharedSource;

  mkdirSync(dirname(frontendTargetPath), { recursive: true });
  writeFileSync(frontendTargetPath, content);
}

function copyZodRuntimeTree(sourceDir: string, targetDir: string) {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name === "src") {
      continue;
    }

    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyZodRuntimeTree(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!/\.(js|mjs|json)$/.test(entry.name)) {
      continue;
    }

    cpSync(sourcePath, targetPath, { force: true });
  }
}

syncSharedValidationModule();

if (existsSync(zodSourceRoot) && statSync(zodSourceRoot).isDirectory()) {
  copyZodRuntimeTree(zodSourceRoot, zodPublicRoot);
  console.log(`Synced ${relative(projectRoot, zodPublicRoot)} runtime from zod package`);
}
