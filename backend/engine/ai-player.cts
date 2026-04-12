import { secureRandom } from "../random.cjs";
import { TurnPhase, validateStandardCardSet, type Card, type GameState, type Territory } from "../../shared/models.cjs";

interface PendingConquest {
  fromId: string;
  toId: string;
  minArmies: number;
  maxArmies: number;
}

interface EnginePlayer {
  id: string | null;
  name: string;
  isAi: boolean;
}

interface ActionFailure {
  ok: false;
  message: string;
}

interface ActionSuccess {
  ok: true;
  message?: string;
}

interface AttackChoice {
  fromId: string;
  toId: string;
  score: number;
}

interface FortifyChoice {
  fromId: string;
  toId: string;
  armies: number;
  score: number;
}

interface AiTurnReport {
  ok: true;
  playerId: string | null;
  tradedCardSets: string[][];
  reinforcementTargets: string[];
  attacks: AttackChoice[];
  conquestMoves: Array<{ fromId: string; toId: string; armies: number | null }>;
  fortify: FortifyChoice | null;
  endedTurn: boolean;
}

type EngineState = GameState & {
  pendingConquest?: PendingConquest | null;
  winnerId: string | null;
  phase: string;
  reinforcementPool: number;
  turnPhase: string;
  hands: Record<string, Card[]>;
};

type EngineModule = {
  applyFortify: (state: EngineState, playerId: string, fromId: string, toId: string, armies: number) => ActionFailure | ActionSuccess;
  applyReinforcement: (state: EngineState, playerId: string, territoryId: string) => ActionFailure | ActionSuccess;
  endTurn: (state: EngineState, playerId: string) => ActionFailure | ActionSuccess;
  getCurrentPlayer: (state: EngineState) => EnginePlayer | null;
  getMapTerritories: (state: EngineState) => Territory[];
  moveAfterConquest: (state: EngineState, playerId: string, armiesToMove: number | null) => ActionFailure | ActionSuccess;
  playerMustTradeCards: (state: EngineState, playerId: string) => boolean;
  resolveAttack: (state: EngineState, playerId: string, fromId: string, toId: string, random?: () => number) => ActionFailure | ActionSuccess;
  tradeCardSet: (state: EngineState, playerId: string, cardIds: string[]) => ActionFailure | ActionSuccess;
  territoriesOwnedBy: (state: EngineState, playerId: string) => Territory[];
};

const {
  applyFortify,
  applyReinforcement,
  endTurn,
  getCurrentPlayer,
  getMapTerritories,
  moveAfterConquest,
  playerMustTradeCards,
  resolveAttack,
  tradeCardSet,
  territoriesOwnedBy
} = require("./game-engine.cjs") as EngineModule;

function listEnemyNeighbors(state: EngineState, territoryId: string, playerId: string): Array<{ territoryId: string; state: { ownerId: string | null; armies: number } }> {
  const territory = getMapTerritories(state).find((item) => item.id === territoryId);
  if (!territory) {
    return [];
  }

  return territory.neighbors
    .map((neighborId) => ({ territoryId: neighborId, state: state.territories[neighborId] }))
    .filter((entry) => entry.state && entry.state.ownerId && entry.state.ownerId !== playerId) as Array<{ territoryId: string; state: { ownerId: string | null; armies: number } }>;
}

export function chooseReinforcementTarget(state: EngineState, playerId: string): string | null {
  const owned = territoriesOwnedBy(state, playerId);
  if (!owned.length) {
    return null;
  }

  const ranked = owned
    .filter((territory): territory is Territory & { id: string } => Boolean(territory.id))
    .map((territory) => {
      const enemyNeighbors = listEnemyNeighbors(state, territory.id, playerId);
      const armies = state.territories[territory.id]?.armies || 0;
      const strongestEnemy = enemyNeighbors.reduce((max, entry) => Math.max(max, entry.state.armies), 0);
      const score = enemyNeighbors.length
        ? (armies - strongestEnemy) + enemyNeighbors.length * 2
        : -100 + armies;

      return {
        territoryId: territory.id,
        enemyNeighbors,
        score,
        armies
      };
    })
    .sort((left, right) => right.score - left.score || right.armies - left.armies || left.territoryId.localeCompare(right.territoryId));

  return ranked[0] ? ranked[0].territoryId : null;
}

