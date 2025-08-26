import Game from "./game.js";
import aiTurnManager from "./src/ai/turn-manager.js";
import { destroyUI } from "./ui.js";
import { navigateTo } from "./navigation.js";
import {
  getSavedGame,
  getSavedPlayers,
  clearSavedGame,
} from "./persistence.js";

let game;
let territoryPositions = {};

async function loadMap(mapName) {
  try {
    const res = await fetch(`./src/data/${mapName}.json`);
    if (!res.ok) {
      throw new Error(`Failed to fetch map data: ${res.status}`);
    }
    const map = await res.json();
    territoryPositions = map.territories.reduce((acc, t) => {
      acc[t.id] = { x: t.x, y: t.y };
      return acc;
    }, {});
    return map;
  } catch (err) {
    if (typeof logger !== "undefined") {
      logger.error("Failed to load map data", err);
    }
    if (typeof alert !== "undefined") {
      alert("Unable to load game data. Please try again later.");
    }
    return null;
  }
}

function restoreGameState(GameClass, map) {
  let loadedGame = getSavedGame(GameClass);
  if (!loadedGame) {
    const players = getSavedPlayers();
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

async function loadGame() {
  const mapName =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("netriskMap")) ||
    "map";
  const map = await loadMap(mapName);
  if (!map) return;
  const GameClass =
    (typeof window !== "undefined" && window.Game) || Game;
  if (typeof GameClass !== "function") {
    throw new Error("Game class not available");
  }
  game = restoreGameState(GameClass, map);
  game.use(aiTurnManager);
  return game;
}

async function startNewGame() {
  const modal = document.getElementById("victoryModal");
  if (modal) modal.classList.remove("show");
  clearSavedGame();
  destroyUI();
  navigateTo("setup.html");
}

export { loadGame, startNewGame, game, territoryPositions };
