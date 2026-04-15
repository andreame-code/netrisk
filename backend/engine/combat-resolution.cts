import { getDiceRuleSet, type DiceRuleSet } from "../../shared/dice.cjs";
import { getCombatRuleSet, type GameState } from "../../shared/models.cjs";
const { secureRandom } = require("../random.cjs");
import type { MapGraph } from "../../shared/map-graph.cjs";
import { compareCombatDice, rollCombatDice, type CombatComparison } from "./combat-dice.cjs";
import { validateAttackAttempt, type AttackValidationResult } from "./attack-validation.cjs";

interface ResolveSingleAttackRollOptions {
  random?: () => number;
  attackDice?: number | null;
  defendDice?: number | null;
  diceRuleSet?: DiceRuleSet;
  diceRuleSetId?: string;
}

export interface CombatResultPayload {
  fromTerritoryId: string;
  toTerritoryId: string;
  diceRuleSetId: string;
  attackDiceCount: number;
  defendDiceCount: number;
  attackerRolls: number[];
  defenderRolls: number[];
  comparisons: CombatComparison[];
  attackerArmiesRemaining: number;
  defenderArmiesRemaining: number;
  defenderReducedToZero: boolean;
}

export interface FailedCombatResolution {
  ok: false;
  code: string;
  message: string;
  details: Record<string, unknown>;
  combat: null;
}

export interface SuccessfulCombatResolution {
  ok: true;
  code: string;
  message: string;
  details: Record<string, unknown>;
  combat: CombatResultPayload;
}

export type CombatResolution = FailedCombatResolution | SuccessfulCombatResolution;

function invalidFromValidation(validation: AttackValidationResult): FailedCombatResolution {
  return {
    ok: false,
    code: validation.code,
    message: validation.message,
    details: validation.details,
    combat: null
  };
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

export function resolveSingleAttackRoll(
  state: GameState,
  graph: MapGraph,
  playerId: string,
  fromTerritoryId: string,
  toTerritoryId: string,
  options: ResolveSingleAttackRollOptions = {}
): CombatResolution {
  const validation = validateAttackAttempt(state, graph, playerId, fromTerritoryId, toTerritoryId);
  if (!validation.ok) {
    return invalidFromValidation(validation);
  }

  const attackerState = state.territories[fromTerritoryId];
  const defenderState = state.territories[toTerritoryId];
  if (!attackerState || !defenderState) {
    throw new Error("Combat resolution requires attacker and defender territory state.");
  }

  const random = typeof options.random === "function" ? options.random : secureRandom;
  const diceRuleSet = options.diceRuleSet
    || (options.diceRuleSetId ? getDiceRuleSet(options.diceRuleSetId) : resolveDiceRuleSetFromState(state));
  const attackerReserve = diceRuleSet.attackerMustLeaveOneArmyBehind ? 1 : 0;

  const maxAttackDice = Math.min(diceRuleSet.attackerMaxDice, attackerState.armies - attackerReserve);
  const maxDefendDice = Math.min(diceRuleSet.defenderMaxDice, defenderState.armies);

  const attackDiceCount = options.attackDice == null ? maxAttackDice : Number(options.attackDice);
  const defendDiceCount = options.defendDice == null ? maxDefendDice : Number(options.defendDice);

  if (!Number.isInteger(attackDiceCount) || attackDiceCount < 1 || attackDiceCount > maxAttackDice) {
    throw new Error(`Attacker dice must be between 1 and ${maxAttackDice}.`);
  }

  if (!Number.isInteger(defendDiceCount) || defendDiceCount < 1 || defendDiceCount > maxDefendDice) {
    throw new Error(`Defender dice must be between 1 and ${maxDefendDice}.`);
  }

  const { attackerRolls, defenderRolls, comparisons } = compareCombatDice(
    rollCombatDice(attackDiceCount, random),
    rollCombatDice(defendDiceCount, random),
    { defenderWinsTies: diceRuleSet.defenderWinsTies }
  );
  const combatRuleSet = getCombatRuleSet(state.combatRuleSetId || "standard");
  const outcome = combatRuleSet.resolveOutcome(comparisons);

  attackerState.armies -= outcome.attackerLosses;
  defenderState.armies -= outcome.defenderLosses;

  return {
    ok: true,
    code: defenderState.armies <= 0 ? "DEFENDER_REDUCED_TO_ZERO" : "COMBAT_RESOLVED",
    message:
      defenderState.armies <= 0
        ? "Combat resolved and the defender territory has been reduced to zero armies."
        : "Combat resolved.",
    details: validation.details,
    combat: {
      fromTerritoryId,
      toTerritoryId,
      diceRuleSetId: diceRuleSet.id || "standard",
      attackDiceCount,
      defendDiceCount,
      attackerRolls,
      defenderRolls,
      comparisons,
      attackerArmiesRemaining: attackerState.armies,
      defenderArmiesRemaining: defenderState.armies,
      defenderReducedToZero: defenderState.armies <= 0
    }
  };
}
