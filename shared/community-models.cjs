function createCommunity(input = {}) {
  return {
    id: input.id || null,
    slug: input.slug || null,
    name: input.name || "",
    branding: input.branding && typeof input.branding === "object" ? { ...input.branding } : {},
    ownerUserId: input.ownerUserId || null
  };
}

function createCommunityMembership(input = {}) {
  return {
    id: input.id || null,
    communityId: input.communityId || null,
    userId: input.userId || null,
    role: input.role || "member"
  };
}

function createLeaderboardEntry(input = {}) {
  return {
    communityId: input.communityId || null,
    gameModeId: input.gameModeId || null,
    playerId: input.playerId || null,
    playerName: input.playerName || "",
    wins: Number.isInteger(input.wins) ? input.wins : 0,
    losses: Number.isInteger(input.losses) ? input.losses : 0,
    rating: Number.isInteger(input.rating) ? input.rating : 0
  };
}

function createCustomMapDefinition(input = {}) {
  return {
    id: input.id || null,
    communityId: input.communityId || null,
    name: input.name || "",
    territories: Array.isArray(input.territories) ? input.territories : [],
    continents: Array.isArray(input.continents) ? input.continents : [],
    positions: input.positions && typeof input.positions === "object" ? { ...input.positions } : {},
    assetUrl: input.assetUrl || null
  };
}

function createPieceThemeDefinition(input = {}) {
  return {
    id: input.id || null,
    communityId: input.communityId || null,
    name: input.name || "",
    armyTokenUrl: input.armyTokenUrl || null,
    capitalTokenUrl: input.capitalTokenUrl || null
  };
}

module.exports = {
  createCommunity,
  createCommunityMembership,
  createCustomMapDefinition,
  createLeaderboardEntry,
  createPieceThemeDefinition
};
