import * as logger from "../logger.js";

// Storage keys
const KEY_MAP = "netriskMap";
const KEY_PLAYERS = "netriskPlayers";
const KEY_GAME = "netriskGame";
const KEY_SAVES = "netriskSaves";

// Helper functions to manage persisted state via localStorage

function getMapName() {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem(KEY_MAP) || "map";
  }
  return "map";
}

function getSavedPlayers() {
  if (typeof localStorage !== "undefined") {
    try {
      return JSON.parse(localStorage.getItem(KEY_PLAYERS)) || [];
    } catch {
      return [];
    }
  }
  return [];
}

function getSavedGame(GameClass) {
  if (typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem(KEY_GAME);
      if (saved && GameClass) {
        return GameClass.deserialize(saved);
      }
    } catch (err) {
      logger.error("Failed to load saved game", err);
    }
  }
  return null;
}

function saveGame(game) {
  if (typeof localStorage !== "undefined" && game) {
    try {
      localStorage.setItem(KEY_GAME, game.serialize());
    } catch (err) {
      logger.error("Failed to save game", err);
    }
  }
}

// --- Multi-save helpers ---

function getAllSavedGames() {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY_SAVES)) || {};
  } catch {
    return {};
  }
}

function persistAllSavedGames(saves) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY_SAVES, JSON.stringify(saves));
  } catch (err) {
    logger.error("Failed to persist saves", err);
  }
}

function saveNamedGame(name, game, meta = {}) {
  if (!name || !game || typeof localStorage === "undefined") return;
  const saves = getAllSavedGames();
  saves[name] = {
    data: game.serialize(),
    map: meta.map || getMapName(),
    savedAt: meta.savedAt || Date.now(),
    turn: meta.turn || game.turnNumber || 0,
  };
  persistAllSavedGames(saves);
}

function loadNamedGame(name, GameClass) {
  if (!name || typeof localStorage === "undefined") return null;
  const saves = getAllSavedGames();
  const slot = saves[name];
  if (slot && GameClass) {
    try {
      return GameClass.deserialize(slot.data);
    } catch (err) {
      logger.error("Failed to load named game", err);
    }
  }
  return null;
}

function listSavedGames() {
  const saves = getAllSavedGames();
  return Object.entries(saves).map(([name, { map, savedAt, turn }]) => ({
    name,
    map,
    savedAt,
    turn,
  }));
}

function renameSavedGame(oldName, newName) {
  if (!oldName || !newName || typeof localStorage === "undefined") return;
  const saves = getAllSavedGames();
  if (saves[oldName]) {
    saves[newName] = saves[oldName];
    delete saves[oldName];
    persistAllSavedGames(saves);
  }
}

function deleteSavedGame(name) {
  if (!name || typeof localStorage === "undefined") return;
  const saves = getAllSavedGames();
  if (saves[name]) {
    delete saves[name];
    persistAllSavedGames(saves);
  }
}

function clearSavedData() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(KEY_GAME);
    localStorage.removeItem(KEY_PLAYERS);
  }
}

function hasSavedPlayers() {
  if (typeof localStorage !== "undefined") {
    return !!localStorage.getItem(KEY_PLAYERS);
  }
  return false;
}

function hasSavedGame() {
  if (typeof localStorage !== "undefined") {
    return !!localStorage.getItem(KEY_GAME);
  }
  return false;
}

function updateGameState(gameState, game, selected = null) {
  if (!gameState || !game) return;
  gameState.initFromGame(game);
  gameState.setSelectedTerritory(selected);
  saveGame(game);
}

export {
  KEY_MAP,
  KEY_PLAYERS,
  KEY_GAME,
  KEY_SAVES,
  getMapName,
  getSavedGame,
  getSavedPlayers,
  saveGame,
  saveNamedGame,
  loadNamedGame,
  listSavedGames,
  renameSavedGame,
  deleteSavedGame,
  clearSavedData,
  hasSavedPlayers,
  hasSavedGame,
  updateGameState,
};
