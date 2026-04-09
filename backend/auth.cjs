const path = require("path");
const crypto = require("crypto");
const { createAuthRepository } = require("./auth-repository.cjs");
const { createLocalizedError } = require("../shared/messages.cjs");

function passwordRecord(secret) {
  const salt = crypto.randomBytes(16).toString("hex");
  const keylen = 64;
  const hash = crypto.scryptSync(String(secret || ""), salt, keylen).toString("hex");
  return {
    algorithm: "scrypt",
    salt,
    keylen,
    hash
  };
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function userRole(user) {
  return user && user.role === "admin" ? "admin" : "user";
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: userRole(user),
    authMethods: Object.keys(user.credentials || {}),
    hasEmail: Boolean(user.profile?.contact?.emailEncrypted)
  };
}

function verifyPassword(credentials, password) {
  const record = credentials && credentials.password ? credentials.password : null;
  if (!record) {
    return false;
  }

  if (!record.salt || !record.hash) {
    return false;
  }

  let candidate = null;
  if (record.algorithm === "scrypt" || !record.digest) {
    const keylen = Number.isInteger(record.keylen) ? record.keylen : 64;
    candidate = crypto.scryptSync(String(password || ""), record.salt, keylen).toString("hex");
  } else {
    const iterations = Number.isInteger(record.iterations) ? record.iterations : 120000;
    const digest = record.digest || "sha256";
    candidate = crypto.pbkdf2Sync(String(password || ""), record.salt, iterations, 32, digest).toString("hex");
  }

  const expected = Buffer.from(record.hash, "hex");
  const received = Buffer.from(candidate, "hex");
  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

function dataProtectionKey(options = {}) {
  const raw = String(
    options.encryptionKey
    || process.env.AUTH_ENCRYPTION_KEY
    || ""
  ).trim();

  return raw ? crypto.createHash("sha256").update(raw).digest() : null;
}

function createFieldProtector(options = {}) {
  const key = dataProtectionKey(options);

  return {
    isConfigured() {
      return Boolean(key);
    },
    encrypt(value) {
      if (!key) {
        throw createLocalizedError("AUTH_ENCRYPTION_KEY mancante.", "auth.internal.missingEncryptionKey");
      }

      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(String(value || ""), "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [
        "v1",
        iv.toString("base64url"),
        tag.toString("base64url"),
        encrypted.toString("base64url")
      ].join(".");
    }
  };
}

function registrationInput(inputOrUsername, password) {
  if (inputOrUsername && typeof inputOrUsername === "object" && !Array.isArray(inputOrUsername)) {
    return {
      username: String(inputOrUsername.username || "").trim().slice(0, 32),
      password: String(inputOrUsername.password || ""),
      email: normalizeEmail(inputOrUsername.email)
    };
  }

  return {
    username: String(inputOrUsername || "").trim().slice(0, 32),
    password: String(password || ""),
    email: ""
  };
}

function authFailure(error, errorKey, errorParams = {}) {
  return { ok: false, error, errorKey, errorParams };
}

function registrationValidationError(input, protector) {
  if (!input.username || !input.password) {
    return authFailure("Inserisci utente e password.", "auth.register.requiredFields");
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$/.test(input.username)) {
    return authFailure("Username valido: 3-32 caratteri, lettere, numeri, underscore e trattino.", "auth.register.invalidUsername");
  }

  if (input.password.length < 4) {
    return authFailure("Password troppo corta: usa almeno 4 caratteri.", "auth.register.shortPassword");
  }

  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return authFailure("Email non valida.", "auth.register.invalidEmail");
  }

  if (input.email && !protector.isConfigured()) {
    return authFailure(
      "Email opzionale disponibile solo con AUTH_ENCRYPTION_KEY configurata sul server.",
      "auth.register.emailProtectionUnavailable"
    );
  }

  return null;
}

