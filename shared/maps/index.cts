import classicMiniMap = require("./classic-mini.cjs");
import middleEarthMap = require("./middle-earth.cjs");
import worldClassicMap = require("./world-classic.cjs");

export interface MapSummary {
  id: string;
  name: string;
  territoryCount: number;
  continentCount: number;
  continentBonuses: Array<{
    id: string | null;
    name: string;
    bonus: number;
    territoryCount: number;
  }>;
}

export const registeredMaps = [classicMiniMap, middleEarthMap, worldClassicMap];

export function summarizeMap(map: (typeof registeredMaps)[number]): MapSummary {
  const continents = Array.isArray(map && map.continents) ? map.continents : [];
  const territories = Array.isArray(map && map.territories) ? map.territories : [];

  return {
    id: map.id,
    name: map.name,
    territoryCount: territories.length,
    continentCount: continents.length,
    continentBonuses: continents.map((continent) => ({
      id: continent.id,
      name: continent.name,
      bonus: continent.bonus,
      territoryCount: Array.isArray(continent.territoryIds) ? continent.territoryIds.length : 0
    }))
  };
}

export function listSupportedMaps(): MapSummary[] {
  return registeredMaps.map(summarizeMap);
}

export function findSupportedMap(mapId: string) {
  return registeredMaps.find((map) => map.id === mapId) || null;
}
