// Generated from shared/runtime-validation.cts. Do not edit manually.
import { z } from "zod";

const NETRISK_MODULE_CAPABILITY_KIND_VALUES = [
  "card-rule-set",
  "content-pack",
  "dice-rule-set",
  "fortify-rule-set",
  "gameplay-hook",
  "map",
  "player-piece-set",
  "reinforcement-rule-set",
  "site-theme",
  "ui-slot",
  "victory-rule-set"
] as const;
const NETRISK_UI_SLOT_ID_VALUES = [
  "admin-modules-page",
  "game.sidebar",
  "lobby.page",
  "new-game.sidebar",
  "top-nav-bar"
] as const;

type IssuePathSegment = string | number;

type ZodLikeIssue = {
  code?: string;
  path?: IssuePathSegment[];
  message?: string;
};

type ZodLikeError = {
  issues?: ZodLikeIssue[];
};

type SchemaLike<T> = {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
};

export const validationErrorSchema = z.object({
  code: z.string(),
  path: z.string(),
  message: z.string()
});

export type ValidationError = z.infer<typeof validationErrorSchema>;

export const messagePayloadSchema = objectSchema({
  message: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  messageKey: z.string().min(1).optional(),
  errorKey: z.string().min(1).optional(),
  reasonKey: z.string().min(1).optional(),
  messageParams: z.record(z.string(), z.unknown()).optional(),
  errorParams: z.record(z.string(), z.unknown()).optional(),
  reasonParams: z.record(z.string(), z.unknown()).optional()
});

export type MessagePayload = z.infer<typeof messagePayloadSchema>;

export const transportErrorPayloadSchema = messagePayloadSchema.extend({
  code: z.string().min(1).nullable().optional(),
  validationErrors: z.array(validationErrorSchema).optional(),
  validation: z.record(z.string(), z.unknown()).optional()
});

export type TransportErrorPayload = z.infer<typeof transportErrorPayloadSchema>;

function objectSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).passthrough();
}

export function formatValidationPath(path: IssuePathSegment[] | undefined): string {
  if (!Array.isArray(path) || !path.length) {
    return "$";
  }

  return path.map((segment) => String(segment)).join(".");
}

export function toValidationErrors(error: ZodLikeError | null | undefined): ValidationError[] {
  if (!Array.isArray(error?.issues)) {
    return [];
  }

  return error.issues.map((issue) => ({
    code: typeof issue.code === "string" && issue.code ? issue.code : "custom",
    path: formatValidationPath(issue.path),
    message: typeof issue.message === "string" && issue.message ? issue.message : "Invalid value."
  }));
}

export class SchemaValidationError extends Error {
  validationErrors: ValidationError[];
  schemaName: string;

  constructor(schemaName: string, message: string, error: unknown) {
    super(message);
    this.name = "SchemaValidationError";
    this.schemaName = schemaName;
    this.validationErrors = toValidationErrors(error as ZodLikeError | null | undefined);
  }
}

export function parseWithSchema<T>(
  schema: SchemaLike<T>,
  payload: unknown,
  options: {
    schemaName?: string;
    message?: string;
  } = {}
): T {
  const result = schema.safeParse(payload);
  if (result.success) {
    return result.data;
  }

  throw new SchemaValidationError(
    options.schemaName || "payload",
    options.message || "Payload validation failed.",
    result.error
  );
}

export const themePreferencesSchema = objectSchema({
  theme: z.string().min(1).nullable().optional()
});

export type ThemePreferences = z.infer<typeof themePreferencesSchema>;

export const publicUserSchema = objectSchema({
  id: z.string().min(1),
  username: z.string().min(1),
  role: z.string().optional(),
  authMethods: z.array(z.string()).optional(),
  hasEmail: z.boolean().optional(),
  preferences: themePreferencesSchema.nullable().optional()
});

export type PublicUser = z.infer<typeof publicUserSchema>;

export const authSessionResponseSchema = objectSchema({
  user: publicUserSchema
});

export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;

export const loginRequestSchema = objectSchema({
  username: z.string().min(1),
  password: z.string().min(1)
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const registerRequestSchema = objectSchema({
  username: z.string().min(1),
  password: z.string().min(1),
  email: z.string().optional()
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginResponseSchema = objectSchema({
  ok: z.literal(true),
  user: publicUserSchema,
  availableAuthProviders: z.array(z.string()).optional(),
  nextAuthProviders: z.array(z.string()).optional()
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const themePreferenceRequestSchema = objectSchema({
  theme: z.string().min(1)
});

export type ThemePreferenceRequest = z.infer<typeof themePreferenceRequestSchema>;

export const themePreferenceResponseSchema = objectSchema({
  ok: z.literal(true),
  user: publicUserSchema,
  preferences: themePreferencesSchema
});

export type ThemePreferenceResponse = z.infer<typeof themePreferenceResponseSchema>;

export const accountSettingsRequestSchema = objectSchema({
  currentPassword: z.string().min(1),
  email: z.string().min(1).optional(),
  newPassword: z.string().min(1).optional(),
  confirmNewPassword: z.string().min(1).optional()
});

export type AccountSettingsRequest = z.infer<typeof accountSettingsRequestSchema>;

export const accountSettingsResponseSchema = objectSchema({
  ok: z.literal(true),
  user: publicUserSchema
});

export type AccountSettingsResponse = z.infer<typeof accountSettingsResponseSchema>;

export const logoutResponseSchema = objectSchema({
  ok: z.literal(true)
});

export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

export const victoryRuleSetSchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1)
});

export type VictoryRuleSet = z.infer<typeof victoryRuleSetSchema>;

export const visualThemeSchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1)
});

export type VisualTheme = z.infer<typeof visualThemeSchema>;

