const crypto = require("crypto");
const { createGameModeDefinition } = require("../shared/models.cjs");

const COMMUNITY_MODES_KEY = "communityGameModes";

function uniqueId() {
  return crypto.randomBytes(8).toString("hex");
}

function listOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function createCommunityModeStore(options = {}) {
  const datastore = options.datastore;
  if (!datastore) {
    throw new Error("Community mode store richiede un datastore.");
  }

  async function listModes() {
    return listOrEmpty(await datastore.getAppStateValue(COMMUNITY_MODES_KEY, []));
  }

  async function saveModes(modes) {
    await datastore.setAppStateValue(COMMUNITY_MODES_KEY, modes);
  }

  async function listModesForCommunity(communityId) {
    return (await listModes()).filter((mode) => mode.communityId === communityId);
  }

  async function getMode(modeId) {
    return (await listModes()).find((mode) => mode.id === modeId) || null;
  }

  async function createMode(input = {}) {
    if (!input.communityId) {
      throw new Error("La modalita richiede una community.");
    }

    const mode = {
      id: uniqueId(),
      communityId: input.communityId,
      name: String(input.name || "").trim() || "Modalita personalizzata",
      definition: createGameModeDefinition(input.definition || {})
    };

    const modes = await listModes();
    modes.push(mode);
    await saveModes(modes);
    return mode;
  }

  async function updateMode(modeId, patch = {}) {
    const modes = await listModes();
    const index = modes.findIndex((mode) => mode.id === modeId);
    if (index === -1) {
      throw new Error("Modalita non trovata.");
    }

    modes[index] = {
      ...modes[index],
      name: patch.name == null ? modes[index].name : String(patch.name).trim() || modes[index].name,
      definition: patch.definition
        ? createGameModeDefinition({ ...modes[index].definition, ...patch.definition })
        : modes[index].definition
    };
    await saveModes(modes);
    return modes[index];
  }

  return {
    createMode,
    getMode,
    listModes,
    listModesForCommunity,
    updateMode
  };
}

module.exports = {
  createCommunityModeStore
};
