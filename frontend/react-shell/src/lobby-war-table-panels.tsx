import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CreateGameRequest,
  CreateGameResponse
} from "@frontend-generated/shared-runtime-validation.mts";

import { createGame, getGameOptions } from "@frontend-core/api/client.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import { resolvedGameModules, resolvedGamePresets } from "@frontend-core/module-catalog.mts";
import { t } from "@frontend-i18n";

import { openShellGame } from "@react-shell/game-navigation";
import {
  buildPlayerCountChoices,
  buildTurnTimeoutHourChoices,
  filterConfigurableGameModules
} from "@react-shell/game-setup-options";
import { storeCurrentPlayerId } from "@react-shell/player-session";
import { gameOptionsQueryKey, lobbyGamesQueryKey } from "@react-shell/react-query";
import { WarTableIcon, type WarTableIconName } from "@react-shell/war-table-icons";

type WarTableLobbyPanelsProps = {
  canCreateGame: boolean;
};

type SelectableModule = ReturnType<typeof resolvedGameModules>[number];

export function buildHumanPlayerSlots(
  totalPlayers: number
): NonNullable<CreateGameRequest["players"]> {
  return Array.from({ length: totalPlayers }, (_, index) => ({
    slot: index + 1,
    type: "human"
  }));
}

export function filterVisibleModuleIds(
  moduleIds: readonly string[] | null | undefined,
  visibleModules: readonly SelectableModule[]
): string[] {
  const visibleModuleIds = new Set(visibleModules.map((moduleEntry) => moduleEntry.id));
  return (moduleIds || []).filter((moduleId) => visibleModuleIds.has(moduleId));
}

function sameModuleIds(first: readonly string[], second: readonly string[]): boolean {
  return (
    first.length === second.length && first.every((moduleId, index) => moduleId === second[index])
  );
}

function presetSummary(preset: ReturnType<typeof resolvedGamePresets>[number] | null): string {
  if (!preset) {
    return t("warTable.lobby.presetFallback");
  }

  return preset.description || t("warTable.lobby.presetFallback");
}

function presetArtClassName(
  preset: ReturnType<typeof resolvedGamePresets>[number],
  index: number
): string {
  const presetText = `${preset.id} ${preset.name || ""}`.toLowerCase();

  if (presetText.includes("duel")) {
    return "is-duel";
  }

  if (presetText.includes("objective") || presetText.includes("mission")) {
    return "is-objective";
  }

  if (presetText.includes("world") || presetText.includes("domination")) {
    return "is-world";
  }

  return index % 2 === 0 ? "is-classic" : "is-command";
}

function moduleIconName(moduleId: string): WarTableIconName {
  const normalizedModuleId = moduleId.toLowerCase();

  if (normalizedModuleId.includes("objective") || normalizedModuleId.includes("mission")) {
    return "objective";
  }

  if (normalizedModuleId.includes("fog") || normalizedModuleId.includes("stealth")) {
    return "stealth";
  }

  if (normalizedModuleId.includes("card")) {
    return "cards";
  }

  return "medal";
}

