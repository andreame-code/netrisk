const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const { createAuthStore } = require("../../../backend/auth.cjs");

async function runTests() {
  console.log("Running custom auth validation tests...");

  const tempFile = path.join(__dirname, "tmp-users-validation.json");
  const tempSessionsFile = path.join(__dirname, "tmp-sessions-validation.json");
  const tempDbFile = path.join(__dirname, "tmp-auth-validation.sqlite");

  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  if (fs.existsSync(tempSessionsFile)) fs.unlinkSync(tempSessionsFile);
  if (fs.existsSync(tempDbFile)) {
    [tempDbFile, `${tempDbFile}-wal`, `${tempDbFile}-shm`].forEach(f => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    });
  }

  const auth = createAuthStore({
    dataFile: tempFile,
    sessionsFile: tempSessionsFile,
    dbFile: tempDbFile
  });

  try {
    // Test minimum length (7 characters should fail)
    const tooShort = await auth.registerPasswordUser({
      username: "too_short",
      password: "1234567"
    });
    assert.equal(tooShort.ok, false, "7-character password should fail");
    assert.equal(tooShort.errorKey, "auth.register.shortPassword");
    console.log("PASS: 7-character password rejected with correct key");

    // Test minimum length (8 characters should pass)
    const justRight = await auth.registerPasswordUser({
      username: "just_right",
      password: "12345678"
    });
    assert.equal(justRight.ok, true, "8-character password should pass");
    console.log("PASS: 8-character password accepted");

    // Test maximum length (129 characters should fail)
    const tooLong = await auth.registerPasswordUser({
      username: "too_long",
      password: "a".repeat(129)
    });
    assert.equal(tooLong.ok, false, "129-character password should fail");
    assert.equal(tooLong.errorKey, "auth.register.longPassword");
    console.log("PASS: 129-character password rejected with correct key");

    // Test maximum length (128 characters should pass)
    const maxAllowed = await auth.registerPasswordUser({
      username: "max_allowed",
      password: "a".repeat(128)
    });
    assert.equal(maxAllowed.ok, true, "128-character password should pass");
    console.log("PASS: 128-character password accepted");

  } finally {
    auth.datastore.close();
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    if (fs.existsSync(tempSessionsFile)) fs.unlinkSync(tempSessionsFile);
    [tempDbFile, `${tempDbFile}-wal`, `${tempDbFile}-shm`].forEach(f => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    });
  }

  console.log("All custom auth validation tests passed!");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
