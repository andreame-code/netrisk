import { useEffect, useEffectEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  GameMutationResponse,
  GameSnapshot,
  SnapshotCard,
  SnapshotPlayer,
  SnapshotTerritory
} from "@frontend-generated/shared-runtime-validation.mts";

import type { ApiClientError } from "@frontend-core/api/http.mts";
import {
  extractGameVersionConflict,
  getGameState,
  joinGame,
  parseGameEventPayload,
  sendGameAction,
  startGame,
  tradeCards
} from "@frontend-core/api/client.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import { t, translateGameLogEntries, translateServerMessage } from "@frontend-i18n";

import { useAuth } from "@react-shell/auth";
import { buildLegacyGamePath } from "@react-shell/legacy-game-handoff";
import { readCurrentPlayerId, storeCurrentPlayerId } from "@react-shell/player-session";
import { gameplayStateQueryKey } from "@react-shell/react-query";

type StreamStatus = "connecting" | "live" | "reconnecting";
type SelectionOption = {
  id: string;
};

function phaseLabel(phase: string | null | undefined): string {
  if (phase === "active") {
    return t("common.phase.active");
  }

  if (phase === "finished") {
    return t("common.phase.finished");
  }

  return t("common.phase.lobby");
}

function turnPhaseLabel(turnPhase: string | null | undefined): string {
  if (turnPhase === "reinforcement") {
    return t("game.actions.reinforce");
  }

  if (turnPhase === "attack") {
    return t("game.actions.attack");
  }

  if (turnPhase === "fortify") {
    return t("game.actions.fortify");
  }

  return phaseLabel(turnPhase);
}

function selectOrFallback(
  selectedId: string | null | undefined,
  options: SelectionOption[],
  fallbackId: string | null = null
): string {
  if (selectedId && options.some((option) => option.id === selectedId)) {
    return selectedId;
  }

  if (fallbackId && options.some((option) => option.id === fallbackId)) {
    return fallbackId;
  }

  return options[0]?.id || "";
}

function parsePositiveInteger(value: string, fallbackValue: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallbackValue;
  }

  return parsed;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeSelectNumber(
  value: string,
  minimum: number,
  maximum: number,
  fallbackValue: number
): string {
  if (maximum < minimum) {
    return "";
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return String(fallbackValue);
  }

  return String(clamp(parsed, minimum, maximum));
}

function territoryOwnerName(territory: SnapshotTerritory, playersById: Record<string, SnapshotPlayer>): string {
  if (!territory.ownerId) {
    return t("game.runtime.none");
  }

  return playersById[territory.ownerId]?.name || territory.ownerId;
}

function territoryOptionLabel(
  territory: SnapshotTerritory,
  playersById: Record<string, SnapshotPlayer>
): string {
  return `${territory.name} · ${territoryOwnerName(territory, playersById)} · ${territory.armies}`;
}

function mapAspectRatio(snapshot: GameSnapshot | null): string {
  const width = Number(snapshot?.mapVisual?.aspectRatio?.width || 0);
  const height = Number(snapshot?.mapVisual?.aspectRatio?.height || 0);
  if (width > 0 && height > 0) {
    return `${width} / ${height}`;
  }

  return "16 / 10";
}

function cardTypeLabel(card: SnapshotCard): string {
  if (card.type === "infantry") {
    return t("game.runtime.cardType.infantry");
  }

  if (card.type === "cavalry") {
    return t("game.runtime.cardType.cavalry");
  }

  if (card.type === "artillery") {
    return t("game.runtime.cardType.artillery");
  }

  if (card.type === "wild") {
    return t("game.runtime.cardType.wild");
  }

  return t("game.runtime.cardType.default");
}

function translateGameplayError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return translateServerMessage(
      (error as ApiClientError).payload,
      error.message || messageFromError(error, fallback) || fallback
    );
  }

  return messageFromError(error, fallback);
}

function GameEmptyRoute() {
  return (
    <section className="status-panel" data-testid="react-shell-game-empty">
      <p className="status-label">Game</p>
      <h2>{t("game.runtime.selectGameFromList")}</h2>
      <p className="status-copy">
        {t("game.runtime.openGame")} via lobby/profile, then return here for the live React
        gameplay route.
      </p>
      <div className="shell-actions">
        <Link className="refresh-button" to="/lobby">
          {t("lobby.heading")}
        </Link>
        <Link className="ghost-action" to="/profile">
          {t("profile.heading")}
        </Link>
      </div>
    </section>
  );
}

