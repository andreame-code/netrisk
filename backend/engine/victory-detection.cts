import {
  DEFAULT_VICTORY_RULE_SET_ID,
  MAJORITY_CONTROL_VICTORY_RULE_SET_ID,
  TurnPhase,
  createLocalizedError,
  findVictoryRuleSet,
  getVictoryRuleSet,
  migrateGameStateExtensions,
  type GameState,
  type Player,
  type VictoryRuleSet
} from "../../shared/models.cjs";
const { authoredVictoryModuleRuntimeSchema } = require("../../shared/runtime-validation.cjs");

export interface VictoryResult {
  ok: true;
  code: string;
  message: string;
  messageKey: string;
  messageParams: Record<string, unknown>;
  details: {
    activePlayerIds: Array<string | null>;
    activePlayerCount: number;
    activeHumanPlayerIds?: Array<string | null>;
    activeHumanPlayerCount?: number;
  };
  victory: {
    winnerId: string | null;
    winnerName: string;
    phase: string;
    turnPhase: string;
    summary: string;
    summaryKey: string;
    summaryParams: Record<string, unknown>;
  } | null;
}

interface ActiveVictoryContext {
  state: GameState;
  victoryRuleSet: VictoryRuleSet;
  activePlayers: Player[];
  majorityControlThresholdPercent: number;
  authoredVictoryModule: null | {
    id: string;
    name: string;
    description: string;
    version: string;
    moduleType: "victory-objectives";
    kind: "authored-victory-objectives";
    map: {
      id: string;
      name: string;
      territoryCount: number;
      continentCount: number;
    };
    objectives: Array<
      | {
          id: string;
          title: string;
          description: string;
          enabled: boolean;
          type: "control-continents";
          continentIds: string[];
          continentNames: string[];
          summary: string;
        }
      | {
          id: string;
          title: string;
          description: string;
          enabled: boolean;
          type: "control-territory-count";
          territoryCount: number;
          summary: string;
        }
    >;
    preview: {
      summary: string;
      objectiveSummaries: string[];
    };
  };
}

function territoryCountByPlayer(state: GameState, playerId: string | null): number {
  return Object.keys(state.territories).reduce((total, territoryId) => {
    const territory = state.territories[territoryId];
    return total + (territory && territory.ownerId === playerId ? 1 : 0);
  }, 0);
}

function isActivePlayer(state: GameState, player: Player): boolean {
  return Boolean(player && !player.surrendered && territoryCountByPlayer(state, player.id) > 0);
}

function isActiveHumanPlayer(player: Player): boolean {
  return Boolean(player && !player.isAi);
}

function validateState(state: GameState): void {
  if (!state || typeof state !== "object") {
    throw createLocalizedError(
      "Victory detection requires a valid game state.",
      "game.victory.internal.invalidState"
    );
  }

  if (!Array.isArray(state.players) || state.players.length === 0) {
    throw createLocalizedError(
      "Victory detection requires at least one player.",
      "game.victory.internal.noPlayers"
    );
  }

  if (!state.territories || typeof state.territories !== "object") {
    throw createLocalizedError(
      "Victory detection requires territory ownership data.",
      "game.victory.internal.missingTerritories"
    );
  }

  const playerIds = new Set<string>();
  state.players.forEach((player, index) => {
    if (!player || !player.id) {
      throw createLocalizedError(
        `Victory detection found an invalid player at index ${index}.`,
        "game.victory.internal.invalidPlayer",
        { index }
      );
    }

    if (playerIds.has(player.id)) {
      throw createLocalizedError(
        `Victory detection found duplicate player id "${player.id}".`,
        "game.victory.internal.duplicatePlayer",
        { playerId: player.id }
      );
    }

    playerIds.add(player.id);
  });
}

function noVictoryResult(activePlayers: Player[]): VictoryResult {
  return {
    ok: true,
    code: "NO_VICTORY",
    message: "Victory has not been determined yet.",
    messageKey: "game.victory.pending",
    messageParams: {},
    details: {
      activePlayerIds: activePlayers.map((player) => player.id),
      activePlayerCount: activePlayers.length
    },
    victory: null
  };
}

function aiOnlyRemainResult(state: GameState, activePlayers: Player[]): VictoryResult {
  state.winnerId = null;
  state.phase = "finished";
  state.turnPhase = TurnPhase.FINISHED;

  return {
    ok: true,
    code: "AI_ONLY_REMAIN",
    message: "Game closed because only AI players remain active.",
    messageKey: "game.victory.aiOnlyRemain",
    messageParams: {},
    details: {
      activePlayerIds: activePlayers.map((player) => player.id),
      activePlayerCount: activePlayers.length,
      activeHumanPlayerIds: [],
      activeHumanPlayerCount: 0
    },
    victory: null
  };
}

