const path = require("path");
const { loadMapDefinitionFromCsv } = require("../map-loader.cjs");
const { loadContinentsFromCsv } = require("../continent-loader.cjs");

const mapDefinition = loadMapDefinitionFromCsv(path.join(__dirname, "middle-earth-map.csv"));
const continentDefinition = loadContinentsFromCsv(path.join(__dirname, "middle-earth-continents.csv"), {
  validTerritoryIds: mapDefinition.territories.map((entry) => entry.territory.id)
});

const territories = mapDefinition.territories.map((entry) => entry.territory);
const positions = mapDefinition.positions;
const continents = continentDefinition.continents;

module.exports = {
  id: "middle-earth",
  name: "Middle-earth",
  territories,
  positions,
  continents,
  backgroundImage: "/assets/maps/middle-earth.jpg",
  aspectRatio: { width: 463, height: 800 },
  mapDefinition: {
    ...mapDefinition,
    continents
  }
};
