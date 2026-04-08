const {
  TurnPhase,
  createContinent,
  createGameState,
  createPlayer,
  createTerritory
} = require("./core-domain.cjs");
const {
  DEFAULT_VICTORY_RULE_ID,
  createDefaultGameModeDefinition,
  createGameModeDefinition
} = require("./game-modes.cjs");
const {
  STANDARD_DICE_RULE_SET_ID,
  STANDARD_THREE_DEFENSE_DICE_RULE_SET_ID,
  STANDARD_TWO_DEFENSE_DICE_RULE_SET_ID,
  findDiceRuleSet,
  getDiceRuleSet,
  listDiceRuleSets,
  standardDiceRuleSet,
  standardThreeDefenseDiceRuleSet,
  standardTwoDefenseDiceRuleSet
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
const {
  findVictoryRule,
  listVictoryRules,
  standardEliminationVictoryRule,
  territoryControlVictoryRule
} = require("./victory-rules/index.cjs");
const {
  createCommunity,
  createCommunityMembership,
  createCustomMapDefinition,
  createLeaderboardEntry,
  createPieceThemeDefinition
} = require("./community-models.cjs");
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
  DEFAULT_VICTORY_RULE_ID,
  GameAction,
  STANDARD_DICE_RULE_SET_ID,
  STANDARD_THREE_DEFENSE_DICE_RULE_SET_ID,
  STANDARD_TWO_DEFENSE_DICE_RULE_SET_ID,
  findDiceRuleSet,
  getDiceRuleSet,
  listDiceRuleSets,
  listVictoryRules,
  standardDiceRuleSet,
  standardEliminationVictoryRule,
  standardThreeDefenseDiceRuleSet,
  standardTwoDefenseDiceRuleSet,
  STANDARD_CARD_RULE_SET_ID,
  STANDARD_MAX_HAND_BEFORE_FORCED_TRADE,
  TurnPhase,
  createCard,
  createActionFailure,
  createCommunity,
  createCommunityMembership,
  createContinent,
  createCustomMapDefinition,
  createDefaultGameModeDefinition,
  createDomainFailure,
  createGameState,
  createGameModeDefinition,
  createLeaderboardEntry,
  createLogEntry,
  createLocalizedError,
  createPieceThemeDefinition,
  createPlayer,
  createStandardDeck,
  createValidationFailure,
  createTerritory,
  getCardRuleSet,
  findVictoryRule,
  standardCardRuleSet,
  standardTradeBonusForIndex,
  territoryControlVictoryRule,
  validateStandardCardSet
};
