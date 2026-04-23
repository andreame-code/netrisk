const assert = require("node:assert/strict");
const { detectVictory } = require("../../../backend/engine/victory-detection.cjs");
const { MAJORITY_CONTROL_VICTORY_RULE_SET_ID } = require("../../../shared/models.cjs");
const {
  makeContinent,
  makePlayers,
  makeState,
  territoryStates,
  TurnPhase
} = require("../helpers/state-builder.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("detectVictory declares victory when only one active player remains", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p1", armies: 1 }
    ]),
    turnPhase: TurnPhase.ATTACK
  });

  const result = detectVictory(state);
  assert.equal(result.ok, true);
  assert.equal(result.code, "VICTORY_DECLARED");
  assert.equal(result.victory.winnerId, "p1");
  assert.equal(state.winnerId, "p1");
  assert.equal(state.phase, "finished");
  assert.equal(state.turnPhase, TurnPhase.FINISHED);
});

register("detectVictory returns no victory while multiple active players remain", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p2", armies: 1 }
    ]),
    turnPhase: TurnPhase.ATTACK
  });

  const result = detectVictory(state);
  assert.equal(result.ok, true);
  assert.equal(result.code, "NO_VICTORY");
  assert.equal(result.victory, null);
  assert.equal(state.winnerId, null);
});

register("detectVictory throws for impossible states with no active players", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: null, armies: 0 },
      { id: "b", ownerId: null, armies: 0 }
    ])
  });

  assert.throws(() => detectVictory(state), /no active players/i);
});

register("detectVictory ignores surrendered players even if they still own territories", () => {
  const players = makePlayers(["Alice", "Bob"]);
  players[1].surrendered = true;
  const state = makeState({
    players,
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p2", armies: 1 }
    ]),
    turnPhase: TurnPhase.ATTACK
  });

  const result = detectVictory(state);
  assert.equal(result.code, "VICTORY_DECLARED");
  assert.equal(result.victory.winnerId, "p1");
});

register("detectVictory closes the game when only AI players remain active", () => {
  const players = makePlayers(["Alice", "Bot Alpha", "Bot Beta"]);
  players[1].isAi = true;
  players[2].isAi = true;
  players[0].surrendered = true;
  const state = makeState({
    players,
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p2", armies: 1 },
      { id: "c", ownerId: "p3", armies: 1 }
    ]),
    turnPhase: TurnPhase.ATTACK
  });

  const result = detectVictory(state);
  assert.equal(result.code, "AI_ONLY_REMAIN");
  assert.equal(result.victory, null);
  assert.equal(state.winnerId, null);
  assert.equal(state.phase, "finished");
  assert.equal(state.turnPhase, TurnPhase.FINISHED);
});

register(
  "detectVictory majority control declares victory when a player reaches 70 percent of territories",
  () => {
    const state = makeState({
      players: makePlayers(["Alice", "Bob"]),
      territories: territoryStates([
        { id: "a", ownerId: "p1", armies: 1 },
        { id: "b", ownerId: "p1", armies: 1 },
        { id: "c", ownerId: "p1", armies: 1 },
        { id: "d", ownerId: "p1", armies: 1 },
        { id: "e", ownerId: "p1", armies: 1 },
        { id: "f", ownerId: "p1", armies: 1 },
        { id: "g", ownerId: "p1", armies: 1 },
        { id: "h", ownerId: "p2", armies: 1 },
        { id: "i", ownerId: "p2", armies: 1 },
        { id: "j", ownerId: "p2", armies: 1 }
      ]),
      turnPhase: TurnPhase.ATTACK
    });
    state.gameConfig = {
      ...(state.gameConfig || {}),
      victoryRuleSetId: MAJORITY_CONTROL_VICTORY_RULE_SET_ID
    };

    const result = detectVictory(state);

    assert.equal(result.code, "VICTORY_DECLARED");
    assert.equal(result.victory?.winnerId, "p1");
    assert.equal(result.victory?.summaryKey, "game.log.victoryMajorityControl");
    assert.equal(result.victory?.summaryParams?.requiredTerritoryCount, 7);
    assert.equal(state.phase, "finished");
  }
);

