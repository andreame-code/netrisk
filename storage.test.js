import {
  saveNamedGame,
  loadNamedGame,
  listSavedGames,
  renameSavedGame,
  deleteSavedGame,
} from "./src/state/storage.js";

class DummyGame {
  constructor(state) {
    this.state = state;
    this.turnNumber = state.turn || 0;
  }
  serialize() {
    return JSON.stringify(this.state);
  }
  static deserialize(data) {
    return new DummyGame(JSON.parse(data));
  }
}

describe("multi-save storage", () => {
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
    jest.spyOn(Date, "now").mockReturnValue(111);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.localStorage;
  });

  test("can save, list, rename, load and delete named games", () => {
    const g1 = new DummyGame({ turn: 5 });
    saveNamedGame("slot1", g1, { map: "map1" });
    let list = listSavedGames();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("slot1");
    expect(list[0].map).toBe("map1");
    const loaded = loadNamedGame("slot1", DummyGame);
    expect(loaded.state.turn).toBe(5);

    renameSavedGame("slot1", "renamed");
    list = listSavedGames();
    expect(list[0].name).toBe("renamed");

    deleteSavedGame("renamed");
    expect(listSavedGames()).toHaveLength(0);
  });
});