function maskEmail(email) {
  const normalized = normalizeEmail(email);
  const parts = normalized.split("@");
  if (parts.length !== 2) {
    return "";
  }

  const local = parts[0];
  const domain = parts[1];
  const visible = local.length <= 2 ? local.charAt(0) : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

function buildProfile(username, email, protector) {
  const profile = {
    displayName: username
  };

  if (email) {
    profile.contact = {
      emailEncrypted: protector.encrypt(email),
      emailHint: maskEmail(email)
    };
  }

  return profile;
}

function createAuthStore(options = {}) {
  const datastore = options.datastore || createAuthRepository({
    driver: options.driver || process.env.DATASTORE_DRIVER || "local",
    dbFile: options.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite"),
    dataFile: options.dataFile || path.join(__dirname, "..", "data", "users.json"),
    sessionsFile: options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json"),
    gamesFile: options.gamesFile || path.join(__dirname, "..", "data", "games.json"),
    supabaseUrl: options.supabaseUrl,
    supabaseServiceRoleKey: options.supabaseServiceRoleKey,
    supabaseSchema: options.supabaseSchema
  });
  const protector = createFieldProtector(options);

  async function listUsers() {
    return datastore.listUsers();
  }

  async function findByUsername(username) {
    const normalized = normalizeUsername(username);
    return normalized ? datastore.findUserByUsername(normalized) : null;
  }

  async function registerPasswordUser(inputOrUsername, password) {
    const input = registrationInput(inputOrUsername, password);
    const validationError = registrationValidationError(input, protector);
    if (validationError) {
      return validationError;
    }

    if (await findByUsername(input.username)) {
      return authFailure("Utente gia registrato.", "auth.register.userExists");
    }

    const user = {
      id: crypto.randomBytes(8).toString("hex"),
      username: input.username,
      credentials: {
        password: passwordRecord(input.password)
      },
      role: "user",
      profile: buildProfile(input.username, input.email, protector),
      createdAt: new Date().toISOString()
    };

    return { ok: true, user: publicUser(await datastore.createUser(user)) };
  }

  async function loginWithPassword(username, password) {
    const user = await findByUsername(username);

    if (typeof user?.credentials?.password?.secret === "string") {
      // Password in chiaro (legacy): verifica e migra subito a scrypt
      if (!user || user.credentials.password.secret !== String(password || "")) {
        return authFailure("Credenziali non valide.", "auth.login.invalidCredentials");
      }
      await datastore.updateUserCredentials(user.id, {
        ...user.credentials,
        password: passwordRecord(password)
      });
    } else {
      if (!user || !verifyPassword(user.credentials, password)) {
        return authFailure("Credenziali non valide.", "auth.login.invalidCredentials");
      }
      if (user.credentials?.password?.algorithm !== "scrypt") {
        await datastore.updateUserCredentials(user.id, {
          ...user.credentials,
          password: passwordRecord(password)
        });
      }
    }

    const sessionToken = crypto.randomBytes(16).toString("hex");
    await datastore.createSession(sessionToken, user.id, Date.now());

    return {
      ok: true,
      sessionToken,
      user: publicUser(user)
    };
  }

  async function getUserFromSession(sessionToken) {
    if (!sessionToken) {
      return null;
    }

    const session = await datastore.findSession(sessionToken);
    if (!session) {
      return null;
    }

    const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni
    const createdAt = session.created_at || session.createdAt || 0;
    if (Date.now() - Number(createdAt) > SESSION_MAX_AGE_MS) {
      await datastore.deleteSession(sessionToken);
      return null;
    }

    return await datastore.findUserById(session.user_id || session.userId) || null;
  }

  async function logout(sessionToken) {
    if (sessionToken) {
      await datastore.deleteSession(sessionToken);
    }

    return null;
  }

  return {
    datastore,
    findByUsername,
    getUserFromSession,
    listUsers,
    loginWithPassword,
    logout,
    publicUser,
    registerPasswordUser
  };
}

module.exports = {
  createAuthStore,
  normalizeUsername,
  publicUser,
  userRole
};
