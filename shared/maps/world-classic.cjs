const path = require("path");
const { loadMapDefinitionFromCsv } = require("../map-loader.cjs");
const { loadContinentsFromCsv } = require("../continent-loader.cjs");

const mapDefinition = loadMapDefinitionFromCsv(path.join(__dirname, "world-classic-map.csv"));
const continentDefinition = loadContinentsFromCsv(path.join(__dirname, "world-classic-continents.csv"), {
  validTerritoryIds: mapDefinition.territories.map((entry) => entry.territory.id)
});

const territories = mapDefinition.territories.map((entry) => entry.territory);
const positions = mapDefinition.positions;
const continents = continentDefinition.continents;

module.exports = {
  id: "world-classic",
  name: "World Classic",
  territories,
  positions,
  continents,
  backgroundImage: "/assets/maps/world-classic.png",
  aspectRatio: { width: 800, height: 533 },
  mapDefinition: {
    ...mapDefinition,
    continents
  }
};
