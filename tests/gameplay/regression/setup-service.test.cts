const assert = require("node:assert/strict");
const { createAuthStore } = require("../../../backend/auth.cjs");
const { createSetupService } = require("../../../backend/setup-service.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

type StoredUser = {
  id: string;
  username: string;
  role: string;
  credentials?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  createdAt?: string;
};

function createSetupHarness(
  options: { users?: StoredUser[]; setupCompleted?: boolean; healthOk?: boolean } = {}
) {
  const users = [...(options.users || [])];
  const appState = new Map<string, unknown>();
  if (options.setupCompleted !== undefined) {
    appState.set("setupCompleted", options.setupCompleted);
  }

  const datastore = {
    async healthSummary() {
      return { ok: options.healthOk !== false };
    },
    async listUsers() {
      return users;
    },
    async findUserByUsername(username: string) {
      return (
        users.find(
          (user) => user.username.toLowerCase() === String(username || "").toLowerCase()
        ) || null
      );
    },
    async findUserById(userId: string) {
      return users.find((user) => user.id === userId) || null;
    },
    async createUser(user: StoredUser) {
      users.push(user);
      return user;
    },
    async updateUserCredentials() {
      throw new Error("Credential updates are not used by setup tests.");
    },
    async updateUserProfile() {
      throw new Error("Profile updates are not used by setup tests.");
    },
    async createSession() {
      throw new Error("Session creation is not used by setup tests.");
    },
    async findSession() {
      return null;
    },
    async deleteSession() {},
    async getAppState(key: string) {
      return appState.get(key) ?? null;
    },
    async setAppState(key: string, value: unknown) {
      appState.set(key, value);
      return value;
    }
  };

  const auth = createAuthStore({ datastore });
  const setup = createSetupService({ auth, datastore });

  return { appState, setup, users };
}

register("setup status is required when no admin exists", async () => {
  const { setup } = createSetupHarness();

  assert.deepEqual(await setup.getSetupStatus(), {
    setupRequired: true,
    setupCompleted: false,
    hasAdminUser: false,
    datastoreOk: true
  });
});

register("setup status is complete when an admin exists and setupCompleted is true", async () => {
  const { setup } = createSetupHarness({
    users: [{ id: "u-1", username: "admin", role: "admin" }],
    setupCompleted: true
  });

  assert.deepEqual(await setup.getSetupStatus(), {
    setupRequired: false,
    setupCompleted: true,
    hasAdminUser: true,
    datastoreOk: true
  });
});

register("setup create first admin succeeds only during setup", async () => {
  const { setup, users } = createSetupHarness();

  const result = await setup.createFirstAdmin({
    username: "founder",
    password: "secure-passphrase"
  });

  assert.equal(result.ok, true);
  assert.equal(result.user.username, "founder");
  assert.equal(result.user.role, "admin");
  assert.equal(users.length, 1);
  assert.equal(users[0].role, "admin");
  assert.deepEqual(result.status, {
    setupRequired: true,
    setupCompleted: false,
    hasAdminUser: true,
    datastoreOk: true
  });
});

register("setup create first admin is rejected after setup completed", async () => {
  const { setup } = createSetupHarness({
    users: [{ id: "u-1", username: "admin", role: "admin" }],
    setupCompleted: true
  });

  const result = await setup.createFirstAdmin({
    username: "second_admin",
    password: "secure-passphrase"
  });

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 409);
  assert.equal(result.code, "SETUP_ALREADY_COMPLETED");
});

register("setup completion is rejected when no admin exists", async () => {
  const { setup } = createSetupHarness();

  const result = await setup.completeSetup();

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 400);
  assert.equal(result.code, "SETUP_ADMIN_REQUIRED");
});

register("setup completion marks app state after an admin exists", async () => {
  const { appState, setup } = createSetupHarness({
    users: [{ id: "u-1", username: "admin", role: "admin" }]
  });

  const result = await setup.completeSetup();

  assert.equal(result.ok, true);
  assert.equal(appState.get("setupCompleted"), true);
  assert.deepEqual(result.status, {
    setupRequired: false,
    setupCompleted: true,
    hasAdminUser: true,
    datastoreOk: true
  });
});

register("setup status includes datastore health", async () => {
  const { setup } = createSetupHarness({ healthOk: false });

  assert.deepEqual(await setup.getSetupStatus(), {
    setupRequired: true,
    setupCompleted: false,
    hasAdminUser: false,
    datastoreOk: false
  });
});
