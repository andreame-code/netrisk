const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createAuthStore, publicUser } = require("../../../backend/auth.cjs");
const { sessionTokenStorageKey } = require("../../../backend/session-token.cjs");

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

function createSessionDatastore(options: {
  user?: any;
  sessions?: Map<string, any>;
  failCreateSession?: boolean;
}) {
  const user = options.user || {
    id: "session-user",
    username: "session_user",
    role: "user",
    profile: { preferences: { theme: "command" } },
    credentials: {
      password: {
        algorithm: "scrypt",
        salt: "salt",
        keylen: 64,
        hash: "hash"
      }
    }
  };
  const sessions = options.sessions || new Map<string, any>();
  const deletedTokens: string[] = [];
  const createdSessions: Array<{ token: string; userId: string; createdAt: number }> = [];
  const updatedProfiles: any[] = [];

  return {
    deletedTokens,
    createdSessions,
    updatedProfiles,
    async listUsers() {
      return [user];
    },
    async findUserByUsername() {
      return user;
    },
    async findUserById(userId: string) {
      return userId === user.id ? user : null;
    },
    async createUser(createdUser: unknown) {
      return createdUser;
    },
    async updateUserCredentials() {
      throw new Error("Credential updates are not used by this test.");
    },
    async updateUserProfile(userId: string, profile: any) {
      updatedProfiles.push({ userId, profile });
      if (userId !== user.id) {
        return null;
      }
      user.profile = profile;
      return user;
    },
    async createSession(token: string, userId: string, createdAt: number) {
      createdSessions.push({ token, userId, createdAt });
      if (options.failCreateSession) {
        throw new Error("session create failed");
      }
      sessions.set(token, { user_id: userId, created_at: createdAt });
    },
    async findSession(token: string) {
      return sessions.get(token) || null;
    },
    async deleteSession(token: string) {
      deletedTokens.push(token);
      sessions.delete(token);
    }
  };
}

async function withEnvironmentVariable<T>(
  name: string,
  value: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const previous = process.env[name];
  if (typeof value === "undefined") {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }

  try {
    return await fn();
  } finally {
    if (typeof previous === "undefined") {
      delete process.env[name];
    } else {
      process.env[name] = previous;
    }
  }
}

register("legacy password mismatch performs bounded dummy verification work", async () => {
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
  const originalScrypt = crypto.scrypt;
  const salts: string[] = [];

  crypto.scrypt = function patchedScrypt(
    password: any,
    salt: any,
    keylen: any,
    options: any,
    callback?: any
  ) {
    salts.push(String(salt));
    const actualOptions = typeof options === "object" ? options : {};
    const actualCallback = typeof options === "function" ? options : callback;
    return originalScrypt.call(this, password, salt, keylen, actualOptions, actualCallback);
  };

  try {
    const result = await store.loginWithPassword("legacy_general", "wrong-password");

    assert.equal(result.ok, false);
    assert.equal(result.errorKey, "auth.login.invalidCredentials");
    assert.deepEqual(salts, ["00000000000000000000000000000000"]);
  } finally {
    crypto.scrypt = originalScrypt;
  }
});

register("auth store migra sessioni legacy raw alla storage key hashata", async () => {
  const rawToken = "legacy-session-token";
  const storageKey = sessionTokenStorageKey(rawToken);
  const createdAt = Date.now();
  const sessions = new Map<string, any>([
    [
      rawToken,
      {
        user_id: "session-user",
        created_at: createdAt
      }
    ]
  ]);
  const datastore = createSessionDatastore({ sessions });
  const store = createAuthStore({ datastore });

  const user = await store.getUserFromSession(rawToken);

  assert.equal(user?.id, "session-user");
  assert.deepEqual(datastore.createdSessions, [
    { token: storageKey, userId: "session-user", createdAt }
  ]);
  assert.deepEqual(datastore.deletedTokens, [rawToken]);
  assert.equal(sessions.has(storageKey), true);
  assert.equal(sessions.has(rawToken), false);
});

register("auth store elimina sessioni scadute sia hashate sia raw", async () => {
  const rawToken = "expired-session-token";
  const storageKey = sessionTokenStorageKey(rawToken);
  const sessions = new Map<string, any>([
    [
      storageKey,
      {
        user_id: "session-user",
        created_at: Date.now() - 1000 * 60 * 60 * 24 * 40
      }
    ],
    [
      rawToken,
      {
        user_id: "session-user",
        created_at: Date.now()
      }
    ]
  ]);
  const datastore = createSessionDatastore({ sessions });
  const store = createAuthStore({ datastore });

  const user = await store.getUserFromSession(rawToken);

  assert.equal(user, null);
  assert.deepEqual(datastore.deletedTokens, [storageKey, rawToken]);
  assert.equal(sessions.has(storageKey), false);
  assert.equal(sessions.has(rawToken), false);
});

register("auth store elimina sessioni senza user id prima del lookup utente", async () => {
  const rawToken = "malformed-session-token";
  const storageKey = sessionTokenStorageKey(rawToken);
  const sessions = new Map<string, any>([
    [
      storageKey,
      {
        created_at: Date.now()
      }
    ]
  ]);
  const datastore = createSessionDatastore({ sessions });
  const store = createAuthStore({ datastore });

  const user = await store.getUserFromSession(rawToken);

  assert.equal(user, null);
  assert.deepEqual(datastore.deletedTokens, [storageKey, rawToken]);
});

