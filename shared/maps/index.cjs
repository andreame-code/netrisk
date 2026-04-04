const classicMiniMap = require("./classic-mini.cjs");
const middleEarthMap = require("./middle-earth.cjs");
const worldClassicMap = require("./world-classic.cjs");

const registeredMaps = [classicMiniMap, middleEarthMap, worldClassicMap];

function summarizeMap(map) {
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

function listSupportedMaps() {
  return registeredMaps.map(summarizeMap);
}

function findSupportedMap(mapId) {
  return registeredMaps.find((map) => map.id === mapId) || null;
}

module.exports = {
  findSupportedMap,
  listSupportedMaps,
  registeredMaps,
  summarizeMap
};
