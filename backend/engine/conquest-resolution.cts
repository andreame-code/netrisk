import type { GameState } from "../../shared/models.cjs";
import type { SuccessfulCombatResolution } from "./combat-resolution.cjs";

export interface FailedConquestResolution {
  ok: false;
  code: string;
  message: string;
  details: Record<string, unknown>;
  conquest: null;
}

export interface SuccessfulConquestResolution {
  ok: true;
  code: "CONQUEST_RESOLVED";
  message: string;
  details: {
    playerId: string;
    fromTerritoryId: string;
    toTerritoryId: string;
    minimumMove: number;
    movedArmies: number;
  };
  conquest: {
    fromTerritoryId: string;
    toTerritoryId: string;
    newOwnerId: string;
    movedArmies: number;
    minimumMove: number;
    attackerArmiesRemaining: number;
    conqueredTerritoryArmies: number;
  };
}

export type ConquestResolution = FailedConquestResolution | SuccessfulConquestResolution;

function invalid(code: string, message: string, details: Record<string, unknown> = {}): FailedConquestResolution {
  return {
    ok: false,
    code,
    message,
    details,
    conquest: null
  };
}

export function resolveConquest(
  state: GameState,
  combatResult: SuccessfulCombatResolution,
  armiesToMove: number
): ConquestResolution {
  if (!state || typeof state !== "object") {
    throw new Error("Conquest resolution requires a valid game state.");
  }

  if (!combatResult || typeof combatResult !== "object" || !combatResult.combat) {
    throw new Error("Conquest resolution requires a valid combat result.");
  }

  const combat = combatResult.combat;
  const { fromTerritoryId, toTerritoryId, attackDiceCount, defenderReducedToZero } = combat;

  if (!fromTerritoryId || !toTerritoryId) {
    throw new Error("Combat result is missing conquest territory identifiers.");
  }

  const attackerState = state.territories && state.territories[fromTerritoryId];
  const defenderState = state.territories && state.territories[toTerritoryId];

  if (!attackerState) {
    throw new Error(`Game state is missing attacker territory state for "${fromTerritoryId}".`);
  }

  if (!defenderState) {
    throw new Error(`Game state is missing defender territory state for "${toTerritoryId}".`);
  }

  if (!defenderReducedToZero || defenderState.armies !== 0) {
    return invalid("CONQUEST_NOT_AVAILABLE", "Territory conquest is only allowed after the defender has been reduced to zero armies.", {
      defenderReducedToZero,
      defenderArmies: defenderState.armies
    });
  }

  const minimumMove = Math.max(1, Number(attackDiceCount) || 1);
  const requestedMove = Number(armiesToMove);

  if (!Number.isInteger(requestedMove)) {
    return invalid("INVALID_MOVE_COUNT", "Conquest requires an integer number of armies to move.", {
      armiesToMove
    });
  }

  if (requestedMove < minimumMove) {
    return invalid("MOVE_BELOW_MINIMUM", `You must move at least ${minimumMove} armies into the conquered territory.`, {
      minimumMove,
      requestedMove
    });
  }

  const maxMove = attackerState.armies - 1;
  if (requestedMove > maxMove) {
    return invalid("MOVE_EXCEEDS_AVAILABLE", "The attacker territory must keep at least one army after conquest.", {
      maxMove,
      requestedMove,
      attackerArmies: attackerState.armies
    });
  }

  const newOwnerId = combatResult.details && typeof combatResult.details.playerId === "string" ? combatResult.details.playerId : null;
  if (!newOwnerId) {
    throw new Error("Combat result is missing the attacking player id.");
  }

  attackerState.armies -= requestedMove;
  defenderState.ownerId = newOwnerId;
  defenderState.armies = requestedMove;

  return {
    ok: true,
    code: "CONQUEST_RESOLVED",
    message: "Territory conquest resolved.",
    details: {
      playerId: newOwnerId,
      fromTerritoryId,
      toTerritoryId,
      minimumMove,
      movedArmies: requestedMove
    },
    conquest: {
      fromTerritoryId,
      toTerritoryId,
      newOwnerId,
      movedArmies: requestedMove,
      minimumMove,
      attackerArmiesRemaining: attackerState.armies,
      conqueredTerritoryArmies: defenderState.armies
    }
  };
}