export const pieceSkinSchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  renderStyleId: z.string().min(1),
  usesPlayerColor: z.boolean(),
  assetBaseUrl: z.string().min(1).nullable().optional()
});

export type PieceSkin = z.infer<typeof pieceSkinSchema>;

export const netRiskModuleProfileSchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
  moduleId: z.string().min(1).nullable().optional()
});

export type NetRiskModuleProfile = z.infer<typeof netRiskModuleProfileSchema>;

export const netRiskGamePresetDefaultsSchema = objectSchema({
  contentPackId: z.string().min(1).nullable().optional(),
  ruleSetId: z.string().min(1).nullable().optional(),
  pieceSetId: z.string().min(1).nullable().optional(),
  mapId: z.string().min(1).nullable().optional(),
  diceRuleSetId: z.string().min(1).nullable().optional(),
  victoryRuleSetId: z.string().min(1).nullable().optional(),
  themeId: z.string().min(1).nullable().optional(),
  pieceSkinId: z.string().min(1).nullable().optional()
});

export type NetRiskGamePresetDefaults = z.infer<typeof netRiskGamePresetDefaultsSchema>;

export const netRiskGamePresetSchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
  moduleId: z.string().min(1).nullable().optional(),
  activeModuleIds: z.array(z.string().min(1)).optional(),
  contentProfileId: z.string().min(1).nullable().optional(),
  gameplayProfileId: z.string().min(1).nullable().optional(),
  uiProfileId: z.string().min(1).nullable().optional(),
  defaults: netRiskGamePresetDefaultsSchema.nullable().optional()
});

export type NetRiskGamePreset = z.infer<typeof netRiskGamePresetSchema>;

export const netRiskUiSlotContributionSchema = objectSchema({
  slotId: z.enum(NETRISK_UI_SLOT_ID_VALUES),
  itemId: z.string().min(1),
  title: z.string().min(1),
  kind: z.string().min(1),
  order: z.number().optional(),
  description: z.string().min(1).nullable().optional(),
  route: z.string().min(1).nullable().optional()
});

export type NetRiskUiSlotContribution = z.infer<typeof netRiskUiSlotContributionSchema>;

export const netRiskModuleCapabilitySchema = objectSchema({
  kind: z.enum(NETRISK_MODULE_CAPABILITY_KIND_VALUES),
  targetId: z.string().min(1).nullable().optional(),
  hook: z.string().min(1).nullable().optional(),
  scope: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional()
});

export type NetRiskModuleCapability = z.infer<typeof netRiskModuleCapabilitySchema>;

export const netRiskModuleDependencySchema = objectSchema({
  id: z.string().min(1),
  version: z.string().min(1).nullable().optional(),
  optional: z.boolean().optional()
});

export type NetRiskModuleDependency = z.infer<typeof netRiskModuleDependencySchema>;

export const netRiskModuleEntrypointsSchema = objectSchema({
  server: z.string().min(1).nullable().optional(),
  clientManifest: z.string().min(1).nullable().optional()
});

export type NetRiskModuleEntrypoints = z.infer<typeof netRiskModuleEntrypointsSchema>;

export const netRiskModuleManifestSchema = objectSchema({
  schemaVersion: z.number().int(),
  id: z.string().min(1),
  version: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
  engineVersion: z.string().min(1),
  kind: z.string().min(1),
  dependencies: z.array(netRiskModuleDependencySchema),
  conflicts: z.array(z.string().min(1)),
  capabilities: z.array(netRiskModuleCapabilitySchema),
  entrypoints: netRiskModuleEntrypointsSchema.nullable().optional(),
  assetsDir: z.string().min(1).nullable().optional(),
  migrations: z.array(z.string().min(1)).optional(),
  permissions: z.array(z.string().min(1)).optional()
});

export type NetRiskModuleManifest = z.infer<typeof netRiskModuleManifestSchema>;

export const netRiskContentContributionSchema = objectSchema({
  mapIds: z.array(z.string().min(1)).optional(),
  siteThemeIds: z.array(z.string().min(1)).optional(),
  pieceSkinIds: z.array(z.string().min(1)).optional(),
  playerPieceSetIds: z.array(z.string().min(1)).optional(),
  contentPackIds: z.array(z.string().min(1)).optional(),
  diceRuleSetIds: z.array(z.string().min(1)).optional(),
  cardRuleSetIds: z.array(z.string().min(1)).optional(),
  victoryRuleSetIds: z.array(z.string().min(1)).optional(),
  fortifyRuleSetIds: z.array(z.string().min(1)).optional(),
  reinforcementRuleSetIds: z.array(z.string().min(1)).optional()
});

export type NetRiskContentContribution = z.infer<typeof netRiskContentContributionSchema>;

export const netRiskUiContributionSchema = objectSchema({
  slots: z.array(netRiskUiSlotContributionSchema).optional(),
  themeTokens: z.array(z.string().min(1)).optional(),
  stylesheets: z.array(z.string().min(1)).optional(),
  locales: z.array(z.string().min(1)).optional()
});

export type NetRiskUiContribution = z.infer<typeof netRiskUiContributionSchema>;

export const netRiskGameplayContributionSchema = objectSchema({
  hooks: z.array(z.string().min(1)).optional(),
  profileIds: z.array(z.string().min(1)).optional()
});

export type NetRiskGameplayContribution = z.infer<typeof netRiskGameplayContributionSchema>;

export const netRiskModuleProfilesSchema = objectSchema({
  content: z.array(netRiskModuleProfileSchema).optional(),
  gameplay: z.array(netRiskModuleProfileSchema).optional(),
  ui: z.array(netRiskModuleProfileSchema).optional()
});

export type NetRiskModuleProfiles = z.infer<typeof netRiskModuleProfilesSchema>;

