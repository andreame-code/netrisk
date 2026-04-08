const { spawn } = require("child_process");
const path = require("path");

async function main() {
  const baseURL = process.env.E2E_BASE_URL || process.argv[2];
  if (!baseURL) {
    throw new Error("Specifica E2E_BASE_URL oppure passa l'URL remoto come primo argomento.");
  }

  const playwrightCli = require.resolve("@playwright/test/cli");
  const child = spawn(process.execPath, [
    playwrightCli,
    "test",
    "--config",
    "playwright.tmp.no-webserver.cjs",
    "e2e/remote",
    ...process.argv.slice(3)
  ], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    env: {
      ...process.env,
      E2E_BASE_URL: baseURL
    }
  });

  child.on("exit", (code, signal) => {
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