function declareVictory(
  state: GameState,
  winner: Player,
  victoryRuleSet: ReturnType<typeof getVictoryRuleSet>,
  options: {
    summary: string;
    summaryKey: string;
    summaryParams: Record<string, unknown>;
  }
): VictoryResult {
  const activePlayers = state.players.filter((player) => isActivePlayer(state, player));
  const activeHumanPlayers = activePlayers.filter((player) => isActiveHumanPlayer(player));

  state.winnerId = winner.id;
  state.phase = "finished";
  state.turnPhase = TurnPhase.FINISHED;

  return {
    ok: true,
    code: "VICTORY_DECLARED",
    message: "Victory declared.",
    messageKey: "game.victory.declared",
    messageParams: { playerName: winner.name },
    details: {
      activePlayerIds: activePlayers.map((player) => player.id),
      activePlayerCount: activePlayers.length,
      activeHumanPlayerIds: activeHumanPlayers.map((player) => player.id),
      activeHumanPlayerCount: activeHumanPlayers.length
    },
    victory: {
      winnerId: winner.id,
      winnerName: winner.name,
      phase: state.phase,
      turnPhase: state.turnPhase,
      summary: options.summary,
      summaryKey: options.summaryKey,
      summaryParams: {
        ...options.summaryParams,
        playerName: winner.name,
        victoryRuleSet: victoryRuleSet.name
      }
    }
  };
}

function evaluateConquestVictory(context: ActiveVictoryContext): VictoryResult {
  if (context.activePlayers.length > 1) {
    return noVictoryResult(context.activePlayers);
  }

  const winner = context.activePlayers[0] as Player;
  return declareVictory(context.state, winner, context.victoryRuleSet, {
    summary: winner.name + " conquers the map and wins the game.",
    summaryKey: "game.log.victoryDeclared",
    summaryParams: {}
  });
}

function evaluateMajorityControlVictory(context: ActiveVictoryContext): VictoryResult {
  const totalTerritories = Object.keys(context.state.territories || {}).length;
  const requiredTerritoryCount = Math.max(
    1,
    Math.ceil(totalTerritories * (context.majorityControlThresholdPercent / 100))
  );
  const leadingPlayer =
    context.activePlayers
      .map((player) => ({
        player,
        territoryCount: territoryCountByPlayer(context.state, player.id)
      }))
      .sort((left, right) => right.territoryCount - left.territoryCount)[0] || null;

  if (!leadingPlayer || leadingPlayer.territoryCount < requiredTerritoryCount) {
    return noVictoryResult(context.activePlayers);
  }

  return declareVictory(context.state, leadingPlayer.player, context.victoryRuleSet, {
    summary: leadingPlayer.player.name + " secures majority control and wins the game.",
    summaryKey: "game.log.victoryMajorityControl",
    summaryParams: {
      territoryCount: leadingPlayer.territoryCount,
      totalTerritories,
      majorityControlThresholdPercent: context.majorityControlThresholdPercent,
      requiredTerritoryCount
    }
  });
}

function resolveMajorityControlThresholdPercent(state: GameState): number {
  const rawThreshold = state.gameConfig?.gameplayEffects?.majorityControlThresholdPercent;
  if (
    typeof rawThreshold === "number" &&
    Number.isInteger(rawThreshold) &&
    rawThreshold >= 50 &&
    rawThreshold <= 100
  ) {
    return rawThreshold;
  }

  return 70;
}

function resolveAuthoredVictoryModule(
  state: GameState,
  victoryRuleSetId: string
): ActiveVictoryContext["authoredVictoryModule"] {
  const parsed = authoredVictoryModuleRuntimeSchema.safeParse(
    state.gameConfig?.victoryObjectiveModule
  );
  if (!parsed.success) {
    return null;
  }

  if (parsed.data.id !== victoryRuleSetId) {
    return null;
  }

  return parsed.data;
}

function orderedActivePlayers(state: GameState, activePlayers: Player[]): Player[] {
  if (
    !Number.isInteger(state.currentTurnIndex) ||
    Number(state.currentTurnIndex) < 0 ||
    Number(state.currentTurnIndex) >= state.players.length
  ) {
    return activePlayers;
  }

  const currentPlayerId = state.players[Number(state.currentTurnIndex)]?.id || null;
  if (!currentPlayerId) {
    return activePlayers;
  }

  return [...activePlayers].sort((left, right) => {
    if (left.id === currentPlayerId) {
      return -1;
    }

    if (right.id === currentPlayerId) {
      return 1;
    }

    return 0;
  });
}