export const netRiskModuleClientManifestSchema = objectSchema({
  ui: netRiskUiContributionSchema.nullable().optional(),
  gameplay: netRiskGameplayContributionSchema.nullable().optional(),
  content: netRiskContentContributionSchema.nullable().optional(),
  gamePresets: z.array(netRiskGamePresetSchema).nullable().optional(),
  profiles: netRiskModuleProfilesSchema.nullable().optional()
});

export type NetRiskModuleClientManifest = z.infer<typeof netRiskModuleClientManifestSchema>;

export const netRiskModuleReferenceSchema = objectSchema({
  id: z.string().min(1),
  version: z.string().min(1)
});

export type NetRiskModuleReference = z.infer<typeof netRiskModuleReferenceSchema>;

export const installedModuleSummarySchema = objectSchema({
  id: z.string().min(1),
  version: z.string().min(1).nullable(),
  displayName: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
  kind: z.string().min(1).nullable(),
  sourcePath: z.string().min(1),
  status: z.string().min(1),
  enabled: z.boolean(),
  compatible: z.boolean(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  capabilities: z.array(netRiskModuleCapabilitySchema),
  manifest: netRiskModuleManifestSchema.nullable().optional(),
  clientManifestPath: z.string().min(1).nullable().optional(),
  clientManifest: netRiskModuleClientManifestSchema.nullable().optional()
});

export type InstalledModuleSummary = z.infer<typeof installedModuleSummarySchema>;

export const playerPieceSetSummarySchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  paletteSize: z.number()
});

export type PlayerPieceSetSummary = z.infer<typeof playerPieceSetSummarySchema>;

export const contentPackSummarySchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  defaultSiteThemeId: z.string().min(1),
  defaultMapId: z.string().min(1),
  defaultDiceRuleSetId: z.string().min(1),
  defaultCardRuleSetId: z.string().min(1),
  defaultVictoryRuleSetId: z.string().min(1),
  defaultPieceSetId: z.string().min(1)
});

export type ContentPackSummary = z.infer<typeof contentPackSummarySchema>;

export const continentBonusSummarySchema = objectSchema({
  name: z.string().min(1),
  bonus: z.number(),
  territoryCount: z.number()
});

export type ContinentBonusSummary = z.infer<typeof continentBonusSummarySchema>;

export const mapSummarySchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  territoryCount: z.number(),
  continentCount: z.number(),
  continentBonuses: z.array(continentBonusSummarySchema).optional()
});

export type MapSummary = z.infer<typeof mapSummarySchema>;

export const ruleSetDefaultsSchema = objectSchema({
  extensionSchemaVersion: z.number(),
  mapId: z.string().min(1),
  diceRuleSetId: z.string().min(1),
  victoryRuleSetId: z.string().min(1),
  themeId: z.string().min(1),
  pieceSkinId: z.string().min(1)
});

export type RuleSetDefaults = z.infer<typeof ruleSetDefaultsSchema>;

export const ruleSetSummarySchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  defaults: ruleSetDefaultsSchema,
  defaultDiceRuleSetId: z.string().min(1).optional(),
  defaultVictoryRuleSetId: z.string().min(1).optional()
});

export type RuleSetSummary = z.infer<typeof ruleSetSummarySchema>;

export const diceRuleSetSchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  attackerMaxDice: z.number(),
  defenderMaxDice: z.number()
});

export type DiceRuleSet = z.infer<typeof diceRuleSetSchema>;

export const resolvedModuleCatalogSchema = objectSchema({
  modules: z.array(installedModuleSummarySchema),
  enabledModules: z.array(netRiskModuleReferenceSchema),
  gameModules: z.array(installedModuleSummarySchema),
  content: netRiskContentContributionSchema,
  maps: z.array(mapSummarySchema),
  ruleSets: z.array(ruleSetSummarySchema),
  playerPieceSets: z.array(playerPieceSetSummarySchema),
  diceRuleSets: z.array(diceRuleSetSchema),
  contentPacks: z.array(contentPackSummarySchema),
  victoryRuleSets: z.array(victoryRuleSetSchema),
  themes: z.array(visualThemeSchema),
  pieceSkins: z.array(pieceSkinSchema),
  gamePresets: z.array(netRiskGamePresetSchema),
  uiSlots: z.array(netRiskUiSlotContributionSchema),
  contentProfiles: z.array(netRiskModuleProfileSchema),
  gameplayProfiles: z.array(netRiskModuleProfileSchema),
  uiProfiles: z.array(netRiskModuleProfileSchema)
});

export type ResolvedModuleCatalog = z.infer<typeof resolvedModuleCatalogSchema>;

export const playerSlotConfigSchema = objectSchema({
  slot: z.number().int().nullable().optional(),
  type: z.string().min(1).nullable().optional(),
  name: z.string().min(1).nullable().optional()
});

export type PlayerSlotConfig = z.infer<typeof playerSlotConfigSchema>;

export const createGameRequestSchema = objectSchema({
  name: z.string().min(1).nullable().optional(),
  totalPlayers: z.number().int().nullable().optional(),
  contentPackId: z.string().min(1).nullable().optional(),
  ruleSetId: z.string().min(1).nullable().optional(),
  mapId: z.string().min(1).nullable().optional(),
  diceRuleSetId: z.string().min(1).nullable().optional(),
  victoryRuleSetId: z.string().min(1).nullable().optional(),
  pieceSetId: z.string().min(1).nullable().optional(),
  themeId: z.string().min(1).nullable().optional(),
  pieceSkinId: z.string().min(1).nullable().optional(),
  gamePresetId: z.string().min(1).nullable().optional(),
  activeModuleIds: z.array(z.string().min(1)).nullable().optional(),
  contentProfileId: z.string().min(1).nullable().optional(),
  gameplayProfileId: z.string().min(1).nullable().optional(),
  uiProfileId: z.string().min(1).nullable().optional(),
  turnTimeoutHours: z.number().int().nullable().optional(),
  players: z.array(playerSlotConfigSchema).nullable().optional()
});