register("detectVictory majority control keeps the match active below the threshold", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p1", armies: 1 },
      { id: "c", ownerId: "p1", armies: 1 },
      { id: "d", ownerId: "p1", armies: 1 },
      { id: "e", ownerId: "p1", armies: 1 },
      { id: "f", ownerId: "p1", armies: 1 },
      { id: "g", ownerId: "p2", armies: 1 },
      { id: "h", ownerId: "p2", armies: 1 },
      { id: "i", ownerId: "p2", armies: 1 },
      { id: "j", ownerId: "p2", armies: 1 }
    ]),
    turnPhase: TurnPhase.ATTACK
  });
  state.gameConfig = {
    ...(state.gameConfig || {}),
    victoryRuleSetId: MAJORITY_CONTROL_VICTORY_RULE_SET_ID
  };

  const result = detectVictory(state);

  assert.equal(result.code, "NO_VICTORY");
  assert.equal(result.victory, null);
  assert.equal(state.phase, "active");
  assert.equal(state.winnerId, null);
});

register("detectVictory majority control usa la soglia modulare persistita nel gameConfig", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p1", armies: 1 },
      { id: "c", ownerId: "p1", armies: 1 },
      { id: "d", ownerId: "p1", armies: 1 },
      { id: "e", ownerId: "p1", armies: 1 },
      { id: "f", ownerId: "p1", armies: 1 },
      { id: "g", ownerId: "p2", armies: 1 },
      { id: "h", ownerId: "p2", armies: 1 },
      { id: "i", ownerId: "p2", armies: 1 },
      { id: "j", ownerId: "p2", armies: 1 }
    ]),
    turnPhase: TurnPhase.ATTACK
  });
  state.gameConfig = {
    ...(state.gameConfig || {}),
    victoryRuleSetId: MAJORITY_CONTROL_VICTORY_RULE_SET_ID,
    gameplayEffects: {
      majorityControlThresholdPercent: 60
    }
  };

  const result = detectVictory(state);

  assert.equal(result.code, "VICTORY_DECLARED");
  assert.equal(result.victory?.winnerId, "p1");
  assert.equal(result.victory?.summaryParams?.majorityControlThresholdPercent, 60);
  assert.equal(result.victory?.summaryParams?.requiredTerritoryCount, 6);
});

register(
  "detectVictory resolves authored continent objectives from the persisted gameConfig",
  () => {
    const state = makeState({
      players: makePlayers(["Alice", "Bob"]),
      territories: territoryStates([
        { id: "alaska", ownerId: "p1", armies: 1 },
        { id: "ontario", ownerId: "p1", armies: 1 },
        { id: "india", ownerId: "p1", armies: 1 },
        { id: "china", ownerId: "p1", armies: 1 },
        { id: "brazil", ownerId: "p2", armies: 1 }
      ]),
      continents: [
        makeContinent("north_america", ["alaska", "ontario"], 5, {
          name: "North America"
        }),
        makeContinent("asia", ["india", "china"], 7, {
          name: "Asia"
        }),
        makeContinent("south_america", ["brazil"], 2, {
          name: "South America"
        })
      ],
      currentTurnIndex: 0,
      turnPhase: TurnPhase.ATTACK
    });
    state.gameConfig = {
      ...(state.gameConfig || {}),
      victoryRuleSetId: "victory.na-asia",
      victoryObjectiveModule: {
        id: "victory.na-asia",
        name: "North America and Asia",
        description: "Control both continents simultaneously.",
        version: "1.0.0",
        moduleType: "victory-objectives",
        kind: "authored-victory-objectives",
        map: {
          id: "classic-mini",
          name: "Classic Mini",
          territoryCount: 5,
          continentCount: 3
        },
        objectives: [
          {
            id: "hold-na-asia",
            title: "Hold North America and Asia",
            description: "Control North America and Asia at the same time.",
            enabled: true,
            type: "control-continents",
            continentIds: ["north_america", "asia"],
            continentNames: ["North America", "Asia"],
            summary: "Control North America and Asia simultaneously."
          }
        ],
        preview: {
          summary: "Win condition: control North America and Asia simultaneously.",
          objectiveSummaries: ["Control North America and Asia simultaneously."]
        }
      }
    };

    const result = detectVictory(state);

    assert.equal(result.code, "VICTORY_DECLARED");
    assert.equal(result.victory?.winnerId, "p1");
    assert.equal(result.victory?.summaryKey, "game.log.victoryAuthoredObjective");
    assert.equal(result.victory?.summaryParams?.objectiveId, "hold-na-asia");
    assert.equal(result.victory?.summaryParams?.victoryModuleId, "victory.na-asia");
  }
);

