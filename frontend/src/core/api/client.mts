import {
  authSessionResponseSchema,
  createGameRequestSchema,
  createGameResponseSchema,
  gameIdRequestSchema,
  gameListResponseSchema,
  gameOptionsResponseSchema,
  gameMutationResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  logoutResponseSchema,
  profileResponseSchema,
  themePreferenceRequestSchema,
  themePreferenceResponseSchema
} from "../../generated/shared-runtime-validation.mjs";
import type {
  AuthSessionResponse,
  CreateGameRequest,
  CreateGameResponse,
  GameOptionsResponse,
  GameListResponse,
  GameMutationResponse,
  LoginResponse,
  LogoutResponse,
  ProfileResponse,
  ThemePreferenceResponse
} from "../../generated/shared-runtime-validation.mjs";
import { requestJson } from "./http.mjs";

type ClientMessages = {
  errorMessage: string;
  fallbackMessage?: string;
};

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