export function chooseAttack(state: EngineState, playerId: string): AttackChoice | null {
  const candidates: AttackChoice[] = [];

  territoriesOwnedBy(state, playerId)
    .filter((territory): territory is Territory & { id: string } => Boolean(territory.id))
    .forEach((territory) => {
      const fromState = state.territories[territory.id];
      if (!fromState || fromState.armies < 2) {
        return;
      }

      listEnemyNeighbors(state, territory.id, playerId).forEach((neighbor) => {
        const advantage = fromState.armies - neighbor.state.armies;
        if (advantage < 2) {
          return;
        }

        candidates.push({
          fromId: territory.id,
          toId: neighbor.territoryId,
          score: advantage * 10 - neighbor.state.armies
        });
      });
    });

  candidates.sort((left, right) => right.score - left.score || left.fromId.localeCompare(right.fromId) || left.toId.localeCompare(right.toId));
  return candidates[0] || null;
}

export function chooseConquestMove(state: EngineState, playerId: string, pending: PendingConquest | null | undefined): number | null {
  if (!pending) {
    return null;
  }

  const capturedEnemyNeighbors = listEnemyNeighbors(state, pending.toId, playerId).length;
  if (!capturedEnemyNeighbors) {
    return pending.minArmies;
  }

  return Math.max(
    pending.minArmies,
    Math.min(pending.maxArmies, 2)
  );
}

export function chooseFortify(state: EngineState, playerId: string): FortifyChoice | null {
  const owned = territoriesOwnedBy(state, playerId);
  const borderIds = new Set(
    owned
      .filter((territory): territory is Territory & { id: string } => Boolean(territory.id))
      .filter((territory) => listEnemyNeighbors(state, territory.id, playerId).length > 0)
      .map((territory) => territory.id)
  );

  if (!borderIds.size) {
    return null;
  }

  const candidates: FortifyChoice[] = [];
  owned
    .filter((territory): territory is Territory & { id: string } => Boolean(territory.id))
    .forEach((territory) => {
      const fromState = state.territories[territory.id];
      if (!fromState || fromState.armies <= 1) {
        return;
      }

      const territoryDef = getMapTerritories(state).find((item) => item.id === territory.id);
      if (!territoryDef) {
        return;
      }

      territoryDef.neighbors.forEach((neighborId) => {
        if (!borderIds.has(neighborId)) {
          return;
        }

        const neighborState = state.territories[neighborId];
        if (!neighborState || neighborState.ownerId !== playerId) {
          return;
        }

        const sourceIsBorder = borderIds.has(territory.id);
        if (sourceIsBorder) {
          return;
        }

        const targetEnemyNeighbors = listEnemyNeighbors(state, neighborId, playerId).length;
        const movableArmies = fromState.armies - 1;
        const armies = Math.max(1, Math.min(movableArmies, 2));
        const score = 8 + targetEnemyNeighbors * 4 + (fromState.armies - neighborState.armies);
        if (score < 3) {
          return;
        }

        candidates.push({ fromId: territory.id, toId: neighborId, armies, score });
      });
    });

  candidates.sort((left, right) => right.score - left.score || right.armies - left.armies || left.fromId.localeCompare(right.fromId) || left.toId.localeCompare(right.toId));
  return candidates[0] || null;
}

function chooseTradeSet(state: EngineState, playerId: string): string[] | null {
  const hand = Array.isArray(state.hands?.[playerId]) ? state.hands[playerId] : [];
  if (hand.length < 3) {
    return null;
  }

  for (let first = 0; first < hand.length - 2; first += 1) {
    for (let second = first + 1; second < hand.length - 1; second += 1) {
      for (let third = second + 1; third < hand.length; third += 1) {
        const candidate = [hand[first], hand[second], hand[third]] as Card[];
        const validation = validateStandardCardSet(candidate);
        if (validation.ok) {
          return candidate.map((card) => card.id).filter((id): id is string => Boolean(id));
        }
      }
    }
  }

  return null;
}

