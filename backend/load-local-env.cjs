const fs = require("fs");
const path = require("path");

function stripWrappingQuotes(value) {
  if (!value || value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];
  if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvFile(content) {
  const parsed = {};
  const lines = String(content || "").split(/\r?\n/);

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      return;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      return;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key) {
      return;
    }

    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());
    parsed[key] = value;
  });

  return parsed;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const values = parseEnvFile(content);
  Object.entries(values).forEach(([key, value]) => {
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  });
  return true;
}

function loadLocalEnv() {
  if (String(process.env.E2E || "").toLowerCase() === "true") {
    return;
  }

  const rootDir = path.join(__dirname, "..");
  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));
}

module.exports = {
  loadLocalEnv
};
