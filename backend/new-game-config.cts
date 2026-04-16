import {
  DEFENSE_THREE_DICE_RULE_SET_ID,
  findDiceRuleSet,
  listDiceRuleSets,
  STANDARD_DICE_RULE_SET_ID,
  type DiceRuleSet
} from "../shared/dice.cjs";
import {
  DEFAULT_CONTENT_PACK_ID,
  findContentPack,
  listContentPacks,
  type ContentPackSummary
} from "../shared/content-packs.cjs";
import {
  DEFAULT_PLAYER_PIECE_SET_ID,
  findPlayerPieceSet,
  listPlayerPieceSets,
  type PlayerPieceSet
} from "../shared/player-piece-sets.cjs";
import {
  DEFAULT_PIECE_SKIN_ID,
  DEFAULT_THEME_ID,
  DEFAULT_VICTORY_RULE_SET_ID,
  EXTENSION_SCHEMA_VERSION,
  findExtensionPack,
  findPieceSkin,
  findVictoryRuleSet,
  findVisualTheme,
  listExtensionPacks,
  listPieceSkins,
  listVictoryRuleSets,
  listVisualThemes,
  migrateGameConfigExtensions,
  type ExtensionPackManifest
} from "../shared/extensions.cjs";
import {
  normalizeNetRiskGameModuleSelection,
  type NetRiskGameModuleSelection,
  type NetRiskResolvedGamePreset,
  type NetRiskResolvedModuleSetup
} from "../shared/netrisk-modules.cjs";
import {
  normalizeTurnTimeoutHours,
  TURN_TIMEOUT_HOURS_OPTIONS,
  type TurnTimeoutHoursValue
} from "../shared/turn-timeouts.cjs";
import { findSupportedMap, listSupportedMaps, type SupportedMap } from "../shared/maps/index.cjs";
const { secureRandom } = require("./random.cjs");
import { createLocalizedError, type LocalizedError } from "../shared/messages.cjs";
import type { GameState } from "../shared/models.cjs";

type AddPlayerResult =
  | { ok: true }
  | { ok: false; error?: string; errorKey?: string; errorParams?: Record<string, unknown> };
type CreateInitialStateFn = (selectedMap?: SupportedMap | null) => GameState & {
  gameConfig?: Record<string, unknown>;
  contentPackId: string;
  diceRuleSetId: string;
  victoryRuleSetId: string;
  pieceSetId: string;
};
type AddPlayerFn = (
  state: GameState,
  name: string | null,
  options?: { isAi?: boolean }
) => AddPlayerResult;

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
export const DEFENSE_THREE_NEW_GAME_RULE_SET_ID = "classic-defense-3";

type NewGameRuleSet = Readonly<ExtensionPackManifest>;
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
  contentPackId?: string;
  ruleSetId?: string;
  mapId?: string;
  diceRuleSetId?: string;
  victoryRuleSetId?: string;
  pieceSetId?: string;
  themeId?: string;
  pieceSkinId?: string;
  gamePresetId?: string;
  activeModuleIds?: string[];
  contentProfileId?: string;
  gameplayProfileId?: string;
  uiProfileId?: string;
  turnTimeoutHours?: number;
  players?: RequestedPlayerSlot[];
}

interface ValidatedNewGameConfig {
  name?: string;
  contentPackId: string;
  ruleSetId: string;
  ruleSetName: string;
  mapId: string;
  mapName: string;
  selectedMap: SupportedMap;
  diceRuleSetId: string;
  selectedDiceRuleSet: DiceRuleSet;
  victoryRuleSetId: string;
  pieceSetId: string;
  selectedPieceSet: PlayerPieceSet;
  themeId: string;
  pieceSkinId: string;
  moduleSelection: NetRiskGameModuleSelection;
  extensionSchemaVersion: number;
  turnTimeoutHours: TurnTimeoutHoursValue | null;
  totalPlayers: number;
  players: ValidatedPlayerSlot[];
}

export function normalizePlayerType(value: string | undefined): PlayerType {
  return value === "ai" ? "ai" : "human";
}

