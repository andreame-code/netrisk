const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createSupabaseDatastore } = require("../../../backend/datastore-supabase.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("Supabase auth lookup uses a case-insensitive exact filter", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-supabase-lookup-"));
  const missingUsersFile = path.join(tempRoot, "missing-users.json");
  const missingGamesFile = path.join(tempRoot, "missing-games.json");
  const missingSessionsFile = path.join(tempRoot, "missing-sessions.json");
  const originalFetch = globalThis.fetch;
  let lastRequestUrl = "";

  globalThis.fetch = async (input: unknown) => {
    lastRequestUrl = String(input || "");
    return new Response(
      JSON.stringify([
        {
          id: "user-1",
          username: "Alice_Name",
          credentials_json: "{}",
          role: "user",
          profile_json: "{}",
          created_at: "2026-04-22T00:00:00.000Z"
        }
      ]),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  };

  try {
    const datastore = createSupabaseDatastore({
      supabaseUrl: "https://example.supabase.co",
      supabaseServiceRoleKey: "service-role-key",
      legacyUsersFile: missingUsersFile,
      legacyGamesFile: missingGamesFile,
      legacySessionsFile: missingSessionsFile
    });

    const user = await datastore.findUserByUsername("alice_name");
    assert.equal(user?.username, "Alice_Name");
    assert.match(lastRequestUrl, /username=ilike\./);
    assert.doesNotMatch(lastRequestUrl, /username=eq\./);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

register("user-facing backup and e2e scripts rebuild TypeScript output when needed", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
  ) as {
    scripts: Record<string, string>;
  };

  [
    "backup:data",
    "backup:check",
    "test:e2e",
    "test:e2e:headed",
    "test:e2e:split",
    "test:e2e:parallel",
    "test:e2e:serial",
    "test:e2e:smoke",
    "test:e2e:update"
  ].forEach((scriptName) => {
    assert.match(
      packageJson.scripts[scriptName] || "",
      /^npm run build:ts && node \.tsbuild\/scripts\//
    );
  });
});

register("sync public assets removes stale removed UI artifacts", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-sync-public-assets-"));
  const publicDir = path.join(tempRoot, "public");
  const sourceAssetsDir = path.join(tempRoot, "frontend", "assets");
  const scriptPath = path.join(process.cwd(), ".tsbuild", "scripts", "sync-public-assets.cjs");

  fs.mkdirSync(path.join(publicDir, "legacy"), { recursive: true });
  fs.mkdirSync(path.join(publicDir, "vendor"), { recursive: true });
  fs.mkdirSync(path.join(publicDir, "generated"), { recursive: true });
  fs.mkdirSync(sourceAssetsDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, "legacy", "index.html"), "stale");
  fs.writeFileSync(path.join(publicDir, "vendor", "zod.mjs"), "stale");
  fs.writeFileSync(path.join(publicDir, "static-site.mjs"), "stale");
  fs.writeFileSync(path.join(publicDir, "speed-insights.js"), "stale");
  fs.writeFileSync(path.join(publicDir, "app.mjs"), "stale");
  fs.writeFileSync(path.join(publicDir, "generated", "static-text-assets.mjs"), "stale");
  fs.writeFileSync(path.join(sourceAssetsDir, "favicon.svg"), "<svg />");

  try {
    childProcess.execFileSync(process.execPath, [scriptPath], {
      cwd: tempRoot,
      stdio: "pipe"
    });

    [
      "legacy",
      "vendor",
      "static-site.mjs",
      "speed-insights.js",
      "app.mjs",
      path.join("generated", "static-text-assets.mjs")
    ].forEach((relativePath) => {
      assert.equal(fs.existsSync(path.join(publicDir, relativePath)), false);
    });
    assert.equal(fs.readFileSync(path.join(publicDir, "assets", "favicon.svg"), "utf8"), "<svg />");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
