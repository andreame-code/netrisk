const crypto = require("crypto");

const SESSION_TOKEN_STORAGE_PREFIX = "sha256:";
const SESSION_TOKEN_HASH_DOMAIN = "netrisk-session-token-v1\0";

function sessionTokenStorageKey(sessionToken: unknown): string {
  const token = String(sessionToken || "");
  const digest = crypto
    .createHash("sha256")
    .update(SESSION_TOKEN_HASH_DOMAIN)
    .update(token)
    .digest("hex");
  return `${SESSION_TOKEN_STORAGE_PREFIX}${digest}`;
}

function isSessionTokenStorageKey(value: unknown): boolean {
  return /^sha256:[a-f0-9]{64}$/.test(String(value || ""));
}

module.exports = {
  SESSION_TOKEN_STORAGE_PREFIX,
  isSessionTokenStorageKey,
  sessionTokenStorageKey
};
