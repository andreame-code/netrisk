import type { GameState, Player } from "./core-domain.cjs";
import { createLocalizedError } from "./messages.cjs";
import { createModuleRegistry } from "./module-registry.cjs";

export const STANDARD_VICTORY_RULE_SET_ID = "conquest";

export interface VictoryRuleContext {
  activePlayers: Player[];
  activeHumanPlayers: Player[];
}

export interface VictoryRuleResolution {
  code: string;
  message: string;
  messageKey: string;
  messageParams: Record<string, unknown>;
  shouldFinishGame: boolean;
  winnerId: string | null;
  winnerName: string | null;
  summary: string | null;
  summaryKey: string | null;
  summaryParams: Record<string, unknown>;
}

export interface VictoryRuleSet {
  id: string;
  name: string;
  description: string;
  resolve: (state: GameState, context: VictoryRuleContext) => VictoryRuleResolution;
}

export interface VictoryRuleSetSummary {
  id: string;
  name: string;
  description: string;
}

export const standardVictoryRuleSet: Readonly<VictoryRuleSet> = Object.freeze({
  id: STANDARD_VICTORY_RULE_SET_ID,
  name: "Conquest",
  description: "Wins by remaining the only active commander with territories on the map.",
  resolve(_state: GameState, context: VictoryRuleContext) {
    if (context.activeHumanPlayers.length === 0) {
      return {
        code: "AI_ONLY_REMAIN",
        message: "Game closed because only AI players remain active.",
        messageKey: "game.victory.aiOnlyRemain",
        messageParams: {},
        shouldFinishGame: true,
        winnerId: null,
        winnerName: null,
        summary: null,
        summaryKey: null,
        summaryParams: {}
      };
    }

    if (context.activePlayers.length > 1) {
      return {
        code: "NO_VICTORY",
        message: "Victory has not been determined yet.",
        messageKey: "game.victory.pending",
        messageParams: {},
        shouldFinishGame: false,
        winnerId: null,
        winnerName: null,
        summary: null,
        summaryKey: null,
        summaryParams: {}
      };
    }

    const winner = context.activePlayers[0] as Player;
    return {
      code: "VICTORY_DECLARED",
      message: "Victory declared.",
      messageKey: "game.victory.declared",
      messageParams: { playerName: winner.name },
      shouldFinishGame: true,
      winnerId: winner.id,
      winnerName: winner.name,
      summary: winner.name + " conquers the map and wins the game.",
      summaryKey: "game.log.victoryDeclared",
      summaryParams: {
        playerName: winner.name
      }
    };
  }
});

const victoryRuleSetRegistry = createModuleRegistry<VictoryRuleSet>([standardVictoryRuleSet], {
  onMissing(ruleSetId) {
    throw createLocalizedError("Unsupported victory rule set.", "game.victory.unsupportedRuleSet", {
      ruleSetId
    });
  }
});

export function findVictoryRuleSet(
  ruleSetId: string | null | undefined
): Readonly<VictoryRuleSet> | null {
  return victoryRuleSetRegistry.find(ruleSetId);
}

export function getVictoryRuleSet(
  ruleSetId: string = STANDARD_VICTORY_RULE_SET_ID
): Readonly<VictoryRuleSet> {
  return victoryRuleSetRegistry.get(ruleSetId, STANDARD_VICTORY_RULE_SET_ID);
}

export function listVictoryRuleSets(): VictoryRuleSetSummary[] {
  return victoryRuleSetRegistry.entries.map((ruleSet) => ({
    id: ruleSet.id,
    name: ruleSet.name,
    description: ruleSet.description
  }));
}
