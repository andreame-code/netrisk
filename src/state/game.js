import { REINFORCE } from "../../phases.js";

// Centralized game state object used by the application.
// Keeping this in a dedicated module decouples the game's
// logic from any particular UI implementation.
const gameState = {
  turnNumber: 1,
  currentPlayer: 0,
  players: [],
  territories: [],
  selectedTerritory: null,
  tokenPosition: null,
  phase: REINFORCE,
  log: [],
};

// Initialize the game state from a Game instance
function initGameState(game) {
  if (!game) return;
  gameState.currentPlayer = game.currentPlayer;
  gameState.players = game.players;
  gameState.territories = game.territories;
  gameState.phase = game.getPhase();
}

// Helper to update only the selected territory reference
function setSelectedTerritory(selected) {
  gameState.selectedTerritory = selected;
}

export { gameState, initGameState, setSelectedTerritory };
export default gameState;
