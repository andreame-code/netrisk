export type ThemePreferences = {
  theme?: string | null;
};

export type PublicUser = {
  id: string;
  username: string;
  role?: string;
  authMethods?: string[];
  hasEmail?: boolean;
  preferences?: ThemePreferences | null;
};

export type SessionResponse = MessagePayload & {
  user: PublicUser;
};

export type LoginResponse = SessionResponse;

export type VictoryRuleSet = {
  id: string;
  name: string;
  description: string;
};

export type VisualTheme = {
  id: string;
  name: string;
  description: string;
};

export type PieceSkin = {
  id: string;
  name: string;
  description: string;
  renderStyleId: string;
  usesPlayerColor: boolean;
  assetBaseUrl?: string | null;
};

export type NetRiskModuleReference = {
  id: string;
  version: string;
};

export type NetRiskModuleProfile = {
  id: string;
  name: string;
  description?: string | null;
  moduleId?: string | null;
};

export type NetRiskUiSlotContribution = {
  slotId: string;
  itemId: string;
  title: string;
  kind: string;
  order?: number;
  description?: string | null;
  route?: string | null;
};

export type NetRiskContentContribution = {
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
};

export type InstalledModuleSummary = {
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
  clientManifest?: {
    ui?: {
      slots?: NetRiskUiSlotContribution[];
      themeTokens?: string[];
      stylesheets?: string[];
      locales?: string[];
    } | null;
    content?: NetRiskContentContribution | null;
    profiles?: {
      content?: NetRiskModuleProfile[];
      gameplay?: NetRiskModuleProfile[];
      ui?: NetRiskModuleProfile[];
    } | null;
  } | null;
};

export type GameSummary = {
  id: string;
  name: string;
  phase: string;
  playerCount: number;
  updatedAt: string;
  totalPlayers?: number | null;
  mapName?: string | null;
  mapId?: string | null;
  aiCount?: number;
  creatorUserId?: string | null;
};

export type GameListResponse = MessagePayload & {
  games: GameSummary[];
  activeGameId?: string | null;
};

export type RuleSetSummary = {
  id: string;
  name: string;
  defaults: {
    extensionSchemaVersion: number;
    mapId: string;
    diceRuleSetId: string;
    victoryRuleSetId: string;
    themeId: string;
    pieceSkinId: string;
  };
  defaultDiceRuleSetId?: string;
  defaultVictoryRuleSetId?: string;
};

export type DiceRuleSet = {
  id: string;
  name: string;
  attackerMaxDice: number;
  defenderMaxDice: number;
};

export type VictoryRuleSetSummary = {
  id: string;
  name: string;
  description: string;
};

export type PlayerPieceSetSummary = {
  id: string;
  name: string;
  paletteSize: number;
};

export type ContentPackSummary = {
  id: string;
  name: string;
  description: string;
  defaultSiteThemeId: string;
  defaultMapId: string;
  defaultDiceRuleSetId: string;
  defaultCardRuleSetId: string;
  defaultVictoryRuleSetId: string;
  defaultPieceSetId: string;
};

export type ContinentBonusSummary = {
  name: string;
  bonus: number;
  territoryCount: number;
};

export type MapSummary = {
  id: string;
  name: string;
  territoryCount: number;
  continentCount: number;
  continentBonuses?: ContinentBonusSummary[];
};

export type GameOptionsResponse = MessagePayload & {
  ruleSets: RuleSetSummary[];
  maps: MapSummary[];
  diceRuleSets: DiceRuleSet[];
  victoryRuleSets: VictoryRuleSet[];
  themes: VisualTheme[];
  pieceSkins: PieceSkin[];
  modules?: InstalledModuleSummary[];
  enabledModules?: NetRiskModuleReference[];
  contentProfiles?: NetRiskModuleProfile[];
  gameplayProfiles?: NetRiskModuleProfile[];
  uiProfiles?: NetRiskModuleProfile[];
  uiSlots?: NetRiskUiSlotContribution[];
  playerPieceSets?: PlayerPieceSetSummary[];
  contentPacks?: ContentPackSummary[];
  turnTimeoutHoursOptions: number[];
};

export type ModuleOptionsResponse = MessagePayload & {
  modules: InstalledModuleSummary[];
  enabledModules: NetRiskModuleReference[];
  gameModules: InstalledModuleSummary[];
  content: NetRiskContentContribution;
  uiSlots: NetRiskUiSlotContribution[];
  contentProfiles: NetRiskModuleProfile[];
  gameplayProfiles: NetRiskModuleProfile[];
  uiProfiles: NetRiskModuleProfile[];
};

