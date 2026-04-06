const fs = require("fs");
const path = require("path");

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function backupPathFor(filePath) {
  return filePath + ".bak";
}

function safeReadJson(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }

  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) {
    return fallbackValue;
  }

  return JSON.parse(raw);
}

function readJsonFile(filePath, fallbackValue, isValid) {
  const validate = typeof isValid === "function"
    ? isValid
    : () => true;

  try {
    const parsed = safeReadJson(filePath, fallbackValue);
    return validate(parsed) ? parsed : fallbackValue;
  } catch (error) {
    try {
      const backup = safeReadJson(backupPathFor(filePath), fallbackValue);
      return validate(backup) ? backup : fallbackValue;
    } catch (backupError) {
      return fallbackValue;
    }
  }
}

function writeJsonFile(filePath, value) {
  ensureDirectory(filePath);

  const tempPath = filePath + `.tmp-${process.pid}-${Date.now()}`;
  const backupPath = backupPathFor(filePath);
  const payload = JSON.stringify(value, null, 2) + "\n";

  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
  }

  fs.writeFileSync(tempPath, payload, "utf8");

  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }

  fs.renameSync(tempPath, filePath);
}

module.exports = {
  readJsonFile,
  writeJsonFile
};
