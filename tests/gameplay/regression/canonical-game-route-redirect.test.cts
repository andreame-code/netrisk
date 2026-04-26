const assert = require("node:assert/strict");
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

async function callRequest(app: any, pathname: string): Promise<MockResponse> {
  const req = new (require("events").EventEmitter)();
  req.method = "GET";
  req.url = pathname;
  req.headers = { host: "127.0.0.1" };
  req.destroy = () => {};

  const res = makeMockResponse();

  await new Promise<void>((resolve) => {
    const originalEnd = res.end.bind(res);
    res.end = (chunk = "") => {
      originalEnd(chunk);
      resolve();
    };
    app.handleRequest(req, res);
  });

  return res;
}

async function withApp(run: (app: any) => Promise<void>): Promise<void> {
  const tempRoot = path.join(
    os.tmpdir(),
    `netrisk-canonical-game-route-${process.pid}-${Date.now()}`
  );
  const app = createApp({
    projectRoot: process.cwd(),
    dbFile: path.join(tempRoot, "data", "routes.sqlite"),
    dataFile: path.join(tempRoot, "data", "users.json"),
    gamesFile: path.join(tempRoot, "data", "games.json"),
    sessionsFile: path.join(tempRoot, "data", "sessions.json")
  });

  try {
    await run(app);
  } finally {
    app.datastore.close();
  }
}

register("GET /game.html without gameId is no longer a supported entrypoint", async () => {
  await withApp(async (app: any) => {
    const response = await callRequest(app, "/game.html");

    assert.equal(response.statusCode, 404);
  });
});

register("GET /legacy redirects to the canonical landing route", async () => {
  await withApp(async (app: any) => {
    const response = await callRequest(app, "/legacy");

    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.Location, "/");
  });
});

register("GET deprecated /legacy landing documents redirect to /", async () => {
  await withApp(async (app: any) => {
    const cases = ["/legacy/", "/legacy/index.html", "/legacy/landing.html"];

    for (const requestPath of cases) {
      const response = await callRequest(app, requestPath);

      assert.equal(response.statusCode, 302, requestPath);
      assert.equal(response.headers.Location, "/", requestPath);
    }
  });
});

register("GET deprecated /legacy document routes preserve canonical query params", async () => {
  await withApp(async (app: any) => {
    const cases = [
      {
        requestPath: "/legacy/register.html?next=%2Fprofile",
        expectedLocation: "/register?next=%2Fprofile"
      },
      {
        requestPath: "/legacy/lobby.html?tab=active",
        expectedLocation: "/lobby?tab=active"
      },
      {
        requestPath: "/legacy/new-game.html?preset=quick",
        expectedLocation: "/lobby/new?preset=quick"
      },
      {
        requestPath: "/legacy/profile.html?tab=stats",
        expectedLocation: "/profile?tab=stats"
      }
    ];

    for (const { requestPath, expectedLocation } of cases) {
      const response = await callRequest(app, requestPath);

      assert.equal(response.statusCode, 302, requestPath);
      assert.equal(response.headers.Location, expectedLocation, requestPath);
    }
  });
});

register(
  "GET /legacy/game.html with gameId redirects to the canonical React deep link",
  async () => {
    await withApp(async (app: any) => {
      const response = await callRequest(app, "/legacy/game.html?gameId=g-123");

      assert.equal(response.statusCode, 302);
      assert.equal(response.headers.Location, "/game/g-123");
    });
  }
);

register(
  "GET /legacy/game.html preserves non-gameId query params in the canonical React redirect",
  async () => {
    await withApp(async (app: any) => {
      const response = await callRequest(
        app,
        "/legacy/game.html?gameId=g-123&lang=en&view=compact"
      );

      assert.equal(response.statusCode, 302);
      assert.equal(response.headers.Location, "/game/g-123?lang=en&view=compact");
    });
  }
);

register("GET /legacy/game.html without gameId redirects to /game", async () => {
  await withApp(async (app: any) => {
    const response = await callRequest(app, "/legacy/game.html");

    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.Location, "/game");
  });
});

register("GET /legacy/game.html without gameId keeps non-gameId query params", async () => {
  await withApp(async (app: any) => {
    const response = await callRequest(app, "/legacy/game.html?lang=en&view=compact");

    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.Location, "/game?lang=en&view=compact");
  });
});

register("GET /register.html is no longer a supported compatibility entrypoint", async () => {
  await withApp(async (app: any) => {
    const response = await callRequest(app, "/register.html?next=%2Fprofile");

    assert.equal(response.statusCode, 404);
  });
});

register("GET /legacy/lobby.html redirects to the canonical lobby route", async () => {
  await withApp(async (app: any) => {
    const response = await callRequest(app, "/legacy/lobby.html?tab=active");

    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.Location, "/lobby?tab=active");
  });
});

register("GET /legacy assets without a canonical route return 404", async () => {
  await withApp(async (app: any) => {
    const cases = [
      "/legacy/generated/runtime.css",
      "/legacy/app.mjs",
      "/legacy/shell.mjs",
      "/legacy/style.css"
    ];

    for (const requestPath of cases) {
      const response = await callRequest(app, requestPath);

      assert.equal(response.statusCode, 404, requestPath);
      assert.equal(response.body, "Not found", requestPath);
    }
  });
});
