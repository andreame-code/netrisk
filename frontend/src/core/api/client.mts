import {
  accountSettingsRequestSchema,
  accountSettingsResponseSchema,
  adminAuthoredModuleDetailResponseSchema,
  adminAuthoredModuleEditorOptionsResponseSchema,
  adminAuthoredModuleMutationResponseSchema,
  adminAuthoredModulesListResponseSchema,
  adminAuthoredModuleUpsertRequestSchema,
  adminAuthoredModuleValidateResponseSchema,
  adminAuditResponseSchema,
  adminConfigResponseSchema,
  adminConfigUpdateRequestSchema,
  adminConfigUpdateResponseSchema,
  adminGameActionRequestSchema,
  adminGameActionResponseSchema,
  adminGameDetailsResponseSchema,
  adminGamesResponseSchema,
  adminMaintenanceActionRequestSchema,
  adminMaintenanceActionResponseSchema,
  adminMaintenanceReportSchema,
  adminOverviewResponseSchema,
  adminUserRoleUpdateRequestSchema,
  adminUserRoleUpdateResponseSchema,
  adminUsersResponseSchema,
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
  setupCompleteRequestSchema,
  setupCompleteResponseSchema,
  setupCreateAdminRequestSchema,
  setupCreateAdminResponseSchema,
  setupStatusResponseSchema,
  startGameRequestSchema,
  themePreferenceRequestSchema,
  themePreferenceResponseSchema,
  tradeCardsRequestSchema
} from "../../generated/shared-runtime-validation.mjs";
import type {
  AccountSettingsRequest,
  AccountSettingsResponse,
  AdminAuthoredModuleDetailResponse,
  AdminAuthoredModuleEditorOptionsResponse,
  AdminAuthoredModuleMutationResponse,
  AdminAuthoredModulesListResponse,
  AdminAuthoredModuleUpsertRequest,
  AdminAuthoredModuleValidateResponse,
  AdminAuditResponse,
  AdminConfigResponse,
  AdminConfigUpdateRequest,
  AdminConfigUpdateResponse,
  AdminGameActionRequest,
  AdminGameActionResponse,
  AdminGameDetailsResponse,
  AdminGamesResponse,
  AdminMaintenanceActionRequest,
  AdminMaintenanceActionResponse,
  AdminMaintenanceReport,
  AdminOverviewResponse,
  AdminUserRoleUpdateRequest,
  AdminUserRoleUpdateResponse,
  AdminUsersResponse,
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
  SetupCompleteResponse,
  SetupCreateAdminRequest,
  SetupCreateAdminResponse,
  SetupStatusResponse,
  StartGameRequest,
  TradeCardsRequest,
  ThemePreferenceResponse
} from "../../generated/shared-runtime-validation.mjs";
import type { ApiClientError } from "./http.mjs";
import { requestJson } from "./http.mjs";
import { reportFrontendException } from "../observability.mjs";

type ClientMessages = {
  errorMessage: string;
  fallbackMessage?: string;
};

type GameListRequestOptions = {
  gameId?: string | null;
};

type GameStateRequestOptions = {
  gameId?: string | null;
};

type AdminUsersRequestOptions = {
  query?: string | null;
  role?: string | null;
};

type AdminGamesRequestOptions = {
  query?: string | null;
  status?: string | null;
};

type GameEventSubscriptionOptions = {
  gameId?: string | null;
  onMessage(payload: GameEventPayload): void;
  onOpen?(): void;
  onError?(error: Event): void;
  onInvalidPayload?(error: Error): void;
};

export type { GameActionRequest, GameEventPayload, GameStateResponse, StartGameRequest };
export type { TradeCardsRequest };

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

export function getSetupStatus(messages: ClientMessages): Promise<SetupStatusResponse> {
  return requestJson({
    path: "/api/setup/status",
    responseSchema: setupStatusResponseSchema,
    responseSchemaName: "SetupStatusResponse",
    ...messages
  });
}

export function createSetupAdmin(
  request: SetupCreateAdminRequest,
  messages: ClientMessages
): Promise<SetupCreateAdminResponse> {
  return requestJson({
    path: "/api/setup/create-admin",
    method: "POST",
    body: request,
    requestSchema: setupCreateAdminRequestSchema,
    requestSchemaName: "SetupCreateAdminRequest",
    responseSchema: setupCreateAdminResponseSchema,
    responseSchemaName: "SetupCreateAdminResponse",
    ...messages
  });
}

