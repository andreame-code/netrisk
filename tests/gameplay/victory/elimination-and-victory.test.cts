const assert = require("node:assert/strict");
const { createInitialState, declareWinnerIfNeeded, getMapTerritories, publicState, surrenderPlayer } = require("../../../backend/engine/game-engine.cjs");

type TerritoryRef = { id: string };
type PublicPlayer = { id: string; eliminated: boolean; territoryCount: number };

declare function register(name: string, fn: () => void | Promise<void>): void;

function setupLiveState() {
  const state = createInitialState();
  state.phase = "active";
  state.players = [
    { id: "p1", name: "Alice", color: "#111111", connected: true },
    { id: "p2", name: "Bob", color: "#222222", connected: true }
  ];
  getMapTerritories(state).forEach((territory: TerritoryRef) => {
    state.territories[territory.id] = { ownerId: "p1", armies: 1 };
  });
  return state;
}

register("publicState marks players with zero territories as eliminated", () => {
  const state = setupLiveState();
  const snapshot = publicState(state);
  const player = snapshot.players.find((entry: PublicPlayer) => entry.id === "p2");
  assert.equal(player.eliminated, true);
});

register("publicState keeps players with territories active", () => {
  const state = setupLiveState();
  const territoryId = getMapTerritories(state)[0].id;
  state.territories[territoryId].ownerId = "p2";
  const snapshot = publicState(state);
  const player = snapshot.players.find((entry: PublicPlayer) => entry.id === "p2");
  assert.equal(player.eliminated, false);
});

register("declareWinnerIfNeeded assigns victory when one active player remains", () => {
  const state = setupLiveState();
  const won = declareWinnerIfNeeded(state);
  assert.equal(won, true);
  assert.equal(state.winnerId, "p1");
  assert.equal(state.phase, "finished");
});

register("declareWinnerIfNeeded does not assign victory while more than one player owns territories", () => {
  const state = setupLiveState();
  state.territories[getMapTerritories(state)[0].id].ownerId = "p2";
  const won = declareWinnerIfNeeded(state);
  assert.equal(won, false);
  assert.equal(state.winnerId, null);
});

register("surrenderPlayer elimina il giocatore e assegna la vittoria se resta un solo vivo", () => {
  const state = setupLiveState();
  state.territories[getMapTerritories(state)[0].id].ownerId = "p2";
  const ownedBefore = publicState(state).players.find((entry: PublicPlayer) => entry.id === "p2").territoryCount;

  const result = surrenderPlayer(state, "p2");

  assert.equal(result.ok, true);
  assert.equal(state.winnerId, "p1");
  assert.equal(state.phase, "finished");
  assert.equal(publicState(state).players.find((entry: PublicPlayer) => entry.id === "p2").eliminated, true);
  assert.equal(publicState(state).players.find((entry: PublicPlayer) => entry.id === "p2").territoryCount, ownedBefore);
});

register("declareWinnerIfNeeded chiude la partita quando restano solo AI attive", () => {
  const state = setupLiveState();
  state.players = [
    { id: "p1", name: "Alice", color: "#111111", connected: true, surrendered: true },
    { id: "p2", name: "Bot Alpha", color: "#222222", connected: true, isAi: true },
    { id: "p3", name: "Bot Beta", color: "#333333", connected: true, isAi: true }
  ];
  const territoryIds = getMapTerritories(state).map((territory: TerritoryRef) => territory.id);
  territoryIds.forEach((territoryId: string, index: number) => {
    state.territories[territoryId] = { ownerId: index % 2 === 0 ? "p2" : "p3", armies: 1 };
  });

  const closed = declareWinnerIfNeeded(state);

  assert.equal(closed, true);
  assert.equal(state.phase, "finished");
  assert.equal(state.winnerId, null);
});
