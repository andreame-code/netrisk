const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

interface CleanupOptions {
  strict?: boolean;
}

interface ExitResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}

function canBind(port: number): Promise<boolean> {
  return new Promise((resolve: (value: boolean) => void) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen({ port, host: "127.0.0.1", exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(startPort: number, attempts: number = 20): Promise<number> {
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = startPort + offset;
    if (await canBind(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Nessuna porta libera trovata a partire da ${startPort}.`);
}

async function removeIfExists(filePath: string, attempts: number = 10, options: CleanupOptions = {}): Promise<void> {
  const strict = options.strict !== false;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await fs.promises.rm(filePath, { force: true });
      return;
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException | null;
      if (!fsError || fsError.code === "ENOENT") {
        return;
      }

      if (!strict && (fsError.code === "EBUSY" || fsError.code === "EPERM")) {
        return;
      }

      if (attempt === attempts - 1) {
        throw fsError;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

async function cleanupSqliteFiles(dbFile: string): Promise<void> {
  await removeIfExists(`${dbFile}-shm`);
  await removeIfExists(`${dbFile}-wal`);
  await removeIfExists(dbFile);
}

async function cleanupStaleE2eDatabases(dataDir: string): Promise<void> {
  const entries = await fs.promises.readdir(dataDir, { withFileTypes: true });
  const targets = entries
    .filter((entry: import("node:fs").Dirent) => entry.isFile() && /^e2e-\d+\.sqlite(?:-shm|-wal)?$/.test(entry.name))
    .map((entry: import("node:fs").Dirent) => path.join(dataDir, entry.name));

  for (const target of targets) {
    await removeIfExists(target, 3, { strict: false });
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isServerHealthy(baseURL: string): Promise<boolean> {
  return new Promise((resolve: (value: boolean) => void) => {
    const request = http.get(`${baseURL}/api/health`, (response: import("node:http").IncomingMessage) => {
      response.resume();
      resolve(response.statusCode === 200);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(2000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(baseURL: string, timeoutMs: number = 120000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isServerHealthy(baseURL)) {
      return;
    }

    await wait(500);
  }

  throw new Error(`Timeout avvio server E2E su ${baseURL}.`);
}

function createNoWebserverPlaywrightConfig(repoRoot: string, tempConfigPath: string | null = null): Promise<string> {
  const sourceConfig = path.join(repoRoot, "playwright.config.cjs");
  const tempConfig = tempConfigPath || path.join(repoRoot, ".tsbuild", "playwright.tmp.no-webserver.cjs");
  const configPath = JSON.stringify(sourceConfig);
  const sourceRoot = JSON.stringify(repoRoot);
  const content = `const baseConfig = require(${configPath});
const sourceRoot = ${sourceRoot};
if (baseConfig.testDir) {
  baseConfig.testDir = require("path").resolve(sourceRoot, baseConfig.testDir);
}
if (baseConfig.outputDir) {
  baseConfig.outputDir = require("path").resolve(sourceRoot, baseConfig.outputDir);
}
delete baseConfig.webServer;
module.exports = baseConfig;
`;
  return fs.promises.writeFile(tempConfig, content, "utf8").then(() => tempConfig);
}

function removeNoWebserverPlaywrightConfig(repoRoot: string): Promise<void> {
  return removeIfExists(path.join(repoRoot, ".tsbuild", "playwright.tmp.no-webserver.cjs"), 3, { strict: false });
}

async function main(): Promise<void> {
  const requestedPort = Number(process.env.E2E_PORT || process.env.PORT || 3100);
  const port = await findAvailablePort(requestedPort);
  const baseURL = `http://127.0.0.1:${port}`;
  const args = process.argv.slice(2);
  const playwrightCli = require.resolve("@playwright/test/cli");
  const repoRoot = path.resolve(process.cwd());
  const dataDir = path.join(repoRoot, "data");
  const runId = `${Date.now()}-${process.pid}`;
  const dbFile = path.join(dataDir, `e2e-${runId}.sqlite`);
  const runnerEnv = {
    ...process.env,
    PORT: String(port),
    E2E_PORT: String(port),
    E2E_BASE_URL: baseURL,
    E2E_DB_FILE: dbFile
  };
  await cleanupStaleE2eDatabases(dataDir);
  await cleanupSqliteFiles(dbFile);
  const serverChild = spawn(process.execPath, [path.join(repoRoot, "scripts", "start-e2e.cjs")], {
    cwd: repoRoot,
    stdio: "inherit",
    env: runnerEnv
  });
  const tempConfigPath = path.join(repoRoot, ".tsbuild", "playwright.tmp.no-webserver.cjs");
  await createNoWebserverPlaywrightConfig(repoRoot, tempConfigPath);

  try {
    await waitForServer(baseURL);
  } catch (error) {
    serverChild.kill();
    await removeNoWebserverPlaywrightConfig(repoRoot);
    await cleanupSqliteFiles(dbFile);
    throw error;
  }

  const child = spawn(process.execPath, [playwrightCli, "test", "--config", tempConfigPath, ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    env: runnerEnv
  });

  const result = await new Promise<ExitResult>((resolve) => {
    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      resolve({ code, signal });
    });
  });
  serverChild.kill();
  await removeNoWebserverPlaywrightConfig(repoRoot);
  await cleanupSqliteFiles(dbFile);
  await cleanupStaleE2eDatabases(dataDir);

  if (result.signal) {
    process.kill(process.pid, result.signal);
    return;
  }

  process.exit(result.code == null ? 1 : result.code);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
