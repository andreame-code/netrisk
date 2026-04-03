const path = require("path");
const { loadMapDefinitionFromCsv } = require("../map-loader.cjs");
const { loadContinentsFromCsv } = require("../continent-loader.cjs");

const mapDefinition = loadMapDefinitionFromCsv(path.join(__dirname, "classic-mini-map.csv"));
const continentDefinition = loadContinentsFromCsv(path.join(__dirname, "classic-mini-continents.csv"), {
  validTerritoryIds: mapDefinition.territories.map((entry) => entry.territory.id)
});

const territories = mapDefinition.territories.map((entry) => entry.territory);
const positions = mapDefinition.positions;
const continents = continentDefinition.continents;

module.exports = {
  id: "classic-mini",
  name: "Classic Mini",
  territories,
  positions,
  continents,
  mapDefinition: {
    ...mapDefinition,
    continents
  }
};
