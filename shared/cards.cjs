const { createLocalizedError, createValidationFailure } = require("./messages.cjs");

const CardType = Object.freeze({
  INFANTRY: "infantry",
  CAVALRY: "cavalry",
  ARTILLERY: "artillery",
  WILD: "wild"
});

const STANDARD_CARD_RULE_SET_ID = "standard";
const STANDARD_TRADE_VALUES = [4, 6, 8, 10, 12, 15];
const STANDARD_MAX_HAND_BEFORE_FORCED_TRADE = 5;
const STANDARD_NON_WILD_TYPES = [CardType.INFANTRY, CardType.CAVALRY, CardType.ARTILLERY];

function createCard(input = {}) {
  return {
    id: input.id || null,
    type: input.type || CardType.INFANTRY,
    territoryId: input.territoryId || null
  };
}

function countTypes(cards) {
  return cards.reduce((counts, card) => {
    counts[card.type] = (counts[card.type] || 0) + 1;
    return counts;
  }, {});
}

function buildInvalidResult(reason, reasonKey, reasonParams = {}) {
  return createValidationFailure(reason, reasonKey, reasonParams);
}

function validateStandardCardSet(cards) {
  if (!Array.isArray(cards) || cards.length !== 3) {
    return buildInvalidResult("Card sets must contain exactly three cards.", "cards.invalidSetLength");
  }

  const invalidCard = cards.find((card) => !card || !Object.values(CardType).includes(card.type));
  if (invalidCard) {
    return buildInvalidResult("Card set contains an unsupported card type.", "cards.unsupportedType");
  }

  const counts = countTypes(cards);
  const wildCount = counts[CardType.WILD] || 0;

  for (const type of STANDARD_NON_WILD_TYPES) {
    if ((counts[type] || 0) + wildCount >= 3) {
      return {
        ok: true,
        pattern: "three-of-a-kind",
        resolvedType: type
      };
    }
  }

  const distinctTypes = STANDARD_NON_WILD_TYPES.filter((type) => (counts[type] || 0) > 0).length;
  if (distinctTypes + wildCount >= 3) {
    return {
      ok: true,
      pattern: "one-of-each",
      resolvedType: null
    };
  }

  return buildInvalidResult("Card set does not match a valid standard trade.", "cards.invalidTrade");
}

function standardTradeBonusForIndex(tradeIndex) {
  if (!Number.isInteger(tradeIndex) || tradeIndex < 0) {
    throw createLocalizedError("Trade index must be a non-negative integer.", "cards.invalidTradeIndex");
  }

  if (tradeIndex < STANDARD_TRADE_VALUES.length) {
    return STANDARD_TRADE_VALUES[tradeIndex];
  }

  return STANDARD_TRADE_VALUES[STANDARD_TRADE_VALUES.length - 1] + ((tradeIndex - STANDARD_TRADE_VALUES.length + 1) * 5);
}

function createStandardDeck(territoryIds = [], options = {}) {
  const ids = Array.isArray(territoryIds) ? territoryIds.filter(Boolean) : [];
  const wildCount = Number.isInteger(options.wildCount) ? options.wildCount : 2;
  const typedCards = ids.map((territoryId, index) => createCard({
    id: "card-" + territoryId,
    territoryId,
    type: STANDARD_NON_WILD_TYPES[index % STANDARD_NON_WILD_TYPES.length]
  }));
  const wildCards = Array.from({ length: Math.max(0, wildCount) }, (_, index) => createCard({
    id: "card-wild-" + (index + 1),
    type: CardType.WILD,
    territoryId: null
  }));
  return [...typedCards, ...wildCards];
}

const standardCardRuleSet = Object.freeze({
  id: STANDARD_CARD_RULE_SET_ID,
  cardTypes: Object.freeze([...STANDARD_NON_WILD_TYPES, CardType.WILD]),
  validateSet: validateStandardCardSet,
  tradeBonusForIndex: standardTradeBonusForIndex,
  createDeck: createStandardDeck,
  maxHandBeforeForcedTrade: STANDARD_MAX_HAND_BEFORE_FORCED_TRADE
});

function getCardRuleSet(ruleSetId = STANDARD_CARD_RULE_SET_ID) {
  if (ruleSetId === STANDARD_CARD_RULE_SET_ID) {
    return standardCardRuleSet;
  }

  throw createLocalizedError("Unsupported card rule set.", "cards.unsupportedRuleSet");
}

module.exports = {
  CardType,
  STANDARD_CARD_RULE_SET_ID,
  STANDARD_MAX_HAND_BEFORE_FORCED_TRADE,
  createCard,
  createStandardDeck,
  getCardRuleSet,
  standardCardRuleSet,
  standardTradeBonusForIndex,
  validateStandardCardSet
};
