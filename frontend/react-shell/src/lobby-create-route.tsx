import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ContentPackSummary,
  CreateGameRequest,
  GameListResponse,
  GameOptionsResponse,
  NetRiskModuleProfile,
  RuleSetSummary
} from "@frontend-generated/shared-runtime-validation.mts";

import { createGame, getGameOptions } from "@frontend-core/api/client.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import {
  resolvedContentProfiles,
  resolvedGameplayProfiles,
  resolvedGameModules,
  resolvedGamePresets,
  resolvedUiProfiles
} from "@frontend-core/module-catalog.mts";
import { t } from "@frontend-i18n";

import { useAuth } from "@react-shell/auth";
import { filterConfigurableGameModules } from "@react-shell/game-setup-options";
import { openShellGame } from "@react-shell/game-navigation";
import { storeCurrentPlayerId } from "@react-shell/player-session";
import { buildLobbyPath } from "@react-shell/public-auth-paths";
import { gameOptionsQueryKey, lobbyGamesQueryKey } from "@react-shell/react-query";

type NewGameFormState = {
  name: string;
  contentPackId: string;
  ruleSetId: string;
  mapId: string;
  customizeOptions: boolean;
  diceRuleSetId: string;
  victoryRuleSetId: string;
  themeId: string;
  pieceSkinId: string;
  turnTimeoutHours: string;
  totalPlayers: number;
  playerTypes: string[];
  selectedModuleIds: string[];
  gamePresetId: string;
  contentProfileId: string;
  gameplayProfileId: string;
  uiProfileId: string;
};

type SetupOptionIds = Pick<
  NewGameFormState,
  "diceRuleSetId" | "victoryRuleSetId" | "themeId" | "pieceSkinId"
>;

function firstId<T extends { id: string }>(entries: T[] | null | undefined): string {
  return entries?.[0]?.id || "";
}

function ensurePlayerTypes(playerTypes: string[], totalPlayers: number): string[] {
  return Array.from({ length: totalPlayers }, (_, index) => {
    if (index === 0) {
      return "human";
    }

    return playerTypes[index] === "ai" ? "ai" : "human";
  });
}

function pickAvailableId<T extends { id: string }>(
  preferredId: string | null | undefined,
  entries: T[] | null | undefined
): string {
  if (preferredId && entries?.some((entry) => entry.id === preferredId)) {
    return preferredId;
  }

  return firstId(entries);
}

function pickExplicitId<T extends { id: string }>(
  preferredId: string | null | undefined,
  entries: T[] | null | undefined
): string {
  if (preferredId && entries?.some((entry) => entry.id === preferredId)) {
    return preferredId;
  }

  return "";
}

function pickPresetId<T extends { id: string }>(
  presetId: string | null | undefined,
  currentId: string,
  entries: T[] | null | undefined
): string {
  if (presetId && entries?.some((entry) => entry.id === presetId)) {
    return presetId;
  }

  return pickAvailableId(currentId, entries);
}

function selectedContentPack(
  options: GameOptionsResponse | undefined,
  contentPackId: string
): ContentPackSummary | null {
  return options?.contentPacks?.find((entry) => entry.id === contentPackId) || null;
}

function selectedRuleSet(
  options: GameOptionsResponse | undefined,
  ruleSetId: string
): RuleSetSummary | null {
  return options?.ruleSets?.find((entry) => entry.id === ruleSetId) || null;
}

function selectedMap(options: GameOptionsResponse | undefined, mapId: string) {
  return options?.maps?.find((entry) => entry.id === mapId) || null;
}

function selectedDiceRuleSet(options: GameOptionsResponse | undefined, ruleSetId: string) {
  return options?.diceRuleSets?.find((entry) => entry.id === ruleSetId) || null;
}

function selectedVictoryRuleSet(options: GameOptionsResponse | undefined, ruleSetId: string) {
  return options?.victoryRuleSets?.find((entry) => entry.id === ruleSetId) || null;
}

function selectedTheme(options: GameOptionsResponse | undefined, themeId: string) {
  return options?.themes?.find((entry) => entry.id === themeId) || null;
}

function selectedPieceSkin(options: GameOptionsResponse | undefined, pieceSkinId: string) {
  return options?.pieceSkins?.find((entry) => entry.id === pieceSkinId) || null;
}

function resolveSetupOptionIds(
  formState: NewGameFormState,
  ruleSet: ReturnType<typeof selectedRuleSet>
): SetupOptionIds {
  if (formState.customizeOptions || !ruleSet) {
    return {
      diceRuleSetId: formState.diceRuleSetId,
      victoryRuleSetId: formState.victoryRuleSetId,
      themeId: formState.themeId,
      pieceSkinId: formState.pieceSkinId
    };
  }

  return {
    diceRuleSetId: ruleSet.defaults.diceRuleSetId,
    victoryRuleSetId: ruleSet.defaults.victoryRuleSetId,
    themeId: ruleSet.defaults.themeId,
    pieceSkinId: ruleSet.defaults.pieceSkinId
  };
}

function diceRuleSetLabel(
  diceRuleSet: ReturnType<typeof selectedDiceRuleSet> | null | undefined
): string {
  if (!diceRuleSet) {
    return t("common.notAvailable");
  }

  return `${diceRuleSet.name} (${diceRuleSet.attackerMaxDice}/${diceRuleSet.defenderMaxDice})`;
}