register(
  "detectVictory resolves authored territory-count objectives from the persisted gameConfig",
  () => {
    const state = makeState({
      players: makePlayers(["Alice", "Bob"]),
      territories: territoryStates([
        { id: "a", ownerId: "p1", armies: 1 },
        { id: "b", ownerId: "p1", armies: 1 },
        { id: "c", ownerId: "p1", armies: 1 },
        { id: "d", ownerId: "p1", armies: 1 },
        { id: "e", ownerId: "p2", armies: 1 }
      ]),
      currentTurnIndex: 0,
      turnPhase: TurnPhase.ATTACK
    });
    state.gameConfig = {
      ...(state.gameConfig || {}),
      victoryRuleSetId: "victory.territory-count",
      victoryObjectiveModule: {
        id: "victory.territory-count",
        name: "Territory Control",
        description: "Reach the configured number of territories.",
        version: "1.0.0",
        moduleType: "victory-objectives",
        kind: "authored-victory-objectives",
        map: {
          id: "classic-mini",
          name: "Classic Mini",
          territoryCount: 5,
          continentCount: 0
        },
        objectives: [
          {
            id: "hold-four",
            title: "Own four territories",
            description: "Reach four territories.",
            enabled: true,
            type: "control-territory-count",
            territoryCount: 4,
            summary: "Own at least 4 territories."
          }
        ],
        preview: {
          summary: "Win condition: own at least 4 territories.",
          objectiveSummaries: ["Own at least 4 territories."]
        }
      }
    };

    const result = detectVictory(state);

    assert.equal(result.code, "VICTORY_DECLARED");
    assert.equal(result.victory?.winnerId, "p1");
    assert.equal(result.victory?.summaryParams?.objectiveType, "control-territory-count");
    assert.equal(result.victory?.summaryParams?.objectiveTitle, "Own four territories");
  }
);

register("detectVictory only resolves the authored objective assigned to the player", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p1", armies: 1 },
      { id: "c", ownerId: "p1", armies: 1 },
      { id: "d", ownerId: "p1", armies: 1 },
      { id: "e", ownerId: "p2", armies: 1 }
    ]),
    currentTurnIndex: 0,
    turnPhase: TurnPhase.ATTACK
  });
  state.gameConfig = {
    ...(state.gameConfig || {}),
    victoryRuleSetId: "victory.mixed",
    victoryObjectiveAssignments: {
      p1: "hold-continent"
    },
    victoryObjectiveModule: {
      id: "victory.mixed",
      name: "Mixed objectives",
      description: "Different objectives for each player.",
      version: "1.0.0",
      moduleType: "victory-objectives",
      kind: "authored-victory-objectives",
      map: {
        id: "classic-mini",
        name: "Classic Mini",
        territoryCount: 5,
        continentCount: 1
      },
      objectives: [
        {
          id: "hold-continent",
          title: "Hold the continent",
          description: "Control the target continent.",
          enabled: true,
          type: "control-continents",
          continentIds: ["north"],
          continentNames: ["North"],
          summary: "Control North."
        },
        {
          id: "hold-four",
          title: "Own four territories",
          description: "Reach four territories.",
          enabled: true,
          type: "control-territory-count",
          territoryCount: 4,
          summary: "Own at least 4 territories."
        }
      ],
      preview: {
        summary: "Win condition: complete your assigned objective.",
        objectiveSummaries: ["Control North.", "Own at least 4 territories."]
      }
    }
  };

  const blockedResult = detectVictory(state);

  assert.equal(blockedResult.code, "NO_VICTORY");
  state.gameConfig.victoryObjectiveAssignments = {
    p1: "hold-four"
  };

  const winningResult = detectVictory(state);

  assert.equal(winningResult.code, "VICTORY_DECLARED");
  assert.equal(winningResult.victory?.summaryParams?.objectiveId, "hold-four");
});