export function LobbyWarTablePanels({ canCreateGame }: WarTableLobbyPanelsProps) {
  const queryClient = useQueryClient();
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState(4);
  const [selectedTurnHours, setSelectedTurnHours] = useState(48);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [showAllPresets, setShowAllPresets] = useState(false);

  const optionsQuery = useQuery({
    queryKey: gameOptionsQueryKey(),
    queryFn: () =>
      getGameOptions({
        errorMessage: t("newGame.errors.loadOptions"),
        fallbackMessage: t("newGame.errors.loadOptions")
      })
  });

  const options = optionsQuery.data;
  const presets = useMemo(() => resolvedGamePresets(options), [options]);
  const modules = useMemo(
    () => filterConfigurableGameModules(resolvedGameModules(options)).slice(0, 3),
    [options]
  );
  const selectedPreset =
    presets.find((preset) => preset.id === selectedPresetId) || presets[0] || null;
  const visiblePresets = showAllPresets ? presets : presets.slice(0, 4);
  const createMutation = useMutation({
    mutationFn: (request: CreateGameRequest) =>
      createGame(request, {
        errorMessage: t("errors.requestFailed"),
        fallbackMessage: t("errors.requestFailed")
      })
  });

  useEffect(() => {
    if (!presets.length || presets.some((preset) => preset.id === selectedPresetId)) {
      return;
    }

    const defaultPreset = presets[0];
    setSelectedPresetId(defaultPreset.id);
    setSelectedModuleIds(filterVisibleModuleIds(defaultPreset.activeModuleIds, modules));
  }, [modules, presets, selectedPresetId]);

  useEffect(() => {
    setSelectedModuleIds((currentModuleIds) => {
      const nextModuleIds = filterVisibleModuleIds(currentModuleIds, modules);
      return sameModuleIds(currentModuleIds, nextModuleIds) ? currentModuleIds : nextModuleIds;
    });
  }, [modules]);

  useEffect(() => {
    const choices = buildPlayerCountChoices(options);
    if (choices.length && !choices.includes(selectedPlayers)) {
      setSelectedPlayers(choices[0]);
    }

    const durations = buildTurnTimeoutHourChoices(options);
    if (durations.length && !durations.includes(selectedTurnHours)) {
      setSelectedTurnHours(durations[0]);
    }
  }, [options, selectedPlayers, selectedTurnHours]);

  async function handleCreateGame(): Promise<void> {
    if (!canCreateGame || createMutation.isPending) {
      return;
    }

    const request: CreateGameRequest = {
      name: selectedPreset?.name || t("warTable.lobby.defaultGameName"),
      totalPlayers: selectedPlayers,
      turnTimeoutHours: selectedTurnHours,
      gamePresetId: selectedPreset?.id || null,
      activeModuleIds: selectedModuleIds,
      players: buildHumanPlayerSlots(selectedPlayers)
    };

    let response: CreateGameResponse;

    try {
      response = await createMutation.mutateAsync(request);
    } catch {
      return;
    }

    if (response.playerId) {
      storeCurrentPlayerId(response.playerId, response.game.id);
    }
    await queryClient.invalidateQueries({ queryKey: lobbyGamesQueryKey() });
    openShellGame(response.game.id);
  }

  function handlePresetChange(nextPresetId: string): void {
    const nextPreset = presets.find((preset) => preset.id === nextPresetId) || null;
    setSelectedPresetId(nextPresetId);
    setSelectedModuleIds(filterVisibleModuleIds(nextPreset?.activeModuleIds, modules));
  }

  function toggleModule(moduleId: string): void {
    setSelectedModuleIds((current) =>
      current.includes(moduleId)
        ? current.filter((entry) => entry !== moduleId)
        : [...current, moduleId]
    );
  }

  const createDisabled = !canCreateGame || optionsQuery.isLoading || createMutation.isPending;

  return (
    <div className="war-table-lobby-panels" aria-label={t("warTable.lobby.panelsAria")}>
      <section className="war-table-quick-create" aria-label={t("warTable.lobby.create.heading")}>
        <h3>{t("warTable.lobby.create.heading")}</h3>
        <label className="war-table-field" htmlFor="war-table-preset">
          <span>{t("warTable.lobby.preset")}</span>
          <select
            id="war-table-preset"
            value={selectedPreset?.id || ""}
            disabled={optionsQuery.isLoading}
            onChange={(event) => handlePresetChange(event.target.value)}
          >
            {presets.length ? (
              presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name || preset.id}
                </option>
              ))
            ) : (
              <option value="">{t("warTable.lobby.loadingOptions")}</option>
            )}
          </select>
        </label>

        <div className="war-table-control-row war-table-players-row">
          <span>{t("warTable.lobby.players")}</span>
          <div
            className="war-table-segmented"
            role="group"
            aria-label={t("warTable.lobby.players")}
          >
            {buildPlayerCountChoices(options).map((count) => (
              <button
                key={count}
                type="button"
                className={count === selectedPlayers ? "is-active" : ""}
                onClick={() => setSelectedPlayers(count)}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div className="war-table-control-row war-table-turn-row">
          <span>{t("warTable.lobby.turnDuration")}</span>
          <div
            className="war-table-segmented"
            role="group"
            aria-label={t("warTable.lobby.turnDuration")}
          >
            {buildTurnTimeoutHourChoices(options).map((hours) => (
              <button
                key={hours}
                type="button"
                className={hours === selectedTurnHours ? "is-active" : ""}
                onClick={() => setSelectedTurnHours(hours)}
              >
                {`${hours}h`}
              </button>
            ))}
          </div>
        </div>

        <div className="war-table-control-row war-table-modules-row">
          <span>{t("warTable.lobby.modules")}</span>
          <div className="war-table-module-toggles">
            {modules.length ? (
              modules.map((moduleEntry) => (
                <button
                  key={moduleEntry.id}
                  type="button"
                  className={selectedModuleIds.includes(moduleEntry.id) ? "is-active" : ""}
                  onClick={() => toggleModule(moduleEntry.id)}
                >
                  <WarTableIcon name={moduleIconName(moduleEntry.id)} />
                  <span>{moduleEntry.displayName || moduleEntry.id}</span>
                </button>
              ))
            ) : (
              <span className="badge">{t("warTable.lobby.coreOnly")}</span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="lobby-create-button war-table-create-button"
          disabled={createDisabled}
          onClick={() => void handleCreateGame()}
        >
          {createMutation.isPending
            ? t("newGame.feedback.creating")
            : t("warTable.lobby.createButton")}
        </button>
        {createMutation.isError ? (
          <p className="session-feedback is-error">
            {messageFromError(createMutation.error, t("errors.requestFailed"))}
          </p>
        ) : null}
      </section>

      <aside className="war-table-preset-panel" aria-label={t("warTable.lobby.presets.heading")}>
        <h3>{t("warTable.lobby.presets.heading")}</h3>
        <div className="war-table-preset-list">
          {(presets.length ? visiblePresets : [selectedPreset])
            .filter(Boolean)
            .map((preset, index) => (
              <button
                key={preset.id}
                type="button"
                className={preset.id === selectedPreset?.id ? "is-active" : ""}
                onClick={() => handlePresetChange(preset.id)}
              >
                <span
                  className={`war-table-preset-art ${presetArtClassName(preset, index)}`}
                  aria-hidden="true"
                />
                <span className="war-table-preset-copy">
                  <strong>{preset.name || preset.id}</strong>
                  <span>{presetSummary(preset)}</span>
                </span>
              </button>
            ))}
        </div>
        <button
          type="button"
          className="ghost-button war-table-open-active"
          disabled={optionsQuery.isLoading || !presets.length}
          onClick={() => setShowAllPresets((currentValue) => !currentValue)}
        >
          {showAllPresets ? t("warTable.lobby.hidePresets") : t("warTable.lobby.viewAllPresets")}
        </button>
      </aside>
    </div>
  );
}