function playerControlsContinent(
  state: GameState,
  playerId: string | null,
  continentId: string
): boolean {
  if (!playerId || !Array.isArray(state.continents)) {
    return false;
  }

  const continent = state.continents.find((entry) => entry?.id === continentId) || null;
  if (!continent || !Array.isArray(continent.territoryIds) || continent.territoryIds.length === 0) {
    return false;
  }

  return continent.territoryIds.every(
    (territoryId) => state.territories?.[territoryId]?.ownerId === playerId
  );
}

function evaluateAuthoredObjectiveForPlayer(
  state: GameState,
  player: Player,
  objective: NonNullable<ActiveVictoryContext["authoredVictoryModule"]>["objectives"][number]
): boolean {
  if (!objective.enabled) {
    return false;
  }

  if (objective.type === "control-continents") {
    return objective.continentIds.every((continentId) =>
      playerControlsContinent(state, player.id, continentId)
    );
  }

  return territoryCountByPlayer(state, player.id) >= objective.territoryCount;
}

function evaluateAuthoredVictoryObjectives(context: ActiveVictoryContext): VictoryResult {
  if (!context.authoredVictoryModule) {
    return noVictoryResult(context.activePlayers);
  }

  const orderedPlayers = orderedActivePlayers(context.state, context.activePlayers);

  for (const player of orderedPlayers) {
    const matchedObjective =
      context.authoredVictoryModule.objectives.find((objective) =>
        evaluateAuthoredObjectiveForPlayer(context.state, player, objective)
      ) || null;

    if (!matchedObjective) {
      continue;
    }

    return declareVictory(context.state, player, context.victoryRuleSet, {
      summary:
        player.name + ` completes the objective "${matchedObjective.title}" and wins the game.`,
      summaryKey: "game.log.victoryAuthoredObjective",
      summaryParams: {
        objectiveId: matchedObjective.id,
        objectiveTitle: matchedObjective.title,
        objectiveType: matchedObjective.type,
        objectiveSummary: matchedObjective.summary,
        victoryModuleId: context.authoredVictoryModule.id
      }
    });
  }

  return noVictoryResult(context.activePlayers);
}

const victoryEvaluators: Record<string, (context: ActiveVictoryContext) => VictoryResult> = {
  [DEFAULT_VICTORY_RULE_SET_ID]: evaluateConquestVictory,
  [MAJORITY_CONTROL_VICTORY_RULE_SET_ID]: evaluateMajorityControlVictory
};

export function detectVictory(state: GameState): VictoryResult {
  migrateGameStateExtensions(state);
  validateState(state);
  const victoryRuleSetId = state.gameConfig?.victoryRuleSetId || DEFAULT_VICTORY_RULE_SET_ID;
  const authoredVictoryModule = resolveAuthoredVictoryModule(state, victoryRuleSetId);
  const builtInVictoryRuleSet = findVictoryRuleSet(victoryRuleSetId);
  const victoryRuleSet: VictoryRuleSet = authoredVictoryModule
    ? {
        id: authoredVictoryModule.id,
        name: authoredVictoryModule.name,
        description: authoredVictoryModule.description,
        source: "authored",
        mapId: authoredVictoryModule.map.id,
        objectiveCount: authoredVictoryModule.objectives.filter((objective) => objective.enabled)
          .length,
        moduleType: authoredVictoryModule.moduleType
      }
    : getVictoryRuleSet(victoryRuleSetId);
  const majorityControlThresholdPercent = resolveMajorityControlThresholdPercent(state);

  if (!authoredVictoryModule && !builtInVictoryRuleSet && state.gameConfig?.victoryRuleSetId) {
    throw createLocalizedError(
      `Victory detection found unsupported rule set "${victoryRuleSetId}".`,
      "game.victory.internal.invalidRuleSet",
      { victoryRuleSetId }
    );
  }

  const activePlayers = state.players.filter((player) => isActivePlayer(state, player));
  if (activePlayers.length === 0) {
    throw createLocalizedError(
      "Victory detection found no active players with territories.",
      "game.victory.internal.noActivePlayers"
    );
  }

  const activeHumanPlayers = activePlayers.filter((player) => isActiveHumanPlayer(player));
  if (activeHumanPlayers.length === 0) {
    return aiOnlyRemainResult(state, activePlayers);
  }

  if (authoredVictoryModule) {
    return evaluateAuthoredVictoryObjectives({
      state,
      victoryRuleSet,
      activePlayers,
      majorityControlThresholdPercent,
      authoredVictoryModule
    });
  }

  const evaluateVictory = victoryEvaluators[victoryRuleSet.id] || evaluateConquestVictory;
  return evaluateVictory({
    state,
    victoryRuleSet,
    activePlayers,
    majorityControlThresholdPercent,
    authoredVictoryModule: null
  });
}