export function findNewGameRuleSet(ruleSetId: string | null | undefined): NewGameRuleSet | null {
  return findExtensionPack(ruleSetId);
}

export function listNewGameRuleSets() {
  return listExtensionPacks();
}

export function listTurnTimeoutHoursOptions(): TurnTimeoutHoursValue[] {
  return [...TURN_TIMEOUT_HOURS_OPTIONS];
}

export function buildHistoricalAiNames(
  count: number,
  random: () => number = secureRandom
): string[] {
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
  options: {
    random?: () => number;
    resolveContentPack?: (contentPackId: string) => ContentPackSummary | null;
    resolveDiceRuleSet?: (diceRuleSetId: string) => DiceRuleSet | null;
    resolvePlayerPieceSet?: (pieceSetId: string) => PlayerPieceSet | null;
    resolveSupportedMap?: (mapId: string) => SupportedMap | null;
  } = {}
): ValidatedNewGameConfig {
  const totalPlayers = input.totalPlayers == null ? 2 : Number(input.totalPlayers);
  if (!Number.isInteger(totalPlayers) || totalPlayers < 2 || totalPlayers > 4) {
    throw createLocalizedError(
      "Il numero totale di giocatori deve essere compreso tra 2 e 4.",
      "newGame.invalidTotalPlayers"
    );
  }

  const requestedContentPackId = String(input.contentPackId || DEFAULT_CONTENT_PACK_ID);
  const resolveContentPack =
    typeof options.resolveContentPack === "function" ? options.resolveContentPack : findContentPack;
  const selectedContentPack = resolveContentPack(requestedContentPackId);
  if (!selectedContentPack) {
    throw createLocalizedError(
      "Il content pack selezionato non e supportato.",
      "newGame.invalidContentPack"
    );
  }

  const requestedRuleSetId = String(input.ruleSetId || STANDARD_NEW_GAME_RULE_SET_ID);
  const selectedRuleSet = findNewGameRuleSet(requestedRuleSetId);
  if (!selectedRuleSet) {
    throw createLocalizedError(
      "Il ruleset selezionato non e supportato.",
      "newGame.invalidRuleSet"
    );
  }

  const mapId = String(
    input.mapId ||
      selectedContentPack.defaultMapId ||
      selectedRuleSet.defaults.mapId ||
      "classic-mini"
  );
  const resolveSupportedMap =
    typeof options.resolveSupportedMap === "function"
      ? options.resolveSupportedMap
      : findSupportedMap;
  const selectedMap = resolveSupportedMap(mapId);
  if (!selectedMap) {
    throw createLocalizedError("La mappa selezionata non e supportata.", "newGame.invalidMap");
  }

  const requestedDiceRuleSetId = String(
    input.diceRuleSetId ||
      selectedRuleSet.defaults.diceRuleSetId ||
      selectedContentPack.defaultDiceRuleSetId ||
      STANDARD_DICE_RULE_SET_ID
  );
  const resolveDiceRuleSet =
    typeof options.resolveDiceRuleSet === "function" ? options.resolveDiceRuleSet : findDiceRuleSet;
  const selectedDiceRuleSet = resolveDiceRuleSet(requestedDiceRuleSetId);
  if (!selectedDiceRuleSet) {
    throw createLocalizedError(
      "La regola dadi selezionata non e supportata.",
      "newGame.invalidDiceRuleSet"
    );
  }

  const requestedVictoryRuleSetId = String(
    input.victoryRuleSetId ||
      selectedRuleSet.defaults.victoryRuleSetId ||
      selectedContentPack.defaultVictoryRuleSetId ||
      DEFAULT_VICTORY_RULE_SET_ID
  );
  const selectedVictoryRuleSet = findVictoryRuleSet(requestedVictoryRuleSetId);
  if (!selectedVictoryRuleSet) {
    throw createLocalizedError(
      "La regola vittoria selezionata non e supportata.",
      "newGame.invalidVictoryRuleSet"
    );
  }

  const requestedPieceSetId = String(
    input.pieceSetId || selectedContentPack.defaultPieceSetId || DEFAULT_PLAYER_PIECE_SET_ID
  );
  const resolvePlayerPieceSet =
    typeof options.resolvePlayerPieceSet === "function"
      ? options.resolvePlayerPieceSet
      : findPlayerPieceSet;
  const selectedPieceSet = resolvePlayerPieceSet(requestedPieceSetId);
  if (!selectedPieceSet) {
    throw createLocalizedError(
      "Il set pedine selezionato non e supportato.",
      "newGame.invalidPieceSet"
    );
  }

  const requestedThemeId = String(
    input.themeId ||
      selectedRuleSet.defaults.themeId ||
      selectedContentPack.defaultSiteThemeId ||
      DEFAULT_THEME_ID
  );
  const selectedTheme = findVisualTheme(requestedThemeId);
  if (!selectedTheme) {
    throw createLocalizedError("Il tema selezionato non e supportato.", "newGame.invalidTheme");
  }

  const requestedPieceSkinId = String(
    input.pieceSkinId || selectedRuleSet.defaults.pieceSkinId || DEFAULT_PIECE_SKIN_ID
  );
  const selectedPieceSkin = findPieceSkin(requestedPieceSkinId);
  if (!selectedPieceSkin) {
    throw createLocalizedError(
      "La skin pedina selezionata non e supportata.",
      "newGame.invalidPieceSkin"
    );
  }

  const turnTimeoutHours =
    input.turnTimeoutHours == null ? null : normalizeTurnTimeoutHours(input.turnTimeoutHours);
  if (input.turnTimeoutHours != null && turnTimeoutHours == null) {
    throw createLocalizedError(
      "Il limite tempo turno selezionato non e supportato.",
      "newGame.invalidTurnTimeoutHours",
      { allowedValues: TURN_TIMEOUT_HOURS_OPTIONS.join(", ") }
    );
  }

  const requestedPlayers = Array.isArray(input.players)
    ? input.players
    : Array.from({ length: totalPlayers }, () => ({ type: "human" }));

  if (requestedPlayers.length !== totalPlayers) {
    throw createLocalizedError(
      "Configura tutti gli slot giocatore prima di creare la partita.",
      "newGame.invalidPlayers"
    );
  }

  const firstSlotType = normalizePlayerType(requestedPlayers[0] && requestedPlayers[0].type);
  if (firstSlotType !== "human") {
    throw createLocalizedError(
      "Il giocatore 1 deve essere sempre il creatore umano.",
      "newGame.invalidCreatorSlot"
    );
  }

  const aiCount = requestedPlayers
    .slice(1)
    .filter((slot) => normalizePlayerType(slot && slot.type) === "ai").length;
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
    moduleSelection: normalizeNetRiskGameModuleSelection({
      contentProfileId: typeof input.contentProfileId === "string" ? input.contentProfileId : null,
      gameplayProfileId:
        typeof input.gameplayProfileId === "string" ? input.gameplayProfileId : null,
      uiProfileId: typeof input.uiProfileId === "string" ? input.uiProfileId : null
    }),
    name: input.name,
    contentPackId: selectedContentPack.id,
    ruleSetId: selectedRuleSet.id,
    ruleSetName: selectedRuleSet.name,
    mapId,
    mapName: selectedMap.name,
    selectedMap,
    diceRuleSetId: selectedDiceRuleSet.id,
    selectedDiceRuleSet,
    victoryRuleSetId: selectedVictoryRuleSet.id,
    pieceSetId: selectedPieceSet.id,
    selectedPieceSet,
    themeId: selectedTheme.id,
    pieceSkinId: selectedPieceSkin.id,
    extensionSchemaVersion: EXTENSION_SCHEMA_VERSION,
    turnTimeoutHours,
    totalPlayers,
    players
  };
}