export function runAiTurn(
  state: EngineState,
  options: { random?: () => number } = {}
): { ok: false; error: string; report?: AiTurnReport } | AiTurnReport {
  const random = typeof options.random === "function" ? options.random : secureRandom;
  const player = getCurrentPlayer(state);
  if (!player) {
    return { ok: false, error: "Nessun giocatore corrente." };
  }

  if (!player.isAi) {
    return { ok: false, error: "Il giocatore corrente non e controllato dall'AI." };
  }

  if (state.phase !== "active") {
    return { ok: false, error: "La partita non e attiva." };
  }

  const report: AiTurnReport = {
    ok: true,
    playerId: player.id,
    tradedCardSets: [],
    reinforcementTargets: [],
    attacks: [],
    conquestMoves: [],
    fortify: null,
    endedTurn: false
  };

  let steps = 0;
  while (steps < 64) {
    steps += 1;

    if (state.winnerId || state.phase !== "active") {
      report.endedTurn = true;
      return report;
    }

    const current = getCurrentPlayer(state);
    if (!current || current.id !== player.id) {
      report.endedTurn = true;
      return report;
    }

    if (state.pendingConquest) {
      const pending = state.pendingConquest;
      const armiesToMove = chooseConquestMove(state, player.id || "", pending);
      const move = moveAfterConquest(state, player.id || "", armiesToMove);
      if (!move.ok) {
        return { ok: false, error: move.message, report };
      }
      report.conquestMoves.push({ fromId: pending.fromId, toId: pending.toId, armies: armiesToMove });
      continue;
    }

    if (state.turnPhase === TurnPhase.REINFORCEMENT && player.id && playerMustTradeCards(state, player.id)) {
      const cardIds = chooseTradeSet(state, player.id);
      if (!cardIds) {
        return { ok: false, error: "AI senza un set di carte valido da scambiare.", report };
      }

      const trade = tradeCardSet(state, player.id, cardIds);
      if (!trade.ok) {
        return { ok: false, error: trade.message, report };
      }

      report.tradedCardSets.push(cardIds);
      continue;
    }

    if (state.reinforcementPool > 0 || state.turnPhase === TurnPhase.REINFORCEMENT) {
      const territoryId = chooseReinforcementTarget(state, player.id || "");
      if (!territoryId || !player.id) {
        return { ok: false, error: "AI senza territorio valido per i rinforzi.", report };
      }

      const reinforcement = applyReinforcement(state, player.id, territoryId);
      if (!reinforcement.ok) {
        return { ok: false, error: reinforcement.message, report };
      }

      report.reinforcementTargets.push(territoryId);
      continue;
    }

    if (state.turnPhase === TurnPhase.ATTACK) {
      const attack = chooseAttack(state, player.id || "");
      if (attack && player.id) {
        const result = resolveAttack(state, player.id, attack.fromId, attack.toId, random);
        if (!result.ok) {
          return { ok: false, error: result.message, report };
        }
        report.attacks.push(attack);
        continue;
      }

      const toFortify = endTurn(state, player.id || "");
      if (!toFortify.ok) {
        return { ok: false, error: toFortify.message, report };
      }
      continue;
    }

    if (state.turnPhase === TurnPhase.FORTIFY) {
      const fortify = chooseFortify(state, player.id || "");
      if (fortify && player.id) {
        const result = applyFortify(state, player.id, fortify.fromId, fortify.toId, fortify.armies);
        if (!result.ok) {
          return { ok: false, error: result.message, report };
        }
        report.fortify = fortify;
      }

      const finished = endTurn(state, player.id || "");
      if (!finished.ok) {
        return { ok: false, error: finished.message, report };
      }

      report.endedTurn = true;
      return report;
    }

    const fallback = endTurn(state, player.id || "");
    if (!fallback.ok) {
      return { ok: false, error: fallback.message, report };
    }
  }

  return { ok: false, error: "AI interrompibile: troppi passaggi nel turno.", report };
}
