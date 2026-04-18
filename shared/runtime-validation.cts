import { z } from "zod";

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
  slotId: z.string().min(1),
  itemId: z.string().min(1),
  title: z.string().min(1),
  kind: z.string().min(1),
  order: z.number().optional(),
  description: z.string().min(1).nullable().optional(),
  route: z.string().min(1).nullable().optional()
});

export type NetRiskUiSlotContribution = z.infer<typeof netRiskUiSlotContributionSchema>;

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
  capabilities: z.array(z.record(z.string(), z.unknown()))
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

export const playerSlotConfigSchema = objectSchema({
  slot: z.number().int(),
  type: z.string().min(1)
});

export type PlayerSlotConfig = z.infer<typeof playerSlotConfigSchema>;

export const createGameRequestSchema = objectSchema({
  name: z.string().min(1).optional(),
  totalPlayers: z.number().int().optional(),
  contentPackId: z.string().min(1).optional(),
  ruleSetId: z.string().min(1).optional(),
  mapId: z.string().min(1).optional(),
  diceRuleSetId: z.string().min(1).optional(),
  victoryRuleSetId: z.string().min(1).optional(),
  pieceSetId: z.string().min(1).optional(),
  themeId: z.string().min(1).optional(),
  pieceSkinId: z.string().min(1).optional(),
  gamePresetId: z.string().min(1).optional(),
  activeModuleIds: z.array(z.string().min(1)).optional(),
  contentProfileId: z.string().min(1).optional(),
  gameplayProfileId: z.string().min(1).optional(),
  uiProfileId: z.string().min(1).optional(),
  turnTimeoutHours: z.number().int().optional(),
  players: z.array(playerSlotConfigSchema).optional()
});

export type CreateGameRequest = z.infer<typeof createGameRequestSchema>;

export const gameSummarySchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1),
  phase: z.string().min(1),
  playerCount: z.number(),
  updatedAt: z.string().min(1),
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

export const gameListResponseSchema = objectSchema({
  games: z.array(gameSummarySchema),
  activeGameId: z.string().min(1).nullable().optional()
});

export type GameListResponse = z.infer<typeof gameListResponseSchema>;

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
  turnTimeoutHoursOptions: z.array(z.number().int()),
  playerRange: objectSchema({
    min: z.number().int(),
    max: z.number().int()
  })
});

export type GameOptionsResponse = z.infer<typeof gameOptionsResponseSchema>;

export const gameMutationGameSchema = objectSchema({
  id: z.string().min(1),
  name: z.string().min(1).nullable().optional()
});

export type GameMutationGame = z.infer<typeof gameMutationGameSchema>;

export const gameMutationResponseSchema = objectSchema({
  ok: z.literal(true).optional(),
  user: publicUserSchema.optional(),
  playerId: z.string().min(1).nullable().optional(),
  game: gameMutationGameSchema.optional(),
  games: z.array(gameSummarySchema).optional(),
  activeGameId: z.string().min(1).nullable().optional()
});

export type GameMutationResponse = z.infer<typeof gameMutationResponseSchema>;

export const createGameResponseSchema = objectSchema({
  ok: z.literal(true),
  playerId: z.string().min(1).nullable().optional(),
  game: gameMutationGameSchema,
  games: z.array(gameSummarySchema),
  activeGameId: z.string().min(1).nullable().optional(),
  state: z.record(z.string(), z.unknown()).optional(),
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
