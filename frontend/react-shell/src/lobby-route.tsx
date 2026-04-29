import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  GameListResponse,
  GameSummary
} from "@frontend-generated/shared-runtime-validation.mts";

import { joinGame, listGames, openGame } from "@frontend-core/api/client.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import { formatDate, t } from "@frontend-i18n";

import { useAuth } from "@react-shell/auth";
import { openShellGame } from "@react-shell/game-navigation";
import { LobbyWarTablePanels } from "@react-shell/lobby-war-table-panels";
import {
  readCurrentPlayerId,
  storeCurrentPlayerId,
  subscribeCurrentPlayerIdChanges
} from "@react-shell/player-session";
import { buildNewGamePath } from "@react-shell/public-auth-paths";
import { lobbyGamesQueryKey } from "@react-shell/react-query";
import { currentShellTheme } from "@react-shell/theme";
import { themeCopy } from "@react-shell/theme-copy";
import { WarTableIcon } from "@react-shell/war-table-icons";

const VISIBLE_GAMES_BATCH_SIZE = 15;

type WarTableLobbyFilter = "active" | "all" | "finished" | "my-turn" | "waiting";
type WarTableCampaignProgressGame = GameSummary & {
  currentRound?: number | null;
  round?: number | null;
  turnDeadlineAt?: string | null;
  turnEndsAt?: string | null;
  turnExpiresAt?: string | null;
};

