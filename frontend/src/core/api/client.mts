import {
  authSessionResponseSchema,
  createGameRequestSchema,
  createGameResponseSchema,
  gameActionRequestSchema,
  gameEventPayloadSchema,
  gameIdRequestSchema,
  gameListResponseSchema,
  gameOptionsResponseSchema,
  gameMutationResponseSchema,
  gameStateResponseSchema,
  gameVersionConflictResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  logoutResponseSchema,
  moduleOptionsResponseSchema,
  modulesCatalogResponseSchema,
  profileResponseSchema,
  registerRequestSchema,
  startGameRequestSchema,
  themePreferenceRequestSchema,
  themePreferenceResponseSchema,
  tradeCardsRequestSchema
} from "../../generated/shared-runtime-validation.mjs";
import type {
  AuthSessionResponse,
  CreateGameRequest,
  CreateGameResponse,
  GameActionRequest,
  GameEventPayload,
  GameOptionsResponse,
  GameListResponse,
  GameMutationResponse,
  GameStateResponse,
  GameVersionConflictResponse,
  LoginResponse,
  LogoutResponse,
  ModuleOptionsResponse,
  ModulesCatalogResponse,
  ProfileResponse,
  RegisterRequest,
  StartGameRequest,
  ThemePreferenceResponse
} from "../../generated/shared-runtime-validation.mjs";
import type { ApiClientError } from "./http.mjs";
import { requestJson } from "./http.mjs";

type ClientMessages = {
  errorMessage: string;
  fallbackMessage?: string;
};

export type { GameActionRequest, GameEventPayload, GameStateResponse, StartGameRequest };

export type TradeCardsRequest =
  import("../../generated/shared-runtime-validation.mjs").TradeCardsRequest;

export function getSession(messages: ClientMessages): Promise<AuthSessionResponse> {
  return requestJson({
    path: "/api/auth/session",
    responseSchema: authSessionResponseSchema,
    responseSchemaName: "AuthSessionResponse",
    ...messages
  });
}

export function login(
  credentials: {
    username: string;
    password: string;
  },
  messages: ClientMessages
): Promise<LoginResponse> {
  return requestJson({
    path: "/api/auth/login",
    method: "POST",
    body: credentials,
    requestSchema: loginRequestSchema,
    requestSchemaName: "LoginRequest",
    responseSchema: loginResponseSchema,
    responseSchemaName: "LoginResponse",
    ...messages
  });
}

export function register(
  request: RegisterRequest,
  messages: ClientMessages
): Promise<LoginResponse> {
  return requestJson({
    path: "/api/auth/register",
    method: "POST",
    body: request,
    requestSchema: registerRequestSchema,
    requestSchemaName: "RegisterRequest",
    responseSchema: loginResponseSchema,
    responseSchemaName: "LoginResponse",
    ...messages
  });
}

export function logout(messages: ClientMessages): Promise<LogoutResponse> {
  return requestJson({
    path: "/api/auth/logout",
    method: "POST",
    body: {},
    responseSchema: logoutResponseSchema,
    responseSchemaName: "LogoutResponse",
    ...messages
  });
}

export function getProfile(messages: ClientMessages): Promise<ProfileResponse> {
  return requestJson({
    path: "/api/profile",
    responseSchema: profileResponseSchema,
    responseSchemaName: "ProfileResponse",
    ...messages
  });
}

export function getModulesCatalog(messages: ClientMessages): Promise<ModulesCatalogResponse> {
  return requestJson({
    path: "/api/modules",
    responseSchema: modulesCatalogResponseSchema,
    responseSchemaName: "ModulesCatalogResponse",
    ...messages
  });
}

export function getModuleOptions(messages: ClientMessages): Promise<ModuleOptionsResponse> {
  return requestJson({
    path: "/api/modules/options",
    responseSchema: moduleOptionsResponseSchema,
    responseSchemaName: "ModuleOptionsResponse",
    ...messages
  });
}

export function rescanModules(messages: ClientMessages): Promise<ModulesCatalogResponse> {
  return requestJson({
    path: "/api/modules/rescan",
    method: "POST",
    body: {},
    responseSchema: modulesCatalogResponseSchema,
    responseSchemaName: "ModulesCatalogResponse",
    ...messages
  });
}

export function setModuleEnabled(
  moduleId: string,
  enabled: boolean,
  messages: ClientMessages
): Promise<ModulesCatalogResponse> {
  return requestJson({
    path: `/api/modules/${encodeURIComponent(moduleId)}/${enabled ? "enable" : "disable"}`,
    method: "POST",
    body: {},
    responseSchema: modulesCatalogResponseSchema,
    responseSchemaName: "ModulesCatalogResponse",
    ...messages
  });
}

