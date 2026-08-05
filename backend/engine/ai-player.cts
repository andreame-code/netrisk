const { secureRandom } = require("../random.cjs");
import {
  TurnPhase,
  normalizeAiDifficulty,
  validateStandardCardSet,
  type AiDifficulty,
  type AiGameMetrics,
  type Card,
  type GameState,
  type Territory
} from "../../shared/models.cjs";

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
  aiDifficulty?: AiDifficulty | null;
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

interface GameplayEffectsLike {
  fortifyMinimumArmies?: number | null;
  requiredFortifyWhenAvailable?: boolean | null;
  attackMinimumArmies?: number | null;
  attackLimitPerTurn?: number | null;
  minimumAttacksPerTurn?: number | null;
}

interface AiTurnReport {
  ok: true;
  playerId: string | null;
  difficulty: AiDifficulty;
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
  aiMetrics?: AiGameMetrics | null;
};

type StrategyOptions = {
  difficulty?: AiDifficulty;
  random?: () => number;
};

function resolveAiDifficulty(state: EngineState, playerId: string): AiDifficulty {
  const player = state.players.find((entry) => entry.id === playerId);
  return normalizeAiDifficulty(player?.aiDifficulty);
}

function strategyNoise(options: StrategyOptions, amplitude: number): number {
  if (typeof options.random !== "function" || options.difficulty === "medium") {
    return 0;
  }
  return Math.round((options.random() - 0.5) * amplitude);
}

function continentPressureBonus(
  state: EngineState,
  playerId: string,
  targetTerritoryId: string
): number {
  const continent = state.continents.find((entry) =>
    entry.territoryIds.includes(targetTerritoryId)
  );
  const targetOwnerId = state.territories[targetTerritoryId]?.ownerId || null;
  if (!continent || !targetOwnerId) {
    return 0;
  }

  const otherTerritoryIds = continent.territoryIds.filter(
    (territoryId) => territoryId !== targetTerritoryId
  );
  const completesContinent = otherTerritoryIds.every(
    (territoryId) => state.territories[territoryId]?.ownerId === playerId
  );
  const blocksOpponent = otherTerritoryIds.every(
    (territoryId) => state.territories[territoryId]?.ownerId === targetOwnerId
  );

  return (
    (completesContinent ? 35 + continent.bonus * 3 : 0) +
    (blocksOpponent ? 45 + continent.bonus * 3 : 0)
  );
}

function resolveFortifyMinimumArmies(state: EngineState, maxMove: number): number {
  const moduleMinimum =
    state.gameConfig?.gameplayEffects && typeof state.gameConfig.gameplayEffects === "object"
      ? (state.gameConfig.gameplayEffects as GameplayEffectsLike).fortifyMinimumArmies
      : null;
  const desiredMinimum = Math.max(1, Number.isInteger(moduleMinimum) ? Number(moduleMinimum) : 1);
  return Math.max(1, Math.min(maxMove, desiredMinimum));
}

function resolveAttackMinimumArmies(state: EngineState): number {
  const moduleMinimum =
    state.gameConfig?.gameplayEffects && typeof state.gameConfig.gameplayEffects === "object"
      ? (state.gameConfig.gameplayEffects as GameplayEffectsLike).attackMinimumArmies
      : null;
  return Math.max(2, Number.isInteger(moduleMinimum) ? Number(moduleMinimum) : 2);
}

function resolveAttackLimitPerTurn(state: EngineState): number | null {
  const configuredLimit =
    state.gameConfig?.gameplayEffects && typeof state.gameConfig.gameplayEffects === "object"
      ? (state.gameConfig.gameplayEffects as GameplayEffectsLike).attackLimitPerTurn
      : null;
  return Number.isInteger(configuredLimit) ? Math.max(1, Number(configuredLimit)) : null;
}

function resolveMinimumAttacksPerTurn(state: EngineState): number | null {
  const configuredMinimum =
    state.gameConfig?.gameplayEffects && typeof state.gameConfig.gameplayEffects === "object"
      ? (state.gameConfig.gameplayEffects as GameplayEffectsLike).minimumAttacksPerTurn
      : null;
  return Number.isInteger(configuredMinimum) ? Math.max(1, Number(configuredMinimum)) : null;
}

