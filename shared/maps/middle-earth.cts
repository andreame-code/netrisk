import path from "node:path";
import { loadMapDefinitionFromCsv } from "../map-loader.cjs";
import { loadContinentsFromCsv } from "../continent-loader.cjs";

const sourceMapsDir = path.resolve(__dirname, "..", "..", "..", "shared", "maps");

const mapDefinition = loadMapDefinitionFromCsv(path.join(sourceMapsDir, "middle-earth-map.csv"));
const continentDefinition = loadContinentsFromCsv(path.join(sourceMapsDir, "middle-earth-continents.csv"), {
  validTerritoryIds: mapDefinition.territories.map((entry) => entry.territory.id).filter((id): id is string => Boolean(id))
});

const territories = mapDefinition.territories.map((entry) => entry.territory);
const positions = mapDefinition.positions;
const continents = continentDefinition.continents;

const middleEarthMap = {
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

export = middleEarthMap;