export type CreateGameRequest = z.infer<typeof createGameRequestSchema>;

export const gameSummarySchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  phase: z.string().min(1),
  playerCount: z.number(),
  updatedAt: z.string().min(1),
  contentPackId: z.string().nullable().optional(),
  diceRuleSetId: z.string().nullable().optional(),
  totalPlayers: z.number().nullable().optional(),
  mapName: z.string().nullable().optional(),
  mapId: z.string().nullable().optional(),
  aiCount: z.number().optional(),
  creatorUserId: z.string().nullable().optional(),
  activeModules: z.array(netRiskModuleReferenceSchema).optional(),
  gamePresetId: z.string().nullable().optional(),
  contentProfileId: z.string().nullable().optional(),
  gameplayProfileId: z.string().nullable().optional(),
  uiProfileId: z.string().nullable().optional()
});

export type GameSummary = z.infer<typeof gameSummarySchema>;

export const gameIdRequestSchema = objectSchema({
  gameId: z.string().min(1)
});

export type GameIdRequest = z.infer<typeof gameIdRequestSchema>;

const gameplayRequestBaseSchema = objectSchema({
  gameId: z.string().min(1).nullable().optional(),
  playerId: z.string().min(1),
  expectedVersion: z.number().int().min(1).nullable().optional()
});

export const startGameRequestSchema = gameplayRequestBaseSchema;

export type StartGameRequest = z.infer<typeof startGameRequestSchema>;

export const gameActionReinforceRequestSchema = gameplayRequestBaseSchema.extend({
  type: z.literal("reinforce"),
  territoryId: z.string().min(1),
  amount: z.number().int().min(1).nullable().optional()
});

export type GameActionReinforceRequest = z.infer<typeof gameActionReinforceRequestSchema>;

export const gameActionEnvelopeSchema = gameplayRequestBaseSchema.extend({
  type: z.string().min(1)
});

export type GameActionEnvelope = z.infer<typeof gameActionEnvelopeSchema>;

export const gameActionAttackRequestSchema = gameplayRequestBaseSchema.extend({
  type: z.literal("attack"),
  fromId: z.string().min(1),
  toId: z.string().min(1),
  attackDice: z.number().int().min(1).nullable().optional()
});

export type GameActionAttackRequest = z.infer<typeof gameActionAttackRequestSchema>;

export const gameActionAttackBanzaiRequestSchema = gameplayRequestBaseSchema.extend({
  type: z.literal("attackBanzai"),
  fromId: z.string().min(1),
  toId: z.string().min(1),
  attackDice: z.number().int().min(1).nullable().optional()
});

export type GameActionAttackBanzaiRequest = z.infer<typeof gameActionAttackBanzaiRequestSchema>;

export const gameActionMoveAfterConquestRequestSchema = gameplayRequestBaseSchema.extend({
  type: z.literal("moveAfterConquest"),
  armies: z.number().int().min(1)
});

export type GameActionMoveAfterConquestRequest = z.infer<
  typeof gameActionMoveAfterConquestRequestSchema
>;

export const gameActionFortifyRequestSchema = gameplayRequestBaseSchema.extend({
  type: z.literal("fortify"),
  fromId: z.string().min(1),
  toId: z.string().min(1),
  armies: z.number().int().min(1)
});

export type GameActionFortifyRequest = z.infer<typeof gameActionFortifyRequestSchema>;

export const gameActionEndTurnRequestSchema = gameplayRequestBaseSchema.extend({
  type: z.literal("endTurn")
});

export type GameActionEndTurnRequest = z.infer<typeof gameActionEndTurnRequestSchema>;

export const gameActionSurrenderRequestSchema = gameplayRequestBaseSchema.extend({
  type: z.literal("surrender")
});

export type GameActionSurrenderRequest = z.infer<typeof gameActionSurrenderRequestSchema>;

export const gameActionRequestSchema = z.discriminatedUnion("type", [
  gameActionReinforceRequestSchema,
  gameActionAttackRequestSchema,
  gameActionAttackBanzaiRequestSchema,
  gameActionMoveAfterConquestRequestSchema,
  gameActionFortifyRequestSchema,
  gameActionEndTurnRequestSchema,
  gameActionSurrenderRequestSchema
]);

export type GameActionRequest = z.infer<typeof gameActionRequestSchema>;

export const tradeCardsRequestSchema = gameplayRequestBaseSchema.extend({
  cardIds: z.array(z.string().min(1)).length(3)
});

export type TradeCardsRequest = z.infer<typeof tradeCardsRequestSchema>;

export const gameListResponseSchema = objectSchema({
  games: z.array(gameSummarySchema),
  activeGameId: z.string().min(1).nullable().optional()
});

export type GameListResponse = z.infer<typeof gameListResponseSchema>;

export const adminGameDefaultsSchema = objectSchema({
  totalPlayers: z.number().int().nullable().optional(),
  contentPackId: z.string().min(1).nullable().optional(),
  ruleSetId: z.string().min(1).nullable().optional(),
  mapId: z.string().min(1).nullable().optional(),
  diceRuleSetId: z.string().min(1).nullable().optional(),
  victoryRuleSetId: z.string().min(1).nullable().optional(),
  pieceSetId: z.string().min(1).nullable().optional(),
  themeId: z.string().min(1).nullable().optional(),
  pieceSkinId: z.string().min(1).nullable().optional(),
  gamePresetId: z.string().min(1).nullable().optional(),
  activeModuleIds: z.array(z.string().min(1)).optional(),
  contentProfileId: z.string().min(1).nullable().optional(),
  gameplayProfileId: z.string().min(1).nullable().optional(),
  uiProfileId: z.string().min(1).nullable().optional(),
  turnTimeoutHours: z.number().int().nullable().optional(),
  players: z.array(playerSlotConfigSchema).nullable().optional()
});