function namedOptionLabel(option: { name: string } | null | undefined): string {
  return option?.name || t("common.notAvailable");
}

function applyContentPackDefaults(
  formState: NewGameFormState,
  options: GameOptionsResponse,
  contentPackId: string
): NewGameFormState {
  const contentPack = selectedContentPack(options, contentPackId);
  if (!contentPack) {
    return {
      ...formState,
      contentPackId
    };
  }

  return {
    ...formState,
    contentPackId,
    mapId: pickAvailableId(contentPack.defaultMapId, options.maps),
    diceRuleSetId: pickAvailableId(contentPack.defaultDiceRuleSetId, options.diceRuleSets)
  };
}

function applyRuleSetDefaults(
  formState: NewGameFormState,
  options: GameOptionsResponse,
  ruleSetId: string
): NewGameFormState {
  const ruleSet = selectedRuleSet(options, ruleSetId);
  if (!ruleSet) {
    return {
      ...formState,
      ruleSetId
    };
  }

  return {
    ...formState,
    ruleSetId,
    mapId: pickAvailableId(ruleSet.defaults.mapId, options.maps),
    diceRuleSetId: pickAvailableId(ruleSet.defaults.diceRuleSetId, options.diceRuleSets),
    victoryRuleSetId: pickAvailableId(ruleSet.defaults.victoryRuleSetId, options.victoryRuleSets),
    themeId: pickAvailableId(ruleSet.defaults.themeId, options.themes),
    pieceSkinId: pickAvailableId(ruleSet.defaults.pieceSkinId, options.pieceSkins)
  };
}

function filterProfilesForSelectedModules(
  profiles: NetRiskModuleProfile[] | null | undefined,
  selectedModuleIds: string[]
): NetRiskModuleProfile[] {
  if (!profiles?.length) {
    return [];
  }

  return profiles.filter(
    (profile) => !profile.moduleId || selectedModuleIds.includes(profile.moduleId)
  );
}

function sanitizeProfiles(
  formState: NewGameFormState,
  options: GameOptionsResponse
): NewGameFormState {
  const availableContentProfiles = filterProfilesForSelectedModules(
    resolvedContentProfiles(options),
    formState.selectedModuleIds
  );
  const availableGameplayProfiles = filterProfilesForSelectedModules(
    resolvedGameplayProfiles(options),
    formState.selectedModuleIds
  );
  const availableUiProfiles = filterProfilesForSelectedModules(
    resolvedUiProfiles(options),
    formState.selectedModuleIds
  );

  return {
    ...formState,
    contentProfileId: availableContentProfiles.some(
      (profile) => profile.id === formState.contentProfileId
    )
      ? formState.contentProfileId
      : "",
    gameplayProfileId: availableGameplayProfiles.some(
      (profile) => profile.id === formState.gameplayProfileId
    )
      ? formState.gameplayProfileId
      : "",
    uiProfileId: availableUiProfiles.some((profile) => profile.id === formState.uiProfileId)
      ? formState.uiProfileId
      : ""
  };
}

function buildInitialForm(options: GameOptionsResponse): NewGameFormState {
  const adminDefaults = options.adminDefaults || {};
  const adminDefaultMapId = pickExplicitId(adminDefaults.mapId, options.maps);
  const adminDefaultDiceRuleSetId = pickExplicitId(
    adminDefaults.diceRuleSetId,
    options.diceRuleSets
  );
  const adminDefaultVictoryRuleSetId = pickExplicitId(
    adminDefaults.victoryRuleSetId,
    options.victoryRuleSets
  );
  const adminDefaultThemeId = pickExplicitId(adminDefaults.themeId, options.themes);
  const adminDefaultPieceSkinId = pickExplicitId(adminDefaults.pieceSkinId, options.pieceSkins);
  const initialTotalPlayers = Number.isInteger(adminDefaults.totalPlayers)
    ? Math.min(
        options.playerRange?.max || 4,
        Math.max(options.playerRange?.min || 2, Number(adminDefaults.totalPlayers))
      )
    : Math.max(options.playerRange?.min || 2, 2);
  const initialState: NewGameFormState = {
    name: "",
    contentPackId: pickAvailableId(adminDefaults.contentPackId, options.contentPacks),
    ruleSetId: pickAvailableId(adminDefaults.ruleSetId, options.ruleSets),
    mapId: adminDefaultMapId,
    customizeOptions: false,
    diceRuleSetId: adminDefaultDiceRuleSetId,
    victoryRuleSetId: adminDefaultVictoryRuleSetId,
    themeId: adminDefaultThemeId,
    pieceSkinId: adminDefaultPieceSkinId,
    turnTimeoutHours:
      adminDefaults.turnTimeoutHours != null
        ? String(adminDefaults.turnTimeoutHours)
        : options.turnTimeoutHoursOptions?.[0]
          ? String(options.turnTimeoutHoursOptions[0])
          : "",
    totalPlayers: initialTotalPlayers,
    playerTypes: ensurePlayerTypes(
      Array.isArray(adminDefaults.players)
        ? adminDefaults.players.map((slot) => (slot?.type === "ai" ? "ai" : "human"))
        : [],
      initialTotalPlayers
    ),
    selectedModuleIds: Array.isArray(adminDefaults.activeModuleIds)
      ? adminDefaults.activeModuleIds
      : [],
    gamePresetId: adminDefaults.gamePresetId || "",
    contentProfileId: adminDefaults.contentProfileId || "",
    gameplayProfileId: adminDefaults.gameplayProfileId || "",
    uiProfileId: adminDefaults.uiProfileId || ""
  };

  const withContentPackDefaults = applyContentPackDefaults(
    initialState,
    options,
    initialState.contentPackId
  );
  return sanitizeProfiles(
    {
      ...applyRuleSetDefaults(withContentPackDefaults, options, initialState.ruleSetId),
      ...(adminDefaultMapId ? { mapId: adminDefaultMapId } : {}),
      ...(adminDefaultDiceRuleSetId ? { diceRuleSetId: adminDefaultDiceRuleSetId } : {}),
      ...(adminDefaultVictoryRuleSetId ? { victoryRuleSetId: adminDefaultVictoryRuleSetId } : {}),
      ...(adminDefaultThemeId ? { themeId: adminDefaultThemeId } : {}),
      ...(adminDefaultPieceSkinId ? { pieceSkinId: adminDefaultPieceSkinId } : {})
    },
    options
  );
}

