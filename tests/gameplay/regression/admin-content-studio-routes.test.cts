const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createApp } = require("../../../backend/server.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

type HeaderMap = Record<string, string>;

type MockResponse = {
  statusCode: number;
  headers: HeaderMap;
  body: string;
  setHeader(name: string, value: string): void;
  writeHead(statusCode: number, nextHeaders?: HeaderMap): void;
  end(chunk?: string): void;
};

function makeMockResponse(): MockResponse {
  const headers: HeaderMap = {};
  return {
    statusCode: 200,
    headers,
    body: "",
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    writeHead(statusCode: number, nextHeaders: HeaderMap = {}) {
      this.statusCode = statusCode;
      Object.assign(headers, nextHeaders);
    },
    end(chunk = "") {
      this.body += chunk || "";
    }
  };
}

async function callApp(
  app: any,
  method: string,
  pathname: string,
  body?: any,
  headers: HeaderMap = {}
): Promise<{ statusCode: number; payload: any }> {
  const req = new (require("events").EventEmitter)();
  req.method = method;
  req.headers = { "content-type": "application/json", ...headers };
  req.destroy = () => {};
  const res = makeMockResponse();
  const promise = app.handleApi(req, res, new URL(`http://127.0.0.1${pathname}`));

  process.nextTick(() => {
    if (body !== undefined) {
      req.emit("data", JSON.stringify(body));
    }
    req.emit("end");
  });

  await promise;
  return {
    statusCode: res.statusCode,
    payload: res.body ? JSON.parse(res.body) : null
  };
}

function authHeaders(sessionToken: string): HeaderMap {
  return {
    cookie: `netrisk_session=${encodeURIComponent(sessionToken)}`
  };
}

function cleanupSqliteFiles(baseFile: string): void {
  [baseFile, `${baseFile}-shm`, `${baseFile}-wal`].forEach((target) => {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
    }
  });
}

async function withAdminApp(
  run: (context: { app: any; adminSessionToken: string; tempRoot: string }) => Promise<void>
) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-content-studio-"));
  const dataDir = path.join(tempRoot, "data");
  const frontendDir = path.join(tempRoot, "frontend", "src");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(frontendDir, { recursive: true });

  const originalProjectRoot = process.env.NETRISK_PROJECT_ROOT;
  process.env.NETRISK_PROJECT_ROOT = tempRoot;

  const tempDbFile = path.join(tempRoot, "data", "admin.sqlite");
  const tempUsersFile = path.join(tempRoot, "data", "users.json");
  const tempGamesFile = path.join(tempRoot, "data", "games.json");
  const tempSessionsFile = path.join(tempRoot, "data", "sessions.json");
  const app = createApp({
    projectRoot: tempRoot,
    dbFile: tempDbFile,
    dataFile: tempUsersFile,
    gamesFile: tempGamesFile,
    sessionsFile: tempSessionsFile
  });

  try {
    const registered = await app.auth.registerPasswordUser("studio_admin", "secret123");
    assert.equal(registered.ok, true);
    await app.datastore.updateUserRoleByUsername("studio_admin", "admin");
    const login = await app.auth.loginWithPassword("studio_admin", "secret123");
    assert.equal(login.ok, true);

    await run({
      app,
      adminSessionToken: login.sessionToken,
      tempRoot
    });
  } finally {
    app.datastore.close();
    cleanupSqliteFiles(tempDbFile);
    fs.rmSync(tempRoot, { recursive: true, force: true });
    if (typeof originalProjectRoot === "undefined") {
      delete process.env.NETRISK_PROJECT_ROOT;
    } else {
      process.env.NETRISK_PROJECT_ROOT = originalProjectRoot;
    }
  }
}

function createVictoryDraft(
  overrides: Partial<{
    id: string;
    name: string;
    description: string;
    version: string;
    mapId: string;
    objectives: unknown[];
  }> = {}
) {
  return {
    id: overrides.id || "victory.world.na-asia",
    name: overrides.name || "North America and Asia",
    description:
      overrides.description || "Author a world-classic objective that spans two strategic continents.",
    version: overrides.version || "1.0.0",
    moduleType: "victory-objectives",
    content: {
      mapId: overrides.mapId || "world-classic",
      objectives:
        overrides.objectives || [
          {
            id: "hold-na-asia",
            title: "Hold North America and Asia",
            description: "Control North America and Asia at the same time.",
            enabled: true,
            type: "control-continents",
            continentIds: ["north_america", "asia"]
          }
        ]
    }
  };
}

