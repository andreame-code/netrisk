const classicMiniMap = require("./classic-mini.cjs");
const middleEarthMap = require("./middle-earth.cjs");

const registeredMaps = [classicMiniMap, middleEarthMap];

function listSupportedMaps() {
  return registeredMaps.map((map) => ({ id: map.id, name: map.name }));
}

function findSupportedMap(mapId) {
  return registeredMaps.find((map) => map.id === mapId) || null;
}

module.exports = {
  findSupportedMap,
  listSupportedMaps,
  registeredMaps
};
