// @ts-nocheck
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
  if (String(process.env.E2E || "").toLowerCase() === "true" || String(process.env.TEST || "").toLowerCase() === "true" || String(process.env.NODE_ENV || "").toLowerCase() === "test") {
    return;
  }

  const candidates = [process.cwd(), process.env.NETRISK_PROJECT_ROOT, path.join(__dirname, ".."), path.join(__dirname, "../..")];
  const seen = new Set();
  const rootDir = candidates.find((candidate) => {
    if (!candidate) {
      return false;
    }

    const absolute = path.resolve(candidate);
    if (seen.has(absolute)) {
      return false;
    }
    seen.add(absolute);
    return fs.existsSync(path.join(absolute, ".env"));
  }) || process.cwd();

  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));
}

module.exports = {
  loadLocalEnv
};
