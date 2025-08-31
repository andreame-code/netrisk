import Game from "../src/game.js";
import { REINFORCE, ATTACK, FORTIFY } from "../src/phases.js";

describe("phase flow", () => {
  let game;
  let phaseHandler;
  let turnStartHandler;

  beforeEach(() => {
    const players = [
      { name: "P1", color: "red" },
      { name: "P2", color: "blue" },
    ];
    const territories = [
      { id: "a", neighbors: ["b"], owner: 0, armies: 3 },
      { id: "b", neighbors: ["a"], owner: 1, armies: 3 },
    ];
    game = new Game(players, territories, [], [], false);
    phaseHandler = jest.fn();
    turnStartHandler = jest.fn();
    game.on("phaseChange", phaseHandler);
    game.on("turnStart", turnStartHandler);
  });

  test("setup -> reinforce -> attack -> fortify -> endTurn", () => {
    // setup starts in reinforce phase
    expect(game.phase).toBe(REINFORCE);
    game.endTurn(); // unavailable in reinforce
    expect(game.phase).toBe(REINFORCE);
    expect(phaseHandler).not.toHaveBeenCalled();
    expect(turnStartHandler).not.toHaveBeenCalled();

    // reinforce: attack not available
    const bBefore = game.territories[1].armies;
    expect(game.handleTerritoryClick("b")).toBeNull();
    expect(game.territories[1].armies).toBe(bBefore);
    game.handleTerritoryClick("a");
    game.handleTerritoryClick("a");
    game.handleTerritoryClick("a");
    expect(game.phase).toBe(ATTACK);
    expect(phaseHandler).toHaveBeenNthCalledWith(1, {
      phase: ATTACK,
      player: 0,
    });

    // attack: reinforce not available
    const armiesBefore = game.territories[0].armies;
    const res = game.handleTerritoryClick("a");
    expect(res).toEqual({ type: "select", territory: "a" });
    expect(game.territories[0].armies).toBe(armiesBefore);
    game.endTurn();
    expect(game.phase).toBe(FORTIFY);
    expect(phaseHandler).toHaveBeenNthCalledWith(2, {
      phase: FORTIFY,
      player: 0,
    });

    // fortify: attack not available
    expect(game.handleTerritoryClick("a")).toEqual({
      type: "select",
      territory: "a",
    });
    expect(game.handleTerritoryClick("b")).toBeNull();
    const prevPlayer = game.currentPlayer;
    game.endTurn();
    expect(game.currentPlayer).toBe((prevPlayer + 1) % 2);
    expect(game.phase).toBe(REINFORCE);
    expect(game.reinforcements).toBeGreaterThan(0);
    expect(turnStartHandler).toHaveBeenCalledWith({
      player: game.currentPlayer,
    });
    expect(turnStartHandler).toHaveBeenCalledTimes(1);
    expect(phaseHandler).toHaveBeenNthCalledWith(3, {
      phase: REINFORCE,
      player: game.currentPlayer,
    });
    expect(phaseHandler).toHaveBeenCalledTimes(3);
  });
});