register("content studio routes expose CRUD, validation, and enable toggles", async () => {
  await withAdminApp(async ({ app, adminSessionToken }) => {
    const draft = createVictoryDraft();

    const optionsResponse = await callApp(
      app,
      "GET",
      "/api/admin/content-studio/options",
      undefined,
      authHeaders(adminSessionToken)
    );
    assert.equal(optionsResponse.statusCode, 200);
    assert.equal(
      optionsResponse.payload.maps.some((entry: { id?: string }) => entry.id === "world-classic"),
      true
    );

    const validateResponse = await callApp(
      app,
      "POST",
      "/api/admin/content-studio/modules/validate",
      draft,
      authHeaders(adminSessionToken)
    );
    assert.equal(validateResponse.statusCode, 200);
    assert.equal(validateResponse.payload.validation.valid, true);
    assert.match(validateResponse.payload.preview.summary, /North America and Asia/i);

    const createResponse = await callApp(
      app,
      "POST",
      "/api/admin/content-studio/modules",
      draft,
      authHeaders(adminSessionToken)
    );
    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.payload.module.status, "draft");

    const listResponse = await callApp(
      app,
      "GET",
      "/api/admin/content-studio/modules",
      undefined,
      authHeaders(adminSessionToken)
    );
    assert.equal(listResponse.statusCode, 200);
    assert.equal(
      listResponse.payload.modules.some((entry: { id?: string }) => entry.id === draft.id),
      true
    );

    const detailResponse = await callApp(
      app,
      "GET",
      `/api/admin/content-studio/modules/${encodeURIComponent(draft.id)}`,
      undefined,
      authHeaders(adminSessionToken)
    );
    assert.equal(detailResponse.statusCode, 200);
    assert.equal(detailResponse.payload.module.id, draft.id);

    const updatedDraft = createVictoryDraft({
      id: draft.id,
      description: "Updated objective copy for runtime exposure.",
      objectives: [
        ...draft.content.objectives,
        {
          id: "hold-europe-south-america",
          title: "Hold Europe and South America",
          description: "Control Europe and South America at the same time.",
          enabled: false,
          type: "control-continents",
          continentIds: ["europe", "south_america"]
        }
      ]
    });

    const updateResponse = await callApp(
      app,
      "PUT",
      `/api/admin/content-studio/modules/${encodeURIComponent(draft.id)}`,
      updatedDraft,
      authHeaders(adminSessionToken)
    );
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.payload.module.description, updatedDraft.description);
    assert.equal(updateResponse.payload.module.content.objectives.length, 2);

    const publishResponse = await callApp(
      app,
      "POST",
      `/api/admin/content-studio/modules/${encodeURIComponent(draft.id)}/publish`,
      {},
      authHeaders(adminSessionToken)
    );
    assert.equal(publishResponse.statusCode, 200);
    assert.equal(publishResponse.payload.module.status, "published");

    const enabledOptionsResponse = await callApp(app, "GET", "/api/game/options");
    assert.equal(enabledOptionsResponse.statusCode, 200);
    assert.equal(
      enabledOptionsResponse.payload.victoryRuleSets.some((entry: { id?: string }) => entry.id === draft.id),
      true
    );

    const disableResponse = await callApp(
      app,
      "POST",
      `/api/admin/content-studio/modules/${encodeURIComponent(draft.id)}/disable`,
      {},
      authHeaders(adminSessionToken)
    );
    assert.equal(disableResponse.statusCode, 200);
    assert.equal(disableResponse.payload.module.status, "disabled");

    const disabledOptionsResponse = await callApp(app, "GET", "/api/game/options");
    assert.equal(disabledOptionsResponse.statusCode, 200);
    assert.equal(
      disabledOptionsResponse.payload.victoryRuleSets.some((entry: { id?: string }) => entry.id === draft.id),
      false
    );

    const enableResponse = await callApp(
      app,
      "POST",
      `/api/admin/content-studio/modules/${encodeURIComponent(draft.id)}/enable`,
      {},
      authHeaders(adminSessionToken)
    );
    assert.equal(enableResponse.statusCode, 200);
    assert.equal(enableResponse.payload.module.status, "published");

    const reenabledOptionsResponse = await callApp(app, "GET", "/api/game/options");
    assert.equal(reenabledOptionsResponse.statusCode, 200);
    assert.equal(
      reenabledOptionsResponse.payload.victoryRuleSets.some((entry: { id?: string }) => entry.id === draft.id),
      true
    );
  });
});

register("content studio update route rejects body and path id mismatches", async () => {
  await withAdminApp(async ({ app, adminSessionToken }) => {
    const response = await callApp(
      app,
      "PUT",
      "/api/admin/content-studio/modules/victory.route-id",
      createVictoryDraft({ id: "victory.body-id" }),
      authHeaders(adminSessionToken)
    );

    assert.equal(response.statusCode, 400);
    assert.match(String(response.payload.error || ""), /does not match route id/i);
  });
});

register("content studio blocks draft edits after a module is published", async () => {
  await withAdminApp(async ({ app, adminSessionToken }) => {
    const draft = createVictoryDraft({ id: "victory.published-edit-lock" });

    const createResponse = await callApp(
      app,
      "POST",
      "/api/admin/content-studio/modules",
      draft,
      authHeaders(adminSessionToken)
    );
    assert.equal(createResponse.statusCode, 201);

    const publishResponse = await callApp(
      app,
      "POST",
      `/api/admin/content-studio/modules/${encodeURIComponent(draft.id)}/publish`,
      {},
      authHeaders(adminSessionToken)
    );
    assert.equal(publishResponse.statusCode, 200);

    const updateResponse = await callApp(
      app,
      "PUT",
      `/api/admin/content-studio/modules/${encodeURIComponent(draft.id)}`,
      createVictoryDraft({
        id: draft.id,
        description: "Attempt to edit a published module."
      }),
      authHeaders(adminSessionToken)
    );
    assert.equal(updateResponse.statusCode, 409);
    assert.match(String(updateResponse.payload.error || ""), /only draft modules are editable/i);
  });
});
