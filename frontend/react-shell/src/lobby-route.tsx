import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  GameListResponse,
  GameSummary
} from "@frontend-generated/shared-runtime-validation.mts";

import { joinGame, listGames, openGame } from "@frontend-core/api/client.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import { formatDate, t } from "@frontend-i18n";

import { openReactGame } from "@react-shell/legacy-game-handoff";
import { storeCurrentPlayerId } from "@react-shell/player-session";
import { lobbyGamesQueryKey } from "@react-shell/react-query";

const VISIBLE_GAMES_BATCH_SIZE = 15;

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
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [visibleGameCount, setVisibleGameCount] = useState(VISIBLE_GAMES_BATCH_SIZE);
  const [actionError, setActionError] = useState("");

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

  useEffect(() => {
    if (!games.length) {
      setSelectedGameId(null);
      setVisibleGameCount(VISIBLE_GAMES_BATCH_SIZE);
      return;
    }

    setSelectedGameId((current) => {
      if (current && games.some((game) => game.id === current)) {
        return current;
      }

      return activeGameId || games[0]?.id || null;
    });

    setVisibleGameCount((current) =>
      Math.min(games.length, Math.max(VISIBLE_GAMES_BATCH_SIZE, current))
    );
  }, [activeGameId, games]);

  const canLoadMoreGames = visibleGameCount < games.length;
  const visibleGames = games.slice(0, visibleGameCount);
  const selectedGame = games.find((game) => game.id === selectedGameId) || null;
  const readyGames = games.filter((game) => game.phase === "lobby" && game.playerCount >= 2).length;
  const activeGame = games.find((game) => game.id === activeGameId) || null;
  const actionPending = openMutation.isPending || joinMutation.isPending;

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
          Math.min(games.length, current + VISIBLE_GAMES_BATCH_SIZE)
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
  }, [canLoadMoreGames, games.length]);

  async function handleRetry(): Promise<void> {
    setActionError("");
    await lobbyQuery.refetch();
  }

  async function handleOpenSelectedGame(): Promise<void> {
    if (!selectedGame) {
      return;
    }

    setActionError("");

    try {
      const payload = await openMutation.mutateAsync(selectedGame.id);
      storeCurrentPlayerId(payload.playerId);
      if (payload.games) {
        setLobbyGamesCache(queryClient, {
          games: payload.games,
          activeGameId: payload.activeGameId || selectedGame.id
        });
      }
      openReactGame(selectedGame.id);
    } catch (error) {
      setActionError(messageFromError(error, t("errors.requestFailed")));
    }
  }

  async function handleJoinSelectedGame(): Promise<void> {
    if (!selectedGame || !canJoinGame(selectedGame)) {
      return;
    }

    setActionError("");

    try {
      const payload = await joinMutation.mutateAsync(selectedGame.id);
      storeCurrentPlayerId(payload.playerId);
      await queryClient.invalidateQueries({ queryKey: lobbyGamesQueryKey() });
      openReactGame(selectedGame.id);
    } catch (error) {
      setActionError(messageFromError(error, t("errors.requestFailed")));
    }
  }

  if (lobbyQuery.isLoading && !lobbyQuery.data) {
    return (
      <section className="status-panel" data-testid="react-shell-lobby-loading">
        <p className="status-label">{t("lobby.eyebrow")}</p>
        <h2>{t("lobby.heading")}</h2>
        <p className="status-copy">{t("lobby.loading")}</p>
      </section>
    );
  }

  if (lobbyQuery.isError && !games.length) {
    return (
      <section className="status-panel status-panel-error" data-testid="react-shell-lobby-error">
        <p className="status-label">{t("lobby.eyebrow")}</p>
        <h2>{t("lobby.heading")}</h2>
        <p className="status-copy">
          {messageFromError(lobbyQuery.error, t("lobby.errors.loadGames"))}
        </p>
        <div className="shell-actions">
          <button type="button" className="refresh-button" onClick={() => void handleRetry()}>
            Retry lobby
          </button>
        </div>
      </section>
    );
  }

  return (
    <section data-testid="react-shell-lobby-page">
      <p className="status-label">{t("lobby.eyebrow")}</p>
      <h2>{t("lobby.heading")}</h2>
      <p className="status-copy">{t("lobby.copy")}</p>

      {actionError ? (
        <div
          className="profile-query-state profile-query-state-error"
          data-testid="react-shell-lobby-action-error"
        >
          <p className="metric-copy">{actionError}</p>
        </div>
      ) : null}

      <div className="lobby-summary-grid">
        <article className="placeholder-card lobby-summary-card">
          <p className="status-label">{t("lobby.visibleSessions.label")}</p>
          <strong>{games.length}</strong>
          <span>{t("lobby.visibleSessions.copy")}</span>
        </article>
        <article className="placeholder-card lobby-summary-card">
          <p className="status-label">{t("lobby.readySessions.label")}</p>
          <strong>{readyGames}</strong>
          <span>{t("lobby.readySessions.copy")}</span>
        </article>
        <article className="placeholder-card lobby-summary-card">
          <p className="status-label">{t("lobby.focus.label")}</p>
          <strong>{activeGame?.name || t("lobby.focus.value")}</strong>
          <span>
            {activeGame
              ? t("lobby.focus.activeNote", { phase: phaseLabel(activeGame.phase) })
              : t("lobby.focus.selectNote")}
          </span>
        </article>
      </div>

      <div className="lobby-shell-grid">
        <section className="placeholder-card lobby-list-panel">
          <div className="card-header lobby-panel-header">
            <div>
              <p className="status-label">{t("lobby.availableSessions.heading")}</p>
              <h3>{t("lobby.availableSessions.copy")}</h3>
            </div>
            <Link className="refresh-button" to="/lobby/new">
              {t("lobby.createGame")}
            </Link>
          </div>

          {!games.length ? (
            <div className="lobby-empty-state" data-testid="react-shell-lobby-empty">
              <p className="metric-copy">{t("lobby.empty")}</p>
              <div className="shell-actions">
                <Link className="ghost-action" to="/lobby/new">
                  {t("lobby.createGame")}
                </Link>
              </div>
            </div>
          ) : (
            <div className="lobby-session-list" data-testid="react-shell-lobby-list">
              {visibleGames.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  className={`lobby-session-row${selectedGame?.id === game.id ? " is-selected" : ""}`}
                  onClick={() => setSelectedGameId(game.id)}
                  data-testid={`react-shell-lobby-row-${game.id}`}
                >
                  <div className="lobby-session-primary">
                    <strong>{game.name}</strong>
                    <span>{game.mapName || game.mapId || t("common.classicMini")}</span>
                  </div>

                  <div className="lobby-session-meta">
                    <span className="status-pill">{phaseLabel(game.phase)}</span>
                    <span>{gameCapacityLabel(game)}</span>
                    <span>{formatUpdatedTime(game.updatedAt)}</span>
                  </div>
                </button>
              ))}

              <div
                ref={loadMoreRef}
                className="lobby-load-more-state"
                data-testid="react-shell-lobby-load-more"
              >
                {canLoadMoreGames
                  ? t("lobby.loadMore.partial", {
                      visible: visibleGames.length,
                      total: games.length
                    })
                  : t("lobby.loadMore.complete", { total: games.length })}
              </div>
            </div>
          )}
        </section>

        <section
          className="placeholder-card lobby-detail-panel"
          data-testid="react-shell-lobby-details"
        >
          <div className="card-header lobby-panel-header">
            <div>
              <p className="status-label">{t("lobby.details.heading")}</p>
              <h3>{selectedGame?.name || t("lobby.details.emptyBadge")}</h3>
            </div>
            {selectedGame ? (
              <span className="status-pill">{phaseLabel(selectedGame.phase)}</span>
            ) : null}
          </div>

          {!selectedGame ? (
            <div className="lobby-empty-state">
              <p className="metric-copy">{t("lobby.details.emptyExtended")}</p>
            </div>
          ) : (
            <>
              <p className="metric-copy">
                {t("lobby.details.summary", {
                  readiness: readinessLabel(selectedGame),
                  phase: phaseLabel(selectedGame.phase)
                })}
              </p>

              <div className="lobby-detail-grid">
                <article className="lobby-detail-item">
                  <span>{t("lobby.details.map")}</span>
                  <strong>
                    {selectedGame.mapName || selectedGame.mapId || t("common.classicMini")}
                  </strong>
                </article>
                <article className="lobby-detail-item">
                  <span>{t("lobby.details.playersPresent")}</span>
                  <strong>{gameCapacityLabel(selectedGame)}</strong>
                </article>
                <article className="lobby-detail-item">
                  <span>{t("lobby.details.status")}</span>
                  <strong>{readinessLabel(selectedGame)}</strong>
                </article>
                <article className="lobby-detail-item">
                  <span>{t("lobby.details.updated")}</span>
                  <strong>{formatUpdatedTime(selectedGame.updatedAt)}</strong>
                </article>
                <article className="lobby-detail-item">
                  <span>{t("lobby.details.profiles")}</span>
                  <strong>{summarizeSelectedProfiles(selectedGame)}</strong>
                </article>
                <article className="lobby-detail-item">
                  <span>{t("lobby.details.modules")}</span>
                  <strong>{summarizeActiveModules(selectedGame)}</strong>
                </article>
              </div>

              <p className="metric-copy">{t("lobby.details.note")}</p>

              <div className="shell-actions">
                <button
                  type="button"
                  className="refresh-button"
                  onClick={() => void handleOpenSelectedGame()}
                  disabled={actionPending}
                  data-testid="react-shell-lobby-open-selected"
                >
                  {openMutation.isPending ? "Opening..." : t("lobby.openSelected")}
                </button>

                {canJoinGame(selectedGame) ? (
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => void handleJoinSelectedGame()}
                    disabled={actionPending}
                    data-testid="react-shell-lobby-join-selected"
                  >
                    {joinMutation.isPending ? "Joining..." : t("lobby.details.joinOpen")}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
