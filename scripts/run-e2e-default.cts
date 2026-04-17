const path = require("path");
const { spawn } = require("child_process");

type ExitResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
  runLabel: string;
};

type RunPlan = {
  label: string;
  args: string[];
  requestedPort: number;
};

function hasFlag(args: string[], flag: string): boolean {
  return args.some((arg) => arg === flag || arg.startsWith(`${flag}=`));
}

function hasReporterOverride(args: string[]): boolean {
  return hasFlag(args, "--reporter");
}

function hasOutputOverride(args: string[]): boolean {
  return hasFlag(args, "--output");
}

function hasPositionalArgs(args: string[]): boolean {
  return args.some((arg) => !arg.startsWith("-"));
}

function shouldRunSingleShard(args: string[]): boolean {
  if (hasPositionalArgs(args)) {
    return true;
  }

  const singleShardFlags = [
    "--debug",
    "--headed",
    "--project",
    "--shard",
    "--ui",
    "--update-snapshots",
    "--workers"
  ];

  return singleShardFlags.some((flag) => hasFlag(args, flag));
}

function getConfiguredShardCount(): number | null {
  const rawValue = String(process.env.NETRISK_E2E_SHARDS || process.env.E2E_SHARDS || "").trim();
  if (!rawValue) {
    return null;
  }

  const shardCount = Number(rawValue);
  return Number.isInteger(shardCount) && shardCount > 0 ? shardCount : null;
}

function pipeWithPrefix(
  stream: NodeJS.ReadableStream | null,
  target: NodeJS.WriteStream,
  prefix: string
): Promise<void> {
  if (!stream) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let buffer = "";

    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        target.write(`${prefix}${line}\n`);
      }
    });
    stream.on("end", () => {
      if (buffer) {
        target.write(`${prefix}${buffer}\n`);
      }
      resolve();
    });
  });
}

function buildShardPlans(args: string[], shardCount: number): RunPlan[] {
  return Array.from({ length: shardCount }, (_, index) => ({
    label: `${index + 1}/${shardCount}`,
    args: [...args, `--shard=${index + 1}/${shardCount}`],
    requestedPort: 3100 + index * 20
  }));
}

function buildGroupedPlans(): RunPlan[] {
  return [
    {
      label: "gameplay",
      args: ["e2e/gameplay"],
      requestedPort: 3100
    },
    {
      label: "layout-map",
      args: ["e2e/layout", "e2e/map"],
      requestedPort: 3120
    },
    {
      label: "visual-profile",
      args: ["e2e/00-visual", "e2e/profile", "e2e/smoke"],
      requestedPort: 3140
    }
  ];
}

async function runPlan(repoRoot: string, plan: RunPlan): Promise<ExitResult> {
  const runnerPath = path.join(repoRoot, ".tsbuild", "scripts", "run-e2e.cjs");
  const runArgs = [...plan.args];

  if (!hasReporterOverride(runArgs)) {
    runArgs.push("--reporter=line");
  }

  if (!hasOutputOverride(runArgs)) {
    runArgs.push(`--output=test-results/${plan.label.replace(/[^\w-]+/g, "-")}`);
  }

  const child = spawn(process.execPath, [runnerPath, ...runArgs], {
    cwd: repoRoot,
    env: {
      ...process.env,
      E2E_PORT: String(plan.requestedPort),
      PORT: String(plan.requestedPort),
      NETRISK_E2E_SHARD_LABEL: plan.label
    },
    stdio: ["inherit", "pipe", "pipe"]
  });

  const prefix = `[e2e ${plan.label}] `;
  const stdoutDone = pipeWithPrefix(child.stdout, process.stdout, prefix);
  const stderrDone = pipeWithPrefix(child.stderr, process.stderr, prefix);

  const result = await new Promise<ExitResult>((resolve) => {
    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      resolve({ code, signal, runLabel: plan.label });
    });
  });

  await Promise.all([stdoutDone, stderrDone]);
  return result;
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(process.cwd());
  const args = process.argv.slice(2);
  const explicitShardCount = getConfiguredShardCount();
  const runPlans = shouldRunSingleShard(args)
    ? [{ label: "single", args, requestedPort: 3100 }]
    : explicitShardCount
      ? buildShardPlans(args, explicitShardCount)
      : buildGroupedPlans();

  console.log(
    runPlans.length > 1
      ? `E2E default runner: avvio ${runPlans.length} processi Playwright isolati.`
      : "E2E default runner: avvio singolo processo Playwright."
  );

  const results = await Promise.all(runPlans.map((plan) => runPlan(repoRoot, plan)));
  const failed = results.find((result) => result.signal || result.code !== 0);

  if (failed?.signal) {
    process.kill(process.pid, failed.signal);
    return;
  }

  if (failed) {
    process.exit(failed.code == null ? 1 : failed.code);
    return;
  }

  console.log(
    runPlans.length > 1
      ? `E2E default runner: completati ${runPlans.length} processi senza errori.`
      : "E2E default runner: esecuzione completata senza errori."
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
