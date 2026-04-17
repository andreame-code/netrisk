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
  safeParse(input: unknown):
    | { success: true; data: T }
    | { success: false; error: unknown };
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

export const netRiskModuleReferenceSchema = objectSchema({
  id: z.string().min(1),
  version: z.string().min(1)
});

export type NetRiskModuleReference = z.infer<typeof netRiskModuleReferenceSchema>;

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

export const participatingGameLobbySchema = objectSchema({
  playerName: z.string().min(1),
  statusLabel: z.string().min(1),
  focusLabel: z.string().min(1),
  turnPhaseLabel: z.string().min(1),
  territoryCount: z.number(),
  cardCount: z.number()
});

export type ParticipatingGameLobby = z.infer<typeof participatingGameLobbySchema>;

export const participatingGameSchema = gameSummarySchema.extend({
  totalPlayers: z.number().nullable(),
  mapName: z.string().nullable(),
  myLobby: participatingGameLobbySchema
}).passthrough();

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
