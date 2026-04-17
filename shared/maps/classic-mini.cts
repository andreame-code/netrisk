import { buildContinentDefinition, buildMapDefinition } from "../typed-map-data.cjs";
import {
  classicMiniContinentRecords,
  classicMiniTerritoryRecords
} from "./data/classic-mini-data.cjs";

const mapDefinition = buildMapDefinition("shared/maps/classic-mini", classicMiniTerritoryRecords);
const continentDefinition = buildContinentDefinition(
  "shared/maps/classic-mini",
  classicMiniContinentRecords,
  {
    validTerritoryIds: mapDefinition.territories
      .map((entry) => entry.territory.id)
      .filter((id): id is string => Boolean(id))
  }
);

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
