import {
  GameAction,
  TurnPhase,
  createActionFailure,
  type ActionFailure,
  type GameState,
  type MessageParams,
  type Player
} from "../../shared/models.cjs";

type TerritoryState = GameState["territories"][string];

export interface ReinforcementPlacementResult {
  playerId: string;
  territoryId: string;
  placedArmies: number;
  remainingReinforcements: number;
  territoryArmies: number;
  turnPhase: string;
}

export type ReinforcementPlacementActionResult =
  | ActionFailure
  | { ok: true; placement: ReinforcementPlacementResult; player: Player };

interface PlacementContext {
  currentPlayer: Player;
  territoryState: TerritoryState;
  reinforcementAmount: number;
}

function getCurrentPlayer(state: GameState): Player | null {
  if (!state || !Array.isArray(state.players) || state.players.length === 0) {
    return null;
  }

  return state.players[state.currentTurnIndex] || null;
}

function validateState(state: GameState): void {
  if (!state || typeof state !== "object") {
    throw new Error("Reinforcement placement requires a valid game state.");
  }

  if (state.phase !== "active") {
    throw new Error("Reinforcements can only be placed while the game is active.");
  }

  if (state.turnPhase !== TurnPhase.REINFORCEMENT) {
    throw new Error("Reinforcements can only be placed during the reinforcement phase.");
  }

  if (!Array.isArray(state.players) || state.players.length === 0) {
    throw new Error("Game state must contain players for reinforcement placement.");
  }

  if (!state.territories || typeof state.territories !== "object") {
    throw new Error("Game state must contain territories for reinforcement placement.");
  }

  if (
    !Number.isInteger(state.currentTurnIndex) ||
    state.currentTurnIndex < 0 ||
    state.currentTurnIndex >= state.players.length
  ) {
    throw new Error("Game state has an invalid currentTurnIndex for reinforcement placement.");
  }

  if (!Number.isFinite(state.reinforcementPool)) {
    throw new Error("Game state has an invalid reinforcement pool.");
  }
}

function normalizeReinforcementAmount(requestedAmount: unknown): number {
  return Math.floor(Number(requestedAmount));
}

function validatePlacementContext(
  state: GameState,
  playerId: string,
  territoryId: string,
  requestedAmount: unknown
): PlacementContext {
  validateState(state);

  if (!playerId) {
    throw new Error("Reinforcement placement requires a player id.");
  }

  if (!territoryId) {
    throw new Error("Reinforcement placement requires a territory id.");
  }

  const currentPlayer = getCurrentPlayer(state);
  if (!currentPlayer || currentPlayer.id !== playerId) {
    throw new Error("Only the current player can place reinforcements.");
  }

  if (state.reinforcementPool <= 0) {
    throw new Error("No reinforcements are available to place.");
  }

  const reinforcementAmount = normalizeReinforcementAmount(requestedAmount);
  if (!Number.isFinite(reinforcementAmount) || reinforcementAmount <= 0) {
    throw new Error("Reinforcement placement requires a positive whole army count.");
  }

  if (reinforcementAmount > state.reinforcementPool) {
    throw new Error("Reinforcement placement cannot spend more armies than the pool contains.");
  }

  const territoryState = state.territories[territoryId] as TerritoryState | undefined;
  if (!territoryState) {
    throw new Error(`Unknown territory "${territoryId}" for reinforcement placement.`);
  }

  if (territoryState.ownerId !== playerId) {
    throw new Error(`Player "${playerId}" can only place reinforcements on owned territories.`);
  }

  return {
    currentPlayer,
    territoryState,
    reinforcementAmount
  };
}

function applyPlacement(
  state: GameState,
  playerId: string,
  territoryId: string,
  context: PlacementContext,
  summary: string,
  summaryKey?: string,
  summaryParams?: MessageParams
): ReinforcementPlacementResult {
  context.territoryState.armies += context.reinforcementAmount;
  state.reinforcementPool -= context.reinforcementAmount;
  state.lastAction = {
    type: GameAction.REINFORCE,
    playerId,
    territoryId,
    summary,
    ...(summaryKey ? { summaryKey } : {}),
    ...(summaryParams ? { summaryParams } : {})
  };

  return {
    playerId,
    territoryId,
    placedArmies: context.reinforcementAmount,
    remainingReinforcements: state.reinforcementPool,
    territoryArmies: context.territoryState.armies,
    turnPhase: state.turnPhase
  };
}

export function placeReinforcement(
  state: GameState,
  playerId: string,
  territoryId: string,
  requestedAmount: number = 1
): ReinforcementPlacementResult {
  const context = validatePlacementContext(state, playerId, territoryId, requestedAmount);

  return applyPlacement(
    state,
    playerId,
    territoryId,
    context,
    `${context.currentPlayer.name} places ${context.reinforcementAmount} reinforcement${
      context.reinforcementAmount === 1 ? "" : "s"
    } on ${territoryId}.`
  );
}

export function placeReinforcementAction(
  state: GameState,
  playerId: string,
  territoryId: string,
  requestedAmount: unknown
): ReinforcementPlacementActionResult {
  const player = state?.players?.find((entry) => entry.id === playerId) || null;
  if (!player) {
    return createActionFailure("Giocatore non valido.", "game.invalidPlayer");
  }

  if (state.phase !== "active") {
    return createActionFailure("La partita non e attiva.", "game.notActive");
  }

  if (!getCurrentPlayer(state) || getCurrentPlayer(state)?.id !== playerId) {
    return createActionFailure("Non e il tuo turno.", "game.notYourTurn");
  }

  if (state.reinforcementPool <= 0) {
    return createActionFailure("Non hai rinforzi disponibili.", "game.reinforce.noneAvailable");
  }

  const reinforcementAmount = normalizeReinforcementAmount(requestedAmount);
  if (!Number.isFinite(reinforcementAmount) || reinforcementAmount <= 0) {
    return createActionFailure("Quantita rinforzi non valida.", "game.reinforce.invalidAmount");
  }

  if (reinforcementAmount > state.reinforcementPool) {
    return createActionFailure(
      "Stai tentando di usare piu rinforzi di quelli disponibili.",
      "game.reinforce.tooMany"
    );
  }

  const territoryState = state.territories[territoryId] as TerritoryState | undefined;
  if (!territoryState || territoryState.ownerId !== playerId) {
    return createActionFailure(
      "Puoi rinforzare solo un tuo territorio.",
      "game.reinforce.mustOwnTerritory"
    );
  }

  const context: PlacementContext = {
    currentPlayer: player,
    territoryState,
    reinforcementAmount
  };
  const summary =
    player.name + " rinforza " + territoryId + " con " + reinforcementAmount + " armate.";
  const summaryParams = {
    playerName: player.name,
    reinforcementAmount,
    territoryId,
    reinforcementPool: state.reinforcementPool - reinforcementAmount
  };

  return {
    ok: true,
    player,
    placement: applyPlacement(
      state,
      playerId,
      territoryId,
      context,
      summary,
      "game.log.reinforced",
      summaryParams
    )
  };
}
