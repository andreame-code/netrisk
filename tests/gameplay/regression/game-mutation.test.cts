const assert = require("node:assert/strict");
const {
  isInvalidExpectedVersion,
  readExpectedVersionOrSendError
} = require("../../../backend/routes/game-mutation.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("readExpectedVersionOrSendError returns null when expectedVersion is absent", () => {
  const result = readExpectedVersionOrSendError({}, {}, () => {
    throw new Error("sendLocalizedError should not run when expectedVersion is absent.");
  });

  assert.equal(result, null);
  assert.equal(isInvalidExpectedVersion(result), false);
});

register("readExpectedVersionOrSendError returns the numeric expected version", () => {
  const result = readExpectedVersionOrSendError({ expectedVersion: "8" }, {}, () => {
    throw new Error("sendLocalizedError should not run for a valid expectedVersion.");
  });

  assert.equal(result, 8);
  assert.equal(isInvalidExpectedVersion(result), false);
});

register("readExpectedVersionOrSendError sends a localized error for invalid versions", () => {
  let localizedErrorCall: any[] | null = null;

  const result = readExpectedVersionOrSendError({ expectedVersion: 0 }, {}, (...args: any[]) => {
    localizedErrorCall = args;
  });

  assert.equal(isInvalidExpectedVersion(result), true);
  assert.ok(localizedErrorCall);
  assert.equal(localizedErrorCall?.[1], 400);
  assert.equal(localizedErrorCall?.[3], "expectedVersion non valida.");
  assert.equal(localizedErrorCall?.[4], "server.invalidExpectedVersion");
});
