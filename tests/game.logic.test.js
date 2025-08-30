import Game from "../src/game.js";
import { ATTACK } from "../src/phases.js";

// Stub network calls made through loadJson
jest.mock("../src/utils/load-json.js", () => jest.fn(() => Promise.resolve({})));

describe("core game logic", () => {
  const createGame = (territories, continents = []) =>
    new Game(
      [{ name: "P1" }, { name: "P2" }],
      territories,
      continents,
      [],
      false,
      false,
    );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("calculateReinforcements", () => {
    test("minimum three reinforcements even with few territories", () => {
      const territories = [
        { id: "a", neighbors: ["b"], owner: 0, armies: 1 },
        { id: "b", neighbors: ["a"], owner: 0, armies: 1 },
      ];
      const game = createGame(territories);
      const events = [];
      game.on("reinforcementsCalculated", (e) => events.push(e));

      game.calculateReinforcements();

      expect(game.reinforcements).toBe(3);
      expect(events).toEqual([{ player: 0, amount: 3 }]);
    });

    test("continent bonus added to reinforcements", () => {
      const territories = [
        { id: "a", neighbors: ["b"], owner: 0, armies: 1 },
        { id: "b", neighbors: ["a", "c"], owner: 0, armies: 1 },
        { id: "c", neighbors: ["b"], owner: 0, armies: 1 },
      ];
      const continents = [{ territories: ["a", "b"], bonus: 5 }];
      const game = createGame(territories, continents);
      const events = [];
      game.on("reinforcementsCalculated", (e) => events.push(e));

      game.calculateReinforcements();

      expect(game.reinforcements).toBe(8); // base 3 + bonus 5
      expect(events).toEqual([{ player: 0, amount: 8 }]);
    });
  });

  describe("attack", () => {
    test("cannot attack from territory with one army", () => {
      const territories = [
        { id: "a", neighbors: ["b"], owner: 0, armies: 1 },
        { id: "b", neighbors: ["a"], owner: 1, armies: 1 },
      ];
      const game = createGame(territories);
      const events = [];
      game.on("attackResolved", (e) => events.push(e));

      const sequence = [0.3, 0.2]; // defense rolls only
      let i = 0;
      jest.spyOn(Math, "random").mockImplementation(() => sequence[i++]);

      const result = game.attack(game.territoryById("a"), game.territoryById("b"));

      expect(result.attackRolls).toHaveLength(0);
      expect(game.territoryById("b").armies).toBe(2);
      expect(events[0].result.attackRolls).toHaveLength(0);
    });

    test("resolves dice rolls and emits event", () => {
      const territories = [
        { id: "a", neighbors: ["b"], owner: 0, armies: 5 },
        { id: "b", neighbors: ["a"], owner: 1, armies: 1 },
      ];
      const game = createGame(territories);
      const events = [];
      game.on("attackResolved", (e) => events.push(e));

      const sequence = [0.99, 0.4, 0.25, 0.8, 0.6]; // 6,3,2 vs 5,4
      let i = 0;
      jest.spyOn(Math, "random").mockImplementation(() => sequence[i++]);

      const from = game.territoryById("a");
      const to = game.territoryById("b");
      const result = game.attack(from, to);

      expect(result.attackRolls).toEqual([6, 3, 2]);
      expect(result.defendRolls).toEqual([5, 4]);
      expect(result.attackerLosses).toBe(1);
      expect(result.defenderLosses).toBe(1);
      expect(to.armies).toBe(1);
      expect(from.armies).toBe(4);
      expect(events[0]).toEqual({ from: "a", to: "b", result });
    });
  });

  describe("moveArmies", () => {
    test("moves armies only between connected territories", () => {
      const territories = [
        { id: "a", neighbors: ["b"], owner: 0, armies: 5 },
        { id: "b", neighbors: ["a"], owner: 0, armies: 1 },
        { id: "c", neighbors: [], owner: 0, armies: 1 },
      ];
      const game = createGame(territories);
      const events = [];
      game.on("move", (e) => events.push(e));

      const moved = game.moveArmies("a", "b", 3);
      expect(moved).toBe(true);
      expect(game.territoryById("a").armies).toBe(2);
      expect(game.territoryById("b").armies).toBe(4);
      expect(events[0]).toEqual({ from: "a", to: "b", count: 3 });

      const invalid = game.moveArmies("a", "c", 1);
      expect(invalid).toBe(false);
      expect(events).toHaveLength(1); // no additional event
    });
  });

  describe("undo mechanics", () => {
    test("pushUndoState and canUndo only in reinforce phase", () => {
      const territories = [
        { id: "a", neighbors: ["b"], owner: 0, armies: 3 },
        { id: "b", neighbors: ["a"], owner: 0, armies: 3 },
      ];
      const game = createGame(territories);

      game.pushUndoState();
      expect(game.undoStack).toHaveLength(1);
      expect(game.canUndo()).toBe(true);

      game.setPhase(ATTACK);
      game.pushUndoState();
      expect(game.undoStack).toHaveLength(1);
      expect(game.canUndo()).toBe(false);
    });
  });
});
