import type { Card } from "./cards.cjs";
import type { LogEntry } from "./messages.cjs";
import type { NetRiskModuleReference } from "./netrisk-modules.cjs";

export const TurnPhase = Object.freeze({
  LOBBY: "lobby",
  REINFORCEMENT: "reinforcement",
  ATTACK: "attack",
  FORTIFY: "fortify",
  FINISHED: "finished"
} as const);

export type TurnPhaseValue = (typeof TurnPhase)[keyof typeof TurnPhase];

export interface Player {
  id: string | null;
  name: string;
  color: string;
  connected: boolean;
  isAi: boolean;
  linkedUserId: string | null;
  surrendered: boolean;
}

export interface Territory {
  id: string | null;
  name: string;
  ownerId: string | null;
  armies: number;
  continentId: string | null;
  neighbors: string[];
}

export interface Continent {
  id: string | null;
  name: string;
  bonus: number;
  territoryIds: string[];
}

export interface TerritoryState {
  ownerId: string | null;
  armies: number;
}

export interface MapPosition {
  x: number | null;
  y: number | null;
}

export interface GameConfig {
  extensionSchemaVersion?: number;
  moduleSchemaVersion?: number;
  ruleSetId?: string;
  ruleSetName?: string;
  mapId?: string | null;
  mapName?: string | null;
  diceRuleSetId?: string;
  victoryRuleSetId?: string;
  themeId?: string;
  pieceSkinId?: string;
  activeModules?: NetRiskModuleReference[];
  gamePresetId?: string | null;
  contentProfileId?: string | null;
  gameplayProfileId?: string | null;
  uiProfileId?: string | null;
  turnTimeoutHours?: number | null;
  totalPlayers?: number;
  players?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface GameState {
  phase: string;
  turnPhase: TurnPhaseValue;
  turnStartedAt: string | null;
  players: Player[];
  territories: Record<string, TerritoryState>;
  continents: Continent[];
  diceRuleSetId: string;
  combatRuleSetId: string;
  reinforcementRuleSetId: string;
  fortifyRuleSetId: string;
  mapId: string;
  contentPackId: string;
  mapName: string | null;
  mapTerritories: Territory[];
  mapPositions: Record<string, MapPosition>;
  mapImageUrl: string | null;
  mapAspectRatio: number | null;
  currentTurnIndex: number;
  reinforcementPool: number;
  winnerId: string | null;
  victoryRuleSetId: string;
  pieceSetId: string;
  log: string[];
  logEntries: LogEntry[];
  lastAction: Record<string, unknown> | null;
  pendingConquest: Record<string, unknown> | null;
  fortifyUsed: boolean;
  cardRuleSetId: string;
  deck: Card[];
  discardPile: Card[];
  hands: Record<string, Card[]>;
  tradeCount: number;
  conqueredTerritoryThisTurn: boolean;
  gameConfig?: GameConfig | null;
}

export type CreatePlayerInput = Partial<Player>;
export type CreateTerritoryInput = Partial<Territory>;
export type CreateContinentInput = Partial<Continent>;
export type CreateGameStateInput = Partial<GameState>;

export function createPlayer(input: CreatePlayerInput = {}): Player {
  return {
    id: input.id || null,
    name: input.name || "",
    color: input.color || "#9aa6b2",
    connected: Boolean(input.connected),
    isAi: Boolean(input.isAi),
    linkedUserId: input.linkedUserId || null,
    surrendered: Boolean(input.surrendered)
  };
}

export function createTerritory(input: CreateTerritoryInput = {}): Territory {
  return {
    id: input.id || null,
    name: input.name || "",
    ownerId: input.ownerId || null,
    armies: input.armies || 0,
    continentId: input.continentId || null,
    neighbors: input.neighbors || []
  };
}

export function createContinent(input: CreateContinentInput = {}): Continent {
  return {
    id: input.id || null,
    name: input.name || "",
    bonus: input.bonus || 0,
    territoryIds: input.territoryIds || []
  };
}

export function createGameState(input: CreateGameStateInput = {}): GameState {
  return {
    phase: input.phase || "lobby",
    turnPhase: input.turnPhase || TurnPhase.LOBBY,
    turnStartedAt: typeof input.turnStartedAt === "string" ? input.turnStartedAt : null,
    players: input.players || [],
    territories: input.territories || {},
    continents: input.continents || [],
    diceRuleSetId: input.diceRuleSetId || "standard",
    combatRuleSetId: input.combatRuleSetId || "standard",
    reinforcementRuleSetId: input.reinforcementRuleSetId || "standard",
    fortifyRuleSetId: input.fortifyRuleSetId || "standard",
    mapId: input.mapId || "classic-mini",
    contentPackId: input.contentPackId || "core",
    mapName: input.mapName || null,
    mapTerritories: Array.isArray(input.mapTerritories) ? input.mapTerritories : [],
    mapPositions: input.mapPositions || {},
    mapImageUrl: input.mapImageUrl || null,
    mapAspectRatio: input.mapAspectRatio || null,
    currentTurnIndex: input.currentTurnIndex || 0,
    reinforcementPool: input.reinforcementPool || 0,
    winnerId: input.winnerId || null,
    victoryRuleSetId: input.victoryRuleSetId || "conquest",
    pieceSetId: input.pieceSetId || "classic",
    log: input.log || [],
    logEntries: Array.isArray(input.logEntries) ? input.logEntries : [],
    lastAction: input.lastAction || null,
    pendingConquest: input.pendingConquest || null,
    fortifyUsed: Boolean(input.fortifyUsed),
    cardRuleSetId: input.cardRuleSetId || "standard",
    deck: Array.isArray(input.deck) ? input.deck : [],
    discardPile: Array.isArray(input.discardPile) ? input.discardPile : [],
    hands: input.hands || {},
    tradeCount: typeof input.tradeCount === "number" && Number.isInteger(input.tradeCount) ? input.tradeCount : 0,
    conqueredTerritoryThisTurn: Boolean(input.conqueredTerritoryThisTurn),
    gameConfig: input.gameConfig && typeof input.gameConfig === "object" ? input.gameConfig : null
  };
}