export type AdminGameDefaults = z.infer<typeof adminGameDefaultsSchema>;

export const gameOptionsResponseSchema = objectSchema({
  ruleSets: z.array(ruleSetSummarySchema),
  maps: z.array(mapSummarySchema),
  diceRuleSets: z.array(diceRuleSetSchema),
  victoryRuleSets: z.array(victoryRuleSetSchema),
  themes: z.array(visualThemeSchema),
  pieceSkins: z.array(pieceSkinSchema),
  modules: z.array(installedModuleSummarySchema).optional(),
  enabledModules: z.array(netRiskModuleReferenceSchema).optional(),
  gamePresets: z.array(netRiskGamePresetSchema).optional(),
  contentProfiles: z.array(netRiskModuleProfileSchema).optional(),
  gameplayProfiles: z.array(netRiskModuleProfileSchema).optional(),
  uiProfiles: z.array(netRiskModuleProfileSchema).optional(),
  uiSlots: z.array(netRiskUiSlotContributionSchema).optional(),
  playerPieceSets: z.array(playerPieceSetSummarySchema).optional(),
  contentPacks: z.array(contentPackSummarySchema).optional(),
  resolvedCatalog: resolvedModuleCatalogSchema.optional(),
  turnTimeoutHoursOptions: z.array(z.number().int()),
  playerRange: objectSchema({
    min: z.number().int(),
    max: z.number().int()
  }),
  adminDefaults: adminGameDefaultsSchema.optional()
});

export type GameOptionsResponse = z.infer<typeof gameOptionsResponseSchema>;

export const modulesCatalogResponseSchema = objectSchema({
  ok: z.boolean().optional(),
  modules: z.array(installedModuleSummarySchema),
  enabledModules: z.array(netRiskModuleReferenceSchema),
  engineVersion: z.string().min(1)
});

export type ModulesCatalogResponse = z.infer<typeof modulesCatalogResponseSchema>;

export const moduleOptionsResponseSchema = objectSchema({
  modules: z.array(installedModuleSummarySchema),
  enabledModules: z.array(netRiskModuleReferenceSchema),
  gameModules: z.array(installedModuleSummarySchema),
  content: netRiskContentContributionSchema,
  maps: z.array(mapSummarySchema).optional(),
  playerPieceSets: z.array(playerPieceSetSummarySchema).optional(),
  diceRuleSets: z.array(diceRuleSetSchema).optional(),
  contentPacks: z.array(contentPackSummarySchema).optional(),
  gamePresets: z.array(netRiskGamePresetSchema),
  uiSlots: z.array(netRiskUiSlotContributionSchema),
  contentProfiles: z.array(netRiskModuleProfileSchema),
  gameplayProfiles: z.array(netRiskModuleProfileSchema),
  uiProfiles: z.array(netRiskModuleProfileSchema),
  resolvedCatalog: resolvedModuleCatalogSchema.optional()
});

export type ModuleOptionsResponse = z.infer<typeof moduleOptionsResponseSchema>;

export const gameConfigPieceSetSchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  paletteSize: z.number()
});

export type GameConfigPieceSet = z.infer<typeof gameConfigPieceSetSchema>;

export const snapshotPlayerSchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  connected: z.boolean().optional(),
  isAi: z.boolean().optional(),
  surrendered: z.boolean().optional(),
  territoryCount: z.number().optional(),
  eliminated: z.boolean().optional(),
  cardCount: z.number().optional()
});

export type SnapshotPlayer = z.infer<typeof snapshotPlayerSchema>;

export const snapshotTerritorySchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  neighbors: z.array(z.string().min(1)),
  continentId: z.string().min(1).nullable().optional(),
  ownerId: z.string().min(1).nullable(),
  armies: z.number(),
  x: z.number().nullable().optional(),
  y: z.number().nullable().optional()
});

export type SnapshotTerritory = z.infer<typeof snapshotTerritorySchema>;

export const snapshotCardSchema = objectSchema({
  id: z.string().min(1),
  territoryId: z.string().min(1).nullable().optional(),
  type: z.string().min(1).nullable().optional()
});

export type SnapshotCard = z.infer<typeof snapshotCardSchema>;

export const snapshotCombatComparisonSchema = objectSchema({
  winner: z.string().min(1),
  attackDie: z.number().optional(),
  defendDie: z.number().optional(),
  pair: z.number().optional()
});

export type SnapshotCombatComparison = z.infer<typeof snapshotCombatComparisonSchema>;

export const snapshotLastCombatSchema = objectSchema({
  fromTerritoryId: z.string().min(1),
  toTerritoryId: z.string().min(1),
  attackerPlayerId: z.string().min(1).optional(),
  defenderPlayerId: z.string().min(1).nullable().optional(),
  diceRuleSetId: z.string().min(1).optional(),
  attackDiceCount: z.number().optional(),
  defendDiceCount: z.number().optional(),
  attackerRolls: z.array(z.number()).optional(),
  defenderRolls: z.array(z.number()).optional(),
  comparisons: z.array(snapshotCombatComparisonSchema).optional(),
  attackerArmiesBefore: z.number().optional(),
  defenderArmiesBefore: z.number().optional(),
  attackerArmiesRemaining: z.number().optional(),
  defenderArmiesRemaining: z.number().optional(),
  conqueredTerritory: z.boolean().optional(),
  defenderReducedToZero: z.boolean().optional()
});

export type SnapshotLastCombat = z.infer<typeof snapshotLastCombatSchema>;

