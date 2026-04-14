import { createLocalizedError, createValidationFailure, type MessageParams, type ValidationFailure } from "./messages.cjs";
import { createModuleRegistry } from "./module-registry.cjs";

export const CardType = Object.freeze({
  INFANTRY: "infantry",
  CAVALRY: "cavalry",
  ARTILLERY: "artillery",
  WILD: "wild"
} as const);

export type CardTypeValue = (typeof CardType)[keyof typeof CardType];
export type NonWildCardType = Exclude<CardTypeValue, typeof CardType.WILD>;

export interface Card {
  id: string | null;
  type: CardTypeValue;
  territoryId: string | null;
}

export interface CreateCardInput {
  id?: string | null;
  type?: CardTypeValue | null;
  territoryId?: string | null;
}

export interface CreateDeckOptions {
  wildCount?: number;
}

export interface ValidCardSet {
  ok: true;
  pattern: "three-of-a-kind" | "one-of-each";
  resolvedType: NonWildCardType | null;
}

export type CardSetValidationResult = ValidCardSet | ValidationFailure;

export interface CardRuleSet {
  id: string;
  name: string;
  cardTypes: readonly CardTypeValue[];
  validateSet: (cards: Card[]) => CardSetValidationResult;
  tradeBonusForIndex: (tradeIndex: number) => number;
  createDeck: (territoryIds?: string[], options?: CreateDeckOptions) => Card[];
  maxHandBeforeForcedTrade: number;
}

export interface CardRuleSetSummary {
  id: string;
  name: string;
  maxHandBeforeForcedTrade: number;
}

export const STANDARD_CARD_RULE_SET_ID = "standard";
const STANDARD_TRADE_VALUES = [4, 6, 8, 10, 12, 15] as const;
export const STANDARD_MAX_HAND_BEFORE_FORCED_TRADE = 5;
const STANDARD_NON_WILD_TYPES: readonly NonWildCardType[] = [
  CardType.INFANTRY,
  CardType.CAVALRY,
  CardType.ARTILLERY
];
const CARD_TYPES = Object.values(CardType) as CardTypeValue[];

export function createCard(input: CreateCardInput = {}): Card {
  return {
    id: input.id || null,
    type: input.type || CardType.INFANTRY,
    territoryId: input.territoryId || null
  };
}

function countTypes(cards: Card[]): Partial<Record<CardTypeValue, number>> {
  return cards.reduce<Partial<Record<CardTypeValue, number>>>((counts, card) => {
    counts[card.type] = (counts[card.type] || 0) + 1;
    return counts;
  }, {});
}

function buildInvalidResult(reason: string, reasonKey: string, reasonParams: MessageParams = {}): ValidationFailure {
  return createValidationFailure(reason, reasonKey, reasonParams);
}

function isCardType(value: unknown): value is CardTypeValue {
  return typeof value === "string" && CARD_TYPES.includes(value as CardTypeValue);
}

export function validateStandardCardSet(cards: Card[]): CardSetValidationResult {
  if (!Array.isArray(cards) || cards.length !== 3) {
    return buildInvalidResult("Card sets must contain exactly three cards.", "cards.invalidSetLength");
  }

  const invalidCard = cards.find((card) => !card || !isCardType(card.type));
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

export function standardTradeBonusForIndex(tradeIndex: number): number {
  if (!Number.isInteger(tradeIndex) || tradeIndex < 0) {
    throw createLocalizedError("Trade index must be a non-negative integer.", "cards.invalidTradeIndex");
  }

  if (tradeIndex < STANDARD_TRADE_VALUES.length) {
    return STANDARD_TRADE_VALUES[tradeIndex];
  }

  return STANDARD_TRADE_VALUES[STANDARD_TRADE_VALUES.length - 1] + ((tradeIndex - STANDARD_TRADE_VALUES.length + 1) * 5);
}

export function createStandardDeck(territoryIds: string[] = [], options: CreateDeckOptions = {}): Card[] {
  const ids = Array.isArray(territoryIds) ? territoryIds.filter(Boolean) : [];
  const wildCount = typeof options.wildCount === "number" && Number.isInteger(options.wildCount) ? options.wildCount : 2;
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

export const standardCardRuleSet: Readonly<CardRuleSet> = Object.freeze({
  id: STANDARD_CARD_RULE_SET_ID,
  name: "Standard",
  cardTypes: Object.freeze([...STANDARD_NON_WILD_TYPES, CardType.WILD]),
  validateSet: validateStandardCardSet,
  tradeBonusForIndex: standardTradeBonusForIndex,
  createDeck: createStandardDeck,
  maxHandBeforeForcedTrade: STANDARD_MAX_HAND_BEFORE_FORCED_TRADE
});

const cardRuleSetRegistry = createModuleRegistry<CardRuleSet>(
  [standardCardRuleSet],
  {
    onMissing(ruleSetId) {
      throw createLocalizedError("Unsupported card rule set.", "cards.unsupportedRuleSet", { ruleSetId });
    }
  }
);

export function findCardRuleSet(ruleSetId: string | null | undefined): Readonly<CardRuleSet> | null {
  return cardRuleSetRegistry.find(ruleSetId);
}

export function getCardRuleSet(ruleSetId: string = STANDARD_CARD_RULE_SET_ID): Readonly<CardRuleSet> {
  return cardRuleSetRegistry.get(ruleSetId, STANDARD_CARD_RULE_SET_ID);
}

export function listCardRuleSets(): CardRuleSetSummary[] {
  return cardRuleSetRegistry.entries.map((ruleSet) => ({
    id: ruleSet.id,
    name: ruleSet.name,
    maxHandBeforeForcedTrade: ruleSet.maxHandBeforeForcedTrade
  }));
}
