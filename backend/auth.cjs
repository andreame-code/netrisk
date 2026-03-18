const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function ensureDataFile(dataFile) {
  const directory = path.dirname(dataFile);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, "[]\n", "utf8");
  }
}

function readUsers(dataFile) {
  ensureDataFile(dataFile);
  const raw = fs.readFileSync(dataFile, "utf8").trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeUsers(dataFile, users) {
  fs.writeFileSync(dataFile, JSON.stringify(users, null, 2) + "\n", "utf8");
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

function createAuthStore(options = {}) {
  const dataFile = options.dataFile || path.join(__dirname, "..", "data", "users.json");
  const sessions = new Map();

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
        password: {
          secret: cleanedPassword
        }
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
    if (!user || !user.credentials?.password || user.credentials.password.secret !== String(password || "")) {
      return { ok: false, error: "Credenziali non valide." };
    }

    const sessionToken = crypto.randomBytes(16).toString("hex");
    sessions.set(sessionToken, {
      userId: user.id,
      createdAt: Date.now()
    });

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

    const session = sessions.get(sessionToken);
    if (!session) {
      return null;
    }

    return listUsers().find((user) => user.id === session.userId) || null;
  }

  function logout(sessionToken) {
    if (sessionToken) {
      sessions.delete(sessionToken);
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

