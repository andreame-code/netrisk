import Game from "../src/game.js";
import { ATTACK, FORTIFY } from "../src/phases.js";

describe("undo functionality", () => {
  const createGame = (maxUndo = 10) => {
    const territories = [
      { id: "a", neighbors: ["b"], owner: 0, armies: 5 },
      { id: "b", neighbors: ["a"], owner: 0, armies: 1 },
    ];
    return new Game(
      [{ name: "P1" }, { name: "P2" }],
      territories,
      [],
      [],
      false,
      false,
      maxUndo,
    );
  };

  test("undo and redo reinforcement", () => {
    const game = createGame();
    game.reinforcements = 1;
    game.handleTerritoryClick("a");
    expect(game.territories[0].armies).toBe(6);
    expect(game.reinforcements).toBe(0);
    expect(game.canUndo()).toBe(true);
    game.undo();
    expect(game.territories[0].armies).toBe(5);
    expect(game.reinforcements).toBe(1);
    game.redo();
    expect(game.territories[0].armies).toBe(6);
    expect(game.reinforcements).toBe(0);
  });

  test("undo move armies", () => {
    const game = createGame();
    game.setPhase(FORTIFY);
    game.handleTerritoryClick("a");
    game.handleTerritoryClick("b");
    game.moveArmies("a", "b", 3);
    expect(game.territories[0].armies).toBe(2);
    expect(game.territories[1].armies).toBe(4);
    game.undo();
    expect(game.territories[0].armies).toBe(5);
    expect(game.territories[1].armies).toBe(1);
  });

  test("undo attack selection", () => {
    const territories = [
      { id: "a", neighbors: ["b"], owner: 0, armies: 3 },
      { id: "b", neighbors: ["a"], owner: 1, armies: 2 },
    ];
    const game = new Game([{ name: "P1" }, { name: "P2" }], territories, [], [], false, false);
    game.setPhase(ATTACK);
    game.handleTerritoryClick("a");
    expect(game.getSelectedFrom().id).toBe("a");
    game.undo();
    expect(game.getSelectedFrom()).toBeNull();
  });

  test("undo stack limit", () => {
    const game = createGame(2);
    game.reinforcements = 3;
    game.handleTerritoryClick("a"); // 6
    game.handleTerritoryClick("a"); // 7
    game.handleTerritoryClick("a"); // 8 (first state dropped)
    game.undo(); // 7
    game.undo(); // 6, cannot undo to 5
    expect(game.territories[0].armies).toBe(6);
  });

  test("endTurn clears undo stack", () => {
    const game = createGame();
    game.reinforcements = 1;
    game.handleTerritoryClick("a");
    expect(game.canUndo()).toBe(true);
    game.setPhase(FORTIFY);
    game.endTurn();
    expect(game.canUndo()).toBe(false);
  });
});
