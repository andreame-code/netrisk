import {
  CardEffectType,
  createActionFailure,
  type ActionFailure,
  type Card,
  type CardEffectTypeValue,
  type CardRuleSet,
  type CardSetValidationResult,
  type GameState,
  type Player
} from "../../shared/models.cjs";

export type CardEffectSuccess = {
  ok: true;
  bonus: number;
  validation: CardSetValidationResult;
};

export type CardEffectResult = ActionFailure | CardEffectSuccess;

export interface CardEffectContext {
  state: GameState;
  player: Player;
  playerId: string;
  hand: Card[];
  selectedCards: Card[];
  selectedCardIds: string[];
  cardRuleSet: Readonly<CardRuleSet>;
  appendLog(
    state: GameState,
    message: string,
    messageKey: string | null,
    messageParams?: Record<string, unknown>
  ): void;
}

export interface CardEffectHandler {
  type: CardEffectTypeValue;
  canPlay(
    context: CardEffectContext
  ): ActionFailure | { ok: true; validation: CardSetValidationResult };
  apply(context: CardEffectContext): CardEffectResult;
}

const tradeForReinforcementsHandler: CardEffectHandler = Object.freeze({
  type: CardEffectType.TRADE_FOR_REINFORCEMENTS,
  canPlay(context: CardEffectContext) {
    const validation = context.cardRuleSet.validateSet(context.selectedCards);
    if (!validation.ok) {
      return createActionFailure(validation.reason, validation.reasonKey, validation.reasonParams);
    }

    return { ok: true as const, validation };
  },
  apply(context: CardEffectContext): CardEffectResult {
    const playability = this.canPlay(context);
    if (!playability.ok) {
      return playability as ActionFailure;
    }

    const bonus = context.cardRuleSet.tradeBonusForIndex(context.state.tradeCount || 0);
    context.state.hands[context.playerId] = context.hand.filter(
      (card) => !card.id || !context.selectedCardIds.includes(card.id)
    );
    if (!Array.isArray(context.state.discardPile)) {
      context.state.discardPile = [];
    }
    context.state.discardPile.push(...context.selectedCards);
    context.state.tradeCount = (context.state.tradeCount || 0) + 1;
    context.state.reinforcementPool += bonus;
    context.state.lastAction = {
      type: "tradeCards",
      summary: context.player.name + " scambia un set di carte e riceve " + bonus + " rinforzi.",
      summaryKey: "game.log.tradeCompleted",
      summaryParams: {
        playerName: context.player.name,
        bonus
      }
    };
    context.appendLog(
      context.state,
      context.player.name + " scambia un set di carte e riceve " + bonus + " rinforzi.",
      "game.log.tradeCompleted",
      {
        playerName: context.player.name,
        bonus
      }
    );
    return { ok: true, bonus, validation: playability.validation };
  }
});

const cardEffectHandlers = new Map<CardEffectTypeValue, CardEffectHandler>([
  [tradeForReinforcementsHandler.type, tradeForReinforcementsHandler]
]);

export function listCardEffectTypes(): CardEffectTypeValue[] {
  return Array.from(cardEffectHandlers.keys());
}

export function findCardEffectHandler(
  effectType: string | null | undefined
): CardEffectHandler | null {
  if (!effectType) {
    return null;
  }

  return cardEffectHandlers.get(effectType as CardEffectTypeValue) || null;
}

export function getCardEffectHandler(effectType: string | null | undefined): CardEffectHandler {
  const handler = findCardEffectHandler(effectType);
  if (!handler) {
    throw new Error(`Unknown card effect handler "${effectType || ""}".`);
  }

  return handler;
}
