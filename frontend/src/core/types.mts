export type ThemePreferences = {
  theme?: string | null;
};

export type PublicUser = {
  id: string;
  username: string;
  preferences?: ThemePreferences | null;
};

export type SessionResponse = MessagePayload & {
  user: PublicUser;
};

export type LoginResponse = SessionResponse;

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
  defaultDiceRuleSetId: string;
};

export type DiceRuleSet = {
  id: string;
  name: string;
  attackerMaxDice: number;
  defenderMaxDice: number;
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
  turnTimeoutHoursOptions: number[];
};

export type PlayerSlotConfig = {
  type: string;
  slot: number;
};

export type GameConfigSummary = {
  mapName?: string | null;
  mapId?: string | null;
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