function pickSetupPlayerCount(
  requestedValue: string | null,
  playerRange: GameOptionsResponse["playerRange"]
): number | null {
  const parsedValue = Number(requestedValue);
  const minimumPlayers = playerRange?.min || 2;
  const maximumPlayers = playerRange?.max || 4;

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < minimumPlayers ||
    parsedValue > maximumPlayers
  ) {
    return null;
  }

  return parsedValue;
}

function pickSetupTurnTimeoutHours(
  requestedValue: string | null,
  options: GameOptionsResponse
): string | null {
  const parsedValue = Number(requestedValue);
  if (
    !Number.isInteger(parsedValue) ||
    !options.turnTimeoutHoursOptions.some((hours) => hours === parsedValue)
  ) {
    return null;
  }

  return String(parsedValue);
}

function parseSetupModuleIds(requestedValue: string | null): string[] | null {
  if (requestedValue === null) {
    return null;
  }

  const seenModuleIds = new Set<string>();
  return requestedValue
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => {
      if (!entry || seenModuleIds.has(entry)) {
        return false;
      }
      seenModuleIds.add(entry);
      return true;
    });
}

function applySetupSearchParams(
  formState: NewGameFormState,
  options: GameOptionsResponse,
  searchParams: URLSearchParams
): NewGameFormState {
  const hasPresetParam = searchParams.has("preset");
  const presetId = pickExplicitId(searchParams.get("preset"), resolvedGamePresets(options));
  const requestedPlayerCount = pickSetupPlayerCount(
    searchParams.get("players"),
    options.playerRange
  );
  const requestedTurnTimeoutHours = pickSetupTurnTimeoutHours(
    searchParams.get("turnHours"),
    options
  );
  const requestedModuleIds = parseSetupModuleIds(searchParams.get("modules"));
  const availableModuleIds = new Set(
    filterConfigurableGameModules(resolvedGameModules(options)).map((moduleEntry) => moduleEntry.id)
  );
  const nextModuleIds =
    requestedModuleIds === null
      ? null
      : requestedModuleIds.filter((moduleId) => availableModuleIds.has(moduleId));
  const presetState = hasPresetParam ? applyGamePreset(formState, options, presetId) : formState;

  return sanitizeProfiles(
    {
      ...presetState,
      ...(requestedPlayerCount
        ? {
            totalPlayers: requestedPlayerCount,
            playerTypes: ensurePlayerTypes([], requestedPlayerCount)
          }
        : {}),
      ...(requestedTurnTimeoutHours ? { turnTimeoutHours: requestedTurnTimeoutHours } : {}),
      ...(nextModuleIds !== null ? { selectedModuleIds: nextModuleIds } : {})
    },
    options
  );
}

function applyGamePreset(
  formState: NewGameFormState,
  options: GameOptionsResponse,
  gamePresetId: string
): NewGameFormState {
  if (!gamePresetId) {
    return {
      ...formState,
      gamePresetId: ""
    };
  }

  const preset = resolvedGamePresets(options).find((entry) => entry.id === gamePresetId) || null;
  if (!preset) {
    return formState;
  }

  const nextState: NewGameFormState = {
    ...formState,
    gamePresetId: preset.id,
    selectedModuleIds: Array.isArray(preset.activeModuleIds) ? preset.activeModuleIds : [],
    contentProfileId: preset.contentProfileId || "",
    gameplayProfileId: preset.gameplayProfileId || "",
    uiProfileId: preset.uiProfileId || "",
    contentPackId: pickPresetId(
      preset.defaults?.contentPackId,
      formState.contentPackId,
      options.contentPacks
    ),
    ruleSetId: pickPresetId(preset.defaults?.ruleSetId, formState.ruleSetId, options.ruleSets),
    mapId: pickPresetId(preset.defaults?.mapId, formState.mapId, options.maps),
    diceRuleSetId: pickPresetId(
      preset.defaults?.diceRuleSetId,
      formState.diceRuleSetId,
      options.diceRuleSets
    ),
    victoryRuleSetId: pickPresetId(
      preset.defaults?.victoryRuleSetId,
      formState.victoryRuleSetId,
      options.victoryRuleSets
    ),
    themeId: pickPresetId(preset.defaults?.themeId, formState.themeId, options.themes),
    pieceSkinId: pickPresetId(
      preset.defaults?.pieceSkinId,
      formState.pieceSkinId,
      options.pieceSkins
    )
  };

  return sanitizeProfiles(nextState, options);
}

