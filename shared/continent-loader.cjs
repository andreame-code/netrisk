const fs = require("fs");
const path = require("path");
const { createContinent } = require("./core-domain.cjs");

const REQUIRED_HEADERS = ["id", "name", "bonus", "territoryIds"];

function parseCsvRow(line) {
  return line.split(",").map((value) => value.trim());
}

function parseTerritoryIds(rawValue) {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
}

function validateHeaders(headers) {
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new Error(`Continent CSV is missing required headers: ${missingHeaders.join(", ")}.`);
  }
}

function parseContinentRecord(record, rowNumber) {
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

function validateTerritoryReferences(continents, validTerritoryIds = []) {
  if (!validTerritoryIds.length) {
    return;
  }

  const territoryIdSet = new Set(validTerritoryIds);
  continents.forEach((continent) => {
    continent.territoryIds.forEach((territoryId) => {
      if (!territoryIdSet.has(territoryId)) {
        throw new Error(`Continent "${continent.id}" references unknown territory "${territoryId}".`);
      }
    });
  });
}

function loadContinentsFromCsv(csvPath, options = {}) {
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

  const continentsById = {};

  lines.slice(1).forEach((line, index) => {
    const values = parseCsvRow(line);
    if (values.length !== headers.length) {
      throw new Error(`Row ${index + 2} does not match the CSV header length.`);
    }

    const record = headers.reduce((accumulator, header, headerIndex) => {
      accumulator[header] = values[headerIndex];
      return accumulator;
    }, {});

    const continent = parseContinentRecord(record, index + 2);
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

module.exports = {
  loadContinentsFromCsv
};
