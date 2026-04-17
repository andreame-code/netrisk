const assert = require("node:assert/strict");
const { applyFortify } = require("../../../backend/engine/game-engine.cjs");
const {
  makePlayers,
  makeState,
  makeTerritory,
  territoryStates,
  TurnPhase
} = require("../helpers/state-builder.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("applyFortify applica il minimo modulare del motore principale", () => {
  const state = makeState({
    players: makePlayers(["Alice", "Bob"]),
    territories: territoryStates([
      { id: "a", ownerId: "p1", armies: 4 },
      { id: "b", ownerId: "p1", armies: 2 }
    ]),
    turnPhase: TurnPhase.FORTIFY,
    currentTurnIndex: 0
  });

  state.mapTerritories = [makeTerritory("a", ["b"]), makeTerritory("b", ["a"])];
  state.gameConfig = {
    gameplayEffects: {
      fortifyMinimumArmies: 2
    }
  };

  const blocked = applyFortify(state, "p1", "a", "b", 1);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.messageKey, "game.fortify.minArmies");

  const allowed = applyFortify(state, "p1", "a", "b", 2);
  assert.equal(allowed.ok, true);
  assert.equal(state.territories.a.armies, 2);
  assert.equal(state.territories.b.armies, 4);
});
