const path = require("path");
const crypto = require("crypto");
const { createDatastore } = require("./datastore.cjs");

function passwordRecord(secret) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 120000;
  const digest = "sha256";
  const hash = crypto.pbkdf2Sync(String(secret || ""), salt, iterations, 32, digest).toString("hex");
  return {
    salt,
    iterations,
    digest,
    hash
  };
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
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
    authMethods: Object.keys(user.credentials || {})
  };
}

function verifyPassword(credentials, password) {
  const record = credentials && credentials.password ? credentials.password : null;
  if (!record) {
    return false;
  }

  if (typeof record.secret === "string") {
    return record.secret === String(password || "");
  }

  if (!record.salt || !record.hash) {
    return false;
  }

  const iterations = Number.isInteger(record.iterations) ? record.iterations : 120000;
  const digest = record.digest || "sha256";
  const candidate = crypto.pbkdf2Sync(String(password || ""), record.salt, iterations, 32, digest).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(record.hash, "hex"), Buffer.from(candidate, "hex"));
}

function createAuthStore(options = {}) {
  const datastore = options.datastore || createDatastore({
    dbFile: options.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite"),
    legacyUsersFile: options.dataFile || path.join(__dirname, "..", "data", "users.json"),
    legacySessionsFile: options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json"),
    legacyGamesFile: options.gamesFile || path.join(__dirname, "..", "data", "games.json")
  });

  function listUsers() {
    return datastore.listUsers();
  }

  function findByUsername(username) {
    const normalized = normalizeUsername(username);
    return normalized ? datastore.findUserByUsername(normalized) : null;
  }

  function registerPasswordUser(username, password) {
    const cleanedUsername = String(username || "").trim().slice(0, 32);
    const cleanedPassword = String(password || "");

    if (!cleanedUsername || !cleanedPassword) {
      return { ok: false, error: "Inserisci utente e password." };
    }

    if (findByUsername(cleanedUsername)) {
      return { ok: false, error: "Utente gia registrato." };
    }

    const user = {
      id: crypto.randomBytes(8).toString("hex"),
      username: cleanedUsername,
      credentials: {
        password: passwordRecord(cleanedPassword)
      },
      role: "user",
      profile: {
        displayName: cleanedUsername
      },
      createdAt: new Date().toISOString()
    };

    return { ok: true, user: publicUser(datastore.createUser(user)) };
  }

  function loginWithPassword(username, password) {
    const user = findByUsername(username);
    if (!user || !verifyPassword(user.credentials, password)) {
      return { ok: false, error: "Credenziali non valide." };
    }

    if (typeof user.credentials?.password?.secret === "string") {
      datastore.updateUserCredentials(user.id, {
        ...user.credentials,
        password: passwordRecord(password)
      });
    }

    const sessionToken = crypto.randomBytes(16).toString("hex");
    datastore.createSession(sessionToken, user.id, Date.now());

    return {
      ok: true,
      sessionToken,
      user: publicUser(user)
    };
  }

  function getUserFromSession(sessionToken) {
    if (!sessionToken) {
      return null;
    }

    const session = datastore.findSession(sessionToken);
    if (!session) {
      return null;
    }

    return datastore.findUserById(session.user_id || session.userId) || null;
  }

  function logout(sessionToken) {
    if (sessionToken) {
      datastore.deleteSession(sessionToken);
    }
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

