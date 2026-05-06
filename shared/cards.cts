import {
  createLocalizedError,
  createValidationFailure,
  type MessageParams,
  type ValidationFailure
} from "./messages.cjs";
import { createModuleRegistry } from "./module-registry.cjs";
import { moduleApiVersion } from "./version-manifest.cjs";

export const CardType = Object.freeze({
  INFANTRY: "infantry",
  CAVALRY: "cavalry",
  ARTILLERY: "artillery",
  WILD: "wild"
} as const);

export type CardTypeValue = (typeof CardType)[keyof typeof CardType];
export type NonWildCardType = Exclude<CardTypeValue, typeof CardType.WILD>;

export const CardEffectType = Object.freeze({
  TRADE_FOR_REINFORCEMENTS: "tradeForReinforcements"
} as const);

export type CardEffectTypeValue = (typeof CardEffectType)[keyof typeof CardEffectType];

export const CardPlayCondition = Object.freeze({
  REINFORCEMENT_PHASE: "reinforcementPhase",
  CURRENT_PLAYER: "currentPlayer",
  THREE_CARD_SET: "threeCardSet"
} as const);

export type CardPlayConditionValue = (typeof CardPlayCondition)[keyof typeof CardPlayCondition];

export const CardVisualTone = Object.freeze({
  INFANTRY: "infantry",
  CAVALRY: "cavalry",
  ARTILLERY: "artillery",
  WILD: "wild"
} as const);

export type CardVisualToneValue = (typeof CardVisualTone)[keyof typeof CardVisualTone];

export const STANDARD_CARD_EFFECT_TYPES: readonly CardEffectTypeValue[] = Object.freeze([
  CardEffectType.TRADE_FOR_REINFORCEMENTS
]);
export const STANDARD_CARD_PLAY_CONDITIONS: readonly CardPlayConditionValue[] = Object.freeze([
  CardPlayCondition.REINFORCEMENT_PHASE,
  CardPlayCondition.CURRENT_PLAYER,
  CardPlayCondition.THREE_CARD_SET
]);
export const STANDARD_CARD_VISUAL_TONES: readonly CardVisualToneValue[] = Object.freeze(
  Object.values(CardVisualTone) as CardVisualToneValue[]
);

export interface Card {
  id: string | null;
  type: CardTypeValue;
  territoryId: string | null;
  definitionId?: string | null;
}

