import {
  DEFENSE_THREE_DICE_RULE_SET_ID,
  findDiceRuleSet,
  listDiceRuleSets,
  STANDARD_DICE_RULE_SET_ID,
  type DiceRuleSet
} from "../shared/dice.cjs";
import { findSupportedMap, listSupportedMaps } from "../shared/maps/index.cjs";
import { secureRandom } from "./random.cjs";
import { createLocalizedError, type LocalizedError } from "../shared/messages.cjs";
import type { GameState } from "../shared/models.cjs";

type AddPlayerResult = { ok: true } | { ok: false; error?: string; errorKey?: string; errorParams?: Record<string, unknown> };
type CreateInitialStateFn = (selectedMap?: ReturnType<typeof findSupportedMap>) => GameState & { gameConfig?: Record<string, unknown>; diceRuleSetId: string };
type AddPlayerFn = (state: GameState, name: string | null, options?: { isAi?: boolean }) => AddPlayerResult;

const { addPlayer, createInitialState } = require("./engine/game-engine.cjs") as {
  addPlayer: AddPlayerFn;
  createInitialState: CreateInitialStateFn;
};

export const AI_GENERAL_NAMES = [
  "Caesar",
  "Hannibal",
  "Scipio",
  "Belisarius",
  "Saladin",
  "Subutai",
  "Marlborough",
  "Suvorov",
  "Wellington",
  "Napoleon",
  "Kutuzov",
  "Grant"
] as const;

export const STANDARD_NEW_GAME_RULE_SET_ID = "classic";

export const standardNewGameRuleSet = Object.freeze({
  id: STANDARD_NEW_GAME_RULE_SET_ID,
  name: "Classic",
  defaultDiceRuleSetId: STANDARD_DICE_RULE_SET_ID
});

export const DEFENSE_THREE_NEW_GAME_RULE_SET_ID = "classic-defense-3";

export const defenseThreeNewGameRuleSet = Object.freeze({
  id: DEFENSE_THREE_NEW_GAME_RULE_SET_ID,
  name: "Classic Defense 3",
  defaultDiceRuleSetId: DEFENSE_THREE_DICE_RULE_SET_ID
});

const newGameRuleSets = Object.freeze({
  [STANDARD_NEW_GAME_RULE_SET_ID]: standardNewGameRuleSet,
  [DEFENSE_THREE_NEW_GAME_RULE_SET_ID]: defenseThreeNewGameRuleSet
});

type NewGameRuleSet = (typeof newGameRuleSets)[keyof typeof newGameRuleSets];
type PlayerType = "human" | "ai";

interface RequestedPlayerSlot {
  type?: string;
}

interface ValidatedPlayerSlot {
  slot: number;
  type: PlayerType;
  name: string | null;
}

interface NewGameConfigInput {
  name?: string;
  totalPlayers?: number;
  ruleSetId?: string;
  mapId?: string;
  diceRuleSetId?: string;
  players?: RequestedPlayerSlot[];
}

interface ValidatedNewGameConfig {
  name?: string;
  ruleSetId: string;
  ruleSetName: string;
  mapId: string;
  mapName: string;
  selectedMap: NonNullable<ReturnType<typeof findSupportedMap>>;
  diceRuleSetId: string;
  totalPlayers: number;
  players: ValidatedPlayerSlot[];
}

export function normalizePlayerType(value: string | undefined): PlayerType {
  return value === "ai" ? "ai" : "human";
}

export function findNewGameRuleSet(ruleSetId: string | null | undefined): NewGameRuleSet | null {
  if (!ruleSetId) {
    return null;
  }

  return newGameRuleSets[ruleSetId as keyof typeof newGameRuleSets] || null;
}

export function listNewGameRuleSets(): Array<{ id: string; name: string; defaultDiceRuleSetId: string }> {
  return Object.values(newGameRuleSets).map((ruleSet) => ({
    id: ruleSet.id,
    name: ruleSet.name,
    defaultDiceRuleSetId: ruleSet.defaultDiceRuleSetId
  }));
}

export function buildHistoricalAiNames(count: number, random: () => number = secureRandom): string[] {
  const pool = AI_GENERAL_NAMES.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = pool[i] as string;
    pool[i] = pool[j] as (typeof AI_GENERAL_NAMES)[number];
    pool[j] = tmp as (typeof AI_GENERAL_NAMES)[number];
  }

  const names: string[] = [];
  for (let index = 0; index < count; index += 1) {
    if (index < pool.length) {
      names.push(pool[index] as string);
    } else {
      names.push("CPU " + (index + 1));
    }
  }

  return names;
}