register("auth store mantiene la migrazione legacy se la storage key esiste gia", async () => {
  const rawToken = "racing-legacy-token";
  const storageKey = sessionTokenStorageKey(rawToken);
  const createdAt = Date.now();
  const sessions = new Map<string, any>([
    [rawToken, { user_id: "session-user", created_at: createdAt }],
    [storageKey, { user_id: "session-user", created_at: createdAt }]
  ]);
  const datastore = createSessionDatastore({ sessions, failCreateSession: true });
  const store = createAuthStore({ datastore });

  const user = await store.getUserFromSession(rawToken);

  assert.equal(user?.id, "session-user");
  assert.deepEqual(datastore.deletedTokens, [rawToken]);
  assert.equal(sessions.has(storageKey), true);
});

register("auth store fallback aggiorna la preferenza tema nel profilo", async () => {
  const datastore = createSessionDatastore({});
  const store = createAuthStore({ datastore });

  const updated = await store.updateUserThemePreference("session-user", "ember");

  assert.equal(updated?.preferences.theme, "ember");
  assert.equal(datastore.updatedProfiles.length, 1);
  assert.deepEqual(datastore.updatedProfiles[0].profile.preferences, { theme: "ember" });
});

register("auth store rifiuta email senza chiave di cifratura", async () => {
  await withEnvironmentVariable("AUTH_ENCRYPTION_KEY", undefined, async () => {
    const datastore = createSessionDatastore({});
    const store = createAuthStore({ datastore });

    const registered = await store.registerPasswordUser({
      username: "email_user",
      password: "Secret123!",
      email: "player@example.test"
    });

    assert.equal(registered.ok, false);
    assert.equal(registered.errorKey, "auth.register.emailProtectionUnavailable");
  });
});

register("auth store valida le modifiche account prima della password corrente", async () => {
  const datastore = createSessionDatastore({});
  const store = createAuthStore({ datastore });

  const noChanges = await store.updateUserAccountSettings({
    userId: "session-user",
    currentPassword: "Secret123!"
  });
  assert.equal(noChanges.ok, false);
  assert.equal(noChanges.errorKey, "auth.account.noChanges");

  const mismatch = await store.updateUserAccountSettings({
    userId: "session-user",
    currentPassword: "Secret123!",
    newPassword: "NewSecret123!",
    confirmNewPassword: "DifferentSecret123!"
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.errorKey, "auth.account.passwordMismatch");
});

register("auth store normalizza il profilo pubblico senza esporre dati sensibili", () => {
  assert.equal(publicUser(null), null);

  const user = publicUser({
    id: "admin-user",
    username: "admin",
    role: "admin",
    credentials: {
      password: { hash: "secret-hash" },
      webauthn: { credentialId: "credential" }
    },
    profile: {
      preferences: { theme: "midnight" },
      contact: { emailEncrypted: "ciphertext", emailHint: "ad***@example.test" }
    }
  });

  assert.deepEqual(user, {
    id: "admin-user",
    username: "admin",
    role: "admin",
    authMethods: ["password", "webauthn"],
    hasEmail: true,
    preferences: { theme: "midnight" }
  });
  assert.equal(Object.prototype.hasOwnProperty.call(user, "contact"), false);
});

register("auth store registra email solo quando la cifratura e configurata", async () => {
  const store = createAuthStore({
    datastore: createDatastore(null),
    encryptionKey: "test-encryption-key"
  });

  const registered = await store.registerPasswordUser({
    username: "email_user",
    password: "Secret123!",
    email: "PLAYER@example.test"
  });

  assert.equal(registered.ok, true);
  assert.equal(registered.user.username, "email_user");
  assert.equal(registered.user.hasEmail, true);
});

register("auth store rifiuta input registrazione malformati con errori specifici", async () => {
  const store = createAuthStore({ datastore: createDatastore(null) });

  const missing = await store.registerPasswordUser({ username: "", password: "" });
  assert.equal(missing.ok, false);
  assert.equal(missing.errorKey, "auth.register.requiredFields");

  const invalidUsername = await store.registerPasswordUser({
    username: "-bad-name",
    password: "Secret123!"
  });
  assert.equal(invalidUsername.ok, false);
  assert.equal(invalidUsername.errorKey, "auth.register.invalidUsername");

  const shortPassword = await store.registerPasswordUser({
    username: "valid_name",
    password: "short"
  });
  assert.equal(shortPassword.ok, false);
  assert.equal(shortPassword.errorKey, "auth.register.shortPassword");

  const invalidEmail = await store.registerPasswordUser({
    username: "valid_email_name",
    password: "Secret123!",
    email: "not-an-email"
  });
  assert.equal(invalidEmail.ok, false);
  assert.equal(invalidEmail.errorKey, "auth.register.invalidEmail");
});

register("auth store rifiuta login mancanti o password troppo lunghe senza sessione", async () => {
  const missingUserStore = createAuthStore({ datastore: createDatastore(null) });
  const missingUser = await missingUserStore.loginWithPassword("missing", "Secret123!");
  assert.equal(missingUser.ok, false);
  assert.equal(missingUser.errorKey, "auth.login.invalidCredentials");

  const existingUserStore = createAuthStore({ datastore: createDatastore({ id: "too-long" }) });
  const tooLong = await existingUserStore.loginWithPassword("too-long", "x".repeat(129));
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.errorKey, "auth.login.invalidCredentials");
});
