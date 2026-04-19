const assert = require("node:assert/strict");
const {
  handleAuthSessionRoute,
  handleProfileRoute,
  handleThemePreferenceRoute
} = require("../../../backend/routes/account.cjs");
const {
  handleLoginRoute,
  handleRegisterRoute
} = require("../../../backend/routes/password-auth.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

type ValidationIssue = {
  path: string;
};

type LocalizedErrorCall = [
  unknown,
  number,
  unknown,
  string,
  string,
  Record<string, unknown> | undefined,
  string,
  { validationErrors: ValidationIssue[] }
];

function requireLocalizedErrorCall(call: LocalizedErrorCall | null): LocalizedErrorCall {
  if (!call) {
    throw new Error("Expected a localized validation error call.");
  }
  return call;
}

function createAccountDeps(overrides = {}) {
  return {
    req: {},
    res: {},
    requireAuth: async () => ({
      user: { id: "u-1", username: "commander" }
    }),
    auth: {
      publicUser(user: { id: string; username: string }) {
        return {
          id: user.id,
          username: user.username,
          role: "user",
          authMethods: ["password"],
          hasEmail: false,
          preferences: { theme: "command" }
        };
      },
      async updateUserThemePreference(userId: string, theme: string) {
        return {
          id: userId,
          username: "commander",
          preferences: { theme }
        };
      }
    },
    playerProfiles: {
      async getPlayerProfile(username: string) {
        return {
          playerName: username,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          gamesInProgress: 0,
          participatingGames: [],
          winRate: null,
          hasHistory: false,
          placeholders: {
            recentGames: true,
            ranking: true
          }
        };
      }
    },
    sendJson() {
      throw new Error("sendJson should not be called in validation-failure scenarios.");
    },
    sendLocalizedError() {
      throw new Error("sendLocalizedError should be stubbed in each test.");
    },
    extractUserPreferences() {
      return { theme: "command" };
    },
    supportedSiteThemes: new Set(["command", "midnight", "ember"]),
    resolveStoredTheme(theme: string) {
      return theme;
    },
    ...overrides
  };
}

register(
  "handleRegisterRoute rejects invalid inbound registration payloads with mapped validation errors",
  async () => {
    let localizedErrorCall: LocalizedErrorCall | null = null;

    await handleRegisterRoute(
      {},
      {},
      { username: 99 },
      {
        async registerPasswordUser() {
          throw new Error("Registration store should not be reached for invalid payloads.");
        }
      },
      () => {
        throw new Error("sendJson should not be called for invalid registration payloads.");
      },
      (...args: LocalizedErrorCall) => {
        localizedErrorCall = args;
      }
    );

    const call = requireLocalizedErrorCall(localizedErrorCall);
    assert.equal(call[1], 400);
    assert.equal(call[6], "REQUEST_VALIDATION_FAILED");
    assert.deepEqual(
      call[7].validationErrors.map((entry: ValidationIssue) => entry.path),
      ["username", "password"]
    );
  }
);

register(
  "handleLoginRoute rejects invalid inbound login payloads with mapped validation errors",
  async () => {
    let localizedErrorCall: LocalizedErrorCall | null = null;

    await handleLoginRoute(
      {},
      {},
      { username: 99 },
      {
        async loginWithPassword() {
          throw new Error("Login store should not be reached for invalid payloads.");
        }
      },
      () => {
        throw new Error("sendJson should not be called for invalid login payloads.");
      },
      (...args: LocalizedErrorCall) => {
        localizedErrorCall = args;
      },
      (_req: unknown, _sessionToken: string) => "session-cookie"
    );

    const call = requireLocalizedErrorCall(localizedErrorCall);
    assert.equal(call[1], 400);
    assert.equal(call[6], "REQUEST_VALIDATION_FAILED");
    assert.deepEqual(
      call[7].validationErrors.map((entry: ValidationIssue) => entry.path),
      ["username", "password"]
    );
  }
);

register(
  "handleThemePreferenceRoute rejects invalid inbound theme payloads with mapped validation errors",
  async () => {
    let localizedErrorCall: LocalizedErrorCall | null = null;

    await handleThemePreferenceRoute(
      createAccountDeps({
        sendLocalizedError(...args: LocalizedErrorCall) {
          localizedErrorCall = args;
        }
      }),
      { theme: 3 }
    );

    const call = requireLocalizedErrorCall(localizedErrorCall);
    assert.equal(call[1], 400);
    assert.equal(call[6], "REQUEST_VALIDATION_FAILED");
    assert.deepEqual(
      call[7].validationErrors.map((entry: ValidationIssue) => entry.path),
      ["theme"]
    );
  }
);

register("handleAuthSessionRoute traps invalid outbound auth session payloads", async () => {
  let localizedErrorCall: LocalizedErrorCall | null = null;

  const handled = await handleAuthSessionRoute(
    createAccountDeps({
      auth: {
        publicUser() {
          return { username: "commander" };
        },
        async updateUserThemePreference() {
          throw new Error("Not used in this test.");
        }
      },
      sendLocalizedError(...args: LocalizedErrorCall) {
        localizedErrorCall = args;
      }
    })
  );

  assert.equal(handled, true);
  const call = requireLocalizedErrorCall(localizedErrorCall);
  assert.equal(call[1], 500);
  assert.equal(call[6], "RESPONSE_VALIDATION_FAILED");
  assert.deepEqual(
    call[7].validationErrors.map((entry: ValidationIssue) => entry.path),
    ["user.id"]
  );
});

register("handleProfileRoute traps invalid outbound profile payloads", async () => {
  let localizedErrorCall: LocalizedErrorCall | null = null;

  const handled = await handleProfileRoute(
    createAccountDeps({
      playerProfiles: {
        async getPlayerProfile() {
          return {
            playerName: 17,
            gamesPlayed: "many"
          };
        }
      },
      sendLocalizedError(...args: LocalizedErrorCall) {
        localizedErrorCall = args;
      }
    })
  );

  assert.equal(handled, true);
  const call = requireLocalizedErrorCall(localizedErrorCall);
  assert.equal(call[1], 500);
  assert.equal(call[6], "RESPONSE_VALIDATION_FAILED");
  assert.deepEqual(
    call[7].validationErrors.map((entry: ValidationIssue) => entry.path).slice(0, 2),
    ["profile.playerName", "profile.gamesPlayed"]
  );
});

register(
  "handleThemePreferenceRoute traps invalid outbound theme preference payloads",
  async () => {
    let localizedErrorCall: LocalizedErrorCall | null = null;

    const handled = await handleThemePreferenceRoute(
      createAccountDeps({
        auth: {
          publicUser() {
            return null;
          },
          async updateUserThemePreference() {
            return {
              preferences: { theme: "midnight" }
            };
          }
        },
        sendLocalizedError(...args: LocalizedErrorCall) {
          localizedErrorCall = args;
        }
      }),
      { theme: "midnight" }
    );

    assert.equal(handled, true);
    const call = requireLocalizedErrorCall(localizedErrorCall);
    assert.equal(call[1], 500);
    assert.equal(call[6], "RESPONSE_VALIDATION_FAILED");
    assert.deepEqual(
      call[7].validationErrors.map((entry: ValidationIssue) => entry.path),
      ["user.id"]
    );
  }
);

register("handleLoginRoute traps invalid outbound login payloads", async () => {
  let localizedErrorCall: LocalizedErrorCall | null = null;

  await handleLoginRoute(
    {},
    {},
    { username: "commander", password: "secret123" },
    {
      async loginWithPassword() {
        return {
          ok: true,
          sessionToken: "session-1",
          user: {
            username: "commander"
          }
        };
      }
    },
    () => {
      throw new Error("sendJson should not run when login response validation fails.");
    },
    (...args: LocalizedErrorCall) => {
      localizedErrorCall = args;
    },
    (_req: unknown, _sessionToken: string) => "session-cookie"
  );

  const call = requireLocalizedErrorCall(localizedErrorCall);
  assert.equal(call[1], 500);
  assert.equal(call[6], "RESPONSE_VALIDATION_FAILED");
  assert.deepEqual(
    call[7].validationErrors.map((entry: ValidationIssue) => entry.path),
    ["user.id"]
  );
});

register("handleRegisterRoute traps invalid outbound register payloads", async () => {
  let localizedErrorCall: LocalizedErrorCall | null = null;

  await handleRegisterRoute(
    {},
    {},
    { username: "commander", password: "secret123" },
    {
      async registerPasswordUser() {
        return {
          ok: true,
          user: {
            username: "commander"
          }
        };
      }
    },
    () => {
      throw new Error("sendJson should not run when register response validation fails.");
    },
    (...args: LocalizedErrorCall) => {
      localizedErrorCall = args;
    }
  );

  const call = requireLocalizedErrorCall(localizedErrorCall);
  assert.equal(call[1], 500);
  assert.equal(call[6], "RESPONSE_VALIDATION_FAILED");
  assert.deepEqual(
    call[7].validationErrors.map((entry: ValidationIssue) => entry.path),
    ["user.id"]
  );
});
