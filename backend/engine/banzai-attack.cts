import { getDiceRuleSet } from "../../shared/dice.cjs";
import type { GameState } from "../../shared/models.cjs";
import type { DiceRuleSet } from "../../shared/dice.cjs";

type ResolveAttackResult = {
  ok: boolean;
  combat?: Record<string, unknown>;
  rounds?: unknown[];
};

type ResolveAttackFn = (
  state: GameState,
  playerId: string,
  fromId: string,
  toId: string,
  random?: () => number,
  requestedAttackDice?: number | null
) => ResolveAttackResult;

const { resolveAttack } = require("./game-engine.cjs") as { resolveAttack: ResolveAttackFn };

interface BanzaiRound {
  round: number;
  fromTerritoryId: string;
  toTerritoryId: string;
  attackDiceCount: number;
  defendDiceCount: number;
  attackerRolls: number[];
  defenderRolls: number[];
  comparisons: unknown[];
  attackerArmiesBefore: number | undefined;
  defenderArmiesBefore: number | undefined;
  attackerArmiesRemaining: number;
  defenderArmiesRemaining: number;
  defenderReducedToZero: boolean;
  conqueredTerritory: boolean;
}

interface CombatPayload {
  fromTerritoryId: string;
  toTerritoryId: string;
  attackDiceCount: number;
  defendDiceCount: number;
  attackerRolls: number[];
  defenderRolls: number[];
  comparisons: unknown[];
  attackerArmiesBefore?: number;
  defenderArmiesBefore?: number;
  attackerArmiesRemaining: number;
  defenderArmiesRemaining: number;
  defenderReducedToZero?: boolean;
  conqueredTerritory?: boolean;
}

function buildBanzaiRound(roundIndex: number, combat: CombatPayload): BanzaiRound {
  return {
    round: roundIndex,
    fromTerritoryId: combat.fromTerritoryId,
    toTerritoryId: combat.toTerritoryId,
    attackDiceCount: combat.attackDiceCount,
    defendDiceCount: combat.defendDiceCount,
    attackerRolls: combat.attackerRolls,
    defenderRolls: combat.defenderRolls,
    comparisons: combat.comparisons,
    attackerArmiesBefore: combat.attackerArmiesBefore,
    defenderArmiesBefore: combat.defenderArmiesBefore,
    attackerArmiesRemaining: combat.attackerArmiesRemaining,
    defenderArmiesRemaining: combat.defenderArmiesRemaining,
    defenderReducedToZero: Boolean(combat.defenderReducedToZero),
    conqueredTerritory: Boolean(combat.conqueredTerritory)
  };
}

function normalizeRequestedAttackDice(state: GameState, fromId: string, requestedAttackDice: number | null): number | null {
  if (requestedAttackDice == null) {
    return null;
  }

  const from = state?.territories?.[fromId];
  if (!from) {
    return requestedAttackDice;
  }

  const diceRuleSet = resolveDiceRuleSetFromState(state);
  const attackerReserve = diceRuleSet.attackerMustLeaveOneArmyBehind ? 1 : 0;
  const maxAttackDice = Math.max(0, Math.min(diceRuleSet.attackerMaxDice, from.armies - attackerReserve));
  if (maxAttackDice < 1) {
    return requestedAttackDice;
  }

  return Math.min(requestedAttackDice, maxAttackDice);
}

function resolveDiceRuleSetFromState(state: GameState): DiceRuleSet {
  const diceRuleSetId = typeof state.diceRuleSetId === "string" && state.diceRuleSetId
    ? state.diceRuleSetId
    : "standard";
  const gameConfig = state.gameConfig as Record<string, unknown> | null | undefined;

  if (gameConfig
    && typeof gameConfig.diceRuleSetName === "string"
    && gameConfig.diceRuleSetName.trim().length
    && Number.isInteger(gameConfig.diceRuleSetAttackerMaxDice)
    && Number.isInteger(gameConfig.diceRuleSetDefenderMaxDice)
    && typeof gameConfig.diceRuleSetAttackerMustLeaveOneArmyBehind === "boolean"
    && typeof gameConfig.diceRuleSetDefenderWinsTies === "boolean") {
    return {
      id: diceRuleSetId,
      name: gameConfig.diceRuleSetName,
      attackerMaxDice: Number(gameConfig.diceRuleSetAttackerMaxDice),
      defenderMaxDice: Number(gameConfig.diceRuleSetDefenderMaxDice),
      attackerMustLeaveOneArmyBehind: gameConfig.diceRuleSetAttackerMustLeaveOneArmyBehind,
      defenderWinsTies: gameConfig.diceRuleSetDefenderWinsTies
    };
  }

  return getDiceRuleSet(diceRuleSetId);
}

function canContinueBanzai(state: GameState, playerId: string, fromId: string, toId: string): boolean {
  const from = state?.territories?.[fromId];
  const to = state?.territories?.[toId];
  if (!from || !to) {
    return false;
  }

  if (state.pendingConquest) {
    return false;
  }

  if (from.armies <= 1) {
    return false;
  }

  return to.ownerId !== playerId;
}

export function resolveBanzaiAttack(
  state: GameState,
  playerId: string,
  fromId: string,
  toId: string,
  random?: () => number,
  requestedAttackDice: number | null = null
): ResolveAttackResult {
  const rounds: BanzaiRound[] = [];
  const initialResult = resolveAttack(
    state,
    playerId,
    fromId,
    toId,
    random,
    normalizeRequestedAttackDice(state, fromId, requestedAttackDice)
  );
  if (!initialResult.ok || !initialResult.combat) {
    return initialResult;
  }

  rounds.push(buildBanzaiRound(1, initialResult.combat as unknown as CombatPayload));
  let latestResult = initialResult;

  while (canContinueBanzai(state, playerId, fromId, toId)) {
    const nextResult = resolveAttack(
      state,
      playerId,
      fromId,
      toId,
      random,
      normalizeRequestedAttackDice(state, fromId, requestedAttackDice)
    );
    if (!nextResult.ok || !nextResult.combat) {
      break;
    }

    rounds.push(buildBanzaiRound(rounds.length + 1, nextResult.combat as unknown as CombatPayload));
    latestResult = nextResult;
  }

  return {
    ...latestResult,
    rounds
  };
}
