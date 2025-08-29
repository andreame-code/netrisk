#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function getChangedFiles() {
  try {
    let base = 'origin/main';
    try {
      execSync(`git rev-parse --verify ${base}`, { stdio: 'ignore' });
    } catch {
      base = 'main';
    }
    const output = execSync(`git diff --name-only --diff-filter=d ${base}...HEAD`, {
      encoding: 'utf8',
    });
    return output
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f && fs.existsSync(f));
  } catch (err) {
    console.error('Failed to determine changed files');
    process.exit(1);
  }
}

function getRelatedTests(files) {
  if (files.length === 0) return [];
  try {
    const output = execSync(
      `npx jest --config config/jest.config.js --findRelatedTests --listTests ${files.join(' ')}`,
      { encoding: 'utf8' }
    );
    return output
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
  } catch (err) {
    // If jest fails while listing tests, treat as failure
    process.exit(1);
  }
}

function hasPlaywrightTests() {
  return fs.existsSync('config/playwright.config.ts') && fs.existsSync('tests/uat');
}

const changedFiles = getChangedFiles();
const relatedTests = getRelatedTests(changedFiles);

if (relatedTests.length > 0) {
  run(`npx jest --config config/jest.config.js --findRelatedTests ${changedFiles.join(' ')}`);
} else {
  run('npm run test:smoke');
}

if (hasPlaywrightTests()) {
  run('npx playwright test -c config/playwright.config.ts --grep @smoke');
}