export function updateThemePreference(
  theme: string,
  messages: ClientMessages
): Promise<ThemePreferenceResponse> {
  return requestJson({
    path: "/api/profile/preferences/theme",
    method: "PUT",
    body: { theme },
    requestSchema: themePreferenceRequestSchema,
    requestSchemaName: "ThemePreferenceRequest",
    responseSchema: themePreferenceResponseSchema,
    responseSchemaName: "ThemePreferenceResponse",
    ...messages
  });
}

export function listGames(messages: ClientMessages): Promise<GameListResponse> {
  return requestJson({
    path: "/api/games",
    responseSchema: gameListResponseSchema,
    responseSchemaName: "GameListResponse",
    ...messages
  });
}

export function getGameOptions(messages: ClientMessages): Promise<GameOptionsResponse> {
  return requestJson({
    path: "/api/game/options",
    responseSchema: gameOptionsResponseSchema,
    responseSchemaName: "GameOptionsResponse",
    ...messages
  });
}

export function createGame(
  request: CreateGameRequest,
  messages: ClientMessages
): Promise<CreateGameResponse> {
  return requestJson({
    path: "/api/games",
    method: "POST",
    body: request,
    requestSchema: createGameRequestSchema,
    requestSchemaName: "CreateGameRequest",
    responseSchema: createGameResponseSchema,
    responseSchemaName: "CreateGameResponse",
    ...messages
  });
}

export function openGame(gameId: string, messages: ClientMessages): Promise<GameMutationResponse> {
  return requestJson({
    path: "/api/games/open",
    method: "POST",
    body: { gameId },
    requestSchema: gameIdRequestSchema,
    requestSchemaName: "GameIdRequest",
    responseSchema: gameMutationResponseSchema,
    responseSchemaName: "GameMutationResponse",
    ...messages
  });
}

export function joinGame(gameId: string, messages: ClientMessages): Promise<GameMutationResponse> {
  return requestJson({
    path: "/api/join",
    method: "POST",
    body: { gameId },
    requestSchema: gameIdRequestSchema,
    requestSchemaName: "GameIdRequest",
    responseSchema: gameMutationResponseSchema,
    responseSchemaName: "GameMutationResponse",
    ...messages
  });
}

export function getGameState(gameId: string, messages: ClientMessages): Promise<GameStateResponse> {
  return requestJson({
    path: `/api/state?gameId=${encodeURIComponent(gameId)}`,
    responseSchema: gameStateResponseSchema,
    responseSchemaName: "GameStateResponse",
    ...messages
  });
}

export function startGame(
  request: StartGameRequest,
  messages: ClientMessages
): Promise<GameMutationResponse> {
  return requestJson({
    path: "/api/start",
    method: "POST",
    body: request,
    requestSchema: startGameRequestSchema,
    requestSchemaName: "StartGameRequest",
    responseSchema: gameMutationResponseSchema,
    responseSchemaName: "GameMutationResponse",
    ...messages
  });
}

export function sendGameAction(
  request: GameActionRequest,
  messages: ClientMessages
): Promise<GameMutationResponse> {
  return requestJson({
    path: "/api/action",
    method: "POST",
    body: request,
    requestSchema: gameActionRequestSchema,
    requestSchemaName: "GameActionRequest",
    responseSchema: gameMutationResponseSchema,
    responseSchemaName: "GameMutationResponse",
    ...messages
  });
}

export function tradeCards(
  request: TradeCardsRequest,
  messages: ClientMessages
): Promise<GameMutationResponse> {
  return requestJson({
    path: "/api/cards/trade",
    method: "POST",
    body: request,
    requestSchema: tradeCardsRequestSchema,
    requestSchemaName: "TradeCardsRequest",
    responseSchema: gameMutationResponseSchema,
    responseSchemaName: "GameMutationResponse",
    ...messages
  });
}

export function parseGameEventPayload(payload: unknown): GameEventPayload {
  return gameEventPayloadSchema.parse(payload);
}

export function extractGameVersionConflict(error: unknown): GameVersionConflictResponse | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const apiError = error as ApiClientError;
  if (apiError.code !== "VERSION_CONFLICT" || !apiError.payload) {
    return null;
  }

  const parsed = gameVersionConflictResponseSchema.safeParse(apiError.payload);
  return parsed.success ? parsed.data : null;
}
