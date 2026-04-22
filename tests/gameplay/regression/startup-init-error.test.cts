const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");

declare function register(name: string, fn: () => void | Promise<void>): void;

type RequestResult = { status: "resolved" } | { status: "rejected"; error: unknown };

function createMockRequest(pathname: string) {
  return {
    method: "GET",
    url: pathname,
    headers: {
      host: "127.0.0.1"
    }
  };
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: "",
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    writeHead(statusCode: number, headers: Record<string, string> = {}) {
      this.statusCode = statusCode;
      Object.assign(this.headers, headers);
    },
    end(chunk = "") {
      this.body += chunk || "";
    }
  };
}

function captureResult(promise: Promise<void>): Promise<RequestResult> {
  return promise.then(
    () => ({ status: "resolved" }),
    (error: unknown) => ({ status: "rejected", error })
  );
}

function loadServerWithMockedGameSessionStore(createGameSessionStoreMock: () => any) {
  const serverModulePath = require.resolve("../../../backend/server.cjs");
  const gameSessionStoreModulePath = require.resolve("../../../backend/game-session-store.cjs");
  const cache = require.cache as Record<string, any>;
  const originalServerModule = cache[serverModulePath];
  const originalGameSessionStoreModule = cache[gameSessionStoreModulePath];

  delete cache[serverModulePath];
  cache[gameSessionStoreModulePath] = {
    exports: {
      createGameSessionStore: createGameSessionStoreMock
    }
  };

  const serverModule = require("../../../backend/server.cjs");

  return {
    serverModule,
    restore() {
      serverModule.datastore?.close?.();

      if (originalGameSessionStoreModule) {
        cache[gameSessionStoreModulePath] = originalGameSessionStoreModule;
      } else {
        delete cache[gameSessionStoreModulePath];
      }

      if (originalServerModule) {
        cache[serverModulePath] = originalServerModule;
      } else {
        delete cache[serverModulePath];
      }
    }
  };
}

register("concurrent API requests propagate the same active-game init failure", async () => {
  const pendingInitializations: Array<{ reject: (error: Error) => void }> = [];
  const { serverModule, restore } = loadServerWithMockedGameSessionStore(() => {
    let rejectInitialization = (_error: Error) => {};
    const initialization = new Promise((_, reject) => {
      rejectInitialization = reject;
    });

    pendingInitializations.push({ reject: rejectInitialization });

    return {
      ensureActiveGame() {
        return initialization;
      },
      listGames() {
        return [];
      }
    };
  });

  const tempRoot = path.join(os.tmpdir(), `netrisk-startup-init-${process.pid}-${Date.now()}`);
  const app = serverModule.createApp({
    projectRoot: process.cwd(),
    dbFile: path.join(tempRoot, "data", "startup-init.sqlite"),
    dataFile: path.join(tempRoot, "data", "users.json"),
    gamesFile: path.join(tempRoot, "data", "games.json"),
    sessionsFile: path.join(tempRoot, "data", "sessions.json")
  });

  try {
    const testInitialization = pendingInitializations.at(-1);
    if (!testInitialization) {
      throw new Error("Missing mocked game-session initialization");
    }

    const startupError = new Error("startup init failed");
    const requestUrl = new URL("http://127.0.0.1/api/games");
    const firstRequest = captureResult(
      app.handleApi(createMockRequest("/api/games"), createMockResponse(), requestUrl)
    );
    const secondRequest = captureResult(
      app.handleApi(createMockRequest("/api/games"), createMockResponse(), requestUrl)
    );

    testInitialization.reject(startupError);

    const [firstResult, secondResult] = await Promise.all([firstRequest, secondRequest]);

    assert.deepEqual(firstResult, {
      status: "rejected",
      error: startupError
    });
    assert.deepEqual(secondResult, {
      status: "rejected",
      error: startupError
    });
  } finally {
    app.datastore.close();
    restore();
  }
});
