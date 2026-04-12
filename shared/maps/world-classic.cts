import path from "node:path";
import { loadMapDefinitionFromCsv } from "../map-loader.cjs";
import { loadContinentsFromCsv } from "../continent-loader.cjs";

const sourceMapsDir = path.resolve(__dirname, "..", "..", "..", "shared", "maps");

const mapDefinition = loadMapDefinitionFromCsv(path.join(sourceMapsDir, "world-classic-map.csv"));
const continentDefinition = loadContinentsFromCsv(path.join(sourceMapsDir, "world-classic-continents.csv"), {
  validTerritoryIds: mapDefinition.territories.map((entry) => entry.territory.id).filter((id): id is string => Boolean(id))
});

const territories = mapDefinition.territories.map((entry) => entry.territory);
const positions = mapDefinition.positions;
const continents = continentDefinition.continents;

const worldClassicMap = {
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

export = worldClassicMap;
