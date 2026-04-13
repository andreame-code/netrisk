import type { StaticContinentRecord, StaticTerritoryRecord } from "../../typed-map-data.cjs";

export const classicMiniTerritoryRecords: StaticTerritoryRecord[] = [
  { id: "aurora", name: "Aurora", continentId: "north", x: 0.171, y: 0.18, neighbors: ["bastion", "cinder", "delta"] },
  { id: "bastion", name: "Bastion", continentId: "north", x: 0.408, y: 0.14, neighbors: ["aurora", "ember", "forge"] },
  { id: "cinder", name: "Cinder", continentId: "central", x: 0.276, y: 0.39, neighbors: ["aurora", "delta", "ember"] },
  { id: "delta", name: "Delta", continentId: "central", x: 0.145, y: 0.63, neighbors: ["aurora", "cinder", "grove", "harbor"] },
  { id: "ember", name: "Ember", continentId: "central", x: 0.507, y: 0.43, neighbors: ["bastion", "cinder", "forge", "harbor"] },
  { id: "forge", name: "Forge", continentId: "east", x: 0.704, y: 0.25, neighbors: ["bastion", "ember", "harbor", "ion"] },
  { id: "grove", name: "Grove", continentId: "south", x: 0.342, y: 0.84, neighbors: ["delta", "harbor"] },
  { id: "harbor", name: "Harbor", continentId: "south", x: 0.618, y: 0.67, neighbors: ["delta", "ember", "forge", "grove", "ion"] },
  { id: "ion", name: "Ion", continentId: "east", x: 0.862, y: 0.5, neighbors: ["forge", "harbor"] },
];

export const classicMiniContinentRecords: StaticContinentRecord[] = [
  { id: "north", name: "North Reach", bonus: 1, territoryIds: ["aurora", "bastion"] },
  { id: "central", name: "Ash Corridor", bonus: 2, territoryIds: ["cinder", "delta", "ember"] },
  { id: "east", name: "Iron Frontier", bonus: 1, territoryIds: ["forge", "ion"] },
  { id: "south", name: "Harbor Belt", bonus: 1, territoryIds: ["grove", "harbor"] },
];
