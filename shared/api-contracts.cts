export interface ThemePreferences {
  theme?: string | null;
}

export interface VictoryRuleSetContract {
  id: string;
  name: string;
  description: string;
}

export interface VisualThemeContract {
  id: string;
  name: string;
  description: string;
}

export interface PieceSkinContract {
  id: string;
  name: string;
  description: string;
  renderStyleId: string;
  usesPlayerColor: boolean;
  assetBaseUrl?: string | null;
}

export interface NetRiskModuleReferenceContract {
  id: string;
  version: string;
}

export interface NetRiskModuleProfileContract {
  id: string;
  name: string;
  description?: string | null;
  moduleId?: string | null;
}

export interface NetRiskGamePresetContract {
  id: string;
  name: string;
  description?: string | null;
  moduleId?: string | null;
  activeModuleIds?: string[];
  contentProfileId?: string | null;
  gameplayProfileId?: string | null;
  uiProfileId?: string | null;
  defaults?: Record<string, unknown> | null;
}

export interface NetRiskUiSlotContributionContract {
  slotId: string;
  itemId: string;
  title: string;
  kind: string;
  order?: number;
  description?: string | null;
  route?: string | null;
}

export interface NetRiskContentContributionContract {
  mapIds?: string[];
  siteThemeIds?: string[];
  pieceSkinIds?: string[];
  playerPieceSetIds?: string[];
  contentPackIds?: string[];
  diceRuleSetIds?: string[];
  cardRuleSetIds?: string[];
  victoryRuleSetIds?: string[];
  fortifyRuleSetIds?: string[];
  reinforcementRuleSetIds?: string[];
}

export interface NetRiskInstalledModuleContract {
  id: string;
  version: string | null;
  displayName: string;
  description?: string | null;
  kind: string | null;
  sourcePath: string;
  status: string;
  enabled: boolean;
  compatible: boolean;
  warnings: string[];
  errors: string[];
  capabilities: Array<Record<string, unknown>>;
}

export interface ModulesCatalogResponseContract {
  modules: NetRiskInstalledModuleContract[];
  engineVersion: string;
  enabledModules: NetRiskModuleReferenceContract[];
}

export interface ModuleOptionsResponseContract {
  modules: NetRiskInstalledModuleContract[];
  enabledModules: NetRiskModuleReferenceContract[];
  gameModules: NetRiskInstalledModuleContract[];
  content: NetRiskContentContributionContract;
  gamePresets: NetRiskGamePresetContract[];
  uiSlots: NetRiskUiSlotContributionContract[];
  contentProfiles: NetRiskModuleProfileContract[];
  gameplayProfiles: NetRiskModuleProfileContract[];
  uiProfiles: NetRiskModuleProfileContract[];
  resolvedCatalog?: NetRiskResolvedModuleCatalogContract;
}

export interface NetRiskResolvedModuleCatalogContract {
  modules: NetRiskInstalledModuleContract[];
  enabledModules: NetRiskModuleReferenceContract[];
  gameModules: NetRiskInstalledModuleContract[];
  content: NetRiskContentContributionContract;
  maps: Array<Record<string, unknown>>;
  ruleSets: Array<Record<string, unknown>>;
  playerPieceSets: Array<Record<string, unknown>>;
  diceRuleSets: Array<Record<string, unknown>>;
  contentPacks: Array<Record<string, unknown>>;
  victoryRuleSets: VictoryRuleSetContract[];
  themes: VisualThemeContract[];
  pieceSkins: PieceSkinContract[];
  gamePresets: NetRiskGamePresetContract[];
  uiSlots: NetRiskUiSlotContributionContract[];
  contentProfiles: NetRiskModuleProfileContract[];
  gameplayProfiles: NetRiskModuleProfileContract[];
  uiProfiles: NetRiskModuleProfileContract[];
}

export interface PublicUserContract {
  id: string;
  username: string;
  role?: string;
  authMethods?: string[];
  hasEmail?: boolean;
  preferences?: ThemePreferences;
}

export interface GameSummaryContract {
  id: string;
  name: string;
  phase: string;
  currentPlayerId?: string | null;
  playerCount: number;
  updatedAt: string;
  activeModules?: NetRiskModuleReferenceContract[];
  gamePresetId?: string | null;
  contentProfileId?: string | null;
  gameplayProfileId?: string | null;
  uiProfileId?: string | null;
}

export interface AdminGameDefaultsContract {
  totalPlayers?: number | null;
  contentPackId?: string | null;
  ruleSetId?: string | null;
  mapId?: string | null;
  diceRuleSetId?: string | null;
  victoryRuleSetId?: string | null;
  pieceSetId?: string | null;
  themeId?: string | null;
  pieceSkinId?: string | null;
  gamePresetId?: string | null;
  activeModuleIds?: string[];
  contentProfileId?: string | null;
  gameplayProfileId?: string | null;
  uiProfileId?: string | null;
  turnTimeoutHours?: number | null;
  players?: Array<Record<string, unknown>> | null;
}