export interface CreateCardInput {
  id?: string | null;
  type?: CardTypeValue | null;
  territoryId?: string | null;
  definitionId?: string | null;
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

export interface CardVisualDefinition {
  token: string;
  tone: CardVisualToneValue;
  iconKey?: string | null;
}

export interface CardEffectDefinition {
  type: CardEffectTypeValue;
}

export interface CardCompatibilityMetadata {
  moduleId?: string | null;
  moduleApiVersion?: string | null;
  version?: string | null;
}

export interface CardDefinition {
  id: string;
  displayName: string;
  displayNameKey?: string | null;
  description: string;
  descriptionKey?: string | null;
  category: string;
  type?: CardTypeValue | null;
  territoryId?: string | null;
  visual: CardVisualDefinition;
  effect: CardEffectDefinition;
  playConditions?: readonly CardPlayConditionValue[];
  compatibility?: CardCompatibilityMetadata | null;
}

export interface CardModuleManifest {
  id: string;
  name: string;
  description: string;
  moduleId?: string | null;
  version?: string | null;
  moduleApiVersion?: string | null;
  definitions: readonly CardDefinition[];
}

export interface CardModuleValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface CardModuleValidationResult {
  ok: boolean;
  issues: CardModuleValidationIssue[];
}

export interface CardRenderingData {
  definitionId: string;
  displayName: string;
  displayNameKey?: string | null;
  description: string;
  descriptionKey?: string | null;
  category: string;
  visual: CardVisualDefinition;
  effectType: CardEffectTypeValue;
  playConditions: readonly CardPlayConditionValue[];
}

export interface CardRuleSet {
  id: string;
  name: string;
  description: string;
  manifest: CardModuleManifest;
  effect: CardEffectDefinition;
  cardTypes: readonly CardTypeValue[];
  definitions: readonly CardDefinition[];
  validateSet: (cards: Card[]) => CardSetValidationResult;
  tradeBonusForIndex: (tradeIndex: number) => number;
  createDeck: (territoryIds?: string[], options?: CreateDeckOptions) => Card[];
  maxHandBeforeForcedTrade: number;
  resolveDefinition: (card: Card) => Readonly<CardDefinition>;
  renderCard: (card: Card) => CardRenderingData;
}

export interface CardRuleSetSummary {
  id: string;
  name: string;
  description?: string;
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
const EFFECT_TYPES = Object.values(CardEffectType) as CardEffectTypeValue[];
const PLAY_CONDITIONS = Object.values(CardPlayCondition) as CardPlayConditionValue[];

const STANDARD_CARD_DEFINITION_IDS: Record<CardTypeValue, string> = {
  [CardType.INFANTRY]: "standard-infantry",
  [CardType.CAVALRY]: "standard-cavalry",
  [CardType.ARTILLERY]: "standard-artillery",
  [CardType.WILD]: "standard-wild"
};

const STANDARD_CARD_VISUALS: Record<CardTypeValue, CardVisualDefinition> = {
  [CardType.INFANTRY]: Object.freeze({ token: "I", tone: CardVisualTone.INFANTRY }),
  [CardType.CAVALRY]: Object.freeze({ token: "H", tone: CardVisualTone.CAVALRY }),
  [CardType.ARTILLERY]: Object.freeze({ token: "C", tone: CardVisualTone.ARTILLERY }),
  [CardType.WILD]: Object.freeze({ token: "*", tone: CardVisualTone.WILD })
};

export const standardCardModuleManifest: Readonly<CardModuleManifest> = Object.freeze({
  id: STANDARD_CARD_RULE_SET_ID,
  name: "Standard",
  description: "Core Risk-style territory cards traded for reinforcements.",
  moduleId: "core.base",
  version: "1.0.0",
  moduleApiVersion,
  definitions: Object.freeze([
    Object.freeze({
      id: STANDARD_CARD_DEFINITION_IDS[CardType.INFANTRY],
      displayName: "Infantry",
      displayNameKey: "game.runtime.cardType.infantry",
      description: "Standard infantry card for reinforcement trades.",
      descriptionKey: "game.cards.description.infantry",
      category: CardType.INFANTRY,
      type: CardType.INFANTRY,
      visual: STANDARD_CARD_VISUALS[CardType.INFANTRY],
      effect: Object.freeze({ type: CardEffectType.TRADE_FOR_REINFORCEMENTS }),
      playConditions: STANDARD_CARD_PLAY_CONDITIONS,
      compatibility: Object.freeze({ moduleId: "core.base", moduleApiVersion, version: "1.0.0" })
    }),
    Object.freeze({
      id: STANDARD_CARD_DEFINITION_IDS[CardType.CAVALRY],
      displayName: "Cavalry",
      displayNameKey: "game.runtime.cardType.cavalry",
      description: "Standard cavalry card for reinforcement trades.",
      descriptionKey: "game.cards.description.cavalry",
      category: CardType.CAVALRY,
      type: CardType.CAVALRY,
      visual: STANDARD_CARD_VISUALS[CardType.CAVALRY],
      effect: Object.freeze({ type: CardEffectType.TRADE_FOR_REINFORCEMENTS }),
      playConditions: STANDARD_CARD_PLAY_CONDITIONS,
      compatibility: Object.freeze({ moduleId: "core.base", moduleApiVersion, version: "1.0.0" })
    }),
    Object.freeze({
      id: STANDARD_CARD_DEFINITION_IDS[CardType.ARTILLERY],
      displayName: "Artillery",
      displayNameKey: "game.runtime.cardType.artillery",
      description: "Standard artillery card for reinforcement trades.",
      descriptionKey: "game.cards.description.artillery",
      category: CardType.ARTILLERY,
      type: CardType.ARTILLERY,
      visual: STANDARD_CARD_VISUALS[CardType.ARTILLERY],
      effect: Object.freeze({ type: CardEffectType.TRADE_FOR_REINFORCEMENTS }),
      playConditions: STANDARD_CARD_PLAY_CONDITIONS,
      compatibility: Object.freeze({ moduleId: "core.base", moduleApiVersion, version: "1.0.0" })
    }),
    Object.freeze({
      id: STANDARD_CARD_DEFINITION_IDS[CardType.WILD],
      displayName: "Wild",
      displayNameKey: "game.runtime.cardType.wild",
      description: "Wild card that can complete any standard reinforcement trade.",
      descriptionKey: "game.cards.description.wild",
      category: CardType.WILD,
      type: CardType.WILD,
      visual: STANDARD_CARD_VISUALS[CardType.WILD],
      effect: Object.freeze({ type: CardEffectType.TRADE_FOR_REINFORCEMENTS }),
      playConditions: STANDARD_CARD_PLAY_CONDITIONS,
      compatibility: Object.freeze({ moduleId: "core.base", moduleApiVersion, version: "1.0.0" })
    })
  ])
});

export function createCard(input: CreateCardInput = {}): Card {
  const resolvedType = input.type || CardType.INFANTRY;
  return {
    id: input.id || null,
    type: resolvedType,
    territoryId: input.territoryId || null,
    definitionId: input.definitionId || STANDARD_CARD_DEFINITION_IDS[resolvedType] || null
  };
}

function countTypes(cards: Card[]): Partial<Record<CardTypeValue, number>> {
  return cards.reduce<Partial<Record<CardTypeValue, number>>>((counts, card) => {
    counts[card.type] = (counts[card.type] || 0) + 1;
    return counts;
  }, {});
}

function buildInvalidResult(
  reason: string,
  reasonKey: string,
  reasonParams: MessageParams = {}
): ValidationFailure {
  return createValidationFailure(reason, reasonKey, reasonParams);
}

function isCardType(value: unknown): value is CardTypeValue {
  return typeof value === "string" && CARD_TYPES.includes(value as CardTypeValue);
}

function isCardEffectType(value: unknown): value is CardEffectTypeValue {
  return typeof value === "string" && EFFECT_TYPES.includes(value as CardEffectTypeValue);
}

function isCardPlayCondition(value: unknown): value is CardPlayConditionValue {
  return typeof value === "string" && PLAY_CONDITIONS.includes(value as CardPlayConditionValue);
}

function isCardVisualTone(value: unknown): value is CardVisualToneValue {
  return (
    typeof value === "string" && STANDARD_CARD_VISUAL_TONES.includes(value as CardVisualToneValue)
  );
}

function hasUnsafeSerializableValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet()
): boolean {
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    return true;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  if (seen.has(value)) {
    return true;
  }
  seen.add(value);

  const unsafe = Object.values(value as Record<string, unknown>).some((entry) =>
    hasUnsafeSerializableValue(entry, seen)
  );
  seen.delete(value);
  return unsafe;
}

function issue(code: string, path: string, message: string): CardModuleValidationIssue {
  return { code, path, message };
}

export function validateCardModuleManifest(
  manifest: CardModuleManifest,
  options: {
    territoryIds?: readonly string[];
    effectTypes?: readonly CardEffectTypeValue[];
    visualTones?: readonly CardVisualToneValue[];
  } = {}
): CardModuleValidationResult {
  const issues: CardModuleValidationIssue[] = [];
  const allowedTerritoryIds = new Set(options.territoryIds || []);
  const validateTerritories = Boolean(options.territoryIds);
  const allowedEffectTypes = new Set(options.effectTypes || STANDARD_CARD_EFFECT_TYPES);
  const allowedVisualTones = new Set(options.visualTones || STANDARD_CARD_VISUAL_TONES);

  if (!manifest || typeof manifest !== "object") {
    return {
      ok: false,
      issues: [issue("invalid-manifest", "$", "Card module manifest must be an object.")]
    };
  }

  if (!manifest.id || typeof manifest.id !== "string") {
    issues.push(issue("missing-id", "id", "Card module manifest requires an id."));
  }

  if (!manifest.name || typeof manifest.name !== "string" || !manifest.name.trim()) {
    issues.push(issue("missing-name", "name", "Card module manifest requires a name."));
  }

  if (!manifest.description || typeof manifest.description !== "string") {
    issues.push(
      issue("missing-description", "description", "Card module manifest requires a description.")
    );
  }

  if (
    manifest.moduleApiVersion !== null &&
    typeof manifest.moduleApiVersion !== "undefined" &&
    (typeof manifest.moduleApiVersion !== "string" || !manifest.moduleApiVersion.trim())
  ) {
    issues.push(
      issue(
        "invalid-module-api-version",
        "moduleApiVersion",
        "Card module manifest moduleApiVersion must be a non-empty string."
      )
    );
  }

  if (hasUnsafeSerializableValue(manifest)) {
    issues.push(
      issue(
        "unsafe-serialization",
        "$",
        "Card module manifests must contain JSON-serializable data only."
      )
    );
  }

  if (!Array.isArray(manifest.definitions) || manifest.definitions.length === 0) {
    issues.push(
      issue("missing-definitions", "definitions", "Card module manifest requires definitions.")
    );
    return { ok: false, issues };
  }

  const seenDefinitionIds = new Set<string>();
  manifest.definitions.forEach((definition, index) => {
    const path = `definitions.${index}`;
    if (!definition || typeof definition !== "object") {
      issues.push(issue("invalid-definition", path, "Card definition must be an object."));
      return;
    }

    if (!definition.id || typeof definition.id !== "string" || !definition.id.trim()) {
      issues.push(issue("missing-card-id", `${path}.id`, "Card definition requires an id."));
    } else if (seenDefinitionIds.has(definition.id)) {
      issues.push(
        issue("duplicate-card-id", `${path}.id`, `Duplicate card definition id "${definition.id}".`)
      );
    } else {
      seenDefinitionIds.add(definition.id);
    }

    if (!definition.displayName || typeof definition.displayName !== "string") {
      issues.push(
        issue("missing-display-name", `${path}.displayName`, "Card definition requires a name.")
      );
    }

    if (!definition.description || typeof definition.description !== "string") {
      issues.push(
        issue(
          "missing-description",
          `${path}.description`,
          "Card definition requires a description."
        )
      );
    }

    if (!definition.category || typeof definition.category !== "string") {
      issues.push(
        issue("missing-category", `${path}.category`, "Card definition requires a category.")
      );
    }

    if (!definition.effect || !isCardEffectType(definition.effect.type)) {
      issues.push(
        issue(
          "invalid-effect-handler",
          `${path}.effect.type`,
          "Card definition references an unknown effect handler."
        )
      );
    } else if (!allowedEffectTypes.has(definition.effect.type)) {
      issues.push(
        issue(
          "unsupported-effect-handler",
          `${path}.effect.type`,
          `Card effect handler "${definition.effect.type}" is not registered.`
        )
      );
    }

    if (!definition.visual || typeof definition.visual !== "object") {
      issues.push(
        issue("missing-visual", `${path}.visual`, "Card definition requires visual metadata.")
      );
    } else {
      if (
        !definition.visual.token ||
        typeof definition.visual.token !== "string" ||
        definition.visual.token.length > 3
      ) {
        issues.push(
          issue(
            "invalid-visual-token",
            `${path}.visual.token`,
            "Card visual token must be a 1-3 character string."
          )
        );
      }

      if (
        !isCardVisualTone(definition.visual.tone) ||
        !allowedVisualTones.has(definition.visual.tone)
      ) {
        issues.push(
          issue("invalid-visual-tone", `${path}.visual.tone`, "Card visual tone is not supported.")
        );
      }
    }

    if (
      definition.territoryId &&
      validateTerritories &&
      !allowedTerritoryIds.has(definition.territoryId)
    ) {
      issues.push(
        issue(
          "invalid-territory-reference",
          `${path}.territoryId`,
          `Card definition references unknown territory "${definition.territoryId}".`
        )
      );
    }

    if (
      Array.isArray(definition.playConditions) &&
      definition.playConditions.some(
        (condition: CardPlayConditionValue) => !isCardPlayCondition(condition)
      )
    ) {
      issues.push(
        issue(
          "invalid-play-condition",
          `${path}.playConditions`,
          "Card definition contains an unknown play condition."
        )
      );
    }
  });

  return { ok: issues.length === 0, issues };
}

export function assertValidCardModuleManifest(
  manifest: CardModuleManifest,
  options: Parameters<typeof validateCardModuleManifest>[1] = {}
): void {
  const validation = validateCardModuleManifest(manifest, options);
  if (!validation.ok) {
    throw createLocalizedError(
      validation.issues[0]?.message || "Invalid card module manifest.",
      "cards.invalidModuleManifest",
      { issueCode: validation.issues[0]?.code || "invalid-manifest" }
    );
  }
}

export function validateStandardCardSet(cards: Card[]): CardSetValidationResult {
  if (!Array.isArray(cards) || cards.length !== 3) {
    return buildInvalidResult(
      "Card sets must contain exactly three cards.",
      "cards.invalidSetLength"
    );
  }

  const invalidCard = cards.find((card) => !card || !isCardType(card.type));
  if (invalidCard) {
    return buildInvalidResult(
      "Card set contains an unsupported card type.",
      "cards.unsupportedType"
    );
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

  return buildInvalidResult(
    "Card set does not match a valid standard trade.",
    "cards.invalidTrade"
  );
}

export function standardTradeBonusForIndex(tradeIndex: number): number {
  if (!Number.isInteger(tradeIndex) || tradeIndex < 0) {
    throw createLocalizedError(
      "Trade index must be a non-negative integer.",
      "cards.invalidTradeIndex"
    );
  }

  if (tradeIndex < STANDARD_TRADE_VALUES.length) {
    return STANDARD_TRADE_VALUES[tradeIndex];
  }

  return (
    STANDARD_TRADE_VALUES[STANDARD_TRADE_VALUES.length - 1] +
    (tradeIndex - STANDARD_TRADE_VALUES.length + 1) * 5
  );
}

export function createStandardDeck(
  territoryIds: string[] = [],
  options: CreateDeckOptions = {}
): Card[] {
  const ids = Array.isArray(territoryIds) ? territoryIds.filter(Boolean) : [];
  const wildCount =
    typeof options.wildCount === "number" && Number.isInteger(options.wildCount)
      ? options.wildCount
      : 2;
  const typedCards = ids.map((territoryId, index) =>
    createCard({
      id: "card-" + territoryId,
      territoryId,
      type: STANDARD_NON_WILD_TYPES[index % STANDARD_NON_WILD_TYPES.length],
      definitionId:
        STANDARD_CARD_DEFINITION_IDS[
          STANDARD_NON_WILD_TYPES[index % STANDARD_NON_WILD_TYPES.length]
        ]
    })
  );
  const wildCards = Array.from({ length: Math.max(0, wildCount) }, (_, index) =>
    createCard({
      id: "card-wild-" + (index + 1),
      type: CardType.WILD,
      territoryId: null,
      definitionId: STANDARD_CARD_DEFINITION_IDS[CardType.WILD]
    })
  );
  return [...typedCards, ...wildCards];
}

function definitionById(definitions: readonly CardDefinition[]): Record<string, CardDefinition> {
  return definitions.reduce<Record<string, CardDefinition>>((accumulator, definition) => {
    accumulator[definition.id] = definition;
    return accumulator;
  }, {});
}

const standardDefinitionsById = definitionById(standardCardModuleManifest.definitions);
const standardDefinitionsByType = standardCardModuleManifest.definitions.reduce<
  Partial<Record<CardTypeValue, CardDefinition>>
>((accumulator, definition) => {
  if (definition.type) {
    accumulator[definition.type] = definition;
  }
  return accumulator;
}, {});

export function resolveStandardCardDefinition(card: Card): Readonly<CardDefinition> {
  const definitionId = card.definitionId || STANDARD_CARD_DEFINITION_IDS[card.type];
  return (standardDefinitionsById[definitionId || ""] ||
    standardDefinitionsByType[card.type] ||
    standardDefinitionsByType[CardType.INFANTRY]) as Readonly<CardDefinition>;
}

export function renderCardFromDefinition(
  card: Card,
  definition: Readonly<CardDefinition>
): CardRenderingData {
  return {
    definitionId: definition.id,
    displayName: definition.displayName,
    displayNameKey: definition.displayNameKey || null,
    description: definition.description,
    descriptionKey: definition.descriptionKey || null,
    category: definition.category,
    visual: {
      token: definition.visual.token,
      tone: definition.visual.tone,
      iconKey: definition.visual.iconKey || null
    },
    effectType: definition.effect.type,
    playConditions: definition.playConditions || STANDARD_CARD_PLAY_CONDITIONS
  };
}

export const standardCardRuleSet: Readonly<CardRuleSet> = Object.freeze({
  id: STANDARD_CARD_RULE_SET_ID,
  name: "Standard",
  description: standardCardModuleManifest.description,
  manifest: standardCardModuleManifest,
  effect: Object.freeze({ type: CardEffectType.TRADE_FOR_REINFORCEMENTS }),
  cardTypes: Object.freeze([...STANDARD_NON_WILD_TYPES, CardType.WILD]),
  definitions: standardCardModuleManifest.definitions,
  validateSet: validateStandardCardSet,
  tradeBonusForIndex: standardTradeBonusForIndex,
  createDeck: createStandardDeck,
  maxHandBeforeForcedTrade: STANDARD_MAX_HAND_BEFORE_FORCED_TRADE,
  resolveDefinition: resolveStandardCardDefinition,
  renderCard(card: Card): CardRenderingData {
    return renderCardFromDefinition(card, resolveStandardCardDefinition(card));
  }
});

assertValidCardModuleManifest(standardCardModuleManifest);

const cardRuleSetRegistry = createModuleRegistry<CardRuleSet>([standardCardRuleSet], {
  onMissing(ruleSetId) {
    throw createLocalizedError("Unsupported card rule set.", "cards.unsupportedRuleSet", {
      ruleSetId
    });
  }
});

export function findCardRuleSet(
  ruleSetId: string | null | undefined
): Readonly<CardRuleSet> | null {
  return cardRuleSetRegistry.find(ruleSetId);
}

export function getCardRuleSet(
  ruleSetId: string = STANDARD_CARD_RULE_SET_ID
): Readonly<CardRuleSet> {
  return cardRuleSetRegistry.get(ruleSetId, STANDARD_CARD_RULE_SET_ID);
}

export function listCardRuleSets(): CardRuleSetSummary[] {
  return cardRuleSetRegistry.entries.map((ruleSet) => ({
    id: ruleSet.id,
    name: ruleSet.name,
    description: ruleSet.description,
    maxHandBeforeForcedTrade: ruleSet.maxHandBeforeForcedTrade
  }));
}
