import { REINFORCE } from "../phases.js";

// Factory for encapsulated game state. Consumers interact via
// getters/setters rather than mutating a shared object directly.
class GameState {
  constructor() {
    this._state = {
      turnNumber: 1,
      currentPlayer: 0,
      players: [],
      territories: [],
      selectedTerritory: null,
      tokenPosition: null,
      phase: REINFORCE,
      log: [],
    };
  }

  // --- getters exposing read-only views ---
  get turnNumber() {
    return this._state.turnNumber;
  }
  get currentPlayer() {
    return this._state.currentPlayer;
  }
  get players() {
    return [...this._state.players];
  }
  get territories() {
    return [...this._state.territories];
  }
  get selectedTerritory() {
    return this._state.selectedTerritory;
  }
  get tokenPosition() {
    return this._state.tokenPosition;
  }
  get phase() {
    return this._state.phase;
  }
  get log() {
    return [...this._state.log];
  }

  // Return a frozen snapshot of the current state
  getSnapshot() {
    return Object.freeze({
      ...this._state,
      players: [...this._state.players],
      territories: [...this._state.territories],
      log: [...this._state.log],
    });
  }

  // --- mutation helpers ---
  initFromGame(game) {
    if (!game) return;
    this._state.currentPlayer = game.currentPlayer;
    this._state.players = game.players;
    this._state.territories = game.territories;
    this._state.phase = game.getPhase();
  }

  setSelectedTerritory(selected) {
    this._state.selectedTerritory = selected;
  }

  setTokenPosition(pos) {
    this._state.tokenPosition = pos;
  }

  incrementTurnNumber() {
    this._state.turnNumber += 1;
  }

  addLogEntry(entry) {
    this._state.log.push(entry);
  }
}

const gameState = new GameState();

function initGameState(game) {
  gameState.initFromGame(game);
}

function setSelectedTerritory(selected) {
  gameState.setSelectedTerritory(selected);
}

export { GameState, gameState, initGameState, setSelectedTerritory };
export default gameState;
