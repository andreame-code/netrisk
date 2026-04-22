const assert = require("node:assert/strict");
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
