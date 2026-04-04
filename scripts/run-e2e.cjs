const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

function canBind(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen({ port, host: "127.0.0.1", exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(startPort, attempts = 20) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = startPort + offset;
    if (await canBind(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Nessuna porta libera trovata a partire da ${startPort}.`);
}

async function removeIfExists(filePath, attempts = 10, options = {}) {
  const strict = options.strict !== false;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await fs.promises.rm(filePath, { force: true });
      return;
    } catch (error) {
      if (!error || error.code === "ENOENT") {
        return;
      }

      if (!strict && (error.code === "EBUSY" || error.code === "EPERM")) {
        return;
      }

      if (attempt === attempts - 1) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

async function cleanupSqliteFiles(dbFile) {
  await removeIfExists(`${dbFile}-shm`);
  await removeIfExists(`${dbFile}-wal`);
  await removeIfExists(dbFile);
}

async function cleanupStaleE2eDatabases(dataDir) {
  const entries = await fs.promises.readdir(dataDir, { withFileTypes: true });
  const targets = entries
    .filter((entry) => entry.isFile() && /^e2e-\d+\.sqlite(?:-shm|-wal)?$/.test(entry.name))
    .map((entry) => path.join(dataDir, entry.name));

  for (const target of targets) {
    await removeIfExists(target, 3, { strict: false });
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isServerHealthy(baseURL) {
  return new Promise((resolve) => {
    const request = http.get(`${baseURL}/api/health`, (response) => {
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

async function waitForServer(baseURL, timeoutMs = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isServerHealthy(baseURL)) {
      return;
    }

    await wait(500);
  }

  throw new Error(`Timeout avvio server E2E su ${baseURL}.`);
}

async function main() {
  const requestedPort = Number(process.env.E2E_PORT || process.env.PORT || 3100);
  const port = await findAvailablePort(requestedPort);
  const baseURL = `http://127.0.0.1:${port}`;
  const args = process.argv.slice(2);
  const playwrightCli = require.resolve("@playwright/test/cli");
  const dataDir = path.join(__dirname, "..", "data");
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
  const serverChild = spawn(process.execPath, [path.join(__dirname, "start-e2e.cjs")], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    env: runnerEnv
  });

  try {
    await waitForServer(baseURL);
  } catch (error) {
    serverChild.kill();
    await cleanupSqliteFiles(dbFile);
    throw error;
  }

  const child = spawn(process.execPath, [playwrightCli, "test", "--config", "playwright.tmp.no-webserver.cjs", ...args], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    env: runnerEnv
  });

  child.on("exit", async (code, signal) => {
    serverChild.kill();
    await cleanupSqliteFiles(dbFile);
    await cleanupStaleE2eDatabases(dataDir);

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code == null ? 1 : code);
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
