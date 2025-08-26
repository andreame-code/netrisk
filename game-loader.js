/* global logger */
import Game from "./game.js";

async function loadMap(mapName) {
  try {
    const res = await fetch(`./src/data/${mapName}.json`);
    if (!res.ok) {
      throw new Error(`Failed to fetch map data: ${res.status}`);
    }
    const map = await res.json();
    const territoryPositions = map.territories.reduce((acc, t) => {
      acc[t.id] = { x: t.x, y: t.y };
      return acc;
    }, {});
    return { map, territoryPositions };
  } catch (err) {
    if (typeof logger !== "undefined") {
      logger.error("Failed to load map data", err);
    }
    if (typeof alert !== "undefined") {
      alert("Unable to load game data. Please try again later.");
    }
    return { map: null, territoryPositions: {} };
  }
}

function restoreGameState(GameClass, map) {
  let loadedGame = null;
  if (typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem("netriskGame");
      if (saved) {
        loadedGame = GameClass.deserialize(saved);
      }
    } catch (err) {
      if (typeof logger !== "undefined") {
        logger.error("Failed to load saved game", err);
      }
    }
  }
  if (!loadedGame) {
    let players = [];
    if (typeof localStorage !== "undefined") {
      try {
        players = JSON.parse(localStorage.getItem("netriskPlayers")) || [];
      } catch (err) {
        players = [];
      }
    }
    loadedGame = new GameClass(
      players.length ? players : null,
      map.territories,
      map.continents,
      map.deck,
    );
    if (typeof logger !== "undefined") {
      logger.info("Game initialised");
    }
  }
  return loadedGame;
}

export async function loadGame() {
  const mapName =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("netriskMap")) ||
    "map";
  const { map, territoryPositions } = await loadMap(mapName);
  if (!map) return { game: null, territoryPositions };
  const GameClass =
    (typeof window !== "undefined" && window.Game) || Game;
  if (typeof GameClass !== "function") {
    throw new Error("Game class not available");
  }
  const game = restoreGameState(GameClass, map);
  return { game, territoryPositions };
}
