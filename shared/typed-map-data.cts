import { createContinent, createTerritory, type Continent, type MapPosition, type Territory } from "./core-domain.cjs";

export interface MapDefinitionTerritoryEntry {
  territory: Territory;
  position: MapPosition;
}

export interface MapDefinition {
  source: string;
  territories: MapDefinitionTerritoryEntry[];
  positions: Record<string, MapPosition>;
}

export interface ContinentDefinition {
  source: string;
  continents: Continent[];
}

export interface BuildContinentsOptions {
  validTerritoryIds?: readonly string[];
}

export interface StaticTerritoryRecord {
  id: string;
  name: string;
  continentId: string | null;
  x: number;
  y: number;
  neighbors: string[];
}

export interface StaticContinentRecord {
  id: string;
  name: string;
  bonus: number;
  territoryIds: string[];
}

function normalizeCoordinate(rawValue: number, fieldName: string, territoryId: string): number {
  if (!Number.isFinite(rawValue)) {
    throw new Error(`Territory "${territoryId}" has invalid ${fieldName} coordinate.`);
  }

  if (rawValue < 0 || rawValue > 1) {
    throw new Error(`Territory "${territoryId}" must use scalable ${fieldName} coordinates between 0 and 1.`);
  }

  return rawValue;
}

function validateAdjacency(territoriesById: Record<string, MapDefinitionTerritoryEntry>): void {
  Object.values(territoriesById).forEach(({ territory }) => {
    territory.neighbors.forEach((neighborId) => {
      if (!territoriesById[neighborId]) {
        throw new Error(`Territory "${territory.id}" references unknown neighbor "${neighborId}".`);
      }
    });
  });
}

function validateTerritoryReferences(continents: Continent[], validTerritoryIds: readonly string[] = []): void {
  if (!validTerritoryIds.length) {
    return;
  }

  const territoryIdSet = new Set(validTerritoryIds);
  continents.forEach((continent) => {
    continent.territoryIds.forEach((territoryId) => {
      if (!territoryIdSet.has(territoryId)) {
        throw new Error(`Continent "${continent.id}" references unknown territory "${territoryId}".`);
      }
    });
  });
}

export function buildMapDefinition(source: string, territoryRecords: readonly StaticTerritoryRecord[]): MapDefinition {
  if (territoryRecords.length < 1) {
    throw new Error("Map definition must contain at least one territory.");
  }

  const territoriesById: Record<string, MapDefinitionTerritoryEntry> = {};

  territoryRecords.forEach((record) => {
    if (!record.id) {
      throw new Error(`Map "${source}" contains a territory without id.`);
    }

    if (!record.name) {
      throw new Error(`Territory "${record.id}" is missing a name.`);
    }

    if (territoriesById[record.id]) {
      throw new Error(`Duplicate territory id "${record.id}" in map "${source}".`);
    }

    territoriesById[record.id] = {
      territory: createTerritory({
        id: record.id,
        name: record.name,
        continentId: record.continentId,
        neighbors: record.neighbors
      }),
      position: {
        x: normalizeCoordinate(record.x, "x", record.id),
        y: normalizeCoordinate(record.y, "y", record.id)
      }
    };
  });

  validateAdjacency(territoriesById);

  return {
    source,
    territories: Object.values(territoriesById),
    positions: Object.values(territoriesById).reduce<Record<string, MapPosition>>((accumulator, entry) => {
      if (!entry.territory.id) {
        throw new Error("Territory id is required.");
      }

      accumulator[entry.territory.id] = entry.position;
      return accumulator;
    }, {})
  };
}

export function buildContinentDefinition(
  source: string,
  continentRecords: readonly StaticContinentRecord[],
  options: BuildContinentsOptions = {}
): ContinentDefinition {
  if (continentRecords.length < 1) {
    throw new Error("Continent definition must contain at least one continent.");
  }

  const continentsById: Record<string, Continent> = {};

  continentRecords.forEach((record) => {
    if (!record.id) {
      throw new Error(`Continent definition "${source}" contains a continent without id.`);
    }

    if (!record.name) {
      throw new Error(`Continent "${record.id}" is missing a name.`);
    }

    if (!Number.isFinite(record.bonus)) {
      throw new Error(`Continent "${record.id}" has an invalid bonus value.`);
    }

    if (continentsById[record.id]) {
      throw new Error(`Duplicate continent id "${record.id}" in "${source}".`);
    }

    continentsById[record.id] = createContinent({
      id: record.id,
      name: record.name,
      bonus: record.bonus,
      territoryIds: record.territoryIds
    });
  });

  const continents = Object.values(continentsById);
  validateTerritoryReferences(continents, options.validTerritoryIds || []);

  return {
    source,
    continents
  };
}
