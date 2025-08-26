export function updateGameState(game, gameState, selected = null) {
  gameState.currentPlayer = game.currentPlayer;
  gameState.players = game.players;
  gameState.territories = game.territories;
  gameState.phase = game.getPhase();
  gameState.selectedTerritory = selected;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem("netriskGame", game.serialize());
    } catch (err) {
      if (typeof logger !== "undefined") {
        logger.error("Failed to save game", err);
      }
    }
  }
}

export function getSavedGame(GameClass) {
  if (typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem("netriskGame");
      if (saved) {
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

export function getSavedPlayers() {
  if (typeof localStorage !== "undefined") {
    try {
      return JSON.parse(localStorage.getItem("netriskPlayers")) || [];
    } catch (err) {
      return [];
    }
  }
  return [];
}

export function clearSavedGame() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("netriskGame");
    localStorage.removeItem("netriskPlayers");
  }
}
