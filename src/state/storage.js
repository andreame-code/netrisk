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
  clearSavedData,
  hasSavedPlayers,
  hasSavedGame,
  updateGameState,
};

