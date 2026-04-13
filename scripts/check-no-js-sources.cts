const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
const { join, relative, extname } = require("node:path") as typeof import("node:path");

const rootDir = process.cwd();
const guardedDirectories = [
  "api",
  "backend",
  "shared",
  "scripts",
  "tests",
  join("frontend", "src")
];
const disallowedExtensions = new Set([".js", ".cjs"]);
const violations: string[] = [];

function walkDirectory(absoluteDir: string): void {
  const entries = readdirSync(absoluteDir, { withFileTypes: true });

  entries.forEach((entry) => {
    const absolutePath = join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(absolutePath);
      return;
    }

    if (!entry.isFile()) {
      return;
    }

    if (!disallowedExtensions.has(extname(entry.name))) {
      return;
    }

    violations.push(relative(rootDir, absolutePath));
  });
}

guardedDirectories.forEach((directory) => {
  const absoluteDirectory = join(rootDir, directory);
  if (!statSync(absoluteDirectory, { throwIfNoEntry: false })?.isDirectory()) {
    return;
  }

  walkDirectory(absoluteDirectory);
});

if (violations.length > 0) {
  console.error("Found disallowed JS/CJS source files:");
  violations.sort().forEach((filePath) => console.error(` - ${filePath}`));
  process.exitCode = 1;
} else {
  console.log("No JS/CJS source files found in guarded directories.");
}
