const assert = require("node:assert/strict");
const {
  CardEffectType,
  CardType,
  TurnPhase,
  createCard,
  getCardRuleSet,
  standardCardModuleManifest,
  standardTradeBonusForIndex,
  validateCardModuleManifest,
  validateStandardCardSet
} = require("../../../shared/models.cjs");
const { getCardEffectHandler } = require("../../../backend/engine/card-effects.cjs");
const {
  createInitialState,
  publicState,
  startGame,
  tradeCardSet
} = require("../../../backend/engine/game-engine.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("cards core module validates and exposes standard render metadata", () => {
  const validation = validateCardModuleManifest(standardCardModuleManifest);
  assert.equal(validation.ok, true);

  const ruleSet = getCardRuleSet("standard");
  assert.equal(ruleSet.id, "standard");
  assert.equal(ruleSet.effect.type, CardEffectType.TRADE_FOR_REINFORCEMENTS);
  assert.equal(ruleSet.definitions.length, 4);

  const infantryCard = createCard({ id: "card-a", type: CardType.INFANTRY, territoryId: "a" });
  const rendered = ruleSet.renderCard(infantryCard);
  assert.equal(rendered.displayNameKey, "game.runtime.cardType.infantry");
  assert.equal(rendered.visual.token, "I");
  assert.equal(rendered.visual.tone, "infantry");
  assert.equal(rendered.effectType, CardEffectType.TRADE_FOR_REINFORCEMENTS);
});

register("cards manifest validation rejects duplicate ids and invalid handlers", () => {
  const invalidManifest = {
    ...standardCardModuleManifest,
    definitions: [
      {
        ...standardCardModuleManifest.definitions[0],
        id: "duplicate",
        effect: { type: "missingHandler" }
      },
      {
        ...standardCardModuleManifest.definitions[1],
        id: "duplicate",
        visual: { token: "LONG", tone: "unknown" }
      }
    ]
  };

  const validation = validateCardModuleManifest(invalidManifest);
  assert.equal(validation.ok, false);
  assert.equal(
    validation.issues.some((issue: { code: string }) => issue.code === "duplicate-card-id"),
    true
  );
  assert.equal(
    validation.issues.some((issue: { code: string }) => issue.code === "invalid-effect-handler"),
    true
  );
  assert.equal(
    validation.issues.some((issue: { code: string }) => issue.code === "invalid-visual-token"),
    true
  );
  assert.equal(
    validation.issues.some((issue: { code: string }) => issue.code === "invalid-visual-tone"),
    true
  );
});

register("cards standard trade validation and bonus progression stay unchanged", () => {
  const oneOfEach = validateStandardCardSet([
    createCard({ type: CardType.INFANTRY }),
    createCard({ type: CardType.CAVALRY }),
    createCard({ type: CardType.ARTILLERY })
  ]);
  assert.equal(oneOfEach.ok, true);
  assert.equal(oneOfEach.pattern, "one-of-each");

  const threeWithWild = validateStandardCardSet([
    createCard({ type: CardType.INFANTRY }),
    createCard({ type: CardType.INFANTRY }),
    createCard({ type: CardType.WILD })
  ]);
  assert.equal(threeWithWild.ok, true);
  assert.equal(threeWithWild.pattern, "three-of-a-kind");

  assert.deepEqual(
    Array.from({ length: 8 }, (_, index) => standardTradeBonusForIndex(index)),
    [4, 6, 8, 10, 12, 15, 20, 25]
  );
});

register("cards trade effect preserves reinforcement trade flow", () => {
  const state = createInitialState();
  state.players = [
    {
      id: "p1",
      name: "Alice",
      color: "#111111",
      connected: true,
      isAi: false,
      linkedUserId: null,
      surrendered: false
    },
    {
      id: "p2",
      name: "Bob",
      color: "#222222",
      connected: true,
      isAi: false,
      linkedUserId: null,
      surrendered: false
    }
  ];
  startGame(state, () => 0);
  state.phase = "active";
  state.turnPhase = TurnPhase.REINFORCEMENT;
  state.currentTurnIndex = 0;
  state.reinforcementPool = 0;
  state.tradeCount = 0;
  state.hands.p1 = [
    createCard({ id: "card-a", type: CardType.INFANTRY, territoryId: "a" }),
    createCard({ id: "card-b", type: CardType.CAVALRY, territoryId: "b" }),
    createCard({ id: "card-c", type: CardType.ARTILLERY, territoryId: "c" })
  ];

  const handler = getCardEffectHandler(CardEffectType.TRADE_FOR_REINFORCEMENTS);
  assert.equal(handler.type, CardEffectType.TRADE_FOR_REINFORCEMENTS);

  const result = tradeCardSet(state, "p1", ["card-a", "card-b", "card-c"]);
  assert.equal(result.ok, true);
  assert.equal(result.bonus, 4);
  assert.equal(state.reinforcementPool, 4);
  assert.equal(state.tradeCount, 1);
  assert.equal(state.hands.p1.length, 0);
  assert.equal(state.discardPile.length, 3);
});

register("cards public snapshot carries modular rendering data", () => {
  const state = createInitialState();
  state.phase = "active";
  state.turnPhase = TurnPhase.REINFORCEMENT;
  state.players = [
    {
      id: "p1",
      name: "Alice",
      color: "#111111",
      connected: true,
      isAi: false,
      linkedUserId: null,
      surrendered: false
    }
  ];
  state.currentTurnIndex = 0;
  state.hands.p1 = [createCard({ id: "card-a", type: CardType.INFANTRY, territoryId: "a" })];

  const snapshot = publicState(state);
  assert.equal(snapshot.playerHand.length, 1);
  assert.equal(snapshot.playerHand[0].displayNameKey, "game.runtime.cardType.infantry");
  assert.equal(snapshot.playerHand[0].visual.token, "I");
  assert.equal(snapshot.playerHand[0].effectType, CardEffectType.TRADE_FOR_REINFORCEMENTS);
  assert.equal(snapshot.cardState.ruleSetName, "Standard");
});
