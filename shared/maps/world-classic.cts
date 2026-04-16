import { buildContinentDefinition, buildMapDefinition } from "../typed-map-data.cjs";
import {
  worldClassicContinentRecords,
  worldClassicTerritoryRecords
} from "./data/world-classic-data.cjs";

const mapDefinition = buildMapDefinition("shared/maps/world-classic", worldClassicTerritoryRecords);
const continentDefinition = buildContinentDefinition(
  "shared/maps/world-classic",
  worldClassicContinentRecords,
  {
    validTerritoryIds: mapDefinition.territories
      .map((entry) => entry.territory.id)
      .filter((id): id is string => Boolean(id))
  }
);

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
