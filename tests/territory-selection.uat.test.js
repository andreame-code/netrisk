import initTerritorySelection from "../src/territory-selection.js";
import { ATTACK } from "../src/phases.js";

const flushPromises = () => new Promise((res) => setTimeout(res, 0));

describe("territory selection user flow", () => {
  beforeEach(() => {
    // basic DOM structure
    document.body.innerHTML =
      '<div id="board"></div>' + '<div id="selectedTerritory"></div>';

    // stub getBBox with unique coordinates per territory
    SVGElement.prototype.getBBox = function () {
      const positions = {
        A: { x: 0, y: 0 },
        B: { x: 40, y: 50 },
        C: { x: 80, y: 100 },
      };
      return {
        ...(positions[this.id] || { x: 0, y: 0 }),
        width: 10,
        height: 10,
      };
    };
  });

  afterEach(() => {
    // clean up any mocked fetch
    delete global.fetch;
  });

  test("click highlights moves and cleanup works", async () => {
    const svg =
      '<svg id="map">' +
      '<path id="A" class="map-territory" data-name="Alpha" />' +
      '<path id="B" class="map-territory" data-name="Bravo" />' +
      '<path id="C" class="map-territory" data-name="Charlie" />' +
      "</svg>";

    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(svg) }),
    );

    const territories = [
      { id: "A", name: "Alpha", neighbors: ["B"], owner: 0 },
      { id: "B", name: "Bravo", neighbors: ["A", "C"], owner: 1 },
      { id: "C", name: "Charlie", neighbors: ["B"], owner: 0 },
    ];

    const game = {
      currentPlayer: 0,
      players: [{ name: "P1" }, { name: "P2" }],
      getPhase: () => ATTACK,
      territoryById: (id) => territories.find((t) => t.id === id),
    };

    initTerritorySelection({ game, territories, territoryPositions: {} });
    await flushPromises();

    const aPath = document.getElementById("A");
    aPath.dispatchEvent(new Event("click", { bubbles: true }));

    const bButton = document.querySelector('.territory[data-id="B"]');
    expect(aPath.classList.contains("selected")).toBe(true);
    expect(bButton.classList.contains("possible-move")).toBe(true);
    expect(document.getElementById("selectedTerritory").textContent).toBe(
      "Alpha",
    );

    // clicking outside map clears selection
    document.dispatchEvent(new Event("pointerdown"));
    expect(aPath.classList.contains("selected")).toBe(false);
    expect(document.getElementById("selectedTerritory").textContent).toBe("");
  });
});
