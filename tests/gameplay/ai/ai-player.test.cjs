const assert = require("node:assert/strict");
const {
  chooseAttack,
  chooseConquestMove,
  chooseFortify,
  chooseReinforcementTarget,
  runAiTurn
} = require("../../../backend/engine/ai-player.cjs");
const { createCard, CardType } = require("../../../shared/models.cjs");
const { makePlayers, makeState, makeTerritory, territoryStates, TurnPhase } = require("../helpers/state-builder.cjs");
const { createFixedRandom, rollsToRandomValues } = require("../helpers/random.cjs");

function createAiState(options = {}) {
  const territories = options.mapTerritories || [
    makeTerritory("a", ["b"]),
    makeTerritory("b", ["a", "c"]),
    makeTerritory("c", ["b"]),
    makeTerritory("d", [])
  ];

  const state = makeState({
    players: options.players || [
      { ...makePlayers(["CPU Alpha", "Bob"])[0], isAi: true },
      makePlayers(["CPU Alpha", "Bob"])[1]
    ],
    territories: options.territories || territoryStates([
      { id: "a", ownerId: "p1", armies: 2 },
      { id: "b", ownerId: "p2", armies: 2 },
      { id: "c", ownerId: "p1", armies: 5 },
      { id: "d", ownerId: "p2", armies: 1 }
    ]),
    turnPhase: options.turnPhase || TurnPhase.REINFORCEMENT,
    currentTurnIndex: options.currentTurnIndex || 0,
    reinforcementPool: options.reinforcementPool || 0
  });

  state.mapTerritories = territories;
  state.hands = options.hands || {};
  state.discardPile = options.discardPile || [];
  state.deck = options.deck || [];
  state.tradeCount = options.tradeCount || 0;
  state.pendingConquest = options.pendingConquest || null;
  return state;
}

register("chooseReinforcementTarget prefers the strongest border territory with pressure", () => {
  const state = createAiState({
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 2 },
      { id: "b", ownerId: "p2", armies: 4 },
      { id: "c", ownerId: "p1", armies: 6 },
      { id: "d", ownerId: "p2", armies: 1 }
    ])
  });

  const target = chooseReinforcementTarget(state, "p1");
  assert.equal(target, "c");
});

register("chooseAttack selects the highest-value favorable attack", () => {
  const state = createAiState({
    turnPhase: TurnPhase.ATTACK,
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 4 },
      { id: "b", ownerId: "p2", armies: 2 },
      { id: "c", ownerId: "p1", armies: 5 },
      { id: "d", ownerId: "p2", armies: 1 }
    ]),
    mapTerritories: [
      makeTerritory("a", ["b"]),
      makeTerritory("b", ["a"]),
      makeTerritory("c", ["d"]),
      makeTerritory("d", ["c"])
    ]
  });

  const choice = chooseAttack(state, "p1");
  assert.deepEqual(choice, {
    fromId: "c",
    toId: "d",
    score: 39
  });
});

register("chooseConquestMove and chooseFortify respect AI heuristics", () => {
  const conquestState = createAiState({
    turnPhase: TurnPhase.ATTACK,
    pendingConquest: {
      fromId: "c",
      toId: "b",
      minArmies: 1,
      maxArmies: 4
    },
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p1", armies: 0 },
      { id: "c", ownerId: "p1", armies: 5 },
      { id: "d", ownerId: "p2", armies: 2 }
    ]),
    mapTerritories: [
      makeTerritory("a", ["b"]),
      makeTerritory("b", ["a", "c", "d"]),
      makeTerritory("c", ["b"]),
      makeTerritory("d", ["b"])
    ]
  });

  assert.equal(chooseConquestMove(conquestState, "p1", conquestState.pendingConquest), 2);

  const fortifyState = createAiState({
    turnPhase: TurnPhase.FORTIFY,
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 1 },
      { id: "b", ownerId: "p1", armies: 4 },
      { id: "c", ownerId: "p1", armies: 1 },
      { id: "d", ownerId: "p2", armies: 2 }
    ]),
    mapTerritories: [
      makeTerritory("a", ["b"]),
      makeTerritory("b", ["a", "c"]),
      makeTerritory("c", ["b", "d"]),
      makeTerritory("d", ["c"])
    ]
  });

  assert.deepEqual(chooseFortify(fortifyState, "p1"), {
    fromId: "b",
    toId: "c",
    armies: 2,
    score: 15
  });
});

register("runAiTurn trades cards, attacks, resolves conquest, and ends the turn", () => {
  const players = makePlayers(["CPU Alpha", "Bob"]);
  players[0].isAi = true;

  const state = createAiState({
    players,
    hands: {
      p1: [
        createCard({ id: "i1", type: CardType.INFANTRY }),
        createCard({ id: "i2", type: CardType.INFANTRY }),
        createCard({ id: "i3", type: CardType.INFANTRY }),
        createCard({ id: "c1", type: CardType.CAVALRY }),
        createCard({ id: "a1", type: CardType.ARTILLERY }),
        createCard({ id: "w1", type: CardType.WILD })
      ]
    },
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 2 },
      { id: "b", ownerId: "p2", armies: 1 },
      { id: "c", ownerId: "p1", armies: 5 },
      { id: "d", ownerId: "p2", armies: 1 }
    ]),
    reinforcementPool: 0,
    turnPhase: TurnPhase.REINFORCEMENT,
    deck: [createCard({ id: "reward", type: CardType.CAVALRY, territoryId: "d" })]
  });

  const report = runAiTurn(state, {
    random: createFixedRandom(rollsToRandomValues([6, 5, 4, 1]))
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.tradedCardSets, [["i1", "i2", "i3"]]);
  assert.deepEqual(report.reinforcementTargets, ["c", "c", "c", "c"]);
  assert.deepEqual(report.attacks, [{ fromId: "c", toId: "b", score: 79 }]);
  assert.deepEqual(report.conquestMoves, [{ fromId: "c", toId: "b", armies: 1 }]);
  assert.equal(report.endedTurn, true);
  assert.equal(state.currentTurnIndex, 1);
  assert.equal(state.turnPhase, TurnPhase.REINFORCEMENT);
  assert.equal(state.territories.b.ownerId, "p1");
  assert.equal(state.territories.b.armies, 1);
  assert.equal(state.hands.p1.length, 4);
  assert.equal(state.discardPile.length, 3);
});
