function normalizeTerritories(input) {
  if (!Array.isArray(input)) {
    throw new Error("Map graph requires an array of territories or map entries.");
  }

  return input.map((entry, index) => {
    const territory = entry && entry.territory ? entry.territory : entry;
    if (!territory || !territory.id) {
      throw new Error(`Territory entry at index ${index} is missing an id.`);
    }

    if (!Array.isArray(territory.neighbors)) {
      throw new Error(`Territory "${territory.id}" must define neighbors as an array.`);
    }

    return territory;
  });
}

function buildMapGraph(input) {
  const territories = normalizeTerritories(input);
  const adjacency = new Map();
  const territoryIds = new Set();

  territories.forEach((territory) => {
    if (territoryIds.has(territory.id)) {
      throw new Error(`Duplicate territory id "${territory.id}" in graph input.`);
    }

    territoryIds.add(territory.id);
    adjacency.set(territory.id, new Set());
  });

  territories.forEach((territory) => {
    territory.neighbors.forEach((neighborId) => {
      if (!territoryIds.has(neighborId)) {
        throw new Error(`Territory "${territory.id}" references unknown neighbor "${neighborId}".`);
      }

      if (neighborId === territory.id) {
        throw new Error(`Territory "${territory.id}" cannot link to itself.`);
      }

      const neighborSet = adjacency.get(territory.id);
      if (neighborSet.has(neighborId)) {
        throw new Error(`Territory "${territory.id}" contains duplicate link to "${neighborId}".`);
      }

      neighborSet.add(neighborId);
    });
  });

  const edgeKeys = new Set();
  adjacency.forEach((neighbors, territoryId) => {
    neighbors.forEach((neighborId) => {
      const reverseNeighbors = adjacency.get(neighborId);
      if (!reverseNeighbors.has(territoryId)) {
        throw new Error(`Adjacency between "${territoryId}" and "${neighborId}" must be bidirectional.`);
      }

      const edgeKey = [territoryId, neighborId].sort().join(":");
      edgeKeys.add(edgeKey);
    });
  });

  return {
    size: territories.length,
    territoryIds: Array.from(territoryIds),
    edgeCount: edgeKeys.size,
    hasTerritory(territoryId) {
      return adjacency.has(territoryId);
    },
    getNeighbors(territoryId) {
      if (!adjacency.has(territoryId)) {
        throw new Error(`Unknown territory "${territoryId}".`);
      }

      return Array.from(adjacency.get(territoryId));
    },
    areAdjacent(fromId, toId) {
      if (!adjacency.has(fromId)) {
        throw new Error(`Unknown territory "${fromId}".`);
      }

      if (!adjacency.has(toId)) {
        throw new Error(`Unknown territory "${toId}".`);
      }

      return adjacency.get(fromId).has(toId);
    }
  };
}

module.exports = {
  buildMapGraph
};