function resolveRequiredFortifyWhenAvailable(state: EngineState): boolean {
  const configuredValue =
    state.gameConfig?.gameplayEffects && typeof state.gameConfig.gameplayEffects === "object"
      ? (state.gameConfig.gameplayEffects as GameplayEffectsLike).requiredFortifyWhenAvailable
      : null;
  return configuredValue === true;
}

type EngineModule = {
  applyFortify: (
    state: EngineState,
    playerId: string,
    fromId: string,
    toId: string,
    armies: number
  ) => ActionFailure | ActionSuccess;
  applyReinforcement: (
    state: EngineState,
    playerId: string,
    territoryId: string
  ) => ActionFailure | ActionSuccess;
  endTurn: (state: EngineState, playerId: string) => ActionFailure | ActionSuccess;
  getCurrentPlayer: (state: EngineState) => EnginePlayer | null;
  getMapTerritories: (state: EngineState) => Territory[];
  moveAfterConquest: (
    state: EngineState,
    playerId: string,
    armiesToMove: number | null
  ) => ActionFailure | ActionSuccess;
  playerMustTradeCards: (state: EngineState, playerId: string) => boolean;
  resolveAttack: (
    state: EngineState,
    playerId: string,
    fromId: string,
    toId: string,
    random?: () => number
  ) => ActionFailure | ActionSuccess;
  tradeCardSet: (
    state: EngineState,
    playerId: string,
    cardIds: string[]
  ) => ActionFailure | ActionSuccess;
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

function listEnemyNeighbors(
  state: EngineState,
  territoryId: string,
  playerId: string
): Array<{ territoryId: string; state: { ownerId: string | null; armies: number } }> {
  const territory = getMapTerritories(state).find((item) => item.id === territoryId);
  if (!territory) {
    return [];
  }

  return territory.neighbors
    .map((neighborId) => ({ territoryId: neighborId, state: state.territories[neighborId] }))
    .filter(
      (entry) => entry.state && entry.state.ownerId && entry.state.ownerId !== playerId
    ) as Array<{ territoryId: string; state: { ownerId: string | null; armies: number } }>;
}

export function chooseReinforcementTarget(
  state: EngineState,
  playerId: string,
  options: StrategyOptions = {}
): string | null {
  const owned = territoriesOwnedBy(state, playerId);
  if (!owned.length) {
    return null;
  }

  const difficulty = options.difficulty || resolveAiDifficulty(state, playerId);
  const ranked = owned
    .filter((territory): territory is Territory & { id: string } => Boolean(territory.id))
    .map((territory) => {
      const enemyNeighbors = listEnemyNeighbors(state, territory.id, playerId);
      const armies = state.territories[territory.id]?.armies || 0;
      const strongestEnemy = enemyNeighbors.reduce(
        (max, entry) => Math.max(max, entry.state.armies),
        0
      );
      const baselineScore = enemyNeighbors.length
        ? armies - strongestEnemy + enemyNeighbors.length * 2
        : -100 + armies;
      const score =
        baselineScore +
        (difficulty === "hard" ? Math.max(0, strongestEnemy - armies) * 8 : 0) +
        strategyNoise({ ...options, difficulty }, difficulty === "easy" ? 8 : 4);

      return {
        territoryId: territory.id,
        enemyNeighbors,
        score,
        armies
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.armies - left.armies ||
        left.territoryId.localeCompare(right.territoryId)
    );

  return ranked[0] ? ranked[0].territoryId : null;
}

export function chooseAttack(
  state: EngineState,
  playerId: string,
  options: StrategyOptions & { forceLegalAttack?: boolean } = {}
): AttackChoice | null {
  const candidates: AttackChoice[] = [];
  const difficulty = options.difficulty || resolveAiDifficulty(state, playerId);
  const minimumAdvantage = difficulty === "easy" ? 3 : difficulty === "hard" ? 0 : 2;
  const minimumAttackArmies = resolveAttackMinimumArmies(state);
  const attackLimitPerTurn = resolveAttackLimitPerTurn(state);
  const attacksThisTurn =
    typeof state.attacksThisTurn === "number" && Number.isInteger(state.attacksThisTurn)
      ? state.attacksThisTurn
      : 0;
  if (attackLimitPerTurn !== null && attacksThisTurn >= attackLimitPerTurn) {
    return null;
  }

  territoriesOwnedBy(state, playerId)
    .filter((territory): territory is Territory & { id: string } => Boolean(territory.id))
    .forEach((territory) => {
      const fromState = state.territories[territory.id];
      if (!fromState || fromState.armies < minimumAttackArmies) {
        return;
      }

      listEnemyNeighbors(state, territory.id, playerId).forEach((neighbor) => {
        const advantage = fromState.armies - neighbor.state.armies;
        if (!options.forceLegalAttack && advantage < minimumAdvantage) {
          return;
        }

        const strategicBonus =
          difficulty === "hard" ? continentPressureBonus(state, playerId, neighbor.territoryId) : 0;
        candidates.push({
          fromId: territory.id,
          toId: neighbor.territoryId,
          score:
            advantage * 10 -
            neighbor.state.armies +
            strategicBonus +
            strategyNoise({ ...options, difficulty }, difficulty === "easy" ? 10 : 6)
        });
      });
    });

  candidates.sort(
    (left, right) =>
      right.score - left.score ||
      left.fromId.localeCompare(right.fromId) ||
      left.toId.localeCompare(right.toId)
  );
  if (
    difficulty === "easy" &&
    !options.forceLegalAttack &&
    candidates.length > 0 &&
    typeof options.random === "function" &&
    options.random() < 0.35
  ) {
    return null;
  }
  return candidates[0] || null;
}

export function chooseConquestMove(
  state: EngineState,
  playerId: string,
  pending: PendingConquest | null | undefined,
  options: StrategyOptions = {}
): number | null {
  if (!pending) {
    return null;
  }

  const capturedEnemyNeighbors = listEnemyNeighbors(state, pending.toId, playerId).length;
  if (!capturedEnemyNeighbors) {
    return pending.minArmies;
  }

  const difficulty = options.difficulty || resolveAiDifficulty(state, playerId);
  if (difficulty === "easy") {
    return pending.minArmies;
  }
  if (difficulty === "hard") {
    return Math.max(
      pending.minArmies,
      Math.min(pending.maxArmies, Math.ceil(pending.maxArmies * 0.7))
    );
  }

  return Math.max(pending.minArmies, Math.min(pending.maxArmies, 2));
}

export function chooseFortify(
  state: EngineState,
  playerId: string,
  options: StrategyOptions & { forceLegalMove?: boolean } = {}
): FortifyChoice | null {
  const owned = territoriesOwnedBy(state, playerId);
  const difficulty = options.difficulty || resolveAiDifficulty(state, playerId);
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
        if (!options.forceLegalMove && !borderIds.has(neighborId)) {
          return;
        }

        const neighborState = state.territories[neighborId];
        if (!neighborState || neighborState.ownerId !== playerId) {
          return;
        }

        const sourceIsBorder = borderIds.has(territory.id);
        if (!options.forceLegalMove && sourceIsBorder) {
          return;
        }

        const targetEnemyNeighbors = listEnemyNeighbors(state, neighborId, playerId).length;
        const movableArmies = fromState.armies - 1;
        const minimumArmies = resolveFortifyMinimumArmies(state, movableArmies);
        if (movableArmies < minimumArmies) {
          return;
        }

        const armies =
          difficulty === "hard"
            ? Math.min(movableArmies, Math.max(minimumArmies, Math.ceil(movableArmies * 0.7)))
            : difficulty === "easy"
              ? minimumArmies
              : Math.min(movableArmies, Math.max(minimumArmies, 2));
        const score =
          8 +
          targetEnemyNeighbors * 4 +
          (fromState.armies - neighborState.armies) +
          (difficulty === "hard" ? targetEnemyNeighbors * 4 : 0) +
          strategyNoise({ ...options, difficulty }, difficulty === "easy" ? 8 : 4);
        if (!options.forceLegalMove && score < 3) {
          return;
        }

        candidates.push({ fromId: territory.id, toId: neighborId, armies, score });
      });
    });

  candidates.sort(
    (left, right) =>
      right.score - left.score ||
      right.armies - left.armies ||
      left.fromId.localeCompare(right.fromId) ||
      left.toId.localeCompare(right.toId)
  );
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

