import Game from "../src/game.js";
import { gameState, initGameState, setSelectedTerritory } from "../src/state/game.js";

test("initGameState synchronizes game properties", () => {
  const players = [{ name: "A" }, { name: "B" }];
  const territories = [
    { id: "t1", neighbors: [], x: 0, y: 0 },
    { id: "t2", neighbors: [], x: 1, y: 1 },
  ];
  const game = new Game(players, territories, [], [], false, false);
  initGameState(game);

  expect(gameState.currentPlayer).toBe(game.currentPlayer);
  expect(gameState.players).toBe(game.players);
  expect(gameState.territories).toBe(game.territories);
  expect(gameState.phase).toBe(game.getPhase());
});

test("setSelectedTerritory updates selection", () => {
  const players = [{ name: "A" }, { name: "B" }];
  const territories = [
    { id: "t1", neighbors: [], x: 0, y: 0 },
    { id: "t2", neighbors: [], x: 1, y: 1 },
  ];
  const game = new Game(players, territories, [], [], false, false);
  initGameState(game);
  const selected = game.territories[0];

  setSelectedTerritory(selected);
  expect(gameState.selectedTerritory).toBe(selected);

  setSelectedTerritory(null);
  expect(gameState.selectedTerritory).toBeNull();
});
