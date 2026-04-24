const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createAuthStore } = require("../../../backend/auth.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function createDatastore(user: unknown) {
  return {
    async listUsers() {
      return user ? [user] : [];
    },
    async findUserByUsername() {
      return user;
    },
    async findUserById() {
      return user;
    },
    async createUser(createdUser: unknown) {
      return createdUser;
    },
    async updateUserCredentials() {
      throw new Error("Legacy mismatch must not migrate credentials.");
    },
    async updateUserProfile() {
      throw new Error("Profile updates are not used by this test.");
    },
    async createSession() {
      throw new Error("Invalid login must not create a session.");
    },
    async findSession() {
      return null;
    },
    async deleteSession() {}
  };
}

register("legacy password mismatch performs dummy verification work", async () => {
  const legacyUser = {
    id: "legacy-user",
    username: "legacy_general",
    role: "user",
    credentials: {
      password: {
        secret: "correct-password"
      }
    }
  };
  const store = createAuthStore({ datastore: createDatastore(legacyUser) });
  const originalScryptSync = crypto.scryptSync;
  const salts: string[] = [];

  crypto.scryptSync = function patchedScryptSync(password: string, salt: string, keylen: number) {
    salts.push(salt);
    return originalScryptSync.call(this, password, salt, keylen);
  };

  try {
    const result = await store.loginWithPassword("legacy_general", "wrong-password");

    assert.equal(result.ok, false);
    assert.equal(result.errorKey, "auth.login.invalidCredentials");
    assert.deepEqual(salts, ["00000000000000000000000000000000"]);
  } finally {
    crypto.scryptSync = originalScryptSync;
  }
});
