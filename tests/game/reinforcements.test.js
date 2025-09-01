import Game from "../../src/game.js";

/**
 * Verify reinforcement amounts after territory ownership changes.
 */
describe("reinforcement calculation", () => {
  const territories = [
    { id: "t1", neighbors: ["t2"], x: 0, y: 0 },
    { id: "t2", neighbors: ["t1"], x: 0, y: 0 },
    { id: "t3", neighbors: ["t4"], x: 0, y: 0 },
    { id: "t4", neighbors: ["t3"], x: 0, y: 0 },
  ];
  const continents = [{ name: "north", territories: ["t1", "t2"], bonus: 2 }];
  const players = [
    { name: "P1", color: "#000" },
    { name: "P2", color: "#111" },
  ];
  let game;

  beforeEach(() => {
    game = new Game(players, territories, continents, [], false);
    game.setCurrentPlayer(0);
  });

  test("player gains and loses continent bonus with territory changes", () => {
    // owns t1 and t2 -> entire continent bonus
    game.calculateReinforcements();
    expect(game.reinforcements).toBe(5); // base 3 + bonus 2

    // lose t2
    game.territoryById("t2").owner = 1;
    game.calculateReinforcements();
    expect(game.reinforcements).toBe(3);

    // regain t2
    game.territoryById("t2").owner = 0;
    game.calculateReinforcements();
    expect(game.reinforcements).toBe(5);
  });
});
