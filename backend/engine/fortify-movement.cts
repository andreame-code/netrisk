import { TurnPhase, type GameState, type Player } from "../../shared/models.cjs";
import type { MapGraph } from "../../shared/map-graph.cjs";

export interface FailedFortifyResult {
  ok: false;
  code: string;
  message: string;
  details: Record<string, unknown>;
  fortify: null;
}

export interface SuccessfulFortifyResult {
  ok: true;
  code: "FORTIFY_RESOLVED";
  message: string;
  details: {
    playerId: string;
    fromTerritoryId: string;
    toTerritoryId: string;
    movedArmies: number;
  };
  fortify: {
    fromTerritoryId: string;
    toTerritoryId: string;
    movedArmies: number;
    path: string[];
    sourceArmiesRemaining: number;
    targetArmies: number;
    fortifyMoveUsed: boolean;
  };
}

export type FortifyResult = FailedFortifyResult | SuccessfulFortifyResult;

interface FortifyOptions {
  enforceSingleMove?: boolean;
}

function getCurrentPlayer(state: GameState): Player | null {
  if (!state || !Array.isArray(state.players) || state.players.length === 0) {
    return null;
  }

  return state.players[state.currentTurnIndex] || null;
}

function invalid(code: string, message: string, details: Record<string, unknown> = {}): FailedFortifyResult {
  return {
    ok: false,
    code,
    message,
    details,
    fortify: null
  };
}

function findOwnedPath(state: GameState, graph: MapGraph, ownerId: string, fromTerritoryId: string, toTerritoryId: string): string[] | null {
  const queue: string[][] = [[fromTerritoryId]];
  const visited = new Set([fromTerritoryId]);

  while (queue.length > 0) {
    const path = queue.shift();
    if (!path) {
      continue;
    }

    const current = path[path.length - 1] as string;
    if (current === toTerritoryId) {
      return path;
    }

    graph.getNeighbors(current).forEach((neighborId) => {
      if (visited.has(neighborId)) {
        return;
      }

      const territoryState = state.territories[neighborId];
      if (!territoryState || territoryState.ownerId !== ownerId) {
        return;
      }

      visited.add(neighborId);
      queue.push(path.concat(neighborId));
    });
  }

  return null;
}

export function moveFortifyArmies(
  state: GameState & { fortifyMoveUsed?: boolean },
  graph: MapGraph,
  playerId: string,
  fromTerritoryId: string,
  toTerritoryId: string,
  armiesToMove: number,
  options: FortifyOptions = {}
): FortifyResult {
  if (!state || typeof state !== "object") {
    throw new Error("Fortify movement requires a valid game state.");
  }

  if (!graph || typeof graph.hasTerritory !== "function" || typeof graph.getNeighbors !== "function") {
    throw new Error("Fortify movement requires a valid map graph.");
  }

  if (!playerId || !fromTerritoryId || !toTerritoryId) {
    throw new Error("Fortify movement requires player, source territory, and destination territory ids.");
  }

  const requestedArmies = Number(armiesToMove);
  if (!Number.isInteger(requestedArmies) || requestedArmies < 1) {
    return invalid("INVALID_ARMY_COUNT", "Fortify movement requires at least one whole army to move.", {
      armiesToMove
    });
  }

  if (state.phase !== "active") {
    return invalid("GAME_NOT_ACTIVE", "Fortify movement is only allowed while the game is active.");
  }

  if (state.turnPhase !== TurnPhase.FORTIFY) {
    return invalid("INVALID_PHASE", "Fortify movement is only allowed during the fortify phase.", {
      turnPhase: state.turnPhase
    });
  }

  const currentPlayer = getCurrentPlayer(state);
  if (!currentPlayer || currentPlayer.id !== playerId) {
    return invalid("NOT_CURRENT_PLAYER", "Only the current player can fortify.", {
      currentPlayerId: currentPlayer ? currentPlayer.id : null
    });
  }

  if (options.enforceSingleMove !== false && state.fortifyMoveUsed) {
    return invalid("FORTIFY_ALREADY_USED", "Only one fortify move is allowed this turn.");
  }

  if (!graph.hasTerritory(fromTerritoryId)) {
    return invalid("UNKNOWN_SOURCE_TERRITORY", `Unknown source territory "${fromTerritoryId}".`);
  }

  if (!graph.hasTerritory(toTerritoryId)) {
    return invalid("UNKNOWN_TARGET_TERRITORY", `Unknown target territory "${toTerritoryId}".`);
  }

  if (fromTerritoryId === toTerritoryId) {
    return invalid("SAME_TERRITORY", "Fortify movement requires different source and destination territories.");
  }

  const fromState = state.territories && state.territories[fromTerritoryId];
  const toState = state.territories && state.territories[toTerritoryId];

  if (!fromState || !toState) {
    return invalid("MISSING_TERRITORY_STATE", "Game state is missing source or destination territory state.");
  }

  if (fromState.ownerId !== playerId || toState.ownerId !== playerId) {
    return invalid("TERRITORY_NOT_OWNED", "Fortify movement is only allowed between territories owned by the current player.", {
      fromOwnerId: fromState.ownerId,
      toOwnerId: toState.ownerId
    });
  }

  if (!Number.isFinite(fromState.armies) || fromState.armies <= 1) {
    return invalid("INSUFFICIENT_SOURCE_ARMIES", "The source territory must keep at least one army after fortifying.", {
      armies: fromState.armies
    });
  }

  const maxMove = fromState.armies - 1;
  if (requestedArmies > maxMove) {
    return invalid("MOVE_EXCEEDS_AVAILABLE", "The source territory must keep at least one army after fortifying.", {
      maxMove,
      requestedArmies,
      sourceArmies: fromState.armies
    });
  }

  const path = findOwnedPath(state, graph, playerId, fromTerritoryId, toTerritoryId);
  if (!path) {
    return invalid("NO_OWNED_PATH", "Fortify movement requires a connected path through owned territories.");
  }

  fromState.armies -= requestedArmies;
  toState.armies += requestedArmies;
  if (options.enforceSingleMove !== false) {
    state.fortifyMoveUsed = true;
  }

  state.lastAction = {
    type: "fortify",
    playerId,
    fromTerritoryId,
    toTerritoryId,
    movedArmies: requestedArmies,
    summary: `${currentPlayer.name} fortifies ${toTerritoryId} from ${fromTerritoryId} with ${requestedArmies} armies.`
  };

  return {
    ok: true,
    code: "FORTIFY_RESOLVED",
    message: "Fortify movement resolved.",
    details: {
      playerId,
      fromTerritoryId,
      toTerritoryId,
      movedArmies: requestedArmies
    },
    fortify: {
      fromTerritoryId,
      toTerritoryId,
      movedArmies: requestedArmies,
      path,
      sourceArmiesRemaining: fromState.armies,
      targetArmies: toState.armies,
      fortifyMoveUsed: Boolean(state.fortifyMoveUsed)
    }
  };
}
