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
  playerCount: number;
  updatedAt: string;
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
  contentProfiles?: NetRiskModuleProfileContract[];
  gameplayProfiles?: NetRiskModuleProfileContract[];
  uiProfiles?: NetRiskModuleProfileContract[];
  uiSlots?: NetRiskUiSlotContributionContract[];
  playerPieceSets?: Array<Record<string, unknown>>;
  contentPacks?: Array<Record<string, unknown>>;
  turnTimeoutHoursOptions: number[];
  playerRange: {
    min: number;
    max: number;
  };
}

export interface AuthSessionResponseContract {
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

export interface GameMutationResponseContract {
  ok: boolean;
  state?: Record<string, unknown>;
  playerId?: string | null;
  game?: Record<string, unknown>;
}