function playerSlotDescription(type: string, index: number): string {
  if (index === 0) {
    return t("newGame.slot.locked");
  }

  return type === "ai" ? t("newGame.slot.aiDescription") : t("newGame.slot.humanDescription");
}

function setLobbyGamesCache(
  queryClient: ReturnType<typeof useQueryClient>,
  payload: GameListResponse
): void {
  queryClient.setQueryData(lobbyGamesQueryKey(), {
    games: payload.games || [],
    activeGameId: payload.activeGameId || null
  });
}

export function LobbyCreateRoute() {
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const mapSelectRef = useRef<HTMLSelectElement | null>(null);
  const [formState, setFormState] = useState<NewGameFormState | null>(null);
  const [submitError, setSubmitError] = useState("");

  const gameOptionsQuery = useQuery({
    queryKey: gameOptionsQueryKey(),
    queryFn: () =>
      getGameOptions({
        errorMessage: t("newGame.errors.loadOptions"),
        fallbackMessage: t("newGame.errors.loadOptions")
      })
  });

  const createMutation = useMutation({
    mutationFn: (request: CreateGameRequest) =>
      createGame(request, {
        errorMessage: t("errors.requestFailed"),
        fallbackMessage: t("errors.requestFailed")
      })
  });

  const options = gameOptionsQuery.data;
  const gamePresets = resolvedGamePresets(options);
  const availableModules = filterConfigurableGameModules(resolvedGameModules(options));
  const contentProfiles = filterProfilesForSelectedModules(
    resolvedContentProfiles(options),
    formState?.selectedModuleIds || []
  );
  const gameplayProfiles = filterProfilesForSelectedModules(
    resolvedGameplayProfiles(options),
    formState?.selectedModuleIds || []
  );
  const uiProfiles = filterProfilesForSelectedModules(
    resolvedUiProfiles(options),
    formState?.selectedModuleIds || []
  );
  const currentContentPack = formState
    ? selectedContentPack(options, formState.contentPackId)
    : null;
  const currentRuleSet = formState ? selectedRuleSet(options, formState.ruleSetId) : null;
  const resolvedSetupOptions = formState ? resolveSetupOptionIds(formState, currentRuleSet) : null;
  const currentMap = formState ? selectedMap(options, formState.mapId) : null;
  const currentDiceRuleSet = resolvedSetupOptions
    ? selectedDiceRuleSet(options, resolvedSetupOptions.diceRuleSetId)
    : null;
  const currentVictoryRuleSet = resolvedSetupOptions
    ? selectedVictoryRuleSet(options, resolvedSetupOptions.victoryRuleSetId)
    : null;
  const currentTheme = resolvedSetupOptions
    ? selectedTheme(options, resolvedSetupOptions.themeId)
    : null;
  const currentPieceSkin = resolvedSetupOptions
    ? selectedPieceSkin(options, resolvedSetupOptions.pieceSkinId)
    : null;
  const setupSummary = [
    diceRuleSetLabel(currentDiceRuleSet),
    namedOptionLabel(currentVictoryRuleSet),
    namedOptionLabel(currentTheme),
    namedOptionLabel(currentPieceSkin)
  ]
    .filter(Boolean)
    .join(" · ");
  const authenticatedUser = state.status === "authenticated" ? state.user : null;
  const submitDisabled = createMutation.isPending || !authenticatedUser;

  useEffect(() => {
    document.title = t("newGame.title");
  }, []);

  useEffect(() => {
    if (!options || formState) {
      return;
    }

    setFormState(applySetupSearchParams(buildInitialForm(options), options, searchParams));
  }, [formState, options, searchParams]);

  function updateFormState(nextState: NewGameFormState): void {
    setFormState(options ? sanitizeProfiles(nextState, options) : nextState);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!formState || createMutation.isPending) {
      return;
    }

    if (!authenticatedUser) {
      setSubmitError(t("newGame.errors.invalidSession"));
      return;
    }

    setSubmitError("");
    const submittedMapId = mapSelectRef.current?.value || formState.mapId;
    const submittedSetupOptions = resolveSetupOptionIds(formState, currentRuleSet);
    if (!options?.maps.some((entry) => entry.id === submittedMapId)) {
      setSubmitError(t("newGame.errors.unsupportedMap"));
      return;
    }

    const request: CreateGameRequest = {
      ...(formState.name.trim() ? { name: formState.name.trim() } : {}),
      ...(formState.contentPackId ? { contentPackId: formState.contentPackId } : {}),
      ...(formState.ruleSetId ? { ruleSetId: formState.ruleSetId } : {}),
      ...(submittedMapId ? { mapId: submittedMapId } : {}),
      ...(submittedSetupOptions.diceRuleSetId
        ? { diceRuleSetId: submittedSetupOptions.diceRuleSetId }
        : {}),
      ...(submittedSetupOptions.victoryRuleSetId
        ? { victoryRuleSetId: submittedSetupOptions.victoryRuleSetId }
        : {}),
      ...(submittedSetupOptions.themeId ? { themeId: submittedSetupOptions.themeId } : {}),
      ...(submittedSetupOptions.pieceSkinId
        ? { pieceSkinId: submittedSetupOptions.pieceSkinId }
        : {}),
      ...(formState.gamePresetId ? { gamePresetId: formState.gamePresetId } : {}),
      ...(formState.selectedModuleIds.length
        ? { activeModuleIds: formState.selectedModuleIds }
        : {}),
      ...(formState.contentProfileId ? { contentProfileId: formState.contentProfileId } : {}),
      ...(formState.gameplayProfileId ? { gameplayProfileId: formState.gameplayProfileId } : {}),
      ...(formState.uiProfileId ? { uiProfileId: formState.uiProfileId } : {}),
      ...(formState.turnTimeoutHours
        ? { turnTimeoutHours: Number(formState.turnTimeoutHours) }
        : {}),
      totalPlayers: formState.totalPlayers,
      players: ensurePlayerTypes(formState.playerTypes, formState.totalPlayers).map(
        (type, index) => ({
          slot: index + 1,
          type
        })
      )
    };

    try {
      const payload = await createMutation.mutateAsync(request);
      storeCurrentPlayerId(payload.playerId, payload.game.id);
      setLobbyGamesCache(queryClient, {
        games: payload.games || [],
        activeGameId: payload.activeGameId || payload.game.id
      });
      openShellGame(payload.game.id);
    } catch (error) {
      setSubmitError(messageFromError(error, t("errors.requestFailed")));
    }
  }

  return (
    <section data-testid="react-shell-lobby-create-page">
      <section className="panel new-game-shell campaign-shell" data-testid="new-game-shell">
        <div className="section-title-row campaign-hero">
          <div className="campaign-hero-copy">
            <p className="eyebrow">{t("newGame.eyebrow")}</p>
            <h1>{t("newGame.heading")}</h1>
            <p className="stage-copy">{t("newGame.copy")}</p>
          </div>
          <div className="content-meta-line new-game-meta-line campaign-status-line">
            <span id="setup-auth-status">
              {authenticatedUser
                ? t("newGame.auth.commander", { username: authenticatedUser.username })
                : t("newGame.authStatus")}
            </span>
          </div>
        </div>

        <div className="new-game-brief campaign-focus-grid">
          <article className="new-game-brief-card new-game-brief-card-accent campaign-focus-card">
            <span className="lobby-command-label">{t("newGame.goal.label")}</span>
            <strong>{t("newGame.goal.title")}</strong>
            <p>{t("newGame.goal.copy")}</p>
          </article>
          <article className="new-game-brief-card">
            <span className="lobby-command-label">{t("newGame.sequence.label")}</span>
            <ul className="new-game-sequence">
              <li>{t("newGame.sequence.step1")}</li>
              <li>{t("newGame.sequence.step2")}</li>
              <li>{t("newGame.sequence.step3")}</li>
            </ul>
          </article>
          {options && formState ? (
            <article className="new-game-brief-card">
              <span className="lobby-command-label">{t("newGame.quickConfirm.label")}</span>
              <strong>{t("newGame.quickConfirm.title")}</strong>
              <button
                type="submit"
                form="new-game-form"
                className="ghost-button"
                disabled={submitDisabled}
                data-testid="react-shell-new-game-confirm-default"
              >
                {createMutation.isPending
                  ? t("newGame.feedback.creating")
                  : t("newGame.quickConfirm.action")}
              </button>
            </article>
          ) : null}
        </div>

        <div
          id="new-game-feedback"
          className={`session-feedback${submitError ? " is-error" : " is-hidden"}`}
          data-testid={submitError ? "react-shell-new-game-submit-error" : undefined}
        >
          {submitError}
        </div>

        {gameOptionsQuery.isLoading && !options ? (
          <section className="new-game-panel" data-testid="react-shell-new-game-loading">
            <div className="section-title-row compact-row">
              <div>
                <h3>{t("newGame.settings.heading")}</h3>
                <p className="stage-copy">{t("newGame.errors.loadOptions")}</p>
              </div>
            </div>
          </section>
        ) : gameOptionsQuery.isError && !options ? (
          <section className="new-game-panel" data-testid="react-shell-new-game-error">
            <div className="section-title-row compact-row">
              <div>
                <h3>{t("newGame.settings.heading")}</h3>
                <p className="stage-copy">
                  {messageFromError(gameOptionsQuery.error, t("newGame.errors.loadOptions"))}
                </p>
              </div>
            </div>
            <div className="new-game-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => void gameOptionsQuery.refetch()}
              >
                Retry setup
              </button>
            </div>
          </section>
        ) : options && formState ? (
          <>
            <form
              id="new-game-form"
              className="new-game-grid"
              onSubmit={(event) => void handleSubmit(event)}
            >
              <section className="new-game-panel">
                <div className="section-title-row compact-row">
                  <div>
                    <h3>{t("newGame.settings.heading")}</h3>
                    <p className="stage-copy">{t("newGame.settings.copy")}</p>
                  </div>
                </div>
                <label className="field-stack">
                  <span>{t("newGame.name.label")}</span>
                  <input
                    id="setup-game-name"
                    maxLength={80}
                    value={formState.name}
                    placeholder={t("newGame.name.placeholder")}
                    onChange={(event) =>
                      updateFormState({
                        ...formState,
                        name: event.target.value
                      })
                    }
                    data-testid="react-shell-new-game-name"
                  />
                </label>
                <label className="field-stack">
                  <span>{t("newGame.contentPack.label")}</span>
                  <select
                    id="setup-content-pack"
                    value={formState.contentPackId}
                    onChange={(event) => {
                      const nextState = applyContentPackDefaults(
                        formState,
                        options,
                        event.target.value
                      );
                      updateFormState({
                        ...nextState,
                        gamePresetId: ""
                      });
                    }}
                    data-testid="react-shell-new-game-content-pack"
                  >
                    {(options.contentPacks || []).map((contentPack) => (
                      <option key={contentPack.id} value={contentPack.id}>
                        {contentPack.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div
                  id="setup-content-pack-summary"
                  className="setup-ruleset-card"
                  aria-live="polite"
                >
                  {currentContentPack ? (
                    <>
                      <div className="map-setup-card-head">
                        <strong>{currentContentPack.name}</strong>
                        <span className="badge">
                          {selectedMap(options, currentContentPack.defaultMapId || "")?.name ||
                            currentContentPack.defaultMapId ||
                            t("common.notAvailable")}
                        </span>
                      </div>
                      <p className="map-setup-copy">
                        {t("newGame.contentPack.summary", {
                          description: currentContentPack.description,
                          mapName:
                            selectedMap(options, currentContentPack.defaultMapId || "")?.name ||
                            currentContentPack.defaultMapId ||
                            t("common.notAvailable"),
                          dice: diceRuleSetLabel(
                            selectedDiceRuleSet(
                              options,
                              currentContentPack.defaultDiceRuleSetId || ""
                            )
                          )
                        })}
                      </p>
                    </>
                  ) : null}
                </div>
                <label className="field-stack">
                  <span>{t("newGame.ruleset.label")}</span>
                  <select
                    id="setup-ruleset"
                    value={formState.ruleSetId}
                    onChange={(event) => {
                      const nextState = applyRuleSetDefaults(
                        formState,
                        options,
                        event.target.value
                      );
                      updateFormState({
                        ...nextState,
                        gamePresetId: ""
                      });
                    }}
                    data-testid="react-shell-new-game-ruleset"
                  >
                    {options.ruleSets.map((ruleSet) => (
                      <option key={ruleSet.id} value={ruleSet.id}>
                        {ruleSet.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div id="setup-ruleset-summary" className="setup-ruleset-card" aria-live="polite">
                  {currentRuleSet ? (
                    <>
                      <div className="map-setup-card-head">
                        <strong>{currentRuleSet.name}</strong>
                        <span className="badge">{diceRuleSetLabel(currentDiceRuleSet)}</span>
                      </div>
                      <p className="map-setup-copy">
                        {t(
                          formState.customizeOptions
                            ? "newGame.ruleset.summary.custom"
                            : "newGame.ruleset.summary.default",
                          {
                            ruleset: currentRuleSet.name,
                            dice: diceRuleSetLabel(currentDiceRuleSet)
                          }
                        )}
                      </p>
                      <div className="session-detail-tags">
                        <span className="badge">{namedOptionLabel(currentVictoryRuleSet)}</span>
                        <span className="badge">{namedOptionLabel(currentTheme)}</span>
                        <span className="badge">{namedOptionLabel(currentPieceSkin)}</span>
                        <span className="badge">
                          {currentMap?.name || t("common.notAvailable")}
                        </span>
                      </div>
                      <p className="map-setup-copy">{setupSummary || t("newGame.options.copy")}</p>
                    </>
                  ) : (
                    setupSummary || t("newGame.options.copy")
                  )}
                </div>
                <label className="field-stack">
                  <span>{t("newGame.map.label")}</span>
                  <select
                    id="setup-map"
                    ref={mapSelectRef}
                    value={formState.mapId}
                    onChange={(event) =>
                      updateFormState({
                        ...formState,
                        mapId: event.target.value,
                        gamePresetId: ""
                      })
                    }
                    data-testid="react-shell-new-game-map"
                  >
                    {options.maps.map((map) => (
                      <option key={map.id} value={map.id}>
                        {map.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div id="setup-map-details" className="map-setup-card" aria-live="polite">
                  {currentMap ? (
                    <>
                      <div className="map-setup-card-head">
                        <strong>{currentMap.name}</strong>
                        <span className="badge">
                          {t("newGame.map.summary", {
                            territoryCount: currentMap.territoryCount,
                            continentCount: currentMap.continentCount
                          })}
                        </span>
                      </div>
                      <p className="map-setup-copy">{t("newGame.map.copy")}</p>
                      <ul className="map-setup-bonus-list">
                        {(currentMap.continentBonuses || []).map((continent) => (
                          <li key={continent.name}>
                            <span>{continent.name}</span>
                            <strong>
                              {t("newGame.map.bonusLine", {
                                bonus: continent.bonus,
                                territoryCount: continent.territoryCount
                              })}
                            </strong>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
                <section className="setup-options-stack" aria-labelledby="setup-options-heading">
                  <div className="section-title-row compact-row">
                    <div>
                      <h4 id="setup-options-heading">{t("newGame.options.heading")}</h4>
                      <p className="stage-copy">{t("newGame.options.copy")}</p>
                    </div>
                  </div>
                  <label className="setup-options-toggle" htmlFor="setup-customize-options">
                    <input
                      id="setup-customize-options"
                      type="checkbox"
                      checked={formState.customizeOptions}
                      onChange={(event) =>
                        updateFormState({
                          ...formState,
                          customizeOptions: event.target.checked
                        })
                      }
                      data-testid="react-shell-new-game-customize-options"
                    />
                    <span>{t("newGame.options.customizeLabel")}</span>
                  </label>
                  <div
                    id="setup-advanced-options"
                    className="setup-advanced-options"
                    hidden={!formState.customizeOptions}
                  >
                    <label className="field-stack">
                      <span>{t("newGame.dice.label")}</span>
                      <select
                        id="setup-dice-ruleset"
                        value={formState.diceRuleSetId}
                        onChange={(event) =>
                          updateFormState({
                            ...formState,
                            diceRuleSetId: event.target.value,
                            gamePresetId: ""
                          })
                        }
                        data-testid="react-shell-new-game-dice"
                      >
                        {options.diceRuleSets.map((ruleSet) => (
                          <option key={ruleSet.id} value={ruleSet.id}>
                            {ruleSet.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-stack">
                      <span>{t("newGame.victory.label")}</span>
                      <select
                        id="setup-victory-ruleset"
                        value={formState.victoryRuleSetId}
                        onChange={(event) =>
                          updateFormState({
                            ...formState,
                            victoryRuleSetId: event.target.value,
                            gamePresetId: ""
                          })
                        }
                        data-testid="react-shell-new-game-victory"
                      >
                        {options.victoryRuleSets.map((ruleSet) => (
                          <option key={ruleSet.id} value={ruleSet.id}>
                            {ruleSet.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-stack">
                      <span>{t("newGame.theme.label")}</span>
                      <select
                        id="setup-theme"
                        value={formState.themeId}
                        onChange={(event) =>
                          updateFormState({
                            ...formState,
                            themeId: event.target.value,
                            gamePresetId: ""
                          })
                        }
                        data-testid="react-shell-new-game-theme"
                      >
                        {options.themes.map((theme) => (
                          <option key={theme.id} value={theme.id}>
                            {theme.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-stack">
                      <span>{t("newGame.pieceSkin.label")}</span>
                      <select
                        id="setup-piece-skin"
                        value={formState.pieceSkinId}
                        onChange={(event) =>
                          updateFormState({
                            ...formState,
                            pieceSkinId: event.target.value,
                            gamePresetId: ""
                          })
                        }
                        data-testid="react-shell-new-game-piece-skin"
                      >
                        {options.pieceSkins.map((pieceSkin) => (
                          <option key={pieceSkin.id} value={pieceSkin.id}>
                            {pieceSkin.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {gamePresets.length ||
                    availableModules.length ||
                    contentProfiles.length ||
                    gameplayProfiles.length ||
                    uiProfiles.length ? (
                      <div id="setup-module-options">
                        {gamePresets.length ? (
                          <label className="field-stack">
                            <span>Preset</span>
                            <select
                              id="setup-game-preset"
                              value={formState.gamePresetId}
                              onChange={(event) =>
                                updateFormState(
                                  applyGamePreset(formState, options, event.target.value)
                                )
                              }
                              data-testid="react-shell-new-game-preset"
                            >
                              <option value="">{t("common.notAvailable")}</option>
                              {gamePresets.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                  {preset.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}

                        {availableModules.length ? (
                          <div
                            className="new-game-module-list"
                            data-testid="react-shell-new-game-modules"
                          >
                            {availableModules.map((moduleEntry) => {
                              const isChecked = formState.selectedModuleIds.includes(
                                moduleEntry.id
                              );
                              return (
                                <label className="new-game-module-item" key={moduleEntry.id}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(event) => {
                                      const nextSelectedModuleIds = event.target.checked
                                        ? [...formState.selectedModuleIds, moduleEntry.id]
                                        : formState.selectedModuleIds.filter(
                                            (entry) => entry !== moduleEntry.id
                                          );
                                      updateFormState({
                                        ...formState,
                                        selectedModuleIds: nextSelectedModuleIds,
                                        gamePresetId: ""
                                      });
                                    }}
                                    data-testid={`react-shell-new-game-module-${moduleEntry.id}`}
                                  />
                                  <span>
                                    <strong>{moduleEntry.displayName}</strong>
                                    <small>
                                      {moduleEntry.description ||
                                        moduleEntry.kind ||
                                        moduleEntry.id}
                                    </small>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        ) : null}

                        <div className="setup-advanced-options">
                          <label className="field-stack">
                            <span>Content profile</span>
                            <select
                              id="setup-content-profile"
                              value={formState.contentProfileId}
                              onChange={(event) =>
                                updateFormState({
                                  ...formState,
                                  contentProfileId: event.target.value,
                                  gamePresetId: ""
                                })
                              }
                              data-testid="react-shell-new-game-content-profile"
                            >
                              <option value="">{t("common.notAvailable")}</option>
                              {contentProfiles.map((profile) => (
                                <option key={profile.id} value={profile.id}>
                                  {profile.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field-stack">
                            <span>Gameplay profile</span>
                            <select
                              id="setup-gameplay-profile"
                              value={formState.gameplayProfileId}
                              onChange={(event) =>
                                updateFormState({
                                  ...formState,
                                  gameplayProfileId: event.target.value,
                                  gamePresetId: ""
                                })
                              }
                              data-testid="react-shell-new-game-gameplay-profile"
                            >
                              <option value="">{t("common.notAvailable")}</option>
                              {gameplayProfiles.map((profile) => (
                                <option key={profile.id} value={profile.id}>
                                  {profile.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field-stack">
                            <span>UI profile</span>
                            <select
                              id="setup-ui-profile"
                              value={formState.uiProfileId}
                              onChange={(event) =>
                                updateFormState({
                                  ...formState,
                                  uiProfileId: event.target.value,
                                  gamePresetId: ""
                                })
                              }
                              data-testid="react-shell-new-game-ui-profile"
                            >
                              <option value="">{t("common.notAvailable")}</option>
                              {uiProfiles.map((profile) => (
                                <option key={profile.id} value={profile.id}>
                                  {profile.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>
                <label className="field-stack">
                  <span>{t("newGame.totalPlayers.label")}</span>
                  <select
                    id="setup-total-players"
                    value={String(formState.totalPlayers)}
                    onChange={(event) =>
                      updateFormState({
                        ...formState,
                        totalPlayers: Number(event.target.value),
                        playerTypes: ensurePlayerTypes(
                          formState.playerTypes,
                          Number(event.target.value)
                        )
                      })
                    }
                    data-testid="react-shell-new-game-total-players"
                  >
                    {Array.from(
                      {
                        length: Math.max(
                          (options.playerRange?.max || 4) - (options.playerRange?.min || 2) + 1,
                          1
                        )
                      },
                      (_, index) => (options.playerRange?.min || 2) + index
                    ).map((playerCount) => (
                      <option key={playerCount} value={playerCount}>
                        {playerCount}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-stack">
                  <span>{t("newGame.turnTimeout.label")}</span>
                  <select
                    id="setup-turn-timeout-hours"
                    value={formState.turnTimeoutHours}
                    onChange={(event) =>
                      updateFormState({
                        ...formState,
                        turnTimeoutHours: event.target.value
                      })
                    }
                    data-testid="react-shell-new-game-turn-timeout"
                  >
                    {options.turnTimeoutHoursOptions.map((hours) => (
                      <option key={hours} value={String(hours)}>
                        {t("newGame.turnTimeout.option", { hours })}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <section className="new-game-panel">
                <div className="section-title-row compact-row">
                  <div>
                    <h3>{t("newGame.playerSlots.heading")}</h3>
                    <p className="stage-copy">{t("newGame.playerSlots.copy")}</p>
                  </div>
                  <span className="badge">{t("newGame.playerSlots.badge")}</span>
                </div>
                <div id="setup-player-slots" className="setup-player-slots">
                  {ensurePlayerTypes(formState.playerTypes, formState.totalPlayers).map(
                    (playerType, index) => (
                      <article
                        className={`setup-slot${index === 0 ? " is-fixed" : ""}`}
                        data-slot-index={index}
                        key={`slot-${index + 1}`}
                      >
                        <div className="setup-slot-head">
                          <strong>{t("newGame.slot.playerLabel", { number: index + 1 })}</strong>
                          {index === 0 ? (
                            <span className="badge accent">{t("newGame.slot.creatorBadge")}</span>
                          ) : null}
                        </div>
                        {index === 0 ? (
                          <>
                            <div className="field-stack">
                              <span>{t("newGame.slot.typeLabel")}</span>
                              <div className="setup-fixed-value">
                                {t("newGame.slot.humanOption")}
                              </div>
                            </div>
                            <p className="setup-slot-note" data-role="note">
                              {playerSlotDescription(playerType, index)}
                            </p>
                          </>
                        ) : (
                          <label className="field-stack">
                            <span>{t("newGame.slot.typeLabel")}</span>
                            <select
                              data-role="type"
                              value={playerType}
                              onChange={(event) => {
                                const nextPlayerTypes = ensurePlayerTypes(
                                  formState.playerTypes,
                                  formState.totalPlayers
                                );
                                nextPlayerTypes[index] = event.target.value;
                                updateFormState({
                                  ...formState,
                                  playerTypes: nextPlayerTypes
                                });
                              }}
                              data-testid={`react-shell-new-game-slot-${index + 1}`}
                            >
                              <option value="human">{t("newGame.slot.humanOption")}</option>
                              <option value="ai">{t("newGame.slot.aiOption")}</option>
                            </select>
                            <small className="setup-slot-note" data-role="note">
                              {playerSlotDescription(playerType, index)}
                            </small>
                          </label>
                        )}
                      </article>
                    )
                  )}
                </div>
              </section>
            </form>

            <div className="new-game-actions">
              <Link className="ghost-button" to={buildLobbyPath()}>
                {t("common.cancel")}
              </Link>
              <button
                id="submit-new-game"
                type="submit"
                form="new-game-form"
                className="ghost-button"
                disabled={submitDisabled}
                data-testid="react-shell-new-game-submit"
              >
                {createMutation.isPending
                  ? t("newGame.feedback.creating")
                  : t("newGame.createOpen")}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </section>
  );
}