export const pendingConquestSchema = objectSchema({
  fromId: z.string().min(1).optional(),
  toId: z.string().min(1).optional(),
  minArmies: z.number().optional(),
  maxArmies: z.number().optional()
});

export type PendingConquest = z.infer<typeof pendingConquestSchema>;

export const snapshotCardStateSchema = objectSchema({
  ruleSetId: z.string().min(1).optional(),
  tradeCount: z.number().optional(),
  deckCount: z.number().optional(),
  discardCount: z.number().optional(),
  nextTradeBonus: z.number().optional(),
  maxHandBeforeForcedTrade: z.number().optional(),
  currentPlayerMustTrade: z.boolean().optional()
});

export type SnapshotCardState = z.infer<typeof snapshotCardStateSchema>;

export const snapshotMapAspectRatioSchema = objectSchema({
  width: z.number().optional(),
  height: z.number().optional()
});

export type SnapshotMapAspectRatio = z.infer<typeof snapshotMapAspectRatioSchema>;

export const snapshotMapVisualSchema = objectSchema({
  imageUrl: z.string().min(1).nullable().optional(),
  aspectRatio: snapshotMapAspectRatioSchema.nullable().optional()
});

export type SnapshotMapVisual = z.infer<typeof snapshotMapVisualSchema>;

export const snapshotDiceRuleSetSchema = objectSchema({
  id: z.string().min(1).optional(),
  attackerMaxDice: z.number().optional(),
  defenderMaxDice: z.number().optional()
});

export type SnapshotDiceRuleSet = z.infer<typeof snapshotDiceRuleSetSchema>;

export const snapshotLogEntrySchema = objectSchema({
  message: z.string().min(1).optional(),
  messageKey: z.string().min(1).nullable().optional(),
  messageParams: z.record(z.string(), z.unknown()).optional(),
  error: z.string().min(1).optional(),
  errorKey: z.string().min(1).nullable().optional(),
  errorParams: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().min(1).optional(),
  reasonKey: z.string().min(1).nullable().optional(),
  reasonParams: z.record(z.string(), z.unknown()).optional()
});

export type SnapshotLogEntry = z.infer<typeof snapshotLogEntrySchema>;

export const gameConfigSummarySchema = objectSchema({
  contentPackId: z.string().min(1).nullable().optional(),
  pieceSetId: z.string().min(1).nullable().optional(),
  extensionSchemaVersion: z.number().optional(),
  moduleSchemaVersion: z.number().optional(),
  ruleSetId: z.string().min(1).nullable().optional(),
  ruleSetName: z.string().min(1).nullable().optional(),
  mapName: z.string().min(1).nullable().optional(),
  mapId: z.string().min(1).nullable().optional(),
  diceRuleSetId: z.string().min(1).nullable().optional(),
  victoryRuleSetId: z.string().min(1).nullable().optional(),
  themeId: z.string().min(1).nullable().optional(),
  pieceSkinId: z.string().min(1).nullable().optional(),
  activeModules: z.array(netRiskModuleReferenceSchema).optional(),
  gamePresetId: z.string().min(1).nullable().optional(),
  contentProfileId: z.string().min(1).nullable().optional(),
  gameplayProfileId: z.string().min(1).nullable().optional(),
  uiProfileId: z.string().min(1).nullable().optional(),
  pieceSet: gameConfigPieceSetSchema.nullable().optional(),
  pieceSkin: pieceSkinSchema.nullable().optional(),
  turnTimeoutHours: z.number().int().nullable().optional(),
  totalPlayers: z.number().int().optional(),
  players: z.array(playerSlotConfigSchema).optional()
});

export type GameConfigSummary = z.infer<typeof gameConfigSummarySchema>;

export const gameSnapshotSchema = objectSchema({
  gameId: z.string().min(1).nullable().optional(),
  gameName: z.string().min(1).nullable().optional(),
  version: z.number().int().nullable().optional(),
  playerId: z.string().min(1).nullable().optional(),
  phase: z.string().min(1).optional(),
  turnPhase: z.string().min(1).optional(),
  currentPlayerId: z.string().min(1).nullable().optional(),
  winnerId: z.string().min(1).nullable().optional(),
  players: z.array(snapshotPlayerSchema),
  map: z.array(snapshotTerritorySchema),
  continents: z.array(z.record(z.string(), z.unknown())).optional(),
  reinforcementPool: z.number(),
  playerHand: z.array(snapshotCardSchema).optional(),
  pendingConquest: pendingConquestSchema.nullable().optional(),
  lastAction: z.record(z.string(), z.unknown()).nullable().optional(),
  lastCombat: snapshotLastCombatSchema.nullable().optional(),
  cardState: snapshotCardStateSchema.nullable().optional(),
  gameConfig: gameConfigSummarySchema.nullable().optional(),
  mapVisual: snapshotMapVisualSchema.nullable().optional(),
  diceRuleSet: snapshotDiceRuleSetSchema.nullable().optional(),
  fortifyUsed: z.boolean().optional(),
  attacksThisTurn: z.number().optional(),
  conqueredTerritoryThisTurn: z.boolean().optional(),
  log: z.array(z.string()).optional(),
  logEntries: z.array(snapshotLogEntrySchema).optional()
});

export type GameSnapshot = z.infer<typeof gameSnapshotSchema>;

