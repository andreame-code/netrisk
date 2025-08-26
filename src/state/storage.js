/* global logger */

// Helper functions to manage persisted state via localStorage

function getMapName() {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("netriskMap") || "map";
  }
  return "map";
}

function getSavedPlayers() {
  if (typeof localStorage !== "undefined") {
    try {
      return JSON.parse(localStorage.getItem("netriskPlayers")) || [];
    } catch {
      return [];
    }
  }
  return [];
}

function getSavedGame(GameClass) {
  if (typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem("netriskGame");
      if (saved && GameClass) {
        return GameClass.deserialize(saved);
      }
    } catch (err) {
      if (typeof logger !== "undefined") {
        logger.error("Failed to load saved game", err);
      }
    }
  }
  return null;
}

function saveGame(game) {
  if (typeof localStorage !== "undefined" && game) {
    try {
      localStorage.setItem("netriskGame", game.serialize());
    } catch (err) {
      if (typeof logger !== "undefined") {
        logger.error("Failed to save game", err);
      }
    }
  }
}

// --- Multi-save helpers ---

function getAllSavedGames() {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("netriskSaves")) || {};
  } catch {
    return {};
  }
}

function persistAllSavedGames(saves) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem("netriskSaves", JSON.stringify(saves));
  } catch (err) {
    if (typeof logger !== "undefined") {
      logger.error("Failed to persist saves", err);
    }
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
      if (typeof logger !== "undefined") {
        logger.error("Failed to load named game", err);
      }
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
    localStorage.removeItem("netriskGame");
    localStorage.removeItem("netriskPlayers");
  }
}

function hasSavedPlayers() {
  if (typeof localStorage !== "undefined") {
    return !!localStorage.getItem("netriskPlayers");
  }
  return false;
}

function hasSavedGame() {
  if (typeof localStorage !== "undefined") {
    return !!localStorage.getItem("netriskGame");
  }
  return false;
}

function updateGameState(gameState, game, selected = null) {
  if (!gameState || !game) return;
  gameState.currentPlayer = game.currentPlayer;
  gameState.players = game.players;
  gameState.territories = game.territories;
  gameState.phase = game.getPhase();
  gameState.selectedTerritory = selected;
  saveGame(game);
}

export {
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