export interface GameOptionsResponseContract {
  ruleSets: Array<Record<string, unknown>>;
  maps: Array<Record<string, unknown>>;
  diceRuleSets: Array<Record<string, unknown>>;
  victoryRuleSets: VictoryRuleSetContract[];
  themes: VisualThemeContract[];
  pieceSkins: PieceSkinContract[];
  modules?: NetRiskInstalledModuleContract[];
  enabledModules?: NetRiskModuleReferenceContract[];
  gamePresets?: NetRiskGamePresetContract[];
  contentProfiles?: NetRiskModuleProfileContract[];
  gameplayProfiles?: NetRiskModuleProfileContract[];
  uiProfiles?: NetRiskModuleProfileContract[];
  uiSlots?: NetRiskUiSlotContributionContract[];
  playerPieceSets?: Array<Record<string, unknown>>;
  contentPacks?: Array<Record<string, unknown>>;
  resolvedCatalog?: NetRiskResolvedModuleCatalogContract;
  turnTimeoutHoursOptions: number[];
  playerRange: {
    min: number;
    max: number;
  };
  adminDefaults?: AdminGameDefaultsContract;
}

export interface AuthSessionResponseContract {
  user: PublicUserContract;
}

export interface AccountSettingsUpdateRequestContract {
  currentPassword: string;
  email?: string;
  newPassword?: string;
  confirmNewPassword?: string;
}

export interface AccountSettingsUpdateResponseContract {
  ok: true;
  user: PublicUserContract;
}

export interface ParticipatingGameLobbyContract {
  playerName: string;
  statusLabel: string;
  focusLabel: string;
  turnPhaseLabel: string;
  territoryCount: number;
  cardCount: number;
}

export interface ParticipatingGameContract extends GameSummaryContract {
  totalPlayers: number | null;
  mapName: string | null;
  myLobby: ParticipatingGameLobbyContract;
}

export interface ProfileContract {
  playerName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  gamesInProgress: number;
  participatingGames: ParticipatingGameContract[];
  winRate: number | null;
  hasHistory: boolean;
  placeholders: {
    recentGames: boolean;
    ranking: boolean;
  };
  preferences?: ThemePreferences;
}

export interface ProfileResponseContract {
  profile: ProfileContract;
}

export interface AdminIssueContract {
  code: string;
  severity: string;
  message: string;
  gameId?: string | null;
  actionId?: string | null;
}

export interface AdminAuditEntryContract {
  id: string;
  actorId: string;
  actorUsername: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  result: string;
  createdAt: string;
  details?: Record<string, unknown> | null;
}

export interface AdminConfigContract {
  defaults: AdminGameDefaultsContract;
  maintenance: {
    staleLobbyDays: number;
    auditLogLimit: number;
  };
  updatedAt?: string | null;
  updatedBy?: PublicUserContract | null;
}

export interface AdminUserSummaryContract extends PublicUserContract {
  createdAt: string;
  gamesPlayed: number;
  gamesInProgress: number;
  wins: number;
  canPromote: boolean;
  canDemote: boolean;
}

export interface AdminGameSummaryContract extends GameSummaryContract {
  stale: boolean;
  health: string;
  issueCount: number;
  issues: AdminIssueContract[];
}

export interface AdminGamePlayerContract {
  id: string;
  name: string;
  linkedUserId?: string | null;
  isAi?: boolean;
  surrendered?: boolean;
  territoryCount: number;
  cardCount: number;
}

export interface AdminOverviewResponseContract {
  summary: {
    totalUsers: number;
    adminUsers: number;
    activeGames: number;
    lobbyGames: number;
    finishedGames: number;
    staleLobbies: number;
    invalidGames: number;
    enabledModules: number;
  };
  config: AdminConfigContract;
  recentGames: AdminGameSummaryContract[];
  issues: AdminIssueContract[];
  audit: AdminAuditEntryContract[];
}

export interface AdminUsersResponseContract {
  users: AdminUserSummaryContract[];
  total: number;
  filteredTotal: number;
  query: string;
  role: string | null;
}

export interface AdminUserRoleUpdateResponseContract {
  ok: boolean;
  user: AdminUserSummaryContract;
  audit: AdminAuditEntryContract;
}

export interface AdminGamesResponseContract {
  games: AdminGameSummaryContract[];
  total: number;
  filteredTotal: number;
  status: string | null;
  query: string;
}

export interface AdminGameDetailsResponseContract {
  game: AdminGameSummaryContract;
  players: AdminGamePlayerContract[];
  rawState: Record<string, unknown>;
}

export interface AdminGameActionResponseContract {
  ok: boolean;
  game: AdminGameSummaryContract;
  players: AdminGamePlayerContract[];
  rawState: Record<string, unknown>;
  audit: AdminAuditEntryContract;
}

export interface AdminConfigResponseContract {
  config: AdminConfigContract;
}

export interface AdminConfigUpdateResponseContract {
  ok: boolean;
  config: AdminConfigContract;
  audit: AdminAuditEntryContract;
}

export interface AdminMaintenanceReportContract {
  summary: {
    totalGames: number;
    staleLobbies: number;
    invalidGames: number;
    orphanedModuleReferences: number;
  };
  issues: AdminIssueContract[];
}

export interface AdminMaintenanceActionResponseContract {
  ok: boolean;
  report: AdminMaintenanceReportContract;
  affectedGameIds: string[];
  audit: AdminAuditEntryContract;
}

export interface AdminAuditResponseContract {
  entries: AdminAuditEntryContract[];
}

export interface GameMutationResponseContract {
  ok: boolean;
  state?: Record<string, unknown>;
  playerId?: string | null;
  game?: Record<string, unknown>;
}
