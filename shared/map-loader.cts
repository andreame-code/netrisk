import fs from "node:fs";
import path from "node:path";
import { createTerritory, type MapPosition, type Territory } from "./core-domain.cjs";

const REQUIRED_HEADERS = ["id", "name", "continentId", "x", "y", "neighbors"] as const;

interface TerritoryRecord {
  id: string;
  name: string;
  continentId: string;
  x: string;
  y: string;
  neighbors: string;
}

export interface MapDefinitionTerritoryEntry {
  territory: Territory;
  position: MapPosition;
}

export interface MapDefinition {
  source: string;
  territories: MapDefinitionTerritoryEntry[];
  positions: Record<string, MapPosition>;
}

function normalizeCoordinate(rawValue: string, fieldName: string, territoryId: string): number {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new Error(`Territory "${territoryId}" has invalid ${fieldName} coordinate.`);
  }

  if (value < 0 || value > 1) {
    throw new Error(
      `Territory "${territoryId}" must use scalable ${fieldName} coordinates between 0 and 1.`
    );
  }

  return value;
}

function parseNeighbors(rawValue: string): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseCsvRow(line: string): string[] {
  return line.split(",").map((value) => value.trim());
}

function validateHeaders(headers: string[]): void {
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new Error(`Map CSV is missing required headers: ${missingHeaders.join(", ")}.`);
  }
}

function parseTerritoryRecord(
  record: TerritoryRecord,
  rowNumber: number
): MapDefinitionTerritoryEntry {
  if (!record.id) {
    throw new Error(`Row ${rowNumber} is missing territory id.`);
  }

  if (!record.name) {
    throw new Error(`Territory "${record.id}" is missing a name.`);
  }

  return {
    territory: createTerritory({
      id: record.id,
      name: record.name,
      continentId: record.continentId || null,
      neighbors: parseNeighbors(record.neighbors)
    }),
    position: {
      x: normalizeCoordinate(record.x, "x", record.id),
      y: normalizeCoordinate(record.y, "y", record.id)
    }
  };
}

function buildTerritoryRecord(record: Record<string, string>): TerritoryRecord {
  return {
    id: record.id || "",
    name: record.name || "",
    continentId: record.continentId || "",
    x: record.x || "",
    y: record.y || "",
    neighbors: record.neighbors || ""
  };
}

function validateAdjacency(territoriesById: Record<string, MapDefinitionTerritoryEntry>): void {
  Object.values(territoriesById).forEach(({ territory }) => {
    territory.neighbors.forEach((neighborId) => {
      if (!territoriesById[neighborId]) {
        throw new Error(`Territory "${territory.id}" references unknown neighbor "${neighborId}".`);
      }
    });
  });
}

export function loadMapDefinitionFromCsv(csvPath: string): MapDefinition {
  const absolutePath = path.resolve(csvPath);
  const csv = fs.readFileSync(absolutePath, "utf8");
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (lines.length < 2) {
    throw new Error("Map CSV must contain a header row and at least one territory row.");
  }

  const headers = parseCsvRow(lines[0]);
  validateHeaders(headers);

  const territoriesById: Record<string, MapDefinitionTerritoryEntry> = {};

  lines.slice(1).forEach((line, index) => {
    const values = parseCsvRow(line);
    if (values.length !== headers.length) {
      throw new Error(`Row ${index + 2} does not match the CSV header length.`);
    }

    const record = headers.reduce<Record<string, string>>((accumulator, header, headerIndex) => {
      accumulator[header] = values[headerIndex] || "";
      return accumulator;
    }, {});

    const parsed = parseTerritoryRecord(buildTerritoryRecord(record), index + 2);
    if (!parsed.territory.id) {
      throw new Error(`Row ${index + 2} is missing territory id.`);
    }

    if (territoriesById[parsed.territory.id]) {
      throw new Error(`Duplicate territory id "${parsed.territory.id}" in CSV.`);
    }

    territoriesById[parsed.territory.id] = parsed;
  });

  validateAdjacency(territoriesById);

  return {
    source: absolutePath,
    territories: Object.values(territoriesById).map(({ territory, position }) => ({
      territory,
      position
    })),
    positions: Object.values(territoriesById).reduce<Record<string, MapPosition>>(
      (accumulator, entry) => {
        if (!entry.territory.id) {
          throw new Error("Territory id is required.");
        }

        accumulator[entry.territory.id] = entry.position;
        return accumulator;
      },
      {}
    )
  };
}
