const {
  TurnPhase,
  createContinent,
  createGameState,
  createPlayer,
  createTerritory
} = require("./core-domain.cjs");
const {
  STANDARD_DICE_RULE_SET_ID,
  findDiceRuleSet,
  getDiceRuleSet,
  listDiceRuleSets,
  standardDiceRuleSet
} = require("./dice.cjs");
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
const {
  createActionFailure,
  createDomainFailure,
  createLogEntry,
  createLocalizedError,
  createValidationFailure
} = require("./messages.cjs");

module.exports = {
  CardType,
  GameAction,
  STANDARD_DICE_RULE_SET_ID,
  findDiceRuleSet,
  getDiceRuleSet,
  listDiceRuleSets,
  standardDiceRuleSet,
  STANDARD_CARD_RULE_SET_ID,
  STANDARD_MAX_HAND_BEFORE_FORCED_TRADE,
  TurnPhase,
  createCard,
  createActionFailure,
  createContinent,
  createDomainFailure,
  createGameState,
  createLogEntry,
  createLocalizedError,
  createPlayer,
  createStandardDeck,
  createValidationFailure,
  createTerritory,
  getCardRuleSet,
  standardCardRuleSet,
  standardTradeBonusForIndex,
  validateStandardCardSet
};
