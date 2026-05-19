const assert = require("node:assert/strict");

const {
  DEFAULT_CONTENT_PACK_ID,
  findContentPack,
  getContentPack,
  listContentPacks
} = require("../../../shared/content/content-packs/index.cjs");
const {
  createActionFailure,
  createDomainFailure,
  createLocalizedError,
  createLogEntry,
  createValidationFailure
} = require("../../../shared/messages.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("content packs expose summaries, defaults and localized missing errors", () => {
  const summaries = listContentPacks();
  const defaultPack = getContentPack();
  const explicitDefaultPack = getContentPack(DEFAULT_CONTENT_PACK_ID);

  assert.equal(defaultPack.id, DEFAULT_CONTENT_PACK_ID);
  assert.equal(explicitDefaultPack.id, DEFAULT_CONTENT_PACK_ID);
  assert.equal(findContentPack("missing-content-pack"), null);
  assert.equal(
    summaries.some(
      (pack: {
        id: string;
        defaultSiteThemeId: string;
        defaultMapId: string;
        defaultDiceRuleSetId: string;
        defaultCardRuleSetId: string;
        defaultVictoryRuleSetId: string;
        defaultPieceSetId: string;
      }) =>
        pack.id === DEFAULT_CONTENT_PACK_ID &&
        pack.defaultSiteThemeId === defaultPack.defaultSiteThemeId &&
        pack.defaultMapId === defaultPack.defaultMapId &&
        pack.defaultDiceRuleSetId === defaultPack.defaultDiceRuleSetId &&
        pack.defaultCardRuleSetId === defaultPack.defaultCardRuleSetId &&
        pack.defaultVictoryRuleSetId === defaultPack.defaultVictoryRuleSetId &&
        pack.defaultPieceSetId === defaultPack.defaultPieceSetId
    ),
    true
  );

  assert.throws(
    () => getContentPack("missing-content-pack"),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      const localized = error as Error & {
        messageKey?: string | null;
        messageParams?: { contentPackId?: string };
      };
      assert.equal(localized.message, "Unsupported content pack.");
      assert.equal(localized.messageKey, "contentPack.unsupported");
      assert.equal(localized.messageParams?.contentPackId, "missing-content-pack");
      return true;
    }
  );
});

register("message helpers normalize metadata and preserve error codes", () => {
  const codedError = createLocalizedError("Denied.", "auth.denied", { role: "admin" }, "DENIED");
  const defaultedError = createLocalizedError("Plain.", "");
  const actionFailure = createActionFailure("Cannot attack.", null);
  const domainFailure = createDomainFailure("Invalid move.", "move.invalid", { from: "aurora" });
  const validationFailure = createValidationFailure("Bad input.", null);
  const logEntry = createLogEntry("Turn started.", "", undefined);

  assert.equal(codedError.message, "Denied.");
  assert.equal(codedError.messageKey, "auth.denied");
  assert.deepEqual(codedError.messageParams, { role: "admin" });
  assert.equal(codedError.code, "DENIED");
  assert.equal(defaultedError.messageKey, null);
  assert.deepEqual(defaultedError.messageParams, {});
  assert.equal(Object.prototype.hasOwnProperty.call(defaultedError, "code"), false);
  assert.deepEqual(actionFailure, {
    ok: false,
    message: "Cannot attack.",
    messageKey: null,
    messageParams: {}
  });
  assert.deepEqual(domainFailure, {
    ok: false,
    error: "Invalid move.",
    errorKey: "move.invalid",
    errorParams: { from: "aurora" }
  });
  assert.deepEqual(validationFailure, {
    ok: false,
    reason: "Bad input.",
    reasonKey: null,
    reasonParams: {}
  });
  assert.deepEqual(logEntry, {
    message: "Turn started.",
    messageKey: null,
    messageParams: {}
  });
});
