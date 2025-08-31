import { loadGame } from "../src/init/game-loader.js";
import Game from "../src/game.js";
import * as logger from "../src/logger.js";

describe("game loader", () => {
  let originalFetch;
  let originalAlert;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalAlert = global.alert;
    global.fetch = jest.fn();
    global.alert = jest.fn();
    global.localStorage = {
      store: {},
      getItem(key) {
        return this.store[key] || null;
      },
      setItem(key, value) {
        this.store[key] = String(value);
      },
      removeItem(key) {
        delete this.store[key];
      },
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    global.alert = originalAlert;
    delete global.localStorage;
  });

  test("loads selected map and starts new game", async () => {
    const map = {
      territories: [{ id: "t1", x: 1, y: 2, neighbors: [] }],
      continents: [],
      deck: [],
    };
    global.fetch.mockResolvedValue({ ok: true, json: async () => map });
    global.localStorage.setItem("netriskMap", "custom");
    global.localStorage.setItem(
      "netriskPlayers",
      JSON.stringify([{ name: "Red", color: "#f00" }]),
    );

    const { game, territoryPositions } = await loadGame();
    expect(global.fetch).toHaveBeenCalledWith("/src/data/custom.json");
    expect(game).toBeTruthy();
    expect(game.players[0].name).toBe("Red");
    expect(territoryPositions).toEqual({ t1: { x: 1, y: 2 } });
  });

  test("restores saved game from storage", async () => {
    const saved = new Game(
      [{ name: "Red", color: "#f00" }],
      [{ id: "a", x: 5, y: 6, neighbors: [] }],
      [],
      [],
    );
    global.localStorage.setItem("netriskGame", saved.serialize());

    const { game, territoryPositions } = await loadGame();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(game.players[0].name).toBe("Red");
    expect(game.territories[0].id).toBe("a");
    expect(territoryPositions).toEqual({ a: { x: 5, y: 6 } });
  });

  test("returns error when map file is missing", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404 });
    global.localStorage.setItem("netriskMap", "missing");
    const errSpy = jest.spyOn(logger, "error").mockImplementation(() => {});

    const { game, territoryPositions, error } = await loadGame();
    expect(global.fetch).toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    expect(game).toBeNull();
    expect(territoryPositions).toEqual({});
    expect(error).toBeInstanceOf(Error);
  });

  test("ignores corrupted saved game and loads map", async () => {
    global.localStorage.setItem("netriskGame", "not-json");
    global.localStorage.setItem(
      "netriskPlayers",
      JSON.stringify([{ name: "Red", color: "#f00" }]),
    );
    const map = {
      territories: [{ id: "b", x: 7, y: 8, neighbors: [] }],
      continents: [],
      deck: [],
    };
    global.fetch.mockResolvedValue({ ok: true, json: async () => map });
    const errSpy = jest.spyOn(logger, "error").mockImplementation(() => {});

    const { game, territoryPositions } = await loadGame();
    expect(global.fetch).toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    expect(game).toBeTruthy();
    expect(territoryPositions).toEqual({ b: { x: 7, y: 8 } });
  });
});
