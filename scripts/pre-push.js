#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: "inherit", ...opts });
  } catch (err) {
    process.exit(1);
  }
}

function getChangedFiles() {
  try {
    let base = "origin/main";
    try {
      execSync(`git rev-parse --verify ${base}`, { stdio: "ignore" });
    } catch {
      base = "main";
    }
    const output = execSync(
      `git diff --name-only --diff-filter=d ${base}...HEAD`,
      {
        encoding: "utf8",
      },
    );
    return output
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f && fs.existsSync(f));
  } catch (err) {
    console.error("Failed to determine changed files");
    process.exit(1);
  }
}

function getRelatedTests(files) {
  if (files.length === 0) return [];
  try {
    const output = execSync(
      `npx jest --config config/jest.config.js --findRelatedTests --listTests ${files.join(" ")}`,
      { encoding: "utf8" },
    );
    return output
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
  } catch (err) {
    process.exit(1);
  }
}

function hasJestTests() {
  return fs.existsSync("config/jest.config.js");
}

function hasPlaywrightTests() {
  return (
    fs.existsSync("config/playwright.config.ts") && fs.existsSync("tests/uat")
  );
}

const changedFiles = getChangedFiles();
console.log("Changed files:");
if (changedFiles.length === 0) {
  console.log("  (none)");
} else {
  changedFiles.forEach((f) => console.log(`  ${f}`));
}

if (hasJestTests()) {
  const relatedTests = getRelatedTests(changedFiles);
  if (relatedTests.length > 0) {
    console.log("\nRunning related Jest tests:");
    relatedTests.forEach((t) => console.log(`  ${t}`));
    run(
      `npx jest --config config/jest.config.js --findRelatedTests ${changedFiles.join(" ")}`,
    );
  } else {
    console.log("\nNo related Jest tests found, running smoke suite");
    run("npm run test:smoke");
  }
} else {
  console.log("\nJest not detected, skipping unit tests");
}

if (hasPlaywrightTests()) {
  console.log("\nRunning Playwright smoke tests");
  run("npx playwright test -c config/playwright.config.ts --grep @smoke");
} else {
  console.log("\nPlaywright not detected, skipping smoke tests");
}
