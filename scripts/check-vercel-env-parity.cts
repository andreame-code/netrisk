const { spawnSync } = require("child_process");
const {
  OPTIONAL_OBSERVABILITY_BUILD_ENV_KEYS,
  REQUIRED_CRON_ENV_KEYS,
  REQUIRED_DEPLOY_ENV_KEYS
} = require("../backend/required-runtime-env.cjs");

type SpawnError = Error & {
  status?: number | null;
};

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    const error = new Error(
      (result.stderr || result.stdout || "").trim() || `${command} ${args.join(" ")} failed`
    ) as SpawnError;
    error.status = result.status;
    throw error;
  }

  return result.stdout || "";
}

function currentBranch(): string {
  return run("git", ["branch", "--show-current"]).trim();
}

function listEnvKeys(environment: string, branch: string | null = null): Record<string, boolean> {
  const args = ["env", "ls", environment];
  if (branch) {
    args.push(branch);
  }
  args.push("--format", "json");

  const raw = run("vercel", args);
  const parsed = JSON.parse(raw) as {
    envs?: Array<{
      key?: string;
    }>;
  };

  return (parsed.envs || []).reduce((envs: Record<string, boolean>, entry) => {
    if (typeof entry?.key === "string" && entry.key) {
      envs[entry.key] = true;
    }
    return envs;
  }, {});
}

function mergeEnvKeys(...sources: Record<string, boolean>[]): Record<string, boolean> {
  return sources.reduce((merged: Record<string, boolean>, source) => {
    Object.keys(source).forEach((key) => {
      if (source[key]) {
        merged[key] = true;
      }
    });

    return merged;
  }, {});
}

function summarizeMissing(
  keys: string[],
  source: Record<string, unknown>,
  target: Record<string, unknown>
): string[] {
  return keys.filter((key) => source[key] && !target[key]);
}

function requiredDeployKeysFor(envKeys: Record<string, unknown>): string[] {
  const keys = REQUIRED_DEPLOY_ENV_KEYS.slice();
  if (envKeys.VITE_SENTRY_DSN) {
    keys.push(...OPTIONAL_OBSERVABILITY_BUILD_ENV_KEYS);
  }
  return keys;
}

function parityDeployKeys(source: Record<string, unknown>): string[] {
  const keys = REQUIRED_DEPLOY_ENV_KEYS.slice();
  if (source.VITE_SENTRY_DSN) {
    keys.push("VITE_SENTRY_DSN", ...OPTIONAL_OBSERVABILITY_BUILD_ENV_KEYS);
  }
  return keys;
}

function main(): void {
  const branch = process.env.VERCEL_ENV_CHECK_BRANCH || currentBranch();
  const production = listEnvKeys("production");
  const preview = mergeEnvKeys(listEnvKeys("preview"), listEnvKeys("preview", branch));
  const requiredProductionDeployKeys = requiredDeployKeysFor(production);
  const requiredPreviewDeployKeys = requiredDeployKeysFor(preview);
  const deployParityKeys = parityDeployKeys(production);

  const missingInProduction = requiredProductionDeployKeys.filter(
    (key: string) => !production[key]
  );
  const missingInPreview = requiredPreviewDeployKeys.filter((key: string) => !preview[key]);
  const missingFromPreviewComparedToProduction = summarizeMissing(
    deployParityKeys,
    production,
    preview
  );
  const missingCronInProduction = REQUIRED_CRON_ENV_KEYS.filter((key: string) => !production[key]);
  const missingCronInPreview = REQUIRED_CRON_ENV_KEYS.filter((key: string) => !preview[key]);
  const missingCronFromPreviewComparedToProduction = summarizeMissing(
    REQUIRED_CRON_ENV_KEYS,
    production,
    preview
  );

  if (
    !missingInProduction.length &&
    !missingInPreview.length &&
    !missingFromPreviewComparedToProduction.length &&
    !missingCronInProduction.length &&
    !missingCronInPreview.length &&
    !missingCronFromPreviewComparedToProduction.length
  ) {
    console.log(`Vercel env parity OK for branch ${branch}.`);
    return;
  }

  if (missingInProduction.length) {
    console.error(`Missing required production env vars: ${missingInProduction.join(", ")}`);
  }
  if (missingInPreview.length) {
    console.error(
      `Missing required preview env vars for branch ${branch}: ${missingInPreview.join(", ")}`
    );
  }
  if (missingFromPreviewComparedToProduction.length) {
    console.error(
      `Preview branch ${branch} is missing vars present in production: ${missingFromPreviewComparedToProduction.join(", ")}`
    );
  }
  if (missingCronInProduction.length) {
    console.error(`Missing cron env vars in production: ${missingCronInProduction.join(", ")}`);
  }
  if (missingCronInPreview.length) {
    console.error(
      `Missing cron env vars in preview for branch ${branch}: ${missingCronInPreview.join(", ")}`
    );
  }
  if (missingCronFromPreviewComparedToProduction.length) {
    console.error(
      `Preview branch ${branch} is missing cron vars present in production: ${missingCronFromPreviewComparedToProduction.join(", ")}`
    );
  }

  process.exitCode = 1;
}

main();
