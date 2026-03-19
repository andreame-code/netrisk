const {
  TurnPhase,
  createContinent,
  createGameState,
  createPlayer,
  createTerritory
} = require("./core-domain.cjs");
const {
  CardType,
  STANDARD_CARD_RULE_SET_ID,
  STANDARD_MAX_HAND_BEFORE_FORCED_TRADE,
  createCard,
  createStandardDeck,
  getCardRuleSet,
  standardCardRuleSet,
  standardTradeBonusForIndex,
  validateStandardCardSet
} = require("./cards.cjs");
const { GameAction } = require("./game-actions.cjs");

module.exports = {
  CardType,
  GameAction,
  STANDARD_CARD_RULE_SET_ID,
  STANDARD_MAX_HAND_BEFORE_FORCED_TRADE,
  TurnPhase,
  createCard,
  createContinent,
  createGameState,
  createPlayer,
  createStandardDeck,
  createTerritory,
  getCardRuleSet,
  standardCardRuleSet,
  standardTradeBonusForIndex,
  validateStandardCardSet
};