export function createConfiguredInitialState(
  configInput: NewGameConfigInput = {},
  options: {
    random?: () => number;
    resolveContentPack?: (contentPackId: string) => ContentPackSummary | null;
    resolveDiceRuleSet?: (diceRuleSetId: string) => DiceRuleSet | null;
    resolvePlayerPieceSet?: (pieceSetId: string) => PlayerPieceSet | null;
    resolveSupportedMap?: (mapId: string) => SupportedMap | null;
    resolveGamePreset?: (input: {
      gamePresetId?: string | null;
      activeModuleIds?: string[];
    }) => NetRiskResolvedGamePreset | Promise<NetRiskResolvedGamePreset | null> | null;
    resolveGameModuleConfigDefaults?: (input: {
      activeModuleIds?: string[];
      contentProfileId?: string | null;
      gameplayProfileId?: string | null;
      uiProfileId?: string | null;
    }) => NetRiskResolvedModuleSetup | Promise<NetRiskResolvedModuleSetup>;
    resolveGameModuleSelection?: (input: {
      activeModuleIds?: string[];
      contentProfileId?: string | null;
      gameplayProfileId?: string | null;
      uiProfileId?: string | null;
      contentPackId?: string | null;
      pieceSetId?: string | null;
      mapId?: string | null;
      diceRuleSetId?: string | null;
      victoryRuleSetId?: string | null;
      themeId?: string | null;
      pieceSkinId?: string | null;
    }) => NetRiskGameModuleSelection | Promise<NetRiskGameModuleSelection>;
  } = {}
):
  | {
      state: GameState & {
        gameConfig?: Record<string, unknown>;
        contentPackId: string;
        diceRuleSetId: string;
        victoryRuleSetId: string;
        pieceSetId: string;
      };
      gameInput: { name: string | undefined };
      config: ValidatedNewGameConfig;
    }
  | Promise<{
      state: GameState & {
        gameConfig?: Record<string, unknown>;
        contentPackId: string;
        diceRuleSetId: string;
        victoryRuleSetId: string;
        pieceSetId: string;
      };
      gameInput: { name: string | undefined };
      config: ValidatedNewGameConfig;
    }> {
  const resolvedPreset =
    typeof options.resolveGamePreset === "function"
      ? options.resolveGamePreset({
          gamePresetId:
            typeof configInput.gamePresetId === "string" ? configInput.gamePresetId : null,
          activeModuleIds: Array.isArray(configInput.activeModuleIds)
            ? configInput.activeModuleIds
            : []
        })
      : null;

  const finalizeWithResolvedPreset = (
    resolvedGamePreset: NetRiskResolvedGamePreset | null | undefined
  ) => {
    const hydratedPresetInput: NewGameConfigInput = {
      ...(typeof resolvedGamePreset?.defaults?.contentPackId === "string"
        ? { contentPackId: resolvedGamePreset.defaults.contentPackId }
        : {}),
      ...(typeof resolvedGamePreset?.defaults?.ruleSetId === "string"
        ? { ruleSetId: resolvedGamePreset.defaults.ruleSetId }
        : {}),
      ...(typeof resolvedGamePreset?.defaults?.pieceSetId === "string"
        ? { pieceSetId: resolvedGamePreset.defaults.pieceSetId }
        : {}),
      ...(typeof resolvedGamePreset?.defaults?.mapId === "string"
        ? { mapId: resolvedGamePreset.defaults.mapId }
        : {}),
      ...(typeof resolvedGamePreset?.defaults?.diceRuleSetId === "string"
        ? { diceRuleSetId: resolvedGamePreset.defaults.diceRuleSetId }
        : {}),
      ...(typeof resolvedGamePreset?.defaults?.victoryRuleSetId === "string"
        ? { victoryRuleSetId: resolvedGamePreset.defaults.victoryRuleSetId }
        : {}),
      ...(typeof resolvedGamePreset?.defaults?.themeId === "string"
        ? { themeId: resolvedGamePreset.defaults.themeId }
        : {}),
      ...(typeof resolvedGamePreset?.defaults?.pieceSkinId === "string"
        ? { pieceSkinId: resolvedGamePreset.defaults.pieceSkinId }
        : {}),
      ...(Array.isArray(resolvedGamePreset?.activeModuleIds)
        ? { activeModuleIds: resolvedGamePreset.activeModuleIds }
        : {}),
      ...(typeof resolvedGamePreset?.contentProfileId === "string"
        ? { contentProfileId: resolvedGamePreset.contentProfileId }
        : {}),
      ...(typeof resolvedGamePreset?.gameplayProfileId === "string"
        ? { gameplayProfileId: resolvedGamePreset.gameplayProfileId }
        : {}),
      ...(typeof resolvedGamePreset?.uiProfileId === "string"
        ? { uiProfileId: resolvedGamePreset.uiProfileId }
        : {}),
      ...(typeof resolvedGamePreset?.id === "string"
        ? { gamePresetId: resolvedGamePreset.id }
        : {}),
      ...configInput
    };

    const resolvedProfileDefaults =
      typeof options.resolveGameModuleConfigDefaults === "function"
        ? options.resolveGameModuleConfigDefaults({
            activeModuleIds: Array.isArray(hydratedPresetInput.activeModuleIds)
              ? hydratedPresetInput.activeModuleIds
              : [],
            contentProfileId:
              typeof hydratedPresetInput.contentProfileId === "string"
                ? hydratedPresetInput.contentProfileId
                : null,
            gameplayProfileId:
              typeof hydratedPresetInput.gameplayProfileId === "string"
                ? hydratedPresetInput.gameplayProfileId
                : null,
            uiProfileId:
              typeof hydratedPresetInput.uiProfileId === "string"
                ? hydratedPresetInput.uiProfileId
                : null
          })
        : null;

    const finalizeWithResolvedInput = (
      resolvedSetup: NetRiskResolvedModuleSetup | null | undefined
    ) => {
      const resolvedDefaults = resolvedSetup?.defaults || null;
      const hydratedConfigInput: NewGameConfigInput = {
        ...(typeof resolvedDefaults?.contentPackId === "string"
          ? { contentPackId: resolvedDefaults.contentPackId }
          : {}),
        ...(typeof resolvedDefaults?.ruleSetId === "string"
          ? { ruleSetId: resolvedDefaults.ruleSetId }
          : {}),
        ...(typeof resolvedDefaults?.pieceSetId === "string"
          ? { pieceSetId: resolvedDefaults.pieceSetId }
          : {}),
        ...(typeof resolvedDefaults?.mapId === "string" ? { mapId: resolvedDefaults.mapId } : {}),
        ...(typeof resolvedDefaults?.diceRuleSetId === "string"
          ? { diceRuleSetId: resolvedDefaults.diceRuleSetId }
          : {}),
        ...(typeof resolvedDefaults?.victoryRuleSetId === "string"
          ? { victoryRuleSetId: resolvedDefaults.victoryRuleSetId }
          : {}),
        ...(typeof resolvedDefaults?.themeId === "string"
          ? { themeId: resolvedDefaults.themeId }
          : {}),
        ...(typeof resolvedDefaults?.pieceSkinId === "string"
          ? { pieceSkinId: resolvedDefaults.pieceSkinId }
          : {}),
        ...hydratedPresetInput
      };
      const config = validateNewGameConfig(hydratedConfigInput, {
        random: options.random,
        resolveContentPack: options.resolveContentPack,
        resolveDiceRuleSet: options.resolveDiceRuleSet,
        resolvePlayerPieceSet: options.resolvePlayerPieceSet,
        resolveSupportedMap: options.resolveSupportedMap
      });
      const resolvedModuleSelection =
        typeof options.resolveGameModuleSelection === "function"
          ? options.resolveGameModuleSelection({
              activeModuleIds: Array.isArray(hydratedConfigInput.activeModuleIds)
                ? hydratedConfigInput.activeModuleIds
                : [],
              contentProfileId:
                typeof hydratedConfigInput.contentProfileId === "string"
                  ? hydratedConfigInput.contentProfileId
                  : null,
              gameplayProfileId:
                typeof hydratedConfigInput.gameplayProfileId === "string"
                  ? hydratedConfigInput.gameplayProfileId
                  : null,
              uiProfileId:
                typeof hydratedConfigInput.uiProfileId === "string"
                  ? hydratedConfigInput.uiProfileId
                  : null,
              contentPackId: config.contentPackId,
              pieceSetId: config.pieceSetId,
              mapId: config.mapId,
              diceRuleSetId: config.diceRuleSetId,
              victoryRuleSetId: config.victoryRuleSetId,
              themeId: config.themeId,
              pieceSkinId: config.pieceSkinId
            })
          : config.moduleSelection;

      const finalizeConfiguredState = (moduleSelection: NetRiskGameModuleSelection) => {
        const state = createInitialState(config.selectedMap);
        state.contentPackId = config.contentPackId;
        state.diceRuleSetId = config.diceRuleSetId;
        state.victoryRuleSetId = config.victoryRuleSetId;
        state.pieceSetId = config.pieceSetId;
        state.gameConfig = migrateGameConfigExtensions({
          name: config.name,
          contentPackId: config.contentPackId,
          pieceSetId: config.pieceSetId,
          pieceSetName: config.selectedPieceSet.name,
          pieceSetPalette: [...config.selectedPieceSet.palette],
          ruleSetId: config.ruleSetId,
          ruleSetName: config.ruleSetName,
          mapId: config.mapId,
          mapName: config.mapName,
          diceRuleSetId: config.diceRuleSetId,
          diceRuleSetName: config.selectedDiceRuleSet.name,
          diceRuleSetAttackerMaxDice: config.selectedDiceRuleSet.attackerMaxDice,
          diceRuleSetDefenderMaxDice: config.selectedDiceRuleSet.defenderMaxDice,
          diceRuleSetAttackerMustLeaveOneArmyBehind:
            config.selectedDiceRuleSet.attackerMustLeaveOneArmyBehind,
          diceRuleSetDefenderWinsTies: config.selectedDiceRuleSet.defenderWinsTies,
          victoryRuleSetId: config.victoryRuleSetId,
          themeId: config.themeId,
          pieceSkinId: config.pieceSkinId,
          moduleSchemaVersion: moduleSelection.moduleSchemaVersion,
          activeModules: moduleSelection.activeModules,
          gamePresetId:
            typeof hydratedConfigInput.gamePresetId === "string"
              ? hydratedConfigInput.gamePresetId
              : null,
          contentProfileId: moduleSelection.contentProfileId || null,
          gameplayProfileId: moduleSelection.gameplayProfileId || null,
          uiProfileId: moduleSelection.uiProfileId || null,
          gameplayEffects: resolvedSetup?.gameplayEffects || null,
          scenarioSetup: resolvedSetup?.scenarioSetup || null,
          extensionSchemaVersion: config.extensionSchemaVersion,
          turnTimeoutHours: config.turnTimeoutHours,
          totalPlayers: config.totalPlayers,
          players: config.players
        });

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
          config: {
            ...config,
            moduleSelection
          }
        };
      };

      if (
        resolvedModuleSelection &&
        typeof (resolvedModuleSelection as Promise<NetRiskGameModuleSelection>).then === "function"
      ) {
        return (resolvedModuleSelection as Promise<NetRiskGameModuleSelection>).then(
          finalizeConfiguredState
        );
      }

      return finalizeConfiguredState(resolvedModuleSelection as NetRiskGameModuleSelection);
    };

    if (
      resolvedProfileDefaults &&
      typeof (resolvedProfileDefaults as Promise<NetRiskResolvedModuleSetup>).then === "function"
    ) {
      return (resolvedProfileDefaults as Promise<NetRiskResolvedModuleSetup>).then(
        finalizeWithResolvedInput
      );
    }

    return finalizeWithResolvedInput(
      resolvedProfileDefaults as NetRiskResolvedModuleSetup | null | undefined
    );
  };

  if (
    resolvedPreset &&
    typeof (resolvedPreset as Promise<NetRiskResolvedGamePreset | null>).then === "function"
  ) {
    return (resolvedPreset as Promise<NetRiskResolvedGamePreset | null>).then(
      finalizeWithResolvedPreset
    );
  }

  return finalizeWithResolvedPreset(resolvedPreset as NetRiskResolvedGamePreset | null | undefined);
}

export {
  listContentPacks,
  listDiceRuleSets,
  listPlayerPieceSets,
  listPieceSkins,
  listSupportedMaps,
  listVictoryRuleSets,
  listVisualThemes,
  findSupportedMap
};
