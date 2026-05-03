import {
  apiVersion,
  appVersion,
  datastoreSchemaVersion,
  engineVersion,
  minimumCompatibleModuleApiVersion,
  minimumCompatibleSaveGameSchemaVersion,
  moduleApiVersion,
  saveGameSchemaVersion,
  unversionedSaveGameSchemaVersion
} from "./version-manifest.cjs";

export interface VersionSnapshot {
  appVersion: string;
  engineVersion: string;
  apiVersion: string;
  datastoreSchemaVersion: number;
  saveGameSchemaVersion: number;
  moduleApiVersion: string;
  minimumCompatibleSaveGameSchemaVersion: number;
  minimumCompatibleModuleApiVersion: string;
  compatible: true;
}

export interface GameStateVersionMetadata {
  schemaVersion: number;
  engineVersion: string;
  createdWithAppVersion: string;
}

export function buildVersionSnapshot(): VersionSnapshot {
  return {
    appVersion,
    engineVersion,
    apiVersion,
    datastoreSchemaVersion,
    saveGameSchemaVersion,
    moduleApiVersion,
    minimumCompatibleSaveGameSchemaVersion,
    minimumCompatibleModuleApiVersion,
    compatible: true
  };
}

export function buildGameStateVersionMetadata(): GameStateVersionMetadata {
  return {
    schemaVersion: saveGameSchemaVersion,
    engineVersion,
    createdWithAppVersion: appVersion
  };
}

export function isSaveGameSchemaCompatible(version: unknown): boolean {
  const schemaVersion = version == null ? unversionedSaveGameSchemaVersion : Number(version);
  return (
    Number.isInteger(schemaVersion) &&
    schemaVersion >= minimumCompatibleSaveGameSchemaVersion &&
    schemaVersion <= saveGameSchemaVersion
  );
}

export function isSaveGameSchemaRangeCompatible(
  minimumVersion: unknown,
  maximumVersion: unknown
): boolean {
  const minimum =
    minimumVersion == null ? minimumCompatibleSaveGameSchemaVersion : Number(minimumVersion);
  const maximum = maximumVersion == null ? saveGameSchemaVersion : Number(maximumVersion);

  return (
    Number.isInteger(minimum) &&
    Number.isInteger(maximum) &&
    minimum <= saveGameSchemaVersion &&
    maximum >= saveGameSchemaVersion
  );
}

function parseVersionParts(version: string): [number, number, number] | null {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersionParts(left: [number, number, number], right: [number, number, number]) {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

export function isModuleApiCompatible(version: unknown): boolean {
  if (typeof version !== "string") {
    return false;
  }

  const requested = parseVersionParts(version);
  const minimum = parseVersionParts(minimumCompatibleModuleApiVersion);
  const current = parseVersionParts(moduleApiVersion);
  if (!requested || !minimum || !current) {
    return false;
  }

  return (
    compareVersionParts(requested, minimum) >= 0 && compareVersionParts(requested, current) <= 0
  );
}
