import Game from "../game.js";
import aiTurnManager from "../ai/turn-manager.js";
import { getMapName, getSavedGame, getSavedPlayers } from "../state/storage.js";
import * as logger from "../logger.js";

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
    logger.error("Failed to load map data", err);
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
    logger.info("Game initialised");
  }
  return loadedGame;
}

async function loadGame() {
  const GameClass = (typeof window !== "undefined" && window.Game) || Game;
  if (typeof GameClass !== "function") {
    throw new Error("Game class not available");
  }

  const saved = getSavedGame(GameClass);
  if (saved) {
    territoryPositions = saved.territories.reduce((acc, t) => {
      acc[t.id] = { x: t.x, y: t.y };
      return acc;
    }, {});
    saved.use(aiTurnManager);
    return { game: saved, territoryPositions };
  }

  const mapName = getMapName();
  const map = await loadMap(mapName);
  if (!map) return { game: null, territoryPositions: {} };
  const game = restoreGameState(GameClass, map);
  game.use(aiTurnManager);
  return { game, territoryPositions };
}

export { loadMap, restoreGameState, loadGame, territoryPositions };

