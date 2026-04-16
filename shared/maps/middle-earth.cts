import { buildContinentDefinition, buildMapDefinition } from "../typed-map-data.cjs";
import {
  middleEarthContinentRecords,
  middleEarthTerritoryRecords
} from "./data/middle-earth-data.cjs";

const mapDefinition = buildMapDefinition("shared/maps/middle-earth", middleEarthTerritoryRecords);
const continentDefinition = buildContinentDefinition(
  "shared/maps/middle-earth",
  middleEarthContinentRecords,
  {
    validTerritoryIds: mapDefinition.territories
      .map((entry) => entry.territory.id)
      .filter((id): id is string => Boolean(id))
  }
);

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
