const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { REQUIRED_DEPLOY_ENV_KEYS } = require("../backend/required-runtime-env.cjs");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    const error = new Error((result.stderr || result.stdout || "").trim() || `${command} ${args.join(" ")} failed`);
    error.status = result.status;
    throw error;
  }

  return result.stdout || "";
}

function parseEnvFile(filePath) {
  const parsed = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const match = line.match(/^([A-Z0-9_]+)=\"([\s\S]*)\"$/);
    if (!match) {
      return;
    }

    parsed[match[1]] = match[2];
  });

  return parsed;
}

function tempFile(name) {
  return path.join(process.cwd(), name);
}

function currentBranch() {
  return run("git", ["branch", "--show-current"]).trim();
}

function pullEnv(outputFile, environment, branch = null) {
  const args = ["env", "pull", outputFile, `--environment=${environment}`, "--yes"];
  if (branch) {
    args.push(`--git-branch=${branch}`);
  }
  run("vercel", args);
  return parseEnvFile(outputFile);
}

function summarizeMissing(keys, source, target) {
  return keys.filter((key) => source[key] && !target[key]);
}

function main() {
  const branch = process.env.VERCEL_ENV_CHECK_BRANCH || currentBranch();
  const productionFile = tempFile(`.vercel.env-check-production-${process.pid}.env`);
  const previewFile = tempFile(`.vercel.env-check-preview-${process.pid}.env`);

  try {
    const production = pullEnv(productionFile, "production");
    const preview = pullEnv(previewFile, "preview", branch);

    const missingInProduction = REQUIRED_DEPLOY_ENV_KEYS.filter((key) => !production[key]);
    const missingInPreview = REQUIRED_DEPLOY_ENV_KEYS.filter((key) => !preview[key]);
    const missingFromPreviewComparedToProduction = summarizeMissing(REQUIRED_DEPLOY_ENV_KEYS, production, preview);

    if (!missingInProduction.length && !missingInPreview.length && !missingFromPreviewComparedToProduction.length) {
      console.log(`Vercel env parity OK for branch ${branch}.`);
      return;
    }

    if (missingInProduction.length) {
      console.error(`Missing required production env vars: ${missingInProduction.join(", ")}`);
    }
    if (missingInPreview.length) {
      console.error(`Missing required preview env vars for branch ${branch}: ${missingInPreview.join(", ")}`);
    }
    if (missingFromPreviewComparedToProduction.length) {
      console.error(`Preview branch ${branch} is missing vars present in production: ${missingFromPreviewComparedToProduction.join(", ")}`);
    }

    process.exitCode = 1;
  } finally {
    [productionFile, previewFile].forEach((filePath) => {
      try {
        fs.rmSync(filePath, { force: true });
      } catch (error) {
      }
    });
  }
}

main();
