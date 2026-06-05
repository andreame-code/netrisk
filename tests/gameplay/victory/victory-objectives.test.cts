const assert = require("node:assert/strict");
const {
  assignVictoryObjectives,
  getAssignedVictoryObjectiveForPlayer,
  resolveAssignedVictoryObjectiveId
} = require("../../../backend/engine/victory-objectives.cjs");
const { makePlayers, makeState } = require("../helpers/state-builder.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function configureObjectiveModule(state: ReturnType<typeof makeState>, overrides = {}) {
  state.gameConfig = {
    ...(state.gameConfig || {}),
    victoryRuleSetId: "victory.missions",
    victoryObjectiveModule: {
      id: "victory.missions",
      name: "Mission deck",
      objectives: [
        {
          id: "mission-a",
          title: "Mission A",
          description: "Complete mission A.",
          enabled: true,
          type: "control-territory-count",
          summary: "Own 3 territories."
        },
        {
          id: "mission-b",
          title: "",
          description: "",
          enabled: true,
          type: "",
          summary: "Fallback mission summary."
        },
        {
          id: "mission-disabled",
          title: "Disabled",
          description: "Should not be assigned.",
          enabled: false,
          type: "control-territory-count"
        },
        {
          title: "Missing id",
          description: "Should not be assigned.",
          enabled: true,
          type: "control-territory-count"
        }
      ],
      ...overrides
    }
  };
}

register("victory objectives use persisted assignments before runtime player order", () => {
  const state = makeState({ players: makePlayers(["Alice", "Bob"]) });
  configureObjectiveModule(state);
  state.gameConfig = {
    ...(state.gameConfig || {}),
    victoryObjectiveAssignments: {
      p1: "mission-b"
    }
  };

  assert.equal(resolveAssignedVictoryObjectiveId(state, "p1"), "mission-b");

  const objective = getAssignedVictoryObjectiveForPlayer(state, "p1");
  assert.equal(objective?.id, "mission-b");
  assert.equal(objective?.title, "mission-b");
  assert.equal(objective?.description, "Fallback mission summary.");
  assert.equal(objective?.type, "objective");
  assert.equal(objective?.summary, "Fallback mission summary.");
});

register("victory objectives ignore malformed persisted assignments and invalid modules", () => {
  const state = makeState({ players: makePlayers(["Alice", "Bob"]) });
  configureObjectiveModule(state);
  (state.gameConfig as Record<string, unknown>).victoryObjectiveAssignments = ["mission-b"];

  assert.equal(resolveAssignedVictoryObjectiveId(state, "p2"), "mission-b");

  configureObjectiveModule(state, { id: "other-victory-module" });

  assert.equal(resolveAssignedVictoryObjectiveId(state, "p1"), null);
  assert.equal(getAssignedVictoryObjectiveForPlayer(state, "p1"), null);
});

register("victory objectives do not assign in lobby or to unknown players", () => {
  const state = makeState({
    phase: "lobby",
    players: makePlayers(["Alice", "Bob"])
  });
  configureObjectiveModule(state);

  assert.equal(resolveAssignedVictoryObjectiveId(state, "p1"), null);

  state.phase = "active";
  assert.equal(resolveAssignedVictoryObjectiveId(state, "missing-player"), null);
  assert.equal(resolveAssignedVictoryObjectiveId(state, null), null);
});

register(
  "assignVictoryObjectives shuffles enabled objectives and skips players without ids",
  () => {
    const players = makePlayers(["Alice", "Bob", "Carol"]);
    players[2].id = null;
    const state = makeState({ players });
    configureObjectiveModule(state);

    assignVictoryObjectives(state, () => 0);

    assert.deepEqual(state.gameConfig?.victoryObjectiveAssignments, {
      p1: "mission-b",
      p2: "mission-a"
    });
  }
);

register("assignVictoryObjectives leaves gameConfig unchanged without a valid module", () => {
  const state = makeState({ players: makePlayers(["Alice", "Bob"]) });
  state.gameConfig = {
    ruleSetId: "standard",
    victoryRuleSetId: "victory.missions"
  };

  assignVictoryObjectives(state, () => 0);

  assert.deepEqual(state.gameConfig, {
    ruleSetId: "standard",
    victoryRuleSetId: "victory.missions"
  });
});
