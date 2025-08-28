import {
  KEY_MAP,
  KEY_PLAYERS,
  KEY_GAME,
  KEY_SAVES,
  getMapName,
  getSavedPlayers,
  getSavedGame,
  saveGame,
  saveNamedGame,
  loadNamedGame,
  clearSavedData,
  hasSavedPlayers,
  hasSavedGame,
} from "../src/state/storage.js";

describe("storage helpers use correct keys", () => {
  beforeEach(() => {
    const store = {};
    Object.defineProperty(global, "localStorage", {
      value: {
        getItem: jest.fn(key => store[key] || null),
        setItem: jest.fn((key, value) => {
          store[key] = String(value);
        }),
        removeItem: jest.fn(key => {
          delete store[key];
        }),
      },
      writable: true,
    });
  });

  afterEach(() => {
    delete global.localStorage;
  });

  test("getMapName reads KEY_MAP", () => {
    getMapName();
    expect(global.localStorage.getItem).toHaveBeenCalledWith(KEY_MAP);
  });

  test("getSavedPlayers reads KEY_PLAYERS", () => {
    global.localStorage.getItem.mockReturnValue("[]");
    getSavedPlayers();
    expect(global.localStorage.getItem).toHaveBeenCalledWith(KEY_PLAYERS);
  });

  test("getSavedGame reads KEY_GAME", () => {
    getSavedGame();
    expect(global.localStorage.getItem).toHaveBeenCalledWith(KEY_GAME);
  });

  test("saveGame writes KEY_GAME", () => {
    const game = { serialize: () => "{}" };
    saveGame(game);
    expect(global.localStorage.setItem).toHaveBeenCalledWith(KEY_GAME, "{}");
  });

  test("saveNamedGame writes KEY_SAVES", () => {
    const game = { serialize: () => "{}" };
    saveNamedGame("slot", game);
    expect(global.localStorage.setItem).toHaveBeenCalledWith(KEY_SAVES, expect.any(String));
  });

  test("loadNamedGame reads KEY_SAVES", () => {
    const payload = JSON.stringify({ slot: { data: "{}", map: "map", savedAt: 0, turn: 0 } });
    global.localStorage.getItem.mockReturnValue(payload);
    loadNamedGame("slot", { deserialize: () => ({}) });
    expect(global.localStorage.getItem).toHaveBeenCalledWith(KEY_SAVES);
  });

  test("clearSavedData removes KEY_GAME and KEY_PLAYERS", () => {
    clearSavedData();
    expect(global.localStorage.removeItem).toHaveBeenCalledWith(KEY_GAME);
    expect(global.localStorage.removeItem).toHaveBeenCalledWith(KEY_PLAYERS);
  });

  test("hasSavedPlayers reads KEY_PLAYERS", () => {
    hasSavedPlayers();
    expect(global.localStorage.getItem).toHaveBeenCalledWith(KEY_PLAYERS);
  });

  test("hasSavedGame reads KEY_GAME", () => {
    hasSavedGame();
    expect(global.localStorage.getItem).toHaveBeenCalledWith(KEY_GAME);
  });
});
