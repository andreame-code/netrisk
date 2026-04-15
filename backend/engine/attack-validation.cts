import { TurnPhase, type GameState, type Player } from "../../shared/models.cjs";
import type { MapGraph } from "../../shared/map-graph.cjs";

export interface ValidationResult {
  ok: false;
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export interface ValidationSuccess {
  ok: true;
  code: "ATTACK_ALLOWED";
  message: string;
  details: Record<string, unknown>;
}

export type AttackValidationResult = ValidationResult | ValidationSuccess;

interface GameplayEffectsLike {
  attackMinimumArmies?: number | null;
  attackLimitPerTurn?: number | null;
}

function getCurrentPlayer(state: GameState): Player | null {
  if (!state || !Array.isArray(state.players) || state.players.length === 0) {
    return null;
  }

  return state.players[state.currentTurnIndex] || null;
}

function invalid(code: string, message: string, details: Record<string, unknown> = {}): ValidationResult {
  return {
    ok: false,
    code,
    message,
    details
  };
}

function valid(details: Record<string, unknown> = {}): ValidationSuccess {
  return {
    ok: true,
    code: "ATTACK_ALLOWED",
    message: "Attack is allowed.",
    details
  };
}

function resolveAttackMinimumArmies(
  state: GameState & { gameConfig?: { gameplayEffects?: GameplayEffectsLike | null } | null }
): number {
  const moduleMinimum = state.gameConfig?.gameplayEffects?.attackMinimumArmies;
  return Math.max(2, Number.isInteger(moduleMinimum) ? Number(moduleMinimum) : 2);
}

function resolveAttackLimitPerTurn(
  state: GameState & { gameConfig?: { gameplayEffects?: GameplayEffectsLike | null } | null }
): number | null {
  const configuredLimit = state.gameConfig?.gameplayEffects?.attackLimitPerTurn;
  return Number.isInteger(configuredLimit) ? Math.max(1, Number(configuredLimit)) : null;
}

export function validateAttackAttempt(
  state: GameState,
  graph: MapGraph,
  playerId: string,
  fromTerritoryId: string,
  toTerritoryId: string
): AttackValidationResult {
  if (!state || typeof state !== "object") {
    throw new Error("Attack validation requires a valid game state.");
  }

  if (!graph || typeof graph.areAdjacent !== "function" || typeof graph.hasTerritory !== "function") {
    throw new Error("Attack validation requires a valid map graph.");
  }

  if (!playerId) {
    throw new Error("Attack validation requires a player id.");
  }

  if (!fromTerritoryId || !toTerritoryId) {
    throw new Error("Attack validation requires both attacker and defender territory ids.");
  }

  if (state.phase !== "active") {
    return invalid("GAME_NOT_ACTIVE", "Attacks are only allowed while the game is active.");
  }

  if (state.turnPhase !== TurnPhase.ATTACK) {
    return invalid("INVALID_PHASE", "Attacks are only allowed during the attack phase.", {
      turnPhase: state.turnPhase
    });
  }

  const attackLimitPerTurn = resolveAttackLimitPerTurn(state);
  const attacksThisTurn = typeof state.attacksThisTurn === "number" && Number.isInteger(state.attacksThisTurn)
    ? state.attacksThisTurn
    : 0;
  if (attackLimitPerTurn !== null && attacksThisTurn >= attackLimitPerTurn) {
    return invalid("ATTACK_LIMIT_REACHED", "The turn attack limit has already been reached.", {
      attackLimitPerTurn,
      attacksThisTurn
    });
  }

  const currentPlayer = getCurrentPlayer(state);
  if (!currentPlayer || currentPlayer.id !== playerId) {
    return invalid("NOT_CURRENT_PLAYER", "Only the current player can attack.", {
      currentPlayerId: currentPlayer ? currentPlayer.id : null
    });
  }

  if (!graph.hasTerritory(fromTerritoryId)) {
    return invalid("UNKNOWN_ATTACKER_TERRITORY", `Unknown attacker territory "${fromTerritoryId}".`);
  }

  if (!graph.hasTerritory(toTerritoryId)) {
    return invalid("UNKNOWN_DEFENDER_TERRITORY", `Unknown defender territory "${toTerritoryId}".`);
  }

  const fromState = state.territories && state.territories[fromTerritoryId];
  const toState = state.territories && state.territories[toTerritoryId];

  if (!fromState) {
    return invalid("MISSING_ATTACKER_STATE", `Game state is missing attacker territory state for "${fromTerritoryId}".`);
  }

  if (!toState) {
    return invalid("MISSING_DEFENDER_STATE", `Game state is missing defender territory state for "${toTerritoryId}".`);
  }

  if (fromState.ownerId !== playerId) {
    return invalid("ATTACKER_NOT_OWNED", "The attacker territory must belong to the current player.", {
      ownerId: fromState.ownerId
    });
  }

  if (!toState.ownerId || toState.ownerId === playerId) {
    return invalid("DEFENDER_NOT_ENEMY", "The defender territory must belong to another player.", {
      ownerId: toState.ownerId
    });
  }

  if (!graph.areAdjacent(fromTerritoryId, toTerritoryId)) {
    return invalid("NOT_ADJACENT", "The attacker and defender territories must be adjacent.");
  }

  const minimumArmies = resolveAttackMinimumArmies(state);
  if (!Number.isFinite(fromState.armies) || fromState.armies < minimumArmies) {
    return invalid("INSUFFICIENT_ARMIES", `The attacker territory must contain at least ${minimumArmies} armies.`, {
      armies: fromState.armies,
      minimumArmies
    });
  }

  return valid({
    playerId,
    fromTerritoryId,
    toTerritoryId,
    attackLimitPerTurn,
    attacksThisTurn,
    attackerArmies: fromState.armies,
    defenderArmies: toState.armies,
    defenderOwnerId: toState.ownerId
  });
}