export const gameMutationStateSchema = objectSchema({
  gameId: z.string().min(1).nullable().optional(),
  gameName: z.string().min(1).nullable().optional(),
  version: z.number().int().nullable().optional(),
  playerId: z.string().min(1).nullable().optional(),
  phase: z.string().min(1).optional(),
  turnPhase: z.string().min(1).optional(),
  currentPlayerId: z.string().min(1).nullable().optional(),
  winnerId: z.string().min(1).nullable().optional(),
  players: z.union([z.array(snapshotPlayerSchema), z.number()]).optional(),
  map: z.union([z.array(snapshotTerritorySchema), z.number()]).optional(),
  continents: z.array(z.record(z.string(), z.unknown())).optional(),
  reinforcementPool: z.number().optional(),
  playerHand: z.array(snapshotCardSchema).optional(),
  pendingConquest: pendingConquestSchema.nullable().optional(),
  lastAction: z.record(z.string(), z.unknown()).nullable().optional(),
  lastCombat: snapshotLastCombatSchema.nullable().optional(),
  cardState: snapshotCardStateSchema.nullable().optional(),
  gameConfig: gameConfigSummarySchema.nullable().optional(),
  mapVisual: snapshotMapVisualSchema.nullable().optional(),
  diceRuleSet: snapshotDiceRuleSetSchema.nullable().optional(),
  fortifyUsed: z.boolean().optional(),
  attacksThisTurn: z.number().optional(),
  conqueredTerritoryThisTurn: z.boolean().optional(),
  log: z.array(z.string()).optional(),
  logEntries: z.array(snapshotLogEntrySchema).optional()
});

export type GameMutationState = z.infer<typeof gameMutationStateSchema>;

export const gameStateResponseSchema = gameSnapshotSchema;

export type GameStateResponse = z.infer<typeof gameStateResponseSchema>;

export const gameEventPayloadSchema = gameSnapshotSchema;

export type GameEventPayload = z.infer<typeof gameEventPayloadSchema>;

export const gameMutationGameSchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1).nullable().optional()
});

export type GameMutationGame = z.infer<typeof gameMutationGameSchema>;

export const gameMutationResponseSchema = objectSchema({
  ok: z.literal(true).optional(),
  code: z.string().min(1).nullable().optional(),
  currentVersion: z.number().int().nullable().optional(),
  user: publicUserSchema.optional(),
  playerId: z.string().min(1).nullable().optional(),
  bonus: z.number().optional(),
  validation: z.record(z.string(), z.unknown()).optional(),
  game: gameMutationGameSchema.optional(),
  games: z.array(gameSummarySchema).optional(),
  activeGameId: z.string().min(1).nullable().optional(),
  state: gameMutationStateSchema.optional()
});

export type GameMutationResponse = z.infer<typeof gameMutationResponseSchema>;

export const gameVersionConflictResponseSchema = objectSchema({
  code: z.literal("VERSION_CONFLICT"),
  currentVersion: z.number().int().nullable().optional(),
  state: gameMutationStateSchema
});

export type GameVersionConflictResponse = z.infer<typeof gameVersionConflictResponseSchema>;

export const createGameResponseSchema = objectSchema({
  ok: z.literal(true),
  playerId: z.string().min(1).nullable().optional(),
  game: gameMutationGameSchema,
  games: z.array(gameSummarySchema),
  activeGameId: z.string().min(1).nullable().optional(),
  state: gameMutationStateSchema.optional(),
  config: z.record(z.string(), z.unknown()).optional()
});

export type CreateGameResponse = z.infer<typeof createGameResponseSchema>;

export const participatingGameLobbySchema = objectSchema({
  playerName: z.string().min(1),
  statusLabel: z.string().min(1),
  focusLabel: z.string().min(1),
  turnPhaseLabel: z.string().min(1),
  territoryCount: z.number(),
  cardCount: z.number()
});

export type ParticipatingGameLobby = z.infer<typeof participatingGameLobbySchema>;

export const participatingGameSchema = gameSummarySchema
  .extend({
    totalPlayers: z.number().nullable(),
    mapName: z.string().nullable(),
    myLobby: participatingGameLobbySchema
  })
  .passthrough();

export type ParticipatingGame = z.infer<typeof participatingGameSchema>;

export const profileContractSchema = objectSchema({
  playerName: z.string().min(1),
  gamesPlayed: z.number(),
  wins: z.number(),
  losses: z.number(),
  gamesInProgress: z.number(),
  participatingGames: z.array(participatingGameSchema),
  winRate: z.number().nullable(),
  hasHistory: z.boolean(),
  placeholders: objectSchema({
    recentGames: z.boolean(),
    ranking: z.boolean()
  }),
  preferences: themePreferencesSchema.nullable().optional()
});

export type ProfileContract = z.infer<typeof profileContractSchema>;

export const profileResponseSchema = objectSchema({
  profile: profileContractSchema
});

export type ProfileResponse = z.infer<typeof profileResponseSchema>;

export const adminIssueSchema = objectSchema({
  code: z.string().min(1),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string().min(1),
  gameId: z.string().min(1).nullable().optional(),
  actionId: z.string().min(1).nullable().optional()
});

export type AdminIssue = z.infer<typeof adminIssueSchema>;

export const adminAuditEntrySchema = objectSchema({
  id: z.string().min(1),
  actorId: z.string().min(1),
  actorUsername: z.string().min(1),
  action: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1).nullable().optional(),
  targetLabel: z.string().min(1).nullable().optional(),
  result: z.enum(["success", "failure"]),
  createdAt: z.string().min(1),
  details: z.record(z.string(), z.unknown()).nullable().optional()
});

export type AdminAuditEntry = z.infer<typeof adminAuditEntrySchema>;

export const adminConfigSchema = objectSchema({
  defaults: adminGameDefaultsSchema,
  maintenance: objectSchema({
    staleLobbyDays: z.number().int().min(1).max(365),
    auditLogLimit: z.number().int().min(10).max(500)
  }),
  updatedAt: z.string().min(1).nullable().optional(),
  updatedBy: publicUserSchema.nullable().optional()
});

export type AdminConfig = z.infer<typeof adminConfigSchema>;