function formatUpdatedTime(value: string | null | undefined): string {
  if (!value) {
    return t("common.notAvailable");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return t("common.notAvailable");
  }

  return formatDate(parsed, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function phaseLabel(phase: string): string {
  if (phase === "active") {
    return t("common.phase.active");
  }

  if (phase === "finished") {
    return t("common.phase.finished");
  }

  return t("common.phase.lobby");
}

function summarizeIdentifiers(values: Array<string | null | undefined>, limit = 3): string {
  const normalizedValues = values.filter((value): value is string => Boolean(value));
  if (!normalizedValues.length) {
    return t("common.notAvailable");
  }

  if (normalizedValues.length <= limit) {
    return normalizedValues.join(", ");
  }

  return `${normalizedValues.slice(0, limit).join(", ")} +${normalizedValues.length - limit}`;
}

function summarizeSelectedProfiles(game: GameSummary | null): string {
  return summarizeIdentifiers([game?.contentProfileId, game?.gameplayProfileId, game?.uiProfileId]);
}

function summarizeActiveModules(game: GameSummary | null): string {
  return summarizeIdentifiers(game?.activeModules?.map((entry) => entry.id) || []);
}

function readinessLabel(game: GameSummary): string {
  if (game.phase === "finished") {
    return t("lobby.readiness.archive");
  }

  if (game.phase === "active") {
    return t("lobby.readiness.active");
  }

  if (game.playerCount >= 2) {
    return t("lobby.readiness.ready");
  }

  return t("lobby.readiness.waiting");
}

function gameCapacityLabel(game: GameSummary | null): string {
  if (!game) {
    return t("common.notAvailable");
  }

  const configuredPlayers = Number(game.totalPlayers ?? 0);
  const maxPlayers =
    Number.isInteger(configuredPlayers) && configuredPlayers > 0 ? configuredPlayers : 4;

  return `${game.playerCount}/${maxPlayers}`;
}

function canJoinGame(game: GameSummary | null): boolean {
  if (!game || game.phase !== "lobby") {
    return false;
  }

  const configuredPlayers = Number(game.totalPlayers ?? 0);
  const maxPlayers =
    Number.isInteger(configuredPlayers) && configuredPlayers > 0 ? configuredPlayers : 4;

  return game.playerCount < maxPlayers;
}

function warTableRulesetLabel(game: GameSummary): string {
  const moduleIds = new Set((game.activeModules || []).map((entry) => entry.id.toLowerCase()));
  if (moduleIds.has("objectives")) {
    return t("warTable.lobby.rulesets.objectives");
  }

  if (moduleIds.has("cards")) {
    return t("warTable.lobby.rulesets.classicCards");
  }

  if (game.gamePresetId?.toLowerCase().includes("objective")) {
    return t("warTable.lobby.rulesets.objectives");
  }

  if (game.gamePresetId?.toLowerCase().includes("duel")) {
    return t("warTable.lobby.rulesets.duel");
  }

  return t("warTable.lobby.rulesets.classic");
}

function warTableStatusClass(game: GameSummary): string {
  if (game.phase === "active") {
    return "is-active";
  }

  if (game.phase === "finished") {
    return "is-finished";
  }

  return "is-lobby";
}

function warTableGameIconClass(index: number): string {
  return ["is-blue", "is-green", "is-gold", "is-red", "is-purple"][index % 5] || "is-blue";
}

function formatWarTableActivity(value: string | null | undefined): string {
  if (!value) {
    return t("common.notAvailable");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return t("common.notAvailable");
  }

  const elapsedMilliseconds = Math.max(0, Date.now() - parsed.getTime());
  const elapsedMinutes = Math.max(1, Math.round(elapsedMilliseconds / 60_000));

  if (elapsedMinutes < 60) {
    return t("warTable.lobby.activity.minutesAgo", { count: elapsedMinutes });
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return t("warTable.lobby.activity.hoursAgo", { count: elapsedHours });
  }

  return t("warTable.lobby.activity.daysAgo", { count: Math.round(elapsedHours / 24) });
}

function formatWarTableTimeLeft(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const remainingMinutes = Math.ceil((parsed.getTime() - Date.now()) / 60_000);
  if (remainingMinutes <= 0) {
    return null;
  }

  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;

  return hours > 0
    ? t("warTable.lobby.timeLeftHoursMinutes", { hours, minutes })
    : t("warTable.lobby.timeLeftMinutes", { minutes });
}

function warTableCampaignProgress(game: GameSummary | null): {
  roundLabel: string | null;
  timeLeftLabel: string | null;
} {
  if (!game) {
    return {
      roundLabel: null,
      timeLeftLabel: null
    };
  }

  const progressGame = game as WarTableCampaignProgressGame;
  const round = Number(progressGame.currentRound ?? progressGame.round ?? 0);
  const deadline =
    progressGame.turnDeadlineAt || progressGame.turnEndsAt || progressGame.turnExpiresAt || null;

  return {
    roundLabel:
      Number.isInteger(round) && round > 0 ? t("warTable.lobby.roundLabel", { round }) : null,
    timeLeftLabel: formatWarTableTimeLeft(deadline)
  };
}

function matchesWarTableFilter(game: GameSummary, filter: WarTableLobbyFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "waiting") {
    return game.phase === "lobby";
  }

  if (filter === "my-turn") {
    const currentPlayerId = game.phase === "active" ? game.currentPlayerId || null : null;
    const storedPlayerId = readCurrentPlayerId(game.id);

    return Boolean(currentPlayerId && storedPlayerId === currentPlayerId);
  }

  return game.phase === filter;
}

function matchesWarTableSearch(game: GameSummary, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [game.name, phaseLabel(game.phase), warTableRulesetLabel(game), game.mapName, game.mapId]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
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

export function LobbyRoute() {
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [visibleGameCount, setVisibleGameCount] = useState(VISIBLE_GAMES_BATCH_SIZE);
  const [actionError, setActionError] = useState("");
  const [warTableFilter, setWarTableFilter] = useState<WarTableLobbyFilter>("all");
  const [warTableSearch, setWarTableSearch] = useState("");
  const [playerSessionVersion, setPlayerSessionVersion] = useState(0);

  useEffect(
    () =>
      subscribeCurrentPlayerIdChanges(() => {
        setPlayerSessionVersion((current) => current + 1);
      }),
    []
  );

  const lobbyQuery = useQuery({
    queryKey: lobbyGamesQueryKey(),
    queryFn: () =>
      listGames({
        errorMessage: t("lobby.errors.loadGames"),
        fallbackMessage: t("lobby.errors.loadGames")
      })
  });

  const openMutation = useMutation({
    mutationFn: (gameId: string) =>
      openGame(gameId, {
        errorMessage: t("errors.requestFailed"),
        fallbackMessage: t("errors.requestFailed")
      })
  });

  const joinMutation = useMutation({
    mutationFn: (gameId: string) =>
      joinGame(gameId, {
        errorMessage: t("errors.requestFailed"),
        fallbackMessage: t("errors.requestFailed")
      })
  });

  const games = lobbyQuery.data?.games || [];
  const activeGameId = lobbyQuery.data?.activeGameId || null;
  const shellTheme = currentShellTheme();
  const isWarTableTheme = shellTheme === "war-table";
  const displayGames = useMemo(
    () =>
      isWarTableTheme
        ? games.filter(
            (game) =>
              matchesWarTableFilter(game, warTableFilter) &&
              matchesWarTableSearch(game, warTableSearch)
          )
        : games,
    [games, isWarTableTheme, playerSessionVersion, warTableFilter, warTableSearch]
  );

  useEffect(() => {
    const selectableGames = isWarTableTheme ? displayGames : games;

    if (!selectableGames.length) {
      setSelectedGameId(null);
      setVisibleGameCount(VISIBLE_GAMES_BATCH_SIZE);
      return;
    }

    setSelectedGameId((current) => {
      if (current && selectableGames.some((game) => game.id === current)) {
        return current;
      }

      const visibleActiveGameId =
        activeGameId && selectableGames.some((game) => game.id === activeGameId)
          ? activeGameId
          : null;

      return visibleActiveGameId || selectableGames[0]?.id || null;
    });

    setVisibleGameCount((current) =>
      Math.min(selectableGames.length, Math.max(VISIBLE_GAMES_BATCH_SIZE, current))
    );
  }, [activeGameId, displayGames, games, isWarTableTheme]);

  const canLoadMoreGames = visibleGameCount < displayGames.length;
  const visibleGames = displayGames.slice(0, visibleGameCount);
  const selectedGame =
    (isWarTableTheme ? displayGames : games).find((game) => game.id === selectedGameId) || null;
  const readyGames = games.filter((game) => game.phase === "lobby" && game.playerCount >= 2).length;
  const activeGame = games.find((game) => game.id === activeGameId) || null;
  const actionPending = openMutation.isPending || joinMutation.isPending;
  const authenticatedUser = state.status === "authenticated" ? state.user : null;
  const lobbyHeading = themeCopy(shellTheme, "lobby.heading", "lobby.heading");
  const lobbyCopy = themeCopy(shellTheme, "lobby.copy", "lobby.copy");
  const openSelectedLabel =
    shellTheme === "war-table" ? t("warTable.lobby.resumeBattle") : t("lobby.openSelected");
  const openingSelectedLabel =
    shellTheme === "war-table" ? t("warTable.lobby.opening") : "Opening...";
  const selectedGameCanJoin = canJoinGame(selectedGame);

  useEffect(() => {
    document.title = t("lobby.title");
  }, []);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !canLoadMoreGames || typeof IntersectionObserver !== "function") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (!firstEntry?.isIntersecting) {
          return;
        }

        setVisibleGameCount((current) =>
          Math.min(displayGames.length, current + VISIBLE_GAMES_BATCH_SIZE)
        );
      },
      {
        root: null,
        rootMargin: "0px 0px 240px 0px",
        threshold: 0.1
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [canLoadMoreGames, displayGames.length]);

  async function handleOpenGame(game: GameSummary | null): Promise<void> {
    if (!game) {
      return;
    }

    setActionError("");

    try {
      const payload = await openMutation.mutateAsync(game.id);
      storeCurrentPlayerId(payload.playerId, game.id);
      if (payload.games) {
        setLobbyGamesCache(queryClient, {
          games: payload.games,
          activeGameId: payload.activeGameId || game.id
        });
      }
      openShellGame(game.id);
    } catch (error) {
      setActionError(messageFromError(error, t("errors.requestFailed")));
    }
  }

  async function handleOpenSelectedGame(): Promise<void> {
    await handleOpenGame(selectedGame);
  }

  async function handleJoinGame(game: GameSummary | null): Promise<void> {
    if (!game || !canJoinGame(game)) {
      return;
    }

    setActionError("");

    try {
      const payload = await joinMutation.mutateAsync(game.id);
      storeCurrentPlayerId(payload.playerId, game.id);
      await queryClient.invalidateQueries({ queryKey: lobbyGamesQueryKey() });
      openShellGame(game.id);
    } catch (error) {
      setActionError(messageFromError(error, t("errors.requestFailed")));
    }
  }

  async function handleJoinSelectedGame(): Promise<void> {
    await handleJoinGame(selectedGame);
  }

  const renderedGames = visibleGames;
  const hasGames = renderedGames.length > 0;
  const listStateMessage = lobbyQuery.isLoading
    ? t("lobby.loading")
    : lobbyQuery.isError
      ? messageFromError(lobbyQuery.error, t("lobby.errors.loadGames"))
      : t("lobby.empty");
  const gameStatusMessage = activeGame
    ? t("lobby.status.activeGame", { name: activeGame.name })
    : t("lobby.gameStatus");
  const authStatusMessage = authenticatedUser
    ? t("lobby.auth.loggedIn", { username: authenticatedUser.username })
    : t("lobby.auth.loggedOut");
  const focusNote = activeGame
    ? t("lobby.focus.activeNote", { phase: phaseLabel(activeGame.phase) })
    : authenticatedUser
      ? t("lobby.focus.selectNote")
      : t("lobby.focus.loginNote");
  const warTableCampaignName =
    activeGame?.name || selectedGame?.name || t("warTable.lobby.defaultCampaignName");
  const campaignProgress = warTableCampaignProgress(activeGame || selectedGame);
  const isWarTableMyTurn =
    activeGame?.phase === "active" && activeGame.currentPlayerId
      ? readCurrentPlayerId(activeGame.id) === activeGame.currentPlayerId
      : false;
  const loadMoreMessage = !games.length
    ? ""
    : canLoadMoreGames
      ? t("lobby.loadMore.partial", {
          visible: renderedGames.length,
          total: displayGames.length
        })
      : t("lobby.loadMore.complete", { total: displayGames.length });

  return (
    <div data-testid="react-shell-lobby-page">
      <section className="session-browser panel campaign-shell" data-testid="game-lobby-shell">
        <div className="session-browser-head campaign-hero">
          <div className="session-browser-heading campaign-hero-copy">
            <p className="eyebrow session-eyebrow">{t("lobby.eyebrow")}</p>
            <h1>{lobbyHeading}</h1>
            <p className="stage-copy">{lobbyCopy}</p>
          </div>
        </div>

        <div className="content-meta-line lobby-meta-line campaign-status-line">
          <span id="auth-status">{authStatusMessage}</span>
          <span className="status-divider" aria-hidden="true" />
          <span id="game-status">{gameStatusMessage}</span>
        </div>

        {actionError ? (
          <div className="session-feedback is-error" data-testid="react-shell-lobby-action-error">
            {actionError}
          </div>
        ) : null}

        <div className="lobby-focus-band campaign-focus-grid">
          <article className="lobby-focus-card campaign-focus-card">
            <span className="lobby-command-label">
              {isWarTableTheme ? t("warTable.lobby.continueCampaign") : t("lobby.focus.label")}
            </span>
            {isWarTableTheme ? (
              <span className="war-table-campaign-emblem" aria-hidden="true">
                <WarTableIcon name="shield" />
              </span>
            ) : null}
            <strong id="lobby-active-focus">
              {isWarTableTheme ? warTableCampaignName : activeGame?.name || t("lobby.focus.value")}
            </strong>
            {isWarTableTheme ? (
              <div id="lobby-focus-note" className="war-table-campaign-meta">
                {activeGame?.phase === "active" ? (
                  <span className="war-table-turn-state">
                    <span aria-hidden="true" />
                    {isWarTableMyTurn
                      ? t("warTable.lobby.yourTurn")
                      : (t("warTable.lobby.theirTurn") || "Waiting for opponent")}
                  </span>
                ) : null}
                {campaignProgress.roundLabel ? <span>{campaignProgress.roundLabel}</span> : null}
                {campaignProgress.timeLeftLabel ? (
                  <span>
                    <WarTableIcon name="clock" />
                    {campaignProgress.timeLeftLabel}
                  </span>
                ) : null}
              </div>
            ) : (
              <p id="lobby-focus-note">{focusNote}</p>
            )}
          </article>
          <div className="page-header-actions compact-actions lobby-head-actions lobby-focus-actions">
            <Link
              id="create-game-button"
              className="ghost-button lobby-create-button"
              to={buildNewGamePath()}
            >
              {t("lobby.createGame")}
            </Link>
            <button
              type="button"
              id="open-game-button"
              className="ghost-button"
              onClick={() => void handleOpenSelectedGame()}
              disabled={!selectedGame || actionPending}
              data-testid="react-shell-lobby-open-selected"
            >
              {openMutation.isPending ? openingSelectedLabel : openSelectedLabel}
            </button>
          </div>
        </div>

        {shellTheme === "war-table" ? (
          <LobbyWarTablePanels canCreateGame={Boolean(authenticatedUser)} />
        ) : null}

        <div className="lobby-command-strip" aria-label={t("lobby.overviewAria")}>
          {isWarTableTheme ? (
            <>
              <article className="lobby-command-card">
                <WarTableIcon name="users" />
                <span>
                  <strong>{t("warTable.lobby.legend.lobby")}</strong>
                  <p>{t("warTable.lobby.legend.lobbyCopy")}</p>
                </span>
              </article>
              <article className="lobby-command-card">
                <WarTableIcon name="medal" />
                <span>
                  <strong>{t("warTable.lobby.legend.active")}</strong>
                  <p>{t("warTable.lobby.legend.activeCopy")}</p>
                </span>
              </article>
              <article className="lobby-command-card">
                <WarTableIcon name="objective" />
                <span>
                  <strong>{t("warTable.lobby.legend.myTurn")}</strong>
                  <p>{t("warTable.lobby.legend.myTurnCopy")}</p>
                </span>
              </article>
              <article className="lobby-command-card">
                <WarTableIcon name="crosshair" />
                <span>
                  <strong>{t("warTable.lobby.legend.finished")}</strong>
                  <p>{t("warTable.lobby.legend.finishedCopy")}</p>
                </span>
              </article>
            </>
          ) : (
            <>
              <article className="lobby-command-card lobby-command-card-accent">
                <span className="lobby-command-label">{t("lobby.visibleSessions.label")}</span>
                <strong id="lobby-total-games">{renderedGames.length}</strong>
                <p>{t("lobby.visibleSessions.copy")}</p>
              </article>
              <article className="lobby-command-card">
                <span className="lobby-command-label">{t("lobby.readySessions.label")}</span>
                <strong id="lobby-ready-games">{readyGames}</strong>
                <p>{t("lobby.readySessions.copy")}</p>
              </article>
              <article className="lobby-command-card">
                <span className="lobby-command-label">{t("lobby.readiness.label")}</span>
                <strong>{t("lobby.readiness.value")}</strong>
                <p>{t("lobby.readiness.copy")}</p>
              </article>
            </>
          )}
        </div>

        <div className="session-browser-grid">
          <div className="session-list-panel">
            <div className="section-title-row session-list-title-row">
              <div>
                <h3>
                  {isWarTableTheme
                    ? t("warTable.lobby.openGames")
                    : t("lobby.availableSessions.heading")}
                </h3>
                <p className="stage-copy">{t("lobby.availableSessions.copy")}</p>
              </div>
              {isWarTableTheme ? (
                <div className="war-table-list-tools">
                  <div
                    className="war-table-filter-tabs"
                    role="tablist"
                    aria-label={t("warTable.lobby.filtersAria")}
                  >
                    {[
                      ["all", t("warTable.lobby.filters.all")],
                      ["waiting", t("warTable.lobby.filters.waiting")],
                      ["my-turn", t("warTable.lobby.filters.myTurn")],
                      ["active", t("warTable.lobby.filters.active")],
                      ["finished", t("warTable.lobby.filters.finished")]
                    ].map(([filterId, label]) => (
                      <button
                        key={filterId}
                        type="button"
                        className={warTableFilter === filterId ? "is-active" : ""}
                        role="tab"
                        aria-selected={warTableFilter === filterId}
                        onClick={() => setWarTableFilter(filterId as WarTableLobbyFilter)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="war-table-search">
                    <span className="visually-hidden">{t("warTable.lobby.searchGames")}</span>
                    <WarTableIcon name="search" />
                    <input
                      value={warTableSearch}
                      placeholder={t("warTable.lobby.searchPlaceholder")}
                      onChange={(event) => setWarTableSearch(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="war-table-filter-button"
                    aria-label={t("warTable.lobby.filterOptions")}
                  >
                    <WarTableIcon name="filter" />
                  </button>
                </div>
              ) : null}
            </div>
            <div className="session-list-header session-row session-row-head">
              {isWarTableTheme ? (
                <>
                  <span>{t("lobby.table.game")}</span>
                  <span>{t("lobby.table.players")}</span>
                  <span>{t("lobby.table.status")}</span>
                  <span>{t("warTable.lobby.table.ruleset")}</span>
                  <span>{t("warTable.lobby.table.lastActivity")}</span>
                  <span>{t("warTable.lobby.table.action")}</span>
                </>
              ) : (
                <>
                  <span>{t("lobby.table.game")}</span>
                  <span>{t("lobby.table.map")}</span>
                  <span>{t("lobby.table.status")}</span>
                  <span>{t("lobby.table.players")}</span>
                  <span>{t("lobby.table.updated")}</span>
                </>
              )}
            </div>
            <div
              id="game-list-state"
              className={`session-feedback${hasGames ? " is-hidden" : ""}${lobbyQuery.isError ? " is-error" : ""}`}
            >
              {listStateMessage}
            </div>
            <div id="game-session-list" className="session-list" data-testid="game-session-list">
              {renderedGames.map((game, index) =>
                isWarTableTheme ? (
                  <div
                    key={game.id}
                    role="button"
                    tabIndex={0}
                    className={`session-row session-row-button war-table-game-row${selectedGame?.id === game.id ? " is-selected" : ""}`}
                    onClick={() => setSelectedGameId(game.id)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) {
                        return;
                      }

                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedGameId(game.id);
                      }
                    }}
                    data-game-id={game.id}
                    data-testid={`react-shell-lobby-row-${game.id}`}
                  >
                    <span className="session-primary" data-cell-label={t("lobby.table.game")}>
                      <span
                        className={`war-table-game-token ${warTableGameIconClass(index)}`}
                        aria-hidden="true"
                      >
                        <WarTableIcon name="soldier" />
                      </span>
                      <span className="session-name" data-open-game-id={game.id}>
                        {game.name}
                      </span>
                    </span>
                    <span className="session-cell-muted" data-cell-label={t("lobby.table.players")}>
                      {gameCapacityLabel(game).replace("/", " / ")}
                    </span>
                    <span
                      className={`war-table-phase ${warTableStatusClass(game)}`}
                      data-cell-label={t("lobby.table.status")}
                    >
                      {phaseLabel(game.phase)}
                    </span>
                    <span
                      className="session-cell-muted"
                      data-cell-label={t("warTable.lobby.table.ruleset")}
                    >
                      {warTableRulesetLabel(game)}
                    </span>
                    <span
                      className="session-cell-muted"
                      data-cell-label={t("warTable.lobby.table.lastActivity")}
                    >
                      {formatWarTableActivity(game.updatedAt)}
                    </span>
                    <span
                      className="war-table-row-action-cell"
                      data-cell-label={t("warTable.lobby.table.action")}
                    >
                      <button
                        type="button"
                        className="war-table-row-action"
                        disabled={actionPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedGameId(game.id);
                          void (canJoinGame(game) ? handleJoinGame(game) : handleOpenGame(game));
                        }}
                      >
                        {canJoinGame(game) ? t("warTable.lobby.join") : t("warTable.lobby.view")}
                      </button>
                    </span>
                  </div>
                ) : (
                  <button
                    key={game.id}
                    type="button"
                    className={`session-row session-row-button${selectedGame?.id === game.id ? " is-selected" : ""}`}
                    onClick={() => setSelectedGameId(game.id)}
                    data-game-id={game.id}
                    data-testid={`react-shell-lobby-row-${game.id}`}
                  >
                    <span className="session-primary" data-cell-label={t("lobby.table.game")}>
                      <span className="session-name" data-open-game-id={game.id}>
                        {game.name}
                      </span>
                    </span>
                    <span className="session-cell-muted" data-cell-label={t("lobby.table.map")}>
                      {game.mapName || game.mapId || t("common.classicMini")}
                    </span>
                    <span
                      className={`badge${game.id === activeGameId ? " accent" : ""}`}
                      data-cell-label={t("lobby.table.status")}
                    >
                      {phaseLabel(game.phase)}
                    </span>
                    <span className="session-cell-muted" data-cell-label={t("lobby.table.players")}>
                      {gameCapacityLabel(game)}
                    </span>
                    <span className="session-cell-muted" data-cell-label={t("lobby.table.updated")}>
                      {formatUpdatedTime(game.updatedAt)}
                    </span>
                  </button>
                )
              )}
            </div>
            <div
              id="game-list-load-more-state"
              ref={loadMoreRef}
              className={`session-list-load-more${hasGames ? "" : " is-hidden"}`}
              data-testid="react-shell-lobby-load-more"
            >
              {loadMoreMessage}
            </div>
          </div>

          <aside className="session-detail-panel" data-testid="game-session-details">
            <div className="section-title-row">
              <div>
                <h3>{t("lobby.details.heading")}</h3>
                <p className="stage-copy">{t("lobby.details.copy")}</p>
              </div>
              <span id="selected-game-status" className="badge">
                {selectedGame ? phaseLabel(selectedGame.phase) : t("lobby.details.emptyBadge")}
              </span>
            </div>
            <div
              id="game-session-details"
              className="session-details-card"
              data-testid="react-shell-lobby-details"
            >
              {selectedGame ? (
                <>
                  <div className="session-detail-hero">
                    <p className="session-detail-kicker">{t("lobby.details.selectedKicker")}</p>
                    <h4 className="session-detail-title">{selectedGame.name}</h4>
                    <p className="session-detail-copy">
                      {t("lobby.details.summary", {
                        readiness: readinessLabel(selectedGame),
                        phase: phaseLabel(selectedGame.phase)
                      })}
                    </p>
                  </div>
                  <div className="session-detail-grid">
                    <div className="session-detail-item">
                      <span>{t("lobby.details.name")}</span>
                      <strong>{selectedGame.name}</strong>
                    </div>
                    <div className="session-detail-item">
                      <span>{t("lobby.details.id")}</span>
                      <strong>{selectedGame.id}</strong>
                    </div>
                    <div className="session-detail-item">
                      <span>{t("lobby.details.status")}</span>
                      <strong>{phaseLabel(selectedGame.phase)}</strong>
                    </div>
                    <div className="session-detail-item">
                      <span>{t("lobby.details.playersPresent")}</span>
                      <strong>{gameCapacityLabel(selectedGame)}</strong>
                    </div>
                    <div className="session-detail-item">
                      <span>{t("lobby.details.playersConfigured")}</span>
                      <strong>{selectedGame.totalPlayers || t("common.notAvailable")}</strong>
                    </div>
                    <div className="session-detail-item">
                      <span>{t("lobby.details.map")}</span>
                      <strong>
                        {selectedGame.mapName || selectedGame.mapId || t("common.classicMini")}
                      </strong>
                    </div>
                    <div className="session-detail-item">
                      <span>{t("lobby.details.ai")}</span>
                      <strong>{selectedGame.aiCount || 0}</strong>
                    </div>
                    <div className="session-detail-item">
                      <span>{t("lobby.details.preset")}</span>
                      <strong>{selectedGame.gamePresetId || t("common.notAvailable")}</strong>
                    </div>
                    <div className="session-detail-item">
                      <span>{t("lobby.details.profiles")}</span>
                      <strong>{summarizeSelectedProfiles(selectedGame)}</strong>
                    </div>
                    <div className="session-detail-item">
                      <span>{t("lobby.details.modules")}</span>
                      <strong>{summarizeActiveModules(selectedGame)}</strong>
                    </div>
                    <div className="session-detail-item">
                      <span>{t("lobby.details.updated")}</span>
                      <strong>{formatUpdatedTime(selectedGame.updatedAt)}</strong>
                    </div>
                    <div className="session-detail-item">
                      <span>{t("lobby.details.focus")}</span>
                      <strong>
                        {selectedGame.id === activeGameId
                          ? t("lobby.focus.openSession")
                          : t("lobby.focus.available")}
                      </strong>
                    </div>
                  </div>
                  <div className="session-detail-note">{t("lobby.details.note")}</div>
                  <div className="session-detail-actions">
                    <button
                      type="button"
                      id="open-selected-inline"
                      onClick={() => void handleOpenSelectedGame()}
                      disabled={actionPending}
                    >
                      {openMutation.isPending ? "Opening..." : t("lobby.details.open")}
                    </button>
                    {canJoinGame(selectedGame) ? (
                      <button
                        type="button"
                        id="join-selected-inline"
                        className="ghost-button"
                        onClick={() => void handleJoinSelectedGame()}
                        disabled={actionPending}
                        data-testid="react-shell-lobby-join-selected"
                      >
                        {joinMutation.isPending ? "Joining..." : t("lobby.details.joinOpen")}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="session-empty-copy">{t("lobby.details.emptyExtended")}</div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
