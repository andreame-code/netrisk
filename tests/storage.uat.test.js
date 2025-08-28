import {
  saveNamedGame,
  listSavedGames,
  renameSavedGame,
  deleteSavedGame,
} from "../src/state/storage.js";

class DummyGame {
  constructor(state) {
    this.state = state;
    this.turnNumber = state.turn || 0;
  }
  serialize() {
    return JSON.stringify(this.state);
  }
}

describe("storage UAT", () => {
  beforeEach(() => {
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
    jest.spyOn(Date, "now").mockReturnValue(123);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.localStorage;
  });

  test("saves, lists, renames and deletes games", () => {
    const game = new DummyGame({ turn: 7 });
    saveNamedGame("slot1", game, { map: "map1" });
    expect(listSavedGames()).toEqual([
      { name: "slot1", map: "map1", savedAt: 123, turn: 7 },
    ]);

    renameSavedGame("slot1", "slot2");
    expect(listSavedGames()).toEqual([
      { name: "slot2", map: "map1", savedAt: 123, turn: 7 },
    ]);

    deleteSavedGame("slot2");
    expect(listSavedGames()).toEqual([]);
  });
});
