import type { Territory } from "./core-domain.cjs";

export interface MapDefinitionEntry {
  territory: Territory;
}

export interface MapGraph {
  size: number;
  territoryIds: string[];
  edgeCount: number;
  hasTerritory: (territoryId: string) => boolean;
  getNeighbors: (territoryId: string) => string[];
  areAdjacent: (fromId: string, toId: string) => boolean;
}

type GraphInputEntry = Territory | MapDefinitionEntry;

function isMapDefinitionEntry(entry: GraphInputEntry): entry is MapDefinitionEntry {
  return typeof entry === "object" && entry !== null && "territory" in entry;
}

function normalizeTerritories(input: GraphInputEntry[]): Territory[] {
  if (!Array.isArray(input)) {
    throw new Error("Map graph requires an array of territories or map entries.");
  }

  return input.map((entry, index) => {
    const territory = isMapDefinitionEntry(entry) ? entry.territory : entry;
    if (!territory || !territory.id) {
      throw new Error(`Territory entry at index ${index} is missing an id.`);
    }

    if (!Array.isArray(territory.neighbors)) {
      throw new Error(`Territory "${territory.id}" must define neighbors as an array.`);
    }

    return territory;
  });
}

export function buildMapGraph(input: GraphInputEntry[]): MapGraph {
  const territories = normalizeTerritories(input);
  const adjacency = new Map<string, Set<string>>();
  const territoryIds = new Set<string>();

  territories.forEach((territory) => {
    const territoryId = territory.id;
    if (!territoryId) {
      throw new Error("Territory id is required.");
    }

    if (territoryIds.has(territoryId)) {
      throw new Error(`Duplicate territory id "${territoryId}" in graph input.`);
    }

    territoryIds.add(territoryId);
    adjacency.set(territoryId, new Set<string>());
  });

  territories.forEach((territory) => {
    const territoryId = territory.id;
    if (!territoryId) {
      throw new Error("Territory id is required.");
    }

    territory.neighbors.forEach((neighborId) => {
      if (!territoryIds.has(neighborId)) {
        throw new Error(`Territory "${territoryId}" references unknown neighbor "${neighborId}".`);
      }

      if (neighborId === territoryId) {
        throw new Error(`Territory "${territoryId}" cannot link to itself.`);
      }

      const neighborSet = adjacency.get(territoryId);
      if (!neighborSet) {
        throw new Error(`Missing adjacency list for "${territoryId}".`);
      }

      if (neighborSet.has(neighborId)) {
        throw new Error(`Territory "${territoryId}" contains duplicate link to "${neighborId}".`);
      }

      neighborSet.add(neighborId);
    });
  });

  const edgeKeys = new Set<string>();
  adjacency.forEach((neighbors, territoryId) => {
    neighbors.forEach((neighborId) => {
      const reverseNeighbors = adjacency.get(neighborId);
      if (!reverseNeighbors || !reverseNeighbors.has(territoryId)) {
        throw new Error(
          `Adjacency between "${territoryId}" and "${neighborId}" must be bidirectional.`
        );
      }

      const edgeKey = [territoryId, neighborId].sort().join(":");
      edgeKeys.add(edgeKey);
    });
  });

  return {
    size: territories.length,
    territoryIds: Array.from(territoryIds),
    edgeCount: edgeKeys.size,
    hasTerritory(territoryId: string) {
      return adjacency.has(territoryId);
    },
    getNeighbors(territoryId: string) {
      if (!adjacency.has(territoryId)) {
        throw new Error(`Unknown territory "${territoryId}".`);
      }

      const neighbors = adjacency.get(territoryId);
      if (!neighbors) {
        throw new Error(`Missing adjacency list for "${territoryId}".`);
      }

      return Array.from(neighbors);
    },
    areAdjacent(fromId: string, toId: string) {
      if (!adjacency.has(fromId)) {
        throw new Error(`Unknown territory "${fromId}".`);
      }

      if (!adjacency.has(toId)) {
        throw new Error(`Unknown territory "${toId}".`);
      }

      const neighbors = adjacency.get(fromId);
      if (!neighbors) {
        throw new Error(`Missing adjacency list for "${fromId}".`);
      }

      return neighbors.has(toId);
    }
  };
}
