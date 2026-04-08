const crypto = require("crypto");
const { createCommunity, createCommunityMembership } = require("../shared/models.cjs");

const COMMUNITIES_KEY = "communities";
const MEMBERSHIPS_KEY = "communityMemberships";

function listOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCommunity(input = {}) {
  return createCommunity({
    id: input.id || null,
    slug: String(input.slug || "").trim().toLowerCase(),
    name: String(input.name || "").trim(),
    branding: input.branding && typeof input.branding === "object" ? input.branding : {},
    ownerUserId: input.ownerUserId || null
  });
}

function uniqueId() {
  return crypto.randomBytes(8).toString("hex");
}

function createCommunityStore(options = {}) {
  const datastore = options.datastore;
  if (!datastore) {
    throw new Error("Community store richiede un datastore.");
  }

  async function listCommunities() {
    return listOrEmpty(await datastore.getAppStateValue(COMMUNITIES_KEY, []));
  }

  async function listMemberships() {
    return listOrEmpty(await datastore.getAppStateValue(MEMBERSHIPS_KEY, []));
  }

  async function saveCommunities(communities) {
    await datastore.setAppStateValue(COMMUNITIES_KEY, communities);
  }

  async function saveMemberships(memberships) {
    await datastore.setAppStateValue(MEMBERSHIPS_KEY, memberships);
  }

  async function getCommunity(communityId) {
    return (await listCommunities()).find((community) => community.id === communityId) || null;
  }

  async function findCommunityBySlug(slug) {
    const normalizedSlug = String(slug || "").trim().toLowerCase();
    return (await listCommunities()).find((community) => community.slug === normalizedSlug) || null;
  }

  async function listCommunitiesForUser(userId) {
    const [communities, memberships] = await Promise.all([listCommunities(), listMemberships()]);
    const allowedCommunityIds = new Set(memberships.filter((membership) => membership.userId === userId).map((membership) => membership.communityId));
    return communities.filter((community) => allowedCommunityIds.has(community.id));
  }

  async function createOwnedCommunity(input, ownerUser) {
    const community = normalizeCommunity({
      ...input,
      id: uniqueId(),
      ownerUserId: ownerUser.id
    });

    if (!community.slug || !community.name) {
      throw new Error("La community richiede slug e nome.");
    }

    const communities = await listCommunities();
    if (communities.some((entry) => entry.slug === community.slug)) {
      throw new Error("Slug community gia in uso.");
    }

    communities.push(community);
    await saveCommunities(communities);

    const memberships = await listMemberships();
    memberships.push(createCommunityMembership({
      id: uniqueId(),
      communityId: community.id,
      userId: ownerUser.id,
      role: "owner"
    }));
    await saveMemberships(memberships);

    return community;
  }

  async function updateCommunity(communityId, patch = {}) {
    const communities = await listCommunities();
    const index = communities.findIndex((community) => community.id === communityId);
    if (index === -1) {
      throw new Error("Community non trovata.");
    }

    const next = normalizeCommunity({
      ...communities[index],
      ...patch,
      id: communities[index].id,
      ownerUserId: communities[index].ownerUserId
    });

    if (next.slug !== communities[index].slug && communities.some((community) => community.id !== communityId && community.slug === next.slug)) {
      throw new Error("Slug community gia in uso.");
    }

    communities[index] = next;
    await saveCommunities(communities);
    return next;
  }

  async function getMembership(userId, communityId) {
    return (await listMemberships()).find((membership) => membership.userId === userId && membership.communityId === communityId) || null;
  }

  return {
    createOwnedCommunity,
    findCommunityBySlug,
    getCommunity,
    getMembership,
    listCommunities,
    listCommunitiesForUser,
    updateCommunity
  };
}

module.exports = {
  createCommunityStore
};