function shouldTradeVoluntarily(
  state: EngineState,
  playerId: string,
  difficulty: AiDifficulty
): boolean {
  return difficulty === "hard" && Boolean(chooseTradeSet(state, playerId));
}

function completeAiTurn(
  state: EngineState,
  player: EnginePlayer,
  report: AiTurnReport
): AiTurnReport {
  if (!player.id) {
    return report;
  }

  const metrics: AiGameMetrics =
    state.aiMetrics && state.aiMetrics.schemaVersion === 1 && state.aiMetrics.players
      ? state.aiMetrics
      : {
          schemaVersion: 1,
          humanPlayerCount: 0,
          aiPlayerCount: 0,
          players: {}
        };
  metrics.humanPlayerCount = state.players.filter((entry) => !entry.isAi).length;
  metrics.aiPlayerCount = state.players.filter((entry) => entry.isAi).length;

  const playerMetrics = metrics.players[player.id] || {
    difficulty: report.difficulty,
    turns: 0,
    reinforcementsPlaced: 0,
    attacks: 0,
    territoriesConquered: 0,
    cardSetsTraded: 0,
    fortifications: 0
  };
  playerMetrics.difficulty = report.difficulty;
  playerMetrics.turns += 1;
  playerMetrics.reinforcementsPlaced += report.reinforcementTargets.length;
  playerMetrics.attacks += report.attacks.length;
  playerMetrics.territoriesConquered += report.conquestMoves.length;
  playerMetrics.cardSetsTraded += report.tradedCardSets.length;
  playerMetrics.fortifications += report.fortify ? 1 : 0;
  metrics.players[player.id] = playerMetrics;
  state.aiMetrics = metrics;
  return report;
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

  const difficulty = normalizeAiDifficulty(player.aiDifficulty);

  const report: AiTurnReport = {
    ok: true,
    playerId: player.id,
    difficulty,
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
      return completeAiTurn(state, player, report);
    }

    const current = getCurrentPlayer(state);
    if (!current || current.id !== player.id) {
      report.endedTurn = true;
      return completeAiTurn(state, player, report);
    }

    if (state.pendingConquest) {
      const pending = state.pendingConquest;
      const armiesToMove = chooseConquestMove(state, player.id || "", pending, { difficulty });
      const move = moveAfterConquest(state, player.id || "", armiesToMove);
      if (!move.ok) {
        return { ok: false, error: move.message, report };
      }
      report.conquestMoves.push({
        fromId: pending.fromId,
        toId: pending.toId,
        armies: armiesToMove
      });
      continue;
    }

    if (
      state.turnPhase === TurnPhase.REINFORCEMENT &&
      player.id &&
      (playerMustTradeCards(state, player.id) ||
        shouldTradeVoluntarily(state, player.id, difficulty))
    ) {
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
      const territoryId = chooseReinforcementTarget(state, player.id || "", {
        difficulty,
        random
      });
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
      const minimumAttacksPerTurn = resolveMinimumAttacksPerTurn(state);
      const attacksThisTurn =
        typeof state.attacksThisTurn === "number" && Number.isInteger(state.attacksThisTurn)
          ? state.attacksThisTurn
          : 0;
      const attack = chooseAttack(state, player.id || "", {
        forceLegalAttack: minimumAttacksPerTurn !== null && attacksThisTurn < minimumAttacksPerTurn,
        difficulty,
        random
      });
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
      const fortify = chooseFortify(state, player.id || "", {
        forceLegalMove: resolveRequiredFortifyWhenAvailable(state),
        difficulty,
        random
      });
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
      return completeAiTurn(state, player, report);
    }

    const fallback = endTurn(state, player.id || "");
    if (!fallback.ok) {
      return { ok: false, error: fallback.message, report };
    }
  }

  return { ok: false, error: "AI interrompibile: troppi passaggi nel turno.", report };
}
