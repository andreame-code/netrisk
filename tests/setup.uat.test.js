import { colorPalette } from "../src/colors.js";

jest.mock("../src/navigation.js", () => ({
  navigateTo: jest.fn(),
  goHome: jest.fn(),
  exitGame: jest.fn(),
}));

function setupDOM() {
  document.body.innerHTML = `
    <form id="setupForm">
      <input id="humanCount" />
      <input id="aiCount" />
      <select id="aiDifficulty">
        <option value="easy">easy</option>
        <option value="normal">normal</option>
        <option value="hard">hard</option>
      </select>
      <select id="aiStyle">
        <option value="aggressive">aggressive</option>
        <option value="balanced">balanced</option>
        <option value="defensive">defensive</option>
      </select>
      <div id="players"></div>
      <input type="hidden" id="mapSelect" />
      <div id="mapGrid"></div>
    </form>`;
}

describe("setup loadFromStorage and caching", () => {
  beforeEach(() => {
    jest.resetModules();
    setupDOM();
    localStorage.clear();
    window.alert = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test("populates inputs from localStorage", async () => {
    const players = [
      { name: "Alice", color: colorPalette[0] },
      { name: "Bob", color: colorPalette[1] },
      {
        name: "AI 1",
        color: colorPalette[2],
        ai: true,
        difficulty: "hard",
        style: "aggressive",
      },
    ];
    localStorage.setItem("netriskPlayers", JSON.stringify(players));
    localStorage.setItem("netriskMap", "map2");

    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ version: 1, maps: [] }),
      }),
    );
    const setup = require("../src/setup.js");
    await setup.mapLoadPromise;

    expect(document.getElementById("humanCount").value).toBe("2");
    expect(document.getElementById("aiCount").value).toBe("1");
    expect(document.getElementById("aiDifficulty").value).toBe("hard");
    expect(document.getElementById("aiStyle").value).toBe("aggressive");
    expect(document.getElementById("mapSelect").value).toBe("map2");
    expect(document.getElementById("name0").value).toBe("Alice");
    expect(document.getElementById("color0").value).toBe(colorPalette[0]);
    expect(document.getElementById("name1").value).toBe("Bob");
    expect(document.getElementById("color1").value).toBe(colorPalette[1]);
  });

  test("handles missing or invalid storage gracefully", async () => {
    localStorage.setItem("netriskPlayers", "{invalid");
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ version: 1, maps: [] }),
      }),
    );
    const setup = require("../src/setup.js");
    await setup.mapLoadPromise;

    expect(document.getElementById("humanCount").value).toBe("1");
    expect(document.getElementById("aiCount").value).toBe("2");
    const playersDiv = document.getElementById("players");
    expect(playersDiv.querySelectorAll('input[type="text"]').length).toBe(1);
    expect(document.getElementById("name0")).not.toBeNull();
  });

  test("reuses cached images for map thumbnails", async () => {
    const manifest = {
      version: 1,
      maps: [
        {
          id: "mapA",
          name: "A",
          difficulty: "Easy",
          territories: 1,
          bonuses: {},
          thumbnail: "assets/maps/thumb.svg",
          description: "",
        },
        {
          id: "mapB",
          name: "B",
          difficulty: "Easy",
          territories: 1,
          bonuses: {},
          thumbnail: "assets/maps/thumb.svg",
          description: "",
        },
      ],
    };
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve(manifest) }),
    );

    const originalCreate = document.createElement.bind(document);
    const createSpy = jest
      .spyOn(document, "createElement")
      .mockImplementation((tag, opts) => originalCreate(tag, opts));

    const setup = require("../src/setup.js");
    await setup.mapLoadPromise; // first load
    await setup.loadMapData(); // second load to trigger cache hit

    const imgCreates = createSpy.mock.calls.filter(
      (c) => c[0] === "img",
    ).length;
    expect(imgCreates).toBe(1);
    expect(document.querySelectorAll("#mapGrid img").length).toBe(4);
    createSpy.mockRestore();
  });
});
