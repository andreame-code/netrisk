export { attack, reinforce, move, playCard } from "./rules/index.js";
export {
  GameState,
  gameState,
  initGameState,
  setSelectedTerritory,
  serialize,
  deserialize,
} from "./state/index.js";
export {
  battleOutcomeProbs,
  attackSuccessProbability,
  territoryPriority,
} from "./ai/index.js";
export { performAITurn } from "./ai/turn-manager.js";
export { default as aiTurnManager } from "./ai/turn-manager.js";