export const adminUserSummarySchema = publicUserSchema.extend({
  createdAt: z.string().min(1),
  gamesPlayed: z.number().int(),
  gamesInProgress: z.number().int(),
  wins: z.number().int(),
  canPromote: z.boolean(),
  canDemote: z.boolean()
});

export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;

export const adminGameSummarySchema = gameSummarySchema.extend({
  stale: z.boolean(),
  health: z.enum(["ok", "warning", "error"]),
  issueCount: z.number().int(),
  issues: z.array(adminIssueSchema)
});

export type AdminGameSummary = z.infer<typeof adminGameSummarySchema>;

export const adminGamePlayerSchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  linkedUserId: z.string().min(1).nullable().optional(),
  isAi: z.boolean().optional(),
  surrendered: z.boolean().optional(),
  territoryCount: z.number().int(),
  cardCount: z.number().int()
});

export type AdminGamePlayer = z.infer<typeof adminGamePlayerSchema>;

export const adminOverviewResponseSchema = objectSchema({
  summary: objectSchema({
    totalUsers: z.number().int(),
    adminUsers: z.number().int(),
    activeGames: z.number().int(),
    lobbyGames: z.number().int(),
    finishedGames: z.number().int(),
    staleLobbies: z.number().int(),
    invalidGames: z.number().int(),
    enabledModules: z.number().int()
  }),
  config: adminConfigSchema,
  recentGames: z.array(adminGameSummarySchema),
  issues: z.array(adminIssueSchema),
  audit: z.array(adminAuditEntrySchema)
});

export type AdminOverviewResponse = z.infer<typeof adminOverviewResponseSchema>;

export const adminUsersResponseSchema = objectSchema({
  users: z.array(adminUserSummarySchema),
  total: z.number().int(),
  filteredTotal: z.number().int(),
  query: z.string(),
  role: z.string().min(1).nullable().optional()
});

export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;

export const adminUserRoleUpdateRequestSchema = objectSchema({
  userId: z.string().min(1),
  role: z.enum(["admin", "user"])
});

export type AdminUserRoleUpdateRequest = z.infer<typeof adminUserRoleUpdateRequestSchema>;

export const adminUserRoleUpdateResponseSchema = objectSchema({
  ok: z.literal(true),
  user: adminUserSummarySchema,
  audit: adminAuditEntrySchema
});

export type AdminUserRoleUpdateResponse = z.infer<typeof adminUserRoleUpdateResponseSchema>;

export const adminGamesResponseSchema = objectSchema({
  games: z.array(adminGameSummarySchema),
  total: z.number().int(),
  filteredTotal: z.number().int(),
  status: z.string().min(1).nullable().optional(),
  query: z.string()
});

export type AdminGamesResponse = z.infer<typeof adminGamesResponseSchema>;

export const adminGameDetailsResponseSchema = objectSchema({
  game: adminGameSummarySchema,
  players: z.array(adminGamePlayerSchema),
  rawState: z.record(z.string(), z.unknown())
});

export type AdminGameDetailsResponse = z.infer<typeof adminGameDetailsResponseSchema>;

export const adminGameActionRequestSchema = objectSchema({
  gameId: z.string().min(1),
  action: z.enum(["close-lobby", "terminate-game", "repair-game-config"]),
  confirmation: z.string().min(1).nullable().optional()
});

export type AdminGameActionRequest = z.infer<typeof adminGameActionRequestSchema>;

export const adminGameActionResponseSchema = objectSchema({
  ok: z.literal(true),
  game: adminGameSummarySchema,
  players: z.array(adminGamePlayerSchema),
  rawState: z.record(z.string(), z.unknown()),
  audit: adminAuditEntrySchema
});

export type AdminGameActionResponse = z.infer<typeof adminGameActionResponseSchema>;

export const adminConfigResponseSchema = objectSchema({
  config: adminConfigSchema
});

export type AdminConfigResponse = z.infer<typeof adminConfigResponseSchema>;

export const adminConfigUpdateRequestSchema = objectSchema({
  defaults: adminGameDefaultsSchema,
  maintenance: adminConfigSchema.shape.maintenance.optional()
});

export type AdminConfigUpdateRequest = z.infer<typeof adminConfigUpdateRequestSchema>;

export const adminConfigUpdateResponseSchema = objectSchema({
  ok: z.literal(true),
  config: adminConfigSchema,
  audit: adminAuditEntrySchema
});

export type AdminConfigUpdateResponse = z.infer<typeof adminConfigUpdateResponseSchema>;

export const adminMaintenanceReportSchema = objectSchema({
  summary: objectSchema({
    totalGames: z.number().int(),
    staleLobbies: z.number().int(),
    invalidGames: z.number().int(),
    orphanedModuleReferences: z.number().int()
  }),
  issues: z.array(adminIssueSchema)
});

export type AdminMaintenanceReport = z.infer<typeof adminMaintenanceReportSchema>;

export const adminMaintenanceActionRequestSchema = objectSchema({
  action: z.enum(["validate-all", "cleanup-stale-lobbies"]),
  confirmation: z.string().min(1).nullable().optional()
});

export type AdminMaintenanceActionRequest = z.infer<typeof adminMaintenanceActionRequestSchema>;

export const adminMaintenanceActionResponseSchema = objectSchema({
  ok: z.literal(true),
  report: adminMaintenanceReportSchema,
  affectedGameIds: z.array(z.string().min(1)),
  audit: adminAuditEntrySchema
});

export type AdminMaintenanceActionResponse = z.infer<typeof adminMaintenanceActionResponseSchema>;

export const adminAuditResponseSchema = objectSchema({
  entries: z.array(adminAuditEntrySchema)
});

export type AdminAuditResponse = z.infer<typeof adminAuditResponseSchema>;
