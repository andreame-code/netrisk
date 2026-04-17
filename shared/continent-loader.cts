import fs from "node:fs";
import path from "node:path";
import { createContinent, type Continent } from "./core-domain.cjs";

const REQUIRED_HEADERS = ["id", "name", "bonus", "territoryIds"] as const;

interface ContinentRecord {
  id: string;
  name: string;
  bonus: string;
  territoryIds: string;
}

export interface ContinentDefinition {
  source: string;
  continents: Continent[];
}

export interface LoadContinentsOptions {
  validTerritoryIds?: string[];
}

function parseCsvRow(line: string): string[] {
  return line.split(",").map((value) => value.trim());
}

function parseTerritoryIds(rawValue: string): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
}

function validateHeaders(headers: string[]): void {
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new Error(`Continent CSV is missing required headers: ${missingHeaders.join(", ")}.`);
  }
}

function parseContinentRecord(record: ContinentRecord, rowNumber: number): Continent {
  if (!record.id) {
    throw new Error(`Row ${rowNumber} is missing continent id.`);
  }

  if (!record.name) {
    throw new Error(`Continent "${record.id}" is missing a name.`);
  }

  const bonus = Number(record.bonus);
  if (!Number.isFinite(bonus)) {
    throw new Error(`Continent "${record.id}" has an invalid bonus value.`);
  }

  return createContinent({
    id: record.id,
    name: record.name,
    bonus,
    territoryIds: parseTerritoryIds(record.territoryIds)
  });
}

function buildContinentRecord(record: Record<string, string>): ContinentRecord {
  return {
    id: record.id || "",
    name: record.name || "",
    bonus: record.bonus || "",
    territoryIds: record.territoryIds || ""
  };
}

function validateTerritoryReferences(
  continents: Continent[],
  validTerritoryIds: string[] = []
): void {
  if (!validTerritoryIds.length) {
    return;
  }

  const territoryIdSet = new Set(validTerritoryIds);
  continents.forEach((continent) => {
    continent.territoryIds.forEach((territoryId) => {
      if (!territoryIdSet.has(territoryId)) {
        throw new Error(
          `Continent "${continent.id}" references unknown territory "${territoryId}".`
        );
      }
    });
  });
}

export function loadContinentsFromCsv(
  csvPath: string,
  options: LoadContinentsOptions = {}
): ContinentDefinition {
  const absolutePath = path.resolve(csvPath);
  const csv = fs.readFileSync(absolutePath, "utf8");
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (lines.length < 2) {
    throw new Error("Continent CSV must contain a header row and at least one continent row.");
  }

  const headers = parseCsvRow(lines[0]);
  validateHeaders(headers);

  const continentsById: Record<string, Continent> = {};

  lines.slice(1).forEach((line, index) => {
    const values = parseCsvRow(line);
    if (values.length !== headers.length) {
      throw new Error(`Row ${index + 2} does not match the CSV header length.`);
    }

    const record = headers.reduce<Record<string, string>>((accumulator, header, headerIndex) => {
      accumulator[header] = values[headerIndex] || "";
      return accumulator;
    }, {});

    const continent = parseContinentRecord(buildContinentRecord(record), index + 2);
    if (!continent.id) {
      throw new Error(`Row ${index + 2} is missing continent id.`);
    }

    if (continentsById[continent.id]) {
      throw new Error(`Duplicate continent id "${continent.id}" in CSV.`);
    }

    continentsById[continent.id] = continent;
  });

  const continents = Object.values(continentsById);
  validateTerritoryReferences(continents, options.validTerritoryIds || []);

  return {
    source: absolutePath,
    continents
  };
}