export function validateNewGameConfig(
  input: NewGameConfigInput = {},
  options: { random?: () => number } = {}
): ValidatedNewGameConfig {
  const totalPlayers = input.totalPlayers == null ? 2 : Number(input.totalPlayers);
  if (!Number.isInteger(totalPlayers) || totalPlayers < 2 || totalPlayers > 4) {
    throw createLocalizedError("Il numero totale di giocatori deve essere compreso tra 2 e 4.", "newGame.invalidTotalPlayers");
  }

  const requestedRuleSetId = String(input.ruleSetId || STANDARD_NEW_GAME_RULE_SET_ID);
  const selectedRuleSet = findNewGameRuleSet(requestedRuleSetId);
  if (!selectedRuleSet) {
    throw createLocalizedError("Il ruleset selezionato non e supportato.", "newGame.invalidRuleSet");
  }

  const mapId = String(input.mapId || "classic-mini");
  const selectedMap = findSupportedMap(mapId);
  if (!selectedMap) {
    throw createLocalizedError("La mappa selezionata non e supportata.", "newGame.invalidMap");
  }

  const requestedDiceRuleSetId = String(input.diceRuleSetId || selectedRuleSet.defaultDiceRuleSetId || STANDARD_DICE_RULE_SET_ID);
  const selectedDiceRuleSet = findDiceRuleSet(requestedDiceRuleSetId);
  if (!selectedDiceRuleSet) {
    throw createLocalizedError("La regola dadi selezionata non e supportata.", "newGame.invalidDiceRuleSet");
  }

  const requestedPlayers = Array.isArray(input.players)
    ? input.players
    : Array.from({ length: totalPlayers }, () => ({ type: "human" }));

  if (requestedPlayers.length !== totalPlayers) {
    throw createLocalizedError("Configura tutti gli slot giocatore prima di creare la partita.", "newGame.invalidPlayers");
  }

  const firstSlotType = normalizePlayerType(requestedPlayers[0] && requestedPlayers[0].type);
  if (firstSlotType !== "human") {
    throw createLocalizedError("Il giocatore 1 deve essere sempre il creatore umano.", "newGame.invalidCreatorSlot");
  }

  const aiCount = requestedPlayers.slice(1).filter((slot) => normalizePlayerType(slot && slot.type) === "ai").length;
  const aiNames = buildHistoricalAiNames(aiCount, options.random);
  let nextAiIndex = 0;

  const players = requestedPlayers.map((slot, index) => {
    const type = index === 0 ? "human" : normalizePlayerType(slot && slot.type);
    return {
      slot: index + 1,
      type,
      name: type === "ai" ? aiNames[nextAiIndex++] : null
    };
  });

  return {
    name: input.name,
    ruleSetId: selectedRuleSet.id,
    ruleSetName: selectedRuleSet.name,
    mapId,
    mapName: selectedMap.name,
    selectedMap,
    diceRuleSetId: selectedDiceRuleSet.id,
    totalPlayers,
    players
  };
}

export function createConfiguredInitialState(
  configInput: NewGameConfigInput = {},
  options: { random?: () => number } = {}
): { state: GameState & { gameConfig?: Record<string, unknown>; diceRuleSetId: string }; gameInput: { name: string | undefined }; config: ValidatedNewGameConfig } {
  const config = validateNewGameConfig(configInput, options);
  const state = createInitialState(config.selectedMap);
  state.diceRuleSetId = config.diceRuleSetId;
  state.gameConfig = {
    ruleSetId: config.ruleSetId,
    ruleSetName: config.ruleSetName,
    mapId: config.mapId,
    mapName: config.mapName,
    diceRuleSetId: config.diceRuleSetId,
    totalPlayers: config.totalPlayers,
    players: config.players
  };

  config.players.forEach((player) => {
    if (player.type !== "ai") {
      return;
    }

    const result = addPlayer(state, player.name, { isAi: true });
    if (!result.ok) {
      throw createLocalizedError(
        result.error || "Impossibile aggiungere il giocatore AI.",
        result.errorKey || "newGame.addAiFailed",
        result.errorParams
      );
    }
  });

  return {
    state,
    gameInput: { name: config.name },
    config
  };
}

export {
  listDiceRuleSets,
  listSupportedMaps,
  findSupportedMap
};
