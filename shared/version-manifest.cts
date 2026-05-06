export const appVersion = "0.1.004";
export const engineVersion = "1.0.0";
export const apiVersion = "1.0.0";
export const datastoreSchemaVersion = 1;
export const saveGameSchemaVersion = 1;
export const moduleApiVersion = "1.0.0";
export const minimumCompatibleSaveGameSchemaVersion = 1;
export const minimumCompatibleModuleApiVersion = "1.0.0";
export const unversionedSaveGameSchemaVersion = 1;

export const versionManifest = Object.freeze({
  appVersion,
  engineVersion,
  apiVersion,
  datastoreSchemaVersion,
  saveGameSchemaVersion,
  moduleApiVersion,
  minimumCompatibleSaveGameSchemaVersion,
  minimumCompatibleModuleApiVersion
});

export type VersionManifest = typeof versionManifest;
