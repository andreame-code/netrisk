const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { REQUIRED_DEPLOY_ENV_KEYS } = require("../backend/required-runtime-env.cjs");

interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

type SpawnError = Error & {
  status?: number | null;
};

function run(command: string, args: string[], options: RunOptions = {}): string {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    const error = new Error((result.stderr || result.stdout || "").trim() || `${command} ${args.join(" ")} failed`) as SpawnError;
    error.status = result.status;
    throw error;
  }

  return result.stdout || "";
}

function parseEnvFile(filePath: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((line: string) => {
    const match = line.match(/^([A-Z0-9_]+)=\"([\s\S]*)\"$/);
    if (!match) {
      return;
    }

    parsed[match[1]] = match[2];
  });

  return parsed;
}

function tempFile(name: string): string {
  return path.join(process.cwd(), name);
}

function currentBranch(): string {
  return run("git", ["branch", "--show-current"]).trim();
}

function pullEnv(outputFile: string, environment: string, branch: string | null = null): Record<string, string> {
  const args = ["env", "pull", outputFile, `--environment=${environment}`, "--yes"];
  if (branch) {
    args.push(`--git-branch=${branch}`);
  }
  run("vercel", args);
  return parseEnvFile(outputFile);
}

function summarizeMissing(keys: string[], source: Record<string, string>, target: Record<string, string>): string[] {
  return keys.filter((key) => source[key] && !target[key]);
}

function main(): void {
  const branch = process.env.VERCEL_ENV_CHECK_BRANCH || currentBranch();
  const productionFile = tempFile(`.vercel.env-check-production-${process.pid}.env`);
  const previewFile = tempFile(`.vercel.env-check-preview-${process.pid}.env`);

  try {
    const production = pullEnv(productionFile, "production");
    const preview = pullEnv(previewFile, "preview", branch);

    const missingInProduction = REQUIRED_DEPLOY_ENV_KEYS.filter((key: string) => !production[key]);
    const missingInPreview = REQUIRED_DEPLOY_ENV_KEYS.filter((key: string) => !preview[key]);
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
    [productionFile, previewFile].forEach((filePath: string) => {
      try {
        fs.rmSync(filePath, { force: true });
      } catch (error) {
      }
    });
  }
}

main();