export type ModulesCatalogResponse = MessagePayload & {
  modules: InstalledModuleSummary[];
  enabledModules: NetRiskModuleReference[];
  engineVersion: string;
};

export type PlayerSlotConfig = {
  type: string;
  slot: number;
};

export type GameConfigSummary = {
  contentPackId?: string | null;
  pieceSetId?: string | null;
  extensionSchemaVersion?: number;
  moduleSchemaVersion?: number;
  ruleSetId?: string;
  ruleSetName?: string;
  mapName?: string | null;
  mapId?: string | null;
  diceRuleSetId?: string | null;
  victoryRuleSetId?: string | null;
  themeId?: string | null;
  pieceSkinId?: string | null;
  activeModules?: NetRiskModuleReference[];
  contentProfileId?: string | null;
  gameplayProfileId?: string | null;
  uiProfileId?: string | null;
  pieceSkin?: PieceSkin | null;
  turnTimeoutHours?: number | null;
  totalPlayers?: number;
  players?: Array<{ type: string }>;
};

export type SnapshotPlayer = {
  id: string;
  name: string;
  color: string;
  territoryCount?: number;
  eliminated?: boolean;
  cardCount?: number;
};

export type SnapshotTerritory = {
  id: string;
  name: string;
  ownerId: string | null;
  armies: number;
  neighbors: string[];
  x?: number | null;
  y?: number | null;
};

export type SnapshotCard = {
  id: string;
  territoryId?: string | null;
  type?: string | null;
};

export type SnapshotCombatComparison = {
  winner: string;
};

export type SnapshotLastCombat = {
  fromTerritoryId: string;
  toTerritoryId: string;
  attackerRolls?: number[];
  defenderRolls?: number[];
  comparisons?: SnapshotCombatComparison[];
  conqueredTerritory?: boolean;
  defenderReducedToZero?: boolean;
};

export type PendingConquest = {
  minArmies?: number;
  maxArmies?: number;
};

export type SnapshotCardState = {
  currentPlayerMustTrade?: boolean;
  maxHandBeforeForcedTrade?: number;
  nextTradeBonus?: number;
};

export type SnapshotMapVisual = {
  imageUrl?: string | null;
  aspectRatio?: {
    width?: number;
    height?: number;
  } | null;
};

export type SnapshotDiceRuleSet = {
  attackerMaxDice?: number;
  defenderMaxDice?: number;
};

export type GameSnapshot = {
  gameId?: string | null;
  gameName?: string | null;
  version?: number | null;
  playerId?: string | null;
  phase?: string;
  turnPhase?: string;
  currentPlayerId?: string | null;
  winnerId?: string | null;
  players: SnapshotPlayer[];
  map: SnapshotTerritory[];
  reinforcementPool: number;
  playerHand?: SnapshotCard[];
  pendingConquest?: PendingConquest | null;
  lastCombat?: SnapshotLastCombat | null;
  cardState?: SnapshotCardState | null;
  gameConfig?: GameConfigSummary | null;
  mapId?: string | null;
  mapVisual?: SnapshotMapVisual | null;
  diceRuleSet?: SnapshotDiceRuleSet | null;
  fortifyUsed?: boolean;
};

export type MutationResponse = MessagePayload & {
  ok?: boolean;
  code?: string | null;
  user?: PublicUser;
  playerId?: string | null;
  bonus?: number;
  game?: {
    id: string;
    name?: string | null;
  };
  games?: GameSummary[];
  activeGameId?: string | null;
  state?: GameSnapshot;
};

export type ProfileLobbySummary = {
  playerName?: string;
  statusLabel?: string;
  focusLabel?: string;
  turnPhaseLabel?: string;
  territoryCount?: number;
  cardCount?: number;
};

export type ParticipatingGame = GameSummary & {
  totalPlayers: number | null;
  mapName: string | null;
  mapId?: string | null;
  aiCount?: number;
  myLobby?: ProfileLobbySummary;
};

export type ProfileSummary = {
  playerName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  gamesInProgress: number;
  participatingGames: ParticipatingGame[];
  winRate: number | null;
  hasHistory: boolean;
  preferences?: ThemePreferences | null;
};

export type ProfileResponse = {
  profile: ProfileSummary;
};

export type MessagePayload = {
  message?: string;
  error?: string;
  reason?: string;
  messageKey?: string;
  errorKey?: string;
  reasonKey?: string;
  messageParams?: Record<string, unknown>;
  errorParams?: Record<string, unknown>;
  reasonParams?: Record<string, unknown>;
};

export type TranslationParams = Record<string, string | number | boolean | null | undefined>;
