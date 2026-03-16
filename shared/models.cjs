const {
  TurnPhase,
  createContinent,
  createGameState,
  createPlayer,
  createTerritory
} = require("./core-domain.cjs");
const { GameAction } = require("./game-actions.cjs");

module.exports = {
  GameAction,
  TurnPhase,
  createContinent,
  createGameState,
  createPlayer,
  createTerritory
};
