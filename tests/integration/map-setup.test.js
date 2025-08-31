const fs = require("fs");
const path = require("path");

// Utility to wait for pending promises/microtasks
function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("game.html map setup", () => {
  beforeAll(async () => {
    // Load HTML into DOM
    const html = fs.readFileSync(
      path.resolve(__dirname, "../../game.html"),
      "utf8",
    );
    document.documentElement.innerHTML = html;

    // Prepare localStorage for game initialization
    localStorage.setItem("netriskMap", "map");
    localStorage.setItem(
      "netriskPlayers",
      JSON.stringify([
        { name: "Player1", color: "#f00" },
        { name: "Player2", color: "#0f0" },
      ]),
    );

    // Mock fetch for map data and world data
    const mapData = require("../../public/data/map.json");
    const world8 = require("../../public/data/world8.json");
    global.fetch = jest.fn((url) => {
      const u = url.toString();
      if (u.includes("map.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mapData),
        });
      }
      if (u.includes("world8.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(world8),
        });
      }
      if (u.includes("map.svg")) {
        const svg = `<svg id="map" viewBox="0 0 600 400">
          <rect id="t1" class="map-territory" />
          <rect id="t2" class="map-territory" />
          <rect id="t3" class="map-territory" />
          <rect id="t4" class="map-territory" />
          <rect id="t5" class="map-territory" />
          <rect id="t6" class="map-territory" />
        </svg>`;
        return Promise.resolve({ ok: true, text: () => Promise.resolve(svg) });
      }
      return Promise.reject(new Error(`Unhandled fetch ${url}`));
    });

    // Initialise game by requiring main entry
    require("../../src/main.js");
    // Allow pending promises (fetch, DOM updates) to complete
    await flushPromises();
    await flushPromises();
    await flushPromises();
    await flushPromises();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("initial armies are rendered for each territory", () => {
    const territoryIds = ["t1", "t2", "t3", "t4", "t5", "t6"];
    territoryIds.forEach((id) => {
      const selector = `.territory[data-id="${id}"]`;
      const btn = document.querySelector(selector);
      expect(btn).not.toBeNull();
      const val = Number(btn.textContent);
      expect(val).toBeGreaterThan(0);
    });
  });

  test("top control buttons are present and enabled", () => {
    const labelMap = {
      Reinforzo: ["Reinforzo", "Reinforce", "End Turn"],
      Attacco: ["Attacco", "Attack", "End Turn"],
      "Fine turno": ["Fine turno", "End Turn"],
    };
    Object.values(labelMap).forEach((labels) => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => {
        const text = b.textContent.trim();
        const aria = (b.getAttribute("aria-label") || "").trim();
        return labels.some((l) => text === l || aria === l);
      });
      expect(btn).toBeTruthy();
      expect(btn.disabled).toBe(false);
    });
  });
});
