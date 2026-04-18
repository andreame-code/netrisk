import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ContentPackSummary,
  CreateGameRequest,
  GameListResponse,
  GameOptionsResponse,
  NetRiskGamePreset,
  NetRiskModuleProfile,
  RuleSetSummary
} from "@frontend-generated/shared-runtime-validation.mts";

import { createGame, getGameOptions } from "@frontend-core/api/client.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import { t } from "@frontend-i18n";

import { openReactGame } from "@react-shell/legacy-game-handoff";
import { storeCurrentPlayerId } from "@react-shell/player-session";
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
    options.contentProfiles,
    formState.selectedModuleIds
  );
  const availableGameplayProfiles = filterProfilesForSelectedModules(
    options.gameplayProfiles,
    formState.selectedModuleIds
  );
  const availableUiProfiles = filterProfilesForSelectedModules(
    options.uiProfiles,
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
  const initialState: NewGameFormState = {
    name: "",
    contentPackId: firstId(options.contentPacks),
    ruleSetId: firstId(options.ruleSets),
    mapId: firstId(options.maps),
    customizeOptions: false,
    diceRuleSetId: firstId(options.diceRuleSets),
    victoryRuleSetId: firstId(options.victoryRuleSets),
    themeId: firstId(options.themes),
    pieceSkinId: firstId(options.pieceSkins),
    turnTimeoutHours: options.turnTimeoutHoursOptions?.[0]
      ? String(options.turnTimeoutHoursOptions[0])
      : "",
    totalPlayers: Math.max(options.playerRange?.min || 2, 2),
    playerTypes: ["human", "human"],
    selectedModuleIds: [],
    gamePresetId: "",
    contentProfileId: "",
    gameplayProfileId: "",
    uiProfileId: ""
  };

  const withContentPackDefaults = applyContentPackDefaults(
    initialState,
    options,
    initialState.contentPackId
  );
  return applyRuleSetDefaults(withContentPackDefaults, options, initialState.ruleSetId);
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

  const preset =
    options.gamePresets?.find((entry: NetRiskGamePreset) => entry.id === gamePresetId) || null;
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
  const queryClient = useQueryClient();
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
  const availableModules =
    options?.modules?.filter((moduleEntry) => moduleEntry.id !== "core.base") || [];
  const contentProfiles = filterProfilesForSelectedModules(
    options?.contentProfiles,
    formState?.selectedModuleIds || []
  );
  const gameplayProfiles = filterProfilesForSelectedModules(
    options?.gameplayProfiles,
    formState?.selectedModuleIds || []
  );
  const uiProfiles = filterProfilesForSelectedModules(
    options?.uiProfiles,
    formState?.selectedModuleIds || []
  );

  useEffect(() => {
    if (!options || formState) {
      return;
    }

    setFormState(buildInitialForm(options));
  }, [formState, options]);

  function updateFormState(nextState: NewGameFormState): void {
    setFormState(options ? sanitizeProfiles(nextState, options) : nextState);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!formState || createMutation.isPending) {
      return;
    }

    setSubmitError("");

    const request: CreateGameRequest = {
      ...(formState.name.trim() ? { name: formState.name.trim() } : {}),
      ...(formState.contentPackId ? { contentPackId: formState.contentPackId } : {}),
      ...(formState.ruleSetId ? { ruleSetId: formState.ruleSetId } : {}),
      ...(formState.mapId ? { mapId: formState.mapId } : {}),
      ...(formState.diceRuleSetId ? { diceRuleSetId: formState.diceRuleSetId } : {}),
      ...(formState.victoryRuleSetId ? { victoryRuleSetId: formState.victoryRuleSetId } : {}),
      ...(formState.themeId ? { themeId: formState.themeId } : {}),
      ...(formState.pieceSkinId ? { pieceSkinId: formState.pieceSkinId } : {}),
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
      storeCurrentPlayerId(payload.playerId);
      setLobbyGamesCache(queryClient, {
        games: payload.games || [],
        activeGameId: payload.activeGameId || payload.game.id
      });
      openReactGame(payload.game.id);
    } catch (error) {
      setSubmitError(messageFromError(error, t("errors.requestFailed")));
    }
  }

  if (gameOptionsQuery.isLoading && !options) {
    return (
      <section className="status-panel" data-testid="react-shell-new-game-loading">
        <p className="status-label">{t("newGame.eyebrow")}</p>
        <h2>{t("newGame.heading")}</h2>
        <p className="status-copy">{t("newGame.errors.loadOptions")}</p>
      </section>
    );
  }

  if (gameOptionsQuery.isError && !options) {
    return (
      <section className="status-panel status-panel-error" data-testid="react-shell-new-game-error">
        <p className="status-label">{t("newGame.eyebrow")}</p>
        <h2>{t("newGame.heading")}</h2>
        <p className="status-copy">
          {messageFromError(gameOptionsQuery.error, t("newGame.errors.loadOptions"))}
        </p>
        <div className="shell-actions">
          <button
            type="button"
            className="refresh-button"
            onClick={() => void gameOptionsQuery.refetch()}
          >
            Retry setup
          </button>
        </div>
      </section>
    );
  }

  if (!options || !formState) {
    return null;
  }

  return (
    <section data-testid="react-shell-lobby-create-page">
      <p className="status-label">{t("newGame.eyebrow")}</p>
      <h2>{t("newGame.heading")}</h2>
      <p className="status-copy">{t("newGame.copy")}</p>

      {submitError ? (
        <div
          className="profile-query-state profile-query-state-error"
          data-testid="react-shell-new-game-submit-error"
        >
          <p className="metric-copy">{submitError}</p>
        </div>
      ) : null}

      <form className="shell-form new-game-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="new-game-grid">
          <section className="placeholder-card new-game-card">
            <div className="card-header new-game-card-header">
              <div>
                <p className="status-label">{t("newGame.settings.heading")}</p>
                <h3>{t("newGame.settings.copy")}</h3>
              </div>
              <Link className="ghost-action" to="/lobby">
                {t("lobby.heading")}
              </Link>
            </div>

            <label className="shell-field">
              <span>{t("newGame.name.label")}</span>
              <input
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

            <label className="shell-field">
              <span>{t("newGame.contentPack.label")}</span>
              <select
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

            <label className="shell-field">
              <span>{t("newGame.ruleset.label")}</span>
              <select
                value={formState.ruleSetId}
                onChange={(event) => {
                  const nextState = applyRuleSetDefaults(formState, options, event.target.value);
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

            <label className="shell-field">
              <span>{t("newGame.map.label")}</span>
              <select
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

            <div className="new-game-inline-grid">
              <label className="shell-field">
                <span>{t("newGame.totalPlayers.label")}</span>
                <select
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

              <label className="shell-field">
                <span>{t("newGame.turnTimeout.label")}</span>
                <select
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
            </div>
          </section>

          <section className="placeholder-card new-game-card">
            <div className="card-header new-game-card-header">
              <div>
                <p className="status-label">{t("newGame.options.heading")}</p>
                <h3>{t("newGame.options.copy")}</h3>
              </div>
              <label className="new-game-toggle">
                <input
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
            </div>

            {formState.customizeOptions ? (
              <div className="new-game-advanced-grid">
                <label className="shell-field">
                  <span>{t("newGame.dice.label")}</span>
                  <select
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

                <label className="shell-field">
                  <span>{t("newGame.victory.label")}</span>
                  <select
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

                <label className="shell-field">
                  <span>{t("newGame.theme.label")}</span>
                  <select
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

                <label className="shell-field">
                  <span>{t("newGame.pieceSkin.label")}</span>
                  <select
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
              </div>
            ) : (
              <p className="metric-copy">{t("newGame.options.copy")}</p>
            )}

            {options.gamePresets?.length ||
            availableModules.length ||
            contentProfiles.length ||
            gameplayProfiles.length ||
            uiProfiles.length ? (
              <div className="new-game-modules-stack">
                {options.gamePresets?.length ? (
                  <label className="shell-field">
                    <span>Preset</span>
                    <select
                      value={formState.gamePresetId}
                      onChange={(event) =>
                        updateFormState(applyGamePreset(formState, options, event.target.value))
                      }
                      data-testid="react-shell-new-game-preset"
                    >
                      <option value="">{t("common.notAvailable")}</option>
                      {options.gamePresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {availableModules.length ? (
                  <div className="new-game-module-list" data-testid="react-shell-new-game-modules">
                    {availableModules.map((moduleEntry) => {
                      const isChecked = formState.selectedModuleIds.includes(moduleEntry.id);
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
                              {moduleEntry.description || moduleEntry.kind || moduleEntry.id}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}

                <div className="new-game-advanced-grid">
                  <label className="shell-field">
                    <span>Content profile</span>
                    <select
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

                  <label className="shell-field">
                    <span>Gameplay profile</span>
                    <select
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

                  <label className="shell-field">
                    <span>UI profile</span>
                    <select
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
          </section>
        </div>

        <section className="placeholder-card new-game-card">
          <div className="card-header new-game-card-header">
            <div>
              <p className="status-label">{t("newGame.playerSlots.heading")}</p>
              <h3>{t("newGame.playerSlots.copy")}</h3>
            </div>
            <span className="status-pill">{formState.totalPlayers}</span>
          </div>

          <div className="new-game-slot-grid">
            {ensurePlayerTypes(formState.playerTypes, formState.totalPlayers).map(
              (playerType, index) => (
                <article className="new-game-slot-card" key={`slot-${index + 1}`}>
                  <div className="new-game-slot-head">
                    <strong>{t("newGame.slot.playerLabel", { number: index + 1 })}</strong>
                    {index === 0 ? (
                      <span className="status-pill">{t("newGame.slot.creatorBadge")}</span>
                    ) : null}
                  </div>

                  {index === 0 ? (
                    <div className="new-game-slot-copy">
                      <span>{t("newGame.slot.humanOption")}</span>
                      <small>{playerSlotDescription(playerType, index)}</small>
                    </div>
                  ) : (
                    <label className="shell-field">
                      <span>{t("newGame.slot.typeLabel")}</span>
                      <select
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
                      <small>{playerSlotDescription(playerType, index)}</small>
                    </label>
                  )}
                </article>
              )
            )}
          </div>

          <div className="shell-actions">
            <button
              type="submit"
              className="refresh-button"
              disabled={createMutation.isPending}
              data-testid="react-shell-new-game-submit"
            >
              {createMutation.isPending ? t("newGame.feedback.creating") : t("newGame.createOpen")}
            </button>
            <Link className="ghost-action" to="/lobby">
              {t("lobby.heading")}
            </Link>
          </div>
        </section>
      </form>
    </section>
  );
}
