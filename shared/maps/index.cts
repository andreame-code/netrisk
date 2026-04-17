import classicMiniMap = require("./classic-mini.cjs");
import middleEarthMap = require("./middle-earth.cjs");
import worldClassicMap = require("./world-classic.cjs");
import { createModuleRegistry } from "../module-registry.cjs";

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

export type SupportedMap = (typeof registeredMaps)[number];

const mapRegistry = createModuleRegistry([classicMiniMap, middleEarthMap, worldClassicMap]);

export const registeredMaps = mapRegistry.entries;

export function summarizeMap(map: SupportedMap): MapSummary {
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
  return mapRegistry.entries.map(summarizeMap);
}

export function findSupportedMap(mapId: string) {
  return mapRegistry.find(mapId);
}
