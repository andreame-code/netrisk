const path = require("path");
const crypto = require("crypto");
const { readJsonFile, writeJsonFile } = require("./json-file-store.cjs");

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

function readUsers(dataFile) {
  return readJsonFile(dataFile, [], Array.isArray);
}

function writeUsers(dataFile, users) {
  writeJsonFile(dataFile, users);
}

function readSessions(sessionFile) {
  return readJsonFile(sessionFile, [], Array.isArray);
}

function writeSessions(sessionFile, sessions) {
  writeJsonFile(sessionFile, sessions);
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
  const dataFile = options.dataFile || path.join(__dirname, "..", "data", "users.json");
  const sessionsFile = options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json");

  function listUsers() {
    return readUsers(dataFile);
  }

  function findByUsername(username) {
    const normalized = normalizeUsername(username);
    return listUsers().find((user) => user.username.toLowerCase() === normalized) || null;
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

    const users = listUsers();
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

    users.push(user);
    writeUsers(dataFile, users);
    return { ok: true, user: publicUser(user) };
  }

  function loginWithPassword(username, password) {
    const user = findByUsername(username);
    if (!user || !verifyPassword(user.credentials, password)) {
      return { ok: false, error: "Credenziali non valide." };
    }

    if (typeof user.credentials?.password?.secret === "string") {
      const users = listUsers();
      const storedUser = users.find((entry) => entry.id === user.id);
      if (storedUser) {
        storedUser.credentials.password = passwordRecord(password);
        writeUsers(dataFile, users);
      }
    }

    const sessionToken = crypto.randomBytes(16).toString("hex");
    const sessions = readSessions(sessionsFile);
    sessions.push({
      token: sessionToken,
      userId: user.id,
      createdAt: Date.now()
    });
    writeSessions(sessionsFile, sessions);

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

    const session = readSessions(sessionsFile).find((entry) => entry.token === sessionToken);
    if (!session) {
      return null;
    }

    return listUsers().find((user) => user.id === session.userId) || null;
  }

  function logout(sessionToken) {
    if (sessionToken) {
      writeSessions(sessionsFile, readSessions(sessionsFile).filter((entry) => entry.token !== sessionToken));
    }
  }

  return {
    dataFile,
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

