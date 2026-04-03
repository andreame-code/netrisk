const classicMiniMap = require("./classic-mini.cjs");

const registeredMaps = [classicMiniMap];

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
