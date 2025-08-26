import { navigateTo } from "./navigation.js";

/* global logger */

export function updateGameState(gameState, game, selected = null) {
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

export async function startNewGame() {
  const modal = document.getElementById("victoryModal");
  if (modal) modal.classList.remove("show");
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("netriskGame");
    localStorage.removeItem("netriskPlayers");
  }
  navigateTo("setup.html");
}