export function GameRoute() {
  const { gameId } = useParams();
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [actionError, setActionError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [selectedReinforceTerritoryId, setSelectedReinforceTerritoryId] = useState("");
  const [reinforceAmount, setReinforceAmount] = useState("1");
  const [selectedAttackFromId, setSelectedAttackFromId] = useState("");
  const [selectedAttackToId, setSelectedAttackToId] = useState("");
  const [selectedAttackDiceCount, setSelectedAttackDiceCount] = useState("");
  const [selectedFortifyFromId, setSelectedFortifyFromId] = useState("");
  const [selectedFortifyToId, setSelectedFortifyToId] = useState("");
  const [fortifyArmies, setFortifyArmies] = useState("1");
  const [conquestArmies, setConquestArmies] = useState("");
  const [selectedTradeCardIds, setSelectedTradeCardIds] = useState<string[]>([]);

  const gameplayQuery = useQuery({
    queryKey: gameplayStateQueryKey(gameId || "missing"),
    enabled: Boolean(gameId),
    queryFn: () =>
      getGameState(gameId || "", {
        errorMessage: t("game.errors.loadActiveGame"),
        fallbackMessage: t("game.errors.loadActiveGame")
      })
  });

  const snapshot = gameplayQuery.data || null;
  const queryKey = gameplayStateQueryKey(gameId || "missing");
  const authenticatedUser = state.status === "authenticated" ? state.user : null;

  const playersById: Record<string, SnapshotPlayer> = {};
  for (const player of snapshot?.players || []) {
    playersById[player.id] = player;
  }

  const territoriesById: Record<string, SnapshotTerritory> = {};
  for (const territory of snapshot?.map || []) {
    territoriesById[territory.id] = territory;
  }

  const storedPlayerId = readCurrentPlayerId();
  const myPlayerId = snapshot?.playerId || storedPlayerId || null;
  const me = myPlayerId ? playersById[myPlayerId] || null : null;
  const currentPlayer = snapshot?.currentPlayerId ? playersById[snapshot.currentPlayerId] || null : null;
  const winner = snapshot?.winnerId ? playersById[snapshot.winnerId] || null : null;
  const playerHand = Array.isArray(snapshot?.playerHand) ? snapshot.playerHand : [];
  const localizedLog = translateGameLogEntries(snapshot);
  const myTerritories = (snapshot?.map || []).filter((territory) => territory.ownerId === myPlayerId);
  const currentVersion =
    snapshot && Number.isInteger(snapshot.version) ? snapshot.version : undefined;
  const isMyTurn = Boolean(
    snapshot?.phase === "active" && myPlayerId && snapshot.currentPlayerId === myPlayerId
  );
  const mustTradeCards = Boolean(
    isMyTurn && snapshot?.cardState?.currentPlayerMustTrade && playerHand.length
  );
  const showJoinLobby = snapshot?.phase === "lobby" && !myPlayerId;
  const showStartGame = snapshot?.phase === "lobby" && Boolean(myPlayerId);
  const showReinforceGroup = Boolean(
    isMyTurn && snapshot?.turnPhase === "reinforcement" && Number(snapshot?.reinforcementPool || 0) > 0
  );
  const showAttackGroup = Boolean(
    isMyTurn && snapshot?.turnPhase === "attack" && !snapshot?.pendingConquest
  );
  const showConquestGroup = Boolean(isMyTurn && snapshot?.pendingConquest);
  const showFortifyGroup = Boolean(isMyTurn && snapshot?.turnPhase === "fortify");
  const showEndTurn = Boolean(isMyTurn && snapshot?.phase === "active" && !snapshot?.pendingConquest);
  const showSurrender = Boolean(myPlayerId && snapshot?.phase === "active");
  const reinforceTerritoryId = selectOrFallback(
    selectedReinforceTerritoryId,
    myTerritories,
    myTerritories[0]?.id || null
  );
  const attackFromId = selectOrFallback(
    selectedAttackFromId,
    myTerritories,
    reinforceTerritoryId || null
  );
  const attackSource = attackFromId ? territoriesById[attackFromId] || null : null;
  const attackTargets = (snapshot?.map || []).filter(
    (territory) =>
      Boolean(attackSource?.neighbors.includes(territory.id)) &&
      Boolean(territory.ownerId) &&
      territory.ownerId !== myPlayerId
  );
  const attackToId = selectOrFallback(selectedAttackToId, attackTargets);
  const maxAttackDice = attackSource
    ? Math.max(
        0,
        Math.min(Number(snapshot?.diceRuleSet?.attackerMaxDice || 3), attackSource.armies - 1)
      )
    : 0;
  const attackDiceCount = maxAttackDice
    ? normalizeSelectNumber(selectedAttackDiceCount, 1, maxAttackDice, maxAttackDice)
    : "";
  const fortifyFromId = selectOrFallback(
    selectedFortifyFromId,
    myTerritories,
    reinforceTerritoryId || null
  );
  const fortifySource = fortifyFromId ? territoriesById[fortifyFromId] || null : null;
  const fortifyTargets = myTerritories.filter(
    (territory) =>
      territory.id !== fortifyFromId && Boolean(fortifySource?.neighbors.includes(territory.id))
  );
  const fortifyToId = selectOrFallback(selectedFortifyToId, fortifyTargets);
  const maxFortifyArmies = fortifySource ? Math.max(0, fortifySource.armies - 1) : 0;
  const pendingConquestMin = Math.max(1, Number(snapshot?.pendingConquest?.minArmies || 1));
  const pendingConquestMax = Math.max(
    pendingConquestMin,
    Number(snapshot?.pendingConquest?.maxArmies || snapshot?.pendingConquest?.minArmies || 1)
  );
  const endTurnLabel =
    snapshot?.turnPhase === "fortify" ? t("game.actions.endTurn") : t("game.runtime.goToFortify");

  useEffect(() => {
    if (snapshot?.playerId) {
      storeCurrentPlayerId(snapshot.playerId);
    }
  }, [snapshot?.playerId]);

  useEffect(() => {
    setSelectedTradeCardIds((current) =>
      current.filter((cardId) => playerHand.some((card) => card.id === cardId)).slice(0, 3)
    );
  }, [playerHand]);

  const applyMutationPayload = useEffectEvent(
    (payload: GameMutationResponse, options: { feedback?: string } = {}) => {
      if (payload.playerId) {
        storeCurrentPlayerId(payload.playerId);
      } else if (payload.state?.playerId) {
        storeCurrentPlayerId(payload.state.playerId);
      }

      if (payload.state) {
        queryClient.setQueryData(queryKey, payload.state);
      }

      setActionError("");
      setFeedbackMessage(options.feedback || "");

      if (!payload.state?.pendingConquest) {
        setConquestArmies("");
      }
      if (!Array.isArray(payload.state?.playerHand) || !payload.state?.playerHand.length) {
        setSelectedTradeCardIds([]);
      }
    }
  );

  const handleMutationError = useEffectEvent((error: unknown) => {
    const versionConflict = extractGameVersionConflict(error);
    if (versionConflict) {
      queryClient.setQueryData(queryKey, versionConflict.state);
      if (versionConflict.state.playerId) {
        storeCurrentPlayerId(versionConflict.state.playerId);
      }
      setActionError("");
      setFeedbackMessage(t("game.errors.versionConflict"));
      return;
    }

    setFeedbackMessage("");
    setActionError(translateGameplayError(error, t("errors.requestFailed")));
  });

  const handleEventMessage = useEffectEvent((event: MessageEvent<string>) => {
    if (!gameId) {
      return;
    }

    const nextPayload = parseGameEventPayload(JSON.parse(event.data));
    queryClient.setQueryData(gameplayStateQueryKey(gameId), nextPayload);
    if (nextPayload.playerId) {
      storeCurrentPlayerId(nextPayload.playerId);
    }
    setStreamStatus("live");
  });

  const joinMutation = useMutation({
    mutationFn: () =>
      joinGame(gameId || "", {
        errorMessage: t("errors.requestFailed"),
        fallbackMessage: t("errors.requestFailed")
      }),
    onSuccess: (payload) => applyMutationPayload(payload),
    onError: handleMutationError
  });

  const startMutation = useMutation({
    mutationFn: () => {
      if (!gameId || !myPlayerId) {
        throw new Error(t("game.invalidPlayer"));
      }

      return startGame(
        {
          gameId,
          playerId: myPlayerId,
          ...(currentVersion ? { expectedVersion: currentVersion } : {})
        },
        {
          errorMessage: t("errors.requestFailed"),
          fallbackMessage: t("errors.requestFailed")
        }
      );
    },
    onSuccess: (payload) => applyMutationPayload(payload),
    onError: handleMutationError
  });

  const actionMutation = useMutation({
    mutationFn: sendGameAction,
    onSuccess: (payload) => applyMutationPayload(payload),
    onError: handleMutationError
  });

  const tradeMutation = useMutation({
    mutationFn: tradeCards,
    onSuccess: (payload) =>
      applyMutationPayload(payload, {
        feedback:
          typeof payload.bonus === "number"
            ? t("game.runtime.tradeSuccess", { bonus: payload.bonus })
            : ""
      }),
    onError: handleMutationError
  });

  useEffect(() => {
    if (!gameId) {
      return;
    }

    setStreamStatus("connecting");
    const eventSource = new EventSource(`/api/events?gameId=${encodeURIComponent(gameId)}`, {
      withCredentials: true
    });

    eventSource.onmessage = handleEventMessage;
    eventSource.onerror = () => {
      setStreamStatus((current) => (current === "live" ? "reconnecting" : current));
    };

    return () => {
      eventSource.close();
    };
  }, [gameId, handleEventMessage]);

  function submitGameAction(request: Parameters<typeof sendGameAction>[0]): Promise<void> {
    return actionMutation.mutateAsync(request).then(() => undefined);
  }

  async function handleJoinLobby(): Promise<void> {
    if (!gameId) {
      return;
    }

    await joinMutation.mutateAsync();
  }

  async function handleStartGame(): Promise<void> {
    await startMutation.mutateAsync();
  }

  async function handleReinforce(): Promise<void> {
    if (!gameId || !myPlayerId || !reinforceTerritoryId) {
      return;
    }

    const amount = clamp(
      parsePositiveInteger(reinforceAmount, 1),
      1,
      Math.max(1, Number(snapshot?.reinforcementPool || 1))
    );
    await submitGameAction({
      gameId,
      playerId: myPlayerId,
      type: "reinforce",
      territoryId: reinforceTerritoryId,
      amount,
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  async function handleAttack(type: "attack" | "attackBanzai"): Promise<void> {
    if (!gameId || !myPlayerId || !attackFromId || !attackToId || !attackDiceCount) {
      return;
    }

    await submitGameAction({
      gameId,
      playerId: myPlayerId,
      type,
      fromId: attackFromId,
      toId: attackToId,
      attackDice: Number(attackDiceCount),
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  async function handleMoveAfterConquest(): Promise<void> {
    if (!gameId || !myPlayerId || !snapshot?.pendingConquest) {
      return;
    }

    const armies = clamp(
      parsePositiveInteger(conquestArmies, pendingConquestMin),
      pendingConquestMin,
      pendingConquestMax
    );
    await submitGameAction({
      gameId,
      playerId: myPlayerId,
      type: "moveAfterConquest",
      armies,
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  async function handleFortify(): Promise<void> {
    if (!gameId || !myPlayerId || !fortifyFromId || !fortifyToId || maxFortifyArmies < 1) {
      return;
    }

    const armies = clamp(parsePositiveInteger(fortifyArmies, 1), 1, maxFortifyArmies);
    await submitGameAction({
      gameId,
      playerId: myPlayerId,
      type: "fortify",
      fromId: fortifyFromId,
      toId: fortifyToId,
      armies,
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  async function handleEndTurn(): Promise<void> {
    if (!gameId || !myPlayerId) {
      return;
    }

    await submitGameAction({
      gameId,
      playerId: myPlayerId,
      type: "endTurn",
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  async function handleTradeCards(): Promise<void> {
    if (!gameId || !myPlayerId || selectedTradeCardIds.length !== 3) {
      return;
    }

    await tradeMutation.mutateAsync({
      gameId,
      playerId: myPlayerId,
      cardIds: selectedTradeCardIds,
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  async function handleSurrender(): Promise<void> {
    if (!gameId || !myPlayerId || !window.confirm(t("game.runtime.confirmSurrender"))) {
      return;
    }

    await submitGameAction({
      gameId,
      playerId: myPlayerId,
      type: "surrender",
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  function toggleTradeCard(cardId: string): void {
    setSelectedTradeCardIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((entry) => entry !== cardId);
      }

      if (current.length >= 3) {
        return [...current.slice(1), cardId];
      }

      return [...current, cardId];
    });
  }

  function handleTerritorySelect(territoryId: string): void {
    const territory = territoriesById[territoryId];
    if (!territory) {
      return;
    }

    if (
      territory.ownerId === myPlayerId &&
      fortifySource &&
      territory.id !== fortifySource.id &&
      fortifySource.neighbors.includes(territory.id)
    ) {
      setSelectedFortifyToId(territory.id);
      return;
    }

    if (territory.ownerId === myPlayerId) {
      setSelectedReinforceTerritoryId(territoryId);
      setSelectedAttackFromId(territoryId);
      setSelectedFortifyFromId(territoryId);
      setSelectedAttackDiceCount("");
      return;
    }

    if (
      territory.ownerId &&
      territory.ownerId !== myPlayerId &&
      attackSource?.neighbors.includes(territoryId)
    ) {
      setSelectedAttackToId(territoryId);
      return;
    }

    if (
      territory.ownerId === myPlayerId &&
      fortifySource &&
      territory.id !== fortifySource.id &&
      fortifySource.neighbors.includes(territory.id)
    ) {
      setSelectedFortifyToId(territory.id);
    }
  }

  if (!gameId) {
    return <GameEmptyRoute />;
  }

  if (gameplayQuery.isLoading && !snapshot) {
    return (
      <section className="status-panel" data-testid="react-shell-game-loading">
        <p className="status-label">Game</p>
        <h2>{t("game.runtime.loadingState")}</h2>
        <p className="status-copy">{t("game.errors.loadActiveGame")}</p>
      </section>
    );
  }

  if (gameplayQuery.isError && !snapshot) {
    return (
      <section className="status-panel status-panel-error" data-testid="react-shell-game-error">
        <p className="status-label">Game</p>
        <h2>{t("game.errors.loadActiveGame")}</h2>
        <p className="status-copy">
          {translateGameplayError(gameplayQuery.error, t("game.errors.loadActiveGame"))}
        </p>
        <div className="shell-actions">
          <button
            type="button"
            className="refresh-button"
            onClick={() => void gameplayQuery.refetch()}
          >
            Retry game
          </button>
          <a className="ghost-action" href={buildLegacyGamePath(gameId)}>
            Legacy fallback
          </a>
        </div>
      </section>
    );
  }

  if (!snapshot) {
    return null;
  }

  const connectionBadge =
    streamStatus === "live"
      ? "Live"
      : streamStatus === "reconnecting"
        ? "Reconnecting"
        : "Connecting";
  const canTradeCards = selectedTradeCardIds.length === 3 && !tradeMutation.isPending;
  const actionPending =
    joinMutation.isPending ||
    startMutation.isPending ||
    actionMutation.isPending ||
    tradeMutation.isPending;

  return (
    <section data-testid="react-shell-game-page">
      <p className="status-label">{t("game.command.eyebrow")}</p>
      <div className="card-header gameplay-page-header">
        <div>
          <h2>{snapshot.gameName || t("game.title")}</h2>
          <p className="status-copy">
            {snapshot.gameId || gameId} · {snapshot.gameConfig?.mapName || t("common.classicMini")}
          </p>
        </div>
        <div className="shell-actions">
          <span
            className={`status-pill${streamStatus === "live" ? " success" : streamStatus === "reconnecting" ? " danger" : " muted"}`}
          >
            {connectionBadge}
          </span>
          <a className="ghost-action" href={buildLegacyGamePath(gameId)}>
            Legacy fallback
          </a>
        </div>
      </div>

      {mustTradeCards ? (
        <div
          id="trade-alert"
          className="game-trade-alert"
          data-testid="react-shell-game-trade-alert"
        >
          <strong>{t("game.tradeAlert.title")}</strong>
          <span>
            {t("game.runtime.tradeAlert.mustTradeNow", {
              cardCount: playerHand.length,
              limit: snapshot.cardState?.maxHandBeforeForcedTrade || 5
            })}
          </span>
        </div>
      ) : null}

      {actionError ? (
        <div className="profile-query-state profile-query-state-error" data-testid="react-shell-game-action-error">
          <p className="metric-copy">{actionError}</p>
        </div>
      ) : null}

      {feedbackMessage ? (
        <div className="profile-query-state" data-testid="react-shell-game-feedback">
          <p className="metric-copy">{feedbackMessage}</p>
        </div>
      ) : null}

      <div className="gameplay-shell">
        <section className="placeholder-card gameplay-map-card">
          <div className="card-header gameplay-section-header">
            <div>
              <p className="status-label">{t("game.meta.map")}</p>
              <h3>{snapshot.gameConfig?.mapName || t("common.classicMini")}</h3>
            </div>
            <span className="status-pill" data-testid="phase-indicator">
              {phaseLabel(snapshot.phase)} · {turnPhaseLabel(snapshot.turnPhase)}
            </span>
          </div>

          <div className="game-status-banner" data-testid="status-summary">
            <span>
              {t("game.phaseBanner")} <strong>{phaseLabel(snapshot.phase)}</strong>
            </span>
            <span>
              {t("game.reinforcementBanner")} <strong>{snapshot.reinforcementPool}</strong>
            </span>
            <span>
              {t("game.runtime.winner")}:{" "}
              <strong>{winner ? winner.name : t("game.runtime.noneLower")}</strong>
            </span>
          </div>

          <div className="game-meta-grid">
            <article className="game-meta-item">
              <span>{t("game.meta.player")}</span>
              <strong data-testid="current-player-indicator">
                {me?.name || authenticatedUser?.username || t("game.runtime.accessRequired")}
              </strong>
            </article>
            <article className="game-meta-item">
              <span>{t("game.command.heading")}</span>
              <strong>
                {snapshot.phase === "finished"
                  ? t("game.runtime.finished")
                  : currentPlayer
                    ? t("game.runtime.turnOf", { name: currentPlayer.name })
                    : t("game.runtime.waiting")}
              </strong>
            </article>
            <article className="game-meta-item">
              <span>{t("game.meta.setup")}</span>
              <strong>
                {t("game.runtime.setupMeta", {
                  totalPlayers: snapshot.gameConfig?.totalPlayers || snapshot.players.length,
                  playerLabel:
                    (snapshot.gameConfig?.totalPlayers || snapshot.players.length) === 1
                      ? t("game.runtime.playerSingle")
                      : t("game.runtime.playerPlural"),
                  aiCount: snapshot.players.filter((player) => player.isAi).length
                })}
              </strong>
            </article>
          </div>

          <div
            id="map"
            className={`game-map-board${snapshot.mapVisual?.imageUrl ? " has-image" : ""}`}
            style={{
              aspectRatio: mapAspectRatio(snapshot),
              ...(snapshot.mapVisual?.imageUrl
                ? { backgroundImage: `linear-gradient(rgba(15, 22, 36, 0.18), rgba(15, 22, 36, 0.18)), url(${snapshot.mapVisual.imageUrl})` }
                : {})
            }}
          >
            <svg className="game-map-connections" viewBox="0 0 1000 1000" aria-hidden="true">
              {(snapshot.map || []).flatMap((territory) =>
                territory.x == null || territory.y == null
                  ? []
                  : territory.neighbors
                      .filter((neighborId) => territory.id < neighborId)
                      .map((neighborId) => {
                        const target = territoriesById[neighborId];
                        if (!target || target.x == null || target.y == null) {
                          return null;
                        }

                        return (
                          <line
                            key={`${territory.id}-${neighborId}`}
                            x1={territory.x * 1000}
                            y1={territory.y * 1000}
                            x2={target.x * 1000}
                            y2={target.y * 1000}
                          />
                        );
                      })
              )}
            </svg>

            {(snapshot.map || []).map((territory) => {
              const isMine = territory.ownerId === myPlayerId;
              const isAttackSource = territory.id === attackFromId;
              const isAttackTarget = territory.id === attackToId;
              const isReinforceTarget = territory.id === reinforceTerritoryId;
              const isFortifySource = territory.id === fortifyFromId;
              const isFortifyTarget = territory.id === fortifyToId;

              return (
                <button
                  key={territory.id}
                  type="button"
                  className={`territory-node${isMine ? " is-mine" : ""}${isAttackSource ? " is-source" : ""}${isAttackTarget ? " is-target" : ""}${isReinforceTarget ? " is-reinforce" : ""}${isFortifySource ? " is-fortify-source" : ""}${isFortifyTarget ? " is-fortify-target" : ""}`}
                  data-territory-id={territory.id}
                  style={{
                    left: `${(territory.x ?? 0.5) * 100}%`,
                    top: `${(territory.y ?? 0.5) * 100}%`,
                    ["--territory-player-color" as "--territory-player-color"]:
                      territory.ownerId && playersById[territory.ownerId]?.color
                        ? playersById[territory.ownerId].color
                        : "rgba(22, 32, 51, 0.7)"
                  }}
                  onClick={() => handleTerritorySelect(territory.id)}
                >
                  <strong>{territory.name}</strong>
                  <span>{territoryOwnerName(territory, playersById)}</span>
                  <span className="territory-armies">{territory.armies}</span>
                </button>
              );
            })}
          </div>

          <div className="game-map-legend">
            <span>Map picks drive the form selections below. Rule validation stays on the backend.</span>
          </div>
        </section>

        <aside className="gameplay-sidebar">
          <section className="placeholder-card gameplay-action-card">
            <div className="card-header gameplay-section-header">
              <div>
                <p className="status-label">{t("game.command.eyebrow")}</p>
                <h3>{t("game.command.heading")}</h3>
              </div>
              <span className="status-pill">{currentPlayer?.name || t("game.runtime.waiting")}</span>
            </div>

            {showJoinLobby ? (
              <div className="game-action-group">
                <p className="metric-copy">{t("game.meta.accessCopy")}</p>
                <button
                  type="button"
                  className="refresh-button"
                  onClick={() => void handleJoinLobby()}
                  disabled={actionPending}
                >
                  {joinMutation.isPending ? "Joining..." : t("game.join")}
                </button>
              </div>
            ) : null}

            {showStartGame ? (
              <div className="game-action-group">
                <p className="metric-copy">
                  {snapshot.players.length < 2
                    ? t("server.game.notEnoughPlayers")
                    : "The lobby is ready to be promoted into the active turn flow."}
                </p>
                <button
                  type="button"
                  className="refresh-button"
                  onClick={() => void handleStartGame()}
                  disabled={actionPending || snapshot.players.length < 2}
                >
                  {startMutation.isPending ? "Starting..." : t("game.start")}
                </button>
              </div>
            ) : null}

            <div className="game-action-stack">
              <section id="card-trade-group" className="game-action-group">
                <div className="card-header gameplay-subsection-header">
                  <div>
                    <p className="status-label">{t("game.actions.cards")}</p>
                    <h4>{t("game.cards.summary")}</h4>
                  </div>
                  {snapshot.cardState?.nextTradeBonus != null ? (
                    <span className="status-pill">+{snapshot.cardState.nextTradeBonus}</span>
                  ) : null}
                </div>

                {mustTradeCards ? (
                  <p id="card-trade-alert" className="metric-copy">
                    {t("game.cards.alert")}
                  </p>
                ) : null}

                <p id="card-trade-summary" className="metric-copy">
                  {playerHand.length
                    ? t("game.runtime.cardsInHand", { count: playerHand.length })
                    : t("game.runtime.noCardsAvailable")}
                </p>

                {playerHand.length ? (
                  <div id="card-trade-list" className="game-card-grid">
                    {playerHand.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        className={`game-card-pill${selectedTradeCardIds.includes(card.id) ? " is-selected" : ""}`}
                        data-card-id={card.id}
                        onClick={() => toggleTradeCard(card.id)}
                      >
                        <strong>{card.territoryId || card.id}</strong>
                        <span>{cardTypeLabel(card)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <p id="card-trade-help" className="metric-copy">
                  {mustTradeCards
                    ? t("game.runtime.tradeHelp.mustTrade", {
                        limit: snapshot.cardState?.maxHandBeforeForcedTrade || 5
                      })
                    : t("game.runtime.tradeHelp.selected", {
                        selected: selectedTradeCardIds.length
                      })}
                </p>

                <button
                  id="card-trade-button"
                  type="button"
                  className="ghost-action"
                  onClick={() => void handleTradeCards()}
                  disabled={!canTradeCards}
                >
                  {tradeMutation.isPending ? "Trading..." : t("game.cards.tradeSet")}
                </button>
              </section>

              <section id="reinforce-group" className="game-action-group" hidden={!showReinforceGroup}>
                <div className="card-header gameplay-subsection-header">
                  <div>
                    <p className="status-label">{t("game.actions.reinforce")}</p>
                    <h4>{t("game.reinforcementBanner")}</h4>
                  </div>
                  <span className="status-pill">{snapshot.reinforcementPool}</span>
                </div>

                <label className="shell-field">
                  <span>{t("game.actions.reinforce")}</span>
                  <select
                    id="reinforce-territory"
                    value={reinforceTerritoryId}
                    onChange={(event) => setSelectedReinforceTerritoryId(event.target.value)}
                  >
                    {myTerritories.map((territory) => (
                      <option key={territory.id} value={territory.id}>
                        {territoryOptionLabel(territory, playersById)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="shell-field">
                  <span>{t("game.actions.reinforceAmountAria")}</span>
                  <input
                    id="reinforce-amount"
                    inputMode="numeric"
                    value={reinforceAmount}
                    onChange={(event) => setReinforceAmount(event.target.value)}
                  />
                </label>

                <button
                  type="button"
                  className="refresh-button"
                  onClick={() => void handleReinforce()}
                  disabled={!reinforceTerritoryId || actionPending}
                >
                  {actionMutation.isPending ? "Applying..." : t("game.actions.add")}
                </button>
              </section>

              <section id="attack-group" className="game-action-group" hidden={!showAttackGroup}>
                <div className="card-header gameplay-subsection-header">
                  <div>
                    <p className="status-label">{t("game.actions.attack")}</p>
                    <h4>{t("game.actions.launchAttack")}</h4>
                  </div>
                </div>

                <label className="shell-field">
                  <span>{t("game.runtime.hint.attack")}</span>
                  <select
                    id="attack-from"
                    value={attackFromId}
                    onChange={(event) => setSelectedAttackFromId(event.target.value)}
                  >
                    {myTerritories.map((territory) => (
                      <option key={territory.id} value={territory.id}>
                        {territoryOptionLabel(territory, playersById)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="shell-field">
                  <span>{t("game.runtime.noTarget")}</span>
                  <select
                    id="attack-to"
                    value={attackToId}
                    onChange={(event) => setSelectedAttackToId(event.target.value)}
                  >
                    <option value="">{t("game.runtime.noTarget")}</option>
                    {attackTargets.map((territory) => (
                      <option key={territory.id} value={territory.id}>
                        {territoryOptionLabel(territory, playersById)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="shell-field">
                  <span>{t("game.runtime.noDiceAvailable")}</span>
                  <select
                    id="attack-dice"
                    value={attackDiceCount}
                    onChange={(event) => setSelectedAttackDiceCount(event.target.value)}
                  >
                    {!maxAttackDice ? <option value="">{t("game.runtime.noDiceAvailable")}</option> : null}
                    {Array.from({ length: maxAttackDice }, (_, index) => index + 1).map((count) => (
                      <option key={count} value={String(count)}>
                        {t("game.runtime.attackDiceOption", {
                          count,
                          suffix: count === 1 ? "" : "i"
                        })}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="shell-actions">
                  <button
                    type="button"
                    className="refresh-button"
                    onClick={() => void handleAttack("attack")}
                    disabled={!attackFromId || !attackToId || !attackDiceCount || actionPending}
                  >
                    {actionMutation.isPending ? "Attacking..." : t("game.actions.launchAttack")}
                  </button>
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => void handleAttack("attackBanzai")}
                    disabled={!attackFromId || !attackToId || !attackDiceCount || actionPending}
                  >
                    {actionMutation.isPending ? t("game.runtime.banzaiLoading") : t("game.actions.banzai")}
                  </button>
                </div>
              </section>

              <section id="conquest-group" className="game-action-group" hidden={!showConquestGroup}>
                <div className="card-header gameplay-subsection-header">
                  <div>
                    <p className="status-label">{t("game.actions.afterConquest")}</p>
                    <h4>{t("game.runtime.conquest")}</h4>
                  </div>
                  <span className="status-pill">
                    {pendingConquestMin}-{pendingConquestMax}
                  </span>
                </div>

                <label className="shell-field">
                  <span>{t("game.actions.moveArmies")}</span>
                  <input
                    id="conquest-armies"
                    inputMode="numeric"
                    value={conquestArmies}
                    onChange={(event) => setConquestArmies(event.target.value)}
                    placeholder={String(pendingConquestMin)}
                  />
                </label>

                <button
                  type="button"
                  className="refresh-button"
                  onClick={() => void handleMoveAfterConquest()}
                  disabled={actionPending}
                >
                  {actionMutation.isPending ? "Moving..." : t("game.actions.moveArmies")}
                </button>
              </section>

              <section id="fortify-group" className="game-action-group" hidden={!showFortifyGroup}>
                <div className="card-header gameplay-subsection-header">
                  <div>
                    <p className="status-label">{t("game.actions.fortify")}</p>
                    <h4>{t("game.actions.fortify")}</h4>
                  </div>
                </div>

                <label className="shell-field">
                  <span>{t("game.actions.fortify")}</span>
                  <select
                    id="fortify-from"
                    value={fortifyFromId}
                    onChange={(event) => setSelectedFortifyFromId(event.target.value)}
                  >
                    {myTerritories.map((territory) => (
                      <option key={territory.id} value={territory.id}>
                        {territoryOptionLabel(territory, playersById)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="shell-field">
                  <span>{t("game.runtime.noAdjacentTerritory")}</span>
                  <select
                    id="fortify-to"
                    value={fortifyToId}
                    onChange={(event) => setSelectedFortifyToId(event.target.value)}
                  >
                    <option value="">{t("game.runtime.noAdjacentTerritory")}</option>
                    {fortifyTargets.map((territory) => (
                      <option key={territory.id} value={territory.id}>
                        {territoryOptionLabel(territory, playersById)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="shell-field">
                  <span>{t("game.actions.moveArmies")}</span>
                  <input
                    id="fortify-armies"
                    inputMode="numeric"
                    value={fortifyArmies}
                    onChange={(event) => setFortifyArmies(event.target.value)}
                    placeholder="1"
                  />
                </label>

                <button
                  id="fortify-button"
                  type="button"
                  className="refresh-button"
                  onClick={() => void handleFortify()}
                  disabled={
                    !fortifyFromId ||
                    !fortifyToId ||
                    maxFortifyArmies < 1 ||
                    actionPending ||
                    Boolean(snapshot.fortifyUsed)
                  }
                >
                  {actionMutation.isPending ? "Fortifying..." : t("game.actions.fortify")}
                </button>
              </section>
            </div>

            <div className="shell-actions gameplay-primary-actions">
              <button
                id="end-turn-button"
                type="button"
                className="refresh-button"
                onClick={() => void handleEndTurn()}
                hidden={!showEndTurn}
                disabled={actionPending}
              >
                {actionMutation.isPending ? "Updating..." : endTurnLabel}
              </button>

              {showSurrender ? (
                <button
                  id="surrender-button"
                  type="button"
                  className="ghost-action"
                  onClick={() => void handleSurrender()}
                  disabled={actionPending}
                >
                  {t("game.surrender")}
                </button>
              ) : null}
            </div>

            <p className="metric-copy gameplay-fallback-note">
              Advanced sidebars and secondary legacy affordances still fall back to the legacy
              gameplay route when needed.
            </p>
          </section>

          <section className="placeholder-card gameplay-side-card">
            <div className="card-header gameplay-section-header">
              <div>
                <p className="status-label">{t("game.players.heading")}</p>
                <h3>{t("game.players.badge")}</h3>
              </div>
            </div>

            <div className="game-player-list" id="players">
              {snapshot.players.map((player) => (
                <article className="game-player-card" key={player.id}>
                  <div className="game-player-head">
                    <strong>{player.name}</strong>
                    <span
                      className="game-player-swatch"
                      style={{ backgroundColor: player.color || "#162033" }}
                    />
                  </div>
                  <span>
                    {t("game.runtime.territories")}: {player.territoryCount || 0}
                  </span>
                  <span>
                    {player.eliminated
                      ? t("game.runtime.eliminated")
                      : player.surrendered
                        ? t("game.surrender")
                        : t("game.runtime.active")}
                  </span>
                  <span>
                    {typeof player.cardCount === "number"
                      ? t("game.runtime.cardsInHand", { count: player.cardCount })
                      : t("game.runtime.none")}
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section className="placeholder-card gameplay-side-card">
            <div className="card-header gameplay-section-header">
              <div>
                <p className="status-label">{t("game.combat.heading")}</p>
                <h3>{t("game.combat.badge")}</h3>
              </div>
            </div>

            {snapshot.lastCombat ? (
              <div className="game-combat-panel">
                <div className="game-combat-row">
                  <span>{t("game.combat.attacker")}</span>
                  <strong>{snapshot.lastCombat.fromTerritoryId}</strong>
                </div>
                <div className="game-combat-row">
                  <span>{t("game.combat.defender")}</span>
                  <strong>{snapshot.lastCombat.toTerritoryId}</strong>
                </div>
                <div className="game-combat-row">
                  <span>{t("game.combat.comparisons")}</span>
                  <strong>{snapshot.lastCombat.comparisons?.length || 0}</strong>
                </div>
                <div className="game-combat-row">
                  <span>{t("game.runtime.combat.resolved")}</span>
                  <strong>
                    {snapshot.lastCombat.conqueredTerritory
                      ? t("game.runtime.combat.conquered")
                      : snapshot.lastCombat.defenderReducedToZero
                        ? t("game.runtime.combat.defenseBroken")
                        : t("game.runtime.combat.resolved")}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="metric-copy">{t("game.runtime.hint.observation")}</p>
            )}
          </section>

          <section className="placeholder-card gameplay-side-card">
            <div className="card-header gameplay-section-header">
              <div>
                <p className="status-label">{t("game.log.heading")}</p>
                <h3>{t("game.log.badge")}</h3>
              </div>
            </div>

            <div className="game-log-list" id="log">
              {localizedLog.length ? (
                localizedLog.map((entry, index) => (
                  <article className="game-log-entry" key={`${index}-${entry}`}>
                    {entry}
                  </article>
                ))
              ) : (
                <p className="metric-copy">{t("game.log.lobbyCreated")}</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
