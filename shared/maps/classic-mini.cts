import path from "node:path";
import { loadMapDefinitionFromCsv } from "../map-loader.cjs";
import { loadContinentsFromCsv } from "../continent-loader.cjs";

const sourceMapsDir = path.resolve(__dirname, "..", "..", "..", "shared", "maps");

const mapDefinition = loadMapDefinitionFromCsv(path.join(sourceMapsDir, "classic-mini-map.csv"));
const continentDefinition = loadContinentsFromCsv(path.join(sourceMapsDir, "classic-mini-continents.csv"), {
  validTerritoryIds: mapDefinition.territories.map((entry) => entry.territory.id).filter((id): id is string => Boolean(id))
});

const territories = mapDefinition.territories.map((entry) => entry.territory);
const positions = mapDefinition.positions;
const continents = continentDefinition.continents;

const classicMiniMap = {
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

export = classicMiniMap;