export function completeSetup(messages: ClientMessages): Promise<SetupCompleteResponse> {
  return requestJson({
    path: "/api/setup/complete",
    method: "POST",
    body: {},
    requestSchema: setupCompleteRequestSchema,
    requestSchemaName: "SetupCompleteRequest",
    responseSchema: setupCompleteResponseSchema,
    responseSchemaName: "SetupCompleteResponse",
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

export async function getModuleOptionsOrNull(
  messages: ClientMessages
): Promise<ModuleOptionsResponse | null> {
  try {
    return await getModuleOptions(messages);
  } catch {
    return null;
  }
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

export function updateAccountSettings(
  request: AccountSettingsRequest,
  messages: ClientMessages
): Promise<AccountSettingsResponse> {
  return requestJson({
    path: "/api/profile/account",
    method: "PUT",
    body: request,
    requestSchema: accountSettingsRequestSchema,
    requestSchemaName: "AccountSettingsRequest",
    responseSchema: accountSettingsResponseSchema,
    responseSchemaName: "AccountSettingsResponse",
    ...messages
  });
}

export function getAdminOverview(messages: ClientMessages): Promise<AdminOverviewResponse> {
  return requestJson({
    path: "/api/admin/overview",
    responseSchema: adminOverviewResponseSchema,
    responseSchemaName: "AdminOverviewResponse",
    ...messages
  });
}

function buildAdminUsersPath(options: AdminUsersRequestOptions = {}): string {
  const params = new URLSearchParams();

  if (options.query) {
    params.set("q", options.query);
  }

  if (options.role) {
    params.set("role", options.role);
  }

  const query = params.toString();
  return query ? `/api/admin/users?${query}` : "/api/admin/users";
}

export function listAdminUsers(
  messages: ClientMessages,
  options: AdminUsersRequestOptions = {}
): Promise<AdminUsersResponse> {
  return requestJson({
    path: buildAdminUsersPath(options),
    responseSchema: adminUsersResponseSchema,
    responseSchemaName: "AdminUsersResponse",
    ...messages
  });
}

export function updateAdminUserRole(
  request: AdminUserRoleUpdateRequest,
  messages: ClientMessages
): Promise<AdminUserRoleUpdateResponse> {
  return requestJson({
    path: "/api/admin/users/role",
    method: "POST",
    body: request,
    requestSchema: adminUserRoleUpdateRequestSchema,
    requestSchemaName: "AdminUserRoleUpdateRequest",
    responseSchema: adminUserRoleUpdateResponseSchema,
    responseSchemaName: "AdminUserRoleUpdateResponse",
    ...messages
  });
}

function buildAdminGamesPath(options: AdminGamesRequestOptions = {}): string {
  const params = new URLSearchParams();

  if (options.query) {
    params.set("q", options.query);
  }

  if (options.status) {
    params.set("status", options.status);
  }

  const query = params.toString();
  return query ? `/api/admin/games?${query}` : "/api/admin/games";
}

export function listAdminGames(
  messages: ClientMessages,
  options: AdminGamesRequestOptions = {}
): Promise<AdminGamesResponse> {
  return requestJson({
    path: buildAdminGamesPath(options),
    responseSchema: adminGamesResponseSchema,
    responseSchemaName: "AdminGamesResponse",
    ...messages
  });
}

export function getAdminGameDetails(
  gameId: string,
  messages: ClientMessages
): Promise<AdminGameDetailsResponse> {
  return requestJson({
    path: `/api/admin/games/${encodeURIComponent(gameId)}`,
    responseSchema: adminGameDetailsResponseSchema,
    responseSchemaName: "AdminGameDetailsResponse",
    ...messages
  });
}

export function runAdminGameAction(
  request: AdminGameActionRequest,
  messages: ClientMessages
): Promise<AdminGameActionResponse> {
  return requestJson({
    path: "/api/admin/games/action",
    method: "POST",
    body: request,
    requestSchema: adminGameActionRequestSchema,
    requestSchemaName: "AdminGameActionRequest",
    responseSchema: adminGameActionResponseSchema,
    responseSchemaName: "AdminGameActionResponse",
    ...messages
  });
}

export function getAdminConfig(messages: ClientMessages): Promise<AdminConfigResponse> {
  return requestJson({
    path: "/api/admin/config",
    responseSchema: adminConfigResponseSchema,
    responseSchemaName: "AdminConfigResponse",
    ...messages
  });
}

export function updateAdminConfig(
  request: AdminConfigUpdateRequest,
  messages: ClientMessages
): Promise<AdminConfigUpdateResponse> {
  return requestJson({
    path: "/api/admin/config",
    method: "PUT",
    body: request,
    requestSchema: adminConfigUpdateRequestSchema,
    requestSchemaName: "AdminConfigUpdateRequest",
    responseSchema: adminConfigUpdateResponseSchema,
    responseSchemaName: "AdminConfigUpdateResponse",
    ...messages
  });
}

export function getAdminMaintenanceReport(
  messages: ClientMessages
): Promise<AdminMaintenanceReport> {
  return requestJson({
    path: "/api/admin/maintenance",
    responseSchema: adminMaintenanceReportSchema,
    responseSchemaName: "AdminMaintenanceReport",
    ...messages
  });
}

export function runAdminMaintenanceAction(
  request: AdminMaintenanceActionRequest,
  messages: ClientMessages
): Promise<AdminMaintenanceActionResponse> {
  return requestJson({
    path: "/api/admin/maintenance",
    method: "POST",
    body: request,
    requestSchema: adminMaintenanceActionRequestSchema,
    requestSchemaName: "AdminMaintenanceActionRequest",
    responseSchema: adminMaintenanceActionResponseSchema,
    responseSchemaName: "AdminMaintenanceActionResponse",
    ...messages
  });
}

export function getAdminAudit(messages: ClientMessages): Promise<AdminAuditResponse> {
  return requestJson({
    path: "/api/admin/audit",
    responseSchema: adminAuditResponseSchema,
    responseSchemaName: "AdminAuditResponse",
    ...messages
  });
}

export function getAdminContentStudioOptions(
  messages: ClientMessages
): Promise<AdminAuthoredModuleEditorOptionsResponse> {
  return requestJson({
    path: "/api/admin/content-studio/options",
    responseSchema: adminAuthoredModuleEditorOptionsResponseSchema,
    responseSchemaName: "AdminAuthoredModuleEditorOptionsResponse",
    ...messages
  });
}

export function listAdminAuthoredModules(
  messages: ClientMessages
): Promise<AdminAuthoredModulesListResponse> {
  return requestJson({
    path: "/api/admin/content-studio/modules",
    responseSchema: adminAuthoredModulesListResponseSchema,
    responseSchemaName: "AdminAuthoredModulesListResponse",
    ...messages
  });
}

export function getAdminAuthoredModule(
  moduleId: string,
  messages: ClientMessages
): Promise<AdminAuthoredModuleDetailResponse> {
  return requestJson({
    path: `/api/admin/content-studio/modules/${encodeURIComponent(moduleId)}`,
    responseSchema: adminAuthoredModuleDetailResponseSchema,
    responseSchemaName: "AdminAuthoredModuleDetailResponse",
    ...messages
  });
}

export function validateAdminAuthoredModule(
  request: AdminAuthoredModuleUpsertRequest,
  messages: ClientMessages
): Promise<AdminAuthoredModuleValidateResponse> {
  return requestJson({
    path: "/api/admin/content-studio/modules/validate",
    method: "POST",
    body: request,
    requestSchema: adminAuthoredModuleUpsertRequestSchema,
    requestSchemaName: "AdminAuthoredModuleUpsertRequest",
    responseSchema: adminAuthoredModuleValidateResponseSchema,
    responseSchemaName: "AdminAuthoredModuleValidateResponse",
    ...messages
  });
}

export function createAdminAuthoredModule(
  request: AdminAuthoredModuleUpsertRequest,
  messages: ClientMessages
): Promise<AdminAuthoredModuleMutationResponse> {
  return requestJson({
    path: "/api/admin/content-studio/modules",
    method: "POST",
    body: request,
    requestSchema: adminAuthoredModuleUpsertRequestSchema,
    requestSchemaName: "AdminAuthoredModuleUpsertRequest",
    responseSchema: adminAuthoredModuleMutationResponseSchema,
    responseSchemaName: "AdminAuthoredModuleMutationResponse",
    ...messages
  });
}

export function updateAdminAuthoredModule(
  moduleId: string,
  request: AdminAuthoredModuleUpsertRequest,
  messages: ClientMessages
): Promise<AdminAuthoredModuleMutationResponse> {
  return requestJson({
    path: `/api/admin/content-studio/modules/${encodeURIComponent(moduleId)}`,
    method: "PUT",
    body: request,
    requestSchema: adminAuthoredModuleUpsertRequestSchema,
    requestSchemaName: "AdminAuthoredModuleUpsertRequest",
    responseSchema: adminAuthoredModuleMutationResponseSchema,
    responseSchemaName: "AdminAuthoredModuleMutationResponse",
    ...messages
  });
}

export function publishAdminAuthoredModule(
  moduleId: string,
  messages: ClientMessages
): Promise<AdminAuthoredModuleMutationResponse> {
  return requestJson({
    path: `/api/admin/content-studio/modules/${encodeURIComponent(moduleId)}/publish`,
    method: "POST",
    body: {},
    responseSchema: adminAuthoredModuleMutationResponseSchema,
    responseSchemaName: "AdminAuthoredModuleMutationResponse",
    ...messages
  });
}

export function enableAdminAuthoredModule(
  moduleId: string,
  messages: ClientMessages
): Promise<AdminAuthoredModuleMutationResponse> {
  return requestJson({
    path: `/api/admin/content-studio/modules/${encodeURIComponent(moduleId)}/enable`,
    method: "POST",
    body: {},
    responseSchema: adminAuthoredModuleMutationResponseSchema,
    responseSchemaName: "AdminAuthoredModuleMutationResponse",
    ...messages
  });
}

export function disableAdminAuthoredModule(
  moduleId: string,
  messages: ClientMessages
): Promise<AdminAuthoredModuleMutationResponse> {
  return requestJson({
    path: `/api/admin/content-studio/modules/${encodeURIComponent(moduleId)}/disable`,
    method: "POST",
    body: {},
    responseSchema: adminAuthoredModuleMutationResponseSchema,
    responseSchemaName: "AdminAuthoredModuleMutationResponse",
    ...messages
  });
}

function buildGameListPath(options: GameListRequestOptions = {}): string {
  if (!options.gameId) {
    return "/api/games";
  }

  return `/api/games?gameId=${encodeURIComponent(options.gameId)}`;
}

export function listGames(
  messages: ClientMessages,
  options: GameListRequestOptions = {}
): Promise<GameListResponse> {
  return requestJson({
    path: buildGameListPath(options),
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

function buildGameStatePath(options: GameStateRequestOptions = {}): string {
  if (!options.gameId) {
    return "/api/state";
  }

  return `/api/state?gameId=${encodeURIComponent(options.gameId)}`;
}

function buildGameEventsPath(gameId: string | null | undefined): string {
  if (!gameId) {
    return "/api/events";
  }

  return `/api/events?gameId=${encodeURIComponent(gameId)}`;
}

export function getGameState(
  gameId: string | null | undefined,
  messages: ClientMessages
): Promise<GameStateResponse> {
  return requestJson({
    path: buildGameStatePath({
      gameId
    }),
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

export function subscribeToGameEvents({
  gameId,
  onMessage,
  onOpen,
  onError,
  onInvalidPayload
}: GameEventSubscriptionOptions): EventSource {
  const path = buildGameEventsPath(gameId);
  const eventSource = new EventSource(path, {
    withCredentials: true
  });

  if (typeof onOpen === "function") {
    eventSource.onopen = onOpen;
  }

  eventSource.onmessage = (event) => {
    let payload: GameEventPayload;

    try {
      payload = parseGameEventPayload(JSON.parse(event.data));
    } catch (error: unknown) {
      const streamError =
        error instanceof Error ? error : new Error("Unable to validate game event payload.");
      reportFrontendException(streamError, {
        area: "react-shell",
        kind: "response_validation",
        category: "validation",
        path,
        schemaName: "GameEventPayload"
      });
      onInvalidPayload?.(streamError);
      return;
    }

    onMessage(payload);
  };

  eventSource.onerror = (error) => {
    onError?.(error);
  };

  return eventSource;
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
