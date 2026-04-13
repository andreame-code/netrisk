import type { StaticContinentRecord, StaticTerritoryRecord } from "../../typed-map-data.cjs";

export const middleEarthTerritoryRecords: StaticTerritoryRecord[] = [
  { id: "lindon", name: "Lindon", continentId: "eriador", x: 0.12, y: 0.17, neighbors: ["the_shire", "eriador"] },
  { id: "the_shire", name: "The Shire", continentId: "eriador", x: 0.22, y: 0.29, neighbors: ["lindon", "eriador", "dunland"] },
  { id: "eriador", name: "Eriador", continentId: "eriador", x: 0.36, y: 0.23, neighbors: ["lindon", "the_shire", "forodwaith", "rhovanion", "dunland"] },
  { id: "forodwaith", name: "Forodwaith", continentId: "rhovanion", x: 0.55, y: 0.06, neighbors: ["eriador", "rhovanion", "dale", "rhun"] },
  { id: "dunland", name: "Dunland", continentId: "rohan", x: 0.3, y: 0.46, neighbors: ["the_shire", "eriador", "rohan", "gap_of_rohan", "gondor"] },
  { id: "rohan", name: "Rohan", continentId: "rohan", x: 0.43, y: 0.47, neighbors: ["dunland", "fangorn", "gap_of_rohan", "gondor", "emyn_muil"] },
  { id: "fangorn", name: "Fangorn", continentId: "rohan", x: 0.56, y: 0.36, neighbors: ["rohan", "rhovanion", "mirkwood", "brown_lands", "emyn_muil"] },
  { id: "gap_of_rohan", name: "Gap of Rohan", continentId: "rohan", x: 0.48, y: 0.61, neighbors: ["dunland", "rohan", "gondor", "harondor"] },
  { id: "rhovanion", name: "Rhovanion", continentId: "rhovanion", x: 0.6, y: 0.18, neighbors: ["eriador", "forodwaith", "fangorn", "mirkwood", "dale", "brown_lands", "dagorlad"] },
  { id: "mirkwood", name: "Mirkwood", continentId: "mirkwood", x: 0.73, y: 0.29, neighbors: ["rhovanion", "fangorn", "dale", "brown_lands", "dagorlad", "rhun"] },
  { id: "dale", name: "Dale", continentId: "mirkwood", x: 0.77, y: 0.12, neighbors: ["forodwaith", "rhovanion", "mirkwood", "dagorlad", "rhun"] },
  { id: "dorwinion", name: "Dorwinion", continentId: "rhun", x: 0.9, y: 0.48, neighbors: ["rhun", "mordor", "near_harad"] },
  { id: "rhun", name: "Rhun", continentId: "rhun", x: 0.94, y: 0.32, neighbors: ["forodwaith", "dale", "mirkwood", "dagorlad", "dorwinion", "mordor"] },
  { id: "brown_lands", name: "Brown Lands", continentId: "rhovanion", x: 0.63, y: 0.43, neighbors: ["rhovanion", "fangorn", "mirkwood", "emyn_muil", "dagorlad", "dead_marshes"] },
  { id: "emyn_muil", name: "Emyn Muil", continentId: "rhovanion", x: 0.68, y: 0.56, neighbors: ["rohan", "fangorn", "brown_lands", "ithilien", "dead_marshes"] },
  { id: "dagorlad", name: "Dagorlad", continentId: "mirkwood", x: 0.75, y: 0.24, neighbors: ["rhovanion", "mirkwood", "dale", "rhun", "brown_lands", "dead_marshes", "mordor"] },
  { id: "gondor", name: "Gondor", continentId: "gondor", x: 0.36, y: 0.77, neighbors: ["dunland", "rohan", "gap_of_rohan", "ithilien", "harondor"] },
  { id: "ithilien", name: "Ithilien", continentId: "gondor", x: 0.6, y: 0.67, neighbors: ["emyn_muil", "gondor", "dead_marshes", "mordor", "harondor"] },
  { id: "dead_marshes", name: "Dead Marshes", continentId: "mordor", x: 0.73, y: 0.6, neighbors: ["brown_lands", "emyn_muil", "dagorlad", "ithilien", "mordor"] },
  { id: "mordor", name: "Mordor", continentId: "mordor", x: 0.83, y: 0.7, neighbors: ["dagorlad", "dead_marshes", "ithilien", "rhun", "dorwinion", "harondor", "near_harad"] },
  { id: "harondor", name: "Harondor", continentId: "haradwaith", x: 0.56, y: 0.83, neighbors: ["gap_of_rohan", "gondor", "ithilien", "mordor", "near_harad"] },
  { id: "near_harad", name: "Near Harad", continentId: "haradwaith", x: 0.79, y: 0.9, neighbors: ["harondor", "mordor", "dorwinion"] },
];

export const middleEarthContinentRecords: StaticContinentRecord[] = [
  { id: "eriador", name: "Eriador", bonus: 2, territoryIds: ["lindon", "the_shire", "eriador"] },
  { id: "rohan", name: "Rohan", bonus: 3, territoryIds: ["dunland", "rohan", "fangorn", "gap_of_rohan"] },
  { id: "rhovanion", name: "Rhovanion", bonus: 4, territoryIds: ["forodwaith", "rhovanion", "brown_lands", "emyn_muil"] },
  { id: "mirkwood", name: "Mirkwood", bonus: 3, territoryIds: ["mirkwood", "dale", "dagorlad"] },
  { id: "rhun", name: "Rhun", bonus: 2, territoryIds: ["dorwinion", "rhun"] },
  { id: "gondor", name: "Gondor", bonus: 2, territoryIds: ["gondor", "ithilien"] },
  { id: "mordor", name: "Mordor", bonus: 3, territoryIds: ["dead_marshes", "mordor"] },
  { id: "haradwaith", name: "Haradwaith", bonus: 2, territoryIds: ["harondor", "near_harad"] },
];
