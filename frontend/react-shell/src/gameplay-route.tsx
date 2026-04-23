import { useEffect, useEffectEvent, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  GameMutationResponse,
  GameSnapshot,
  GameStateResponse,
  SnapshotCard,
  SnapshotPlayer,
  SnapshotTerritory
} from "@frontend-generated/shared-runtime-validation.mts";

import type { ApiClientError } from "@frontend-core/api/http.mts";
import {
  extractGameVersionConflict,
  getGameState,
  joinGame,
  sendGameAction,
  startGame,
  subscribeToGameEvents,
  tradeCards
} from "@frontend-core/api/client.mts";
import type { GameActionRequest, TradeCardsRequest } from "@frontend-core/api/client.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import { t, translateGameLogEntries, translateServerMessage } from "@frontend-i18n";

import { useAuth } from "@react-shell/auth";
import { GameplayMapViewport } from "@react-shell/gameplay-map-viewport";
import { readCurrentPlayerId, storeCurrentPlayerId } from "@react-shell/player-session";
import { buildRegisterPath, useShellNamespace } from "@react-shell/public-auth-paths";
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

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return String(fallbackValue);
  }

  const parsed = Number(normalizedValue);
  if (!Number.isInteger(parsed)) {
    return String(fallbackValue);
  }

  return String(clamp(parsed, minimum, maximum));
}

function territoryOwnerName(
  territory: SnapshotTerritory,
  playersById: Record<string, SnapshotPlayer>
): string {
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

function pieceSkinRenderStyleForSnapshot(snapshot: GameSnapshot | null): string {
  const renderStyleId = snapshot?.gameConfig?.pieceSkin?.renderStyleId;
  return typeof renderStyleId === "string" && renderStyleId ? renderStyleId : "solid-fill";
}

function pieceSkinClassName(renderStyleId: string | null | undefined): string {
  const normalized =
    typeof renderStyleId === "string" && renderStyleId ? renderStyleId : "solid-fill";
  return `piece-skin-style-${normalized.replace(/[^a-z0-9_-]/gi, "-").toLowerCase()}`;
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

function selectedProfileIds(gameConfig: GameSnapshot["gameConfig"] | null | undefined): string[] {
  return [
    gameConfig?.contentProfileId,
    gameConfig?.gameplayProfileId,
    gameConfig?.uiProfileId
  ].filter((value): value is string => Boolean(value));
}

function gameMetaModuleSummary(gameConfig: GameSnapshot["gameConfig"] | null | undefined): string {
  if (!gameConfig) {
    return "";
  }

  const parts: string[] = [];
  if (gameConfig.gamePresetId) {
    parts.push(t("game.runtime.modularPreset", { id: gameConfig.gamePresetId }));
  }

  const profileIds = selectedProfileIds(gameConfig);
  if (profileIds.length) {
    parts.push(t("game.runtime.modularProfiles", { count: profileIds.length }));
  }

  const moduleCount = Array.isArray(gameConfig.activeModules) ? gameConfig.activeModules.length : 0;
  if (moduleCount > 0) {
    parts.push(t("game.runtime.modularModules", { count: moduleCount }));
  }

  return parts.join(" · ");
}

export function GameRoute() {
  const { gameId } = useParams();
  const { state, signIn } = useAuth();
  const namespace = useShellNamespace();
  const queryClient = useQueryClient();
  const routeGameId = typeof gameId === "string" ? gameId : "";
  const queryKey = gameplayStateQueryKey(routeGameId || "current");
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [actionError, setActionError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [inlineUsername, setInlineUsername] = useState("");
  const [inlinePassword, setInlinePassword] = useState("");
  const [inlineAuthError, setInlineAuthError] = useState("");
  const [inlineAuthPending, setInlineAuthPending] = useState(false);
  const [selectedReinforceTerritoryId, setSelectedReinforceTerritoryId] = useState("");
  const [reinforceAmount, setReinforceAmount] = useState("1");
  const [selectedAttackFromId, setSelectedAttackFromId] = useState("");
  const [selectedAttackToId, setSelectedAttackToId] = useState("");
  const [selectedAttackDiceCount, setSelectedAttackDiceCount] = useState("3");
  const [selectedFortifyFromId, setSelectedFortifyFromId] = useState("");
  const [selectedFortifyToId, setSelectedFortifyToId] = useState("");
  const [fortifySelectionMode, setFortifySelectionMode] = useState<"from" | "to">("from");
  const [fortifyArmies, setFortifyArmies] = useState("1");
  const [conquestArmies, setConquestArmies] = useState("");
  const [selectedTradeCardIds, setSelectedTradeCardIds] = useState<string[]>([]);

  const gameplayQuery = useQuery({
    queryKey,
    queryFn: () =>
      getGameState(routeGameId, {
        errorMessage: t("game.errors.loadActiveGame"),
        fallbackMessage: t("game.errors.loadActiveGame")
      }),
    // Keep the board in sync while the event stream is still handshaking or reconnecting.
    refetchInterval: streamStatus === "live" ? false : 1500,
    refetchIntervalInBackground: true
  });

  const snapshot = gameplayQuery.data || null;
  const resolvedGameId = snapshot?.gameId || routeGameId;
  const authenticatedUser = state.status === "authenticated" ? state.user : null;

  const playersById: Record<string, SnapshotPlayer> = {};
  for (const player of snapshot?.players || []) {
    playersById[player.id] = player;
  }

  const territoriesById: Record<string, SnapshotTerritory> = {};
  for (const territory of snapshot?.map || []) {
    territoriesById[territory.id] = territory;
  }

  const storedPlayerId = readCurrentPlayerId(resolvedGameId || null);
  const myPlayerId = snapshot?.playerId || storedPlayerId || null;
  const me = myPlayerId ? playersById[myPlayerId] || null : null;
  const winner = snapshot?.winnerId ? playersById[snapshot.winnerId] || null : null;
  const playerHand = Array.isArray(snapshot?.playerHand) ? snapshot.playerHand : [];
  const assignedVictoryObjective = snapshot?.assignedVictoryObjective || null;
  const localizedLog = translateGameLogEntries(snapshot);
  const myTerritories = (snapshot?.map || []).filter(
    (territory) => territory.ownerId === myPlayerId
  );
  const currentVersion =
    snapshot && Number.isInteger(snapshot.version) ? snapshot.version : undefined;
  const isMyTurn = Boolean(
    snapshot?.phase === "active" && myPlayerId && snapshot.currentPlayerId === myPlayerId
  );
  const mustTradeCards = Boolean(
    isMyTurn && snapshot?.cardState?.currentPlayerMustTrade && playerHand.length
  );
  const showLobbyControls = snapshot?.phase === "lobby";
  const showJoinLobby = snapshot?.phase === "lobby" && !myPlayerId;
  const showStartGame = snapshot?.phase === "lobby" && Boolean(myPlayerId);
  const showReinforceGroup = Boolean(
    isMyTurn &&
    snapshot?.turnPhase === "reinforcement" &&
    Number(snapshot?.reinforcementPool || 0) > 0
  );
  const showAttackGroup = Boolean(
    isMyTurn && snapshot?.turnPhase === "attack" && !snapshot?.pendingConquest
  );
  const showConquestGroup = Boolean(isMyTurn && snapshot?.pendingConquest);
  const showFortifyGroup = Boolean(isMyTurn && snapshot?.turnPhase === "fortify");
  const showEndTurn = Boolean(
    isMyTurn && snapshot?.phase === "active" && snapshot?.turnPhase !== "reinforcement"
  );
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
  const pieceSkinClass = pieceSkinClassName(pieceSkinRenderStyleForSnapshot(snapshot));
  const phaseBadgeLabel =
    snapshot?.phase === "active" ? turnPhaseLabel(snapshot.turnPhase) : phaseLabel(snapshot?.phase);
  const accessStatusLabel = authenticatedUser
    ? t("game.runtime.loggedIn", { username: authenticatedUser.username })
    : t("game.runtime.accessRequired");
  const gameStatusLabel = String(
    snapshot?.gameName || snapshot?.gameId || resolvedGameId || t("game.meta.noActiveGame")
  );
  const mapMetaLabel = String(
    snapshot?.gameConfig?.mapName || snapshot?.mapId || t("common.classicMini")
  );
  const configuredPlayers = snapshot?.gameConfig?.totalPlayers || snapshot?.players.length || 2;
  const aiCount = Array.isArray(snapshot?.gameConfig?.players)
    ? snapshot.gameConfig.players.filter((player) => player.type === "ai").length
    : snapshot?.players.filter((player) => player.isAi).length || 0;
  const setupMetaLabel = t("game.runtime.setupMeta", {
    totalPlayers: configuredPlayers,
    playerLabel:
      configuredPlayers === 1 ? t("game.runtime.playerSingle") : t("game.runtime.playerPlural"),
    aiCount
  })
    .concat(gameMetaModuleSummary(snapshot?.gameConfig || null) ? " · " : "")
    .concat(gameMetaModuleSummary(snapshot?.gameConfig || null));
  const combatSummary = snapshot?.lastCombat
    ? `${territoriesById[snapshot.lastCombat.fromTerritoryId]?.name || snapshot.lastCombat.fromTerritoryId} -> ${territoriesById[snapshot.lastCombat.toTerritoryId]?.name || snapshot.lastCombat.toTerritoryId}`
    : "";
  const attackerRollsText = snapshot?.lastCombat?.attackerRolls?.length
    ? snapshot.lastCombat.attackerRolls.join(" · ")
    : t("game.runtime.none");
  const defenderRollsText = snapshot?.lastCombat?.defenderRolls?.length
    ? snapshot.lastCombat.defenderRolls.join(" · ")
    : t("game.runtime.none");
  const comparisonSummary = snapshot?.lastCombat?.comparisons?.length
    ? snapshot.lastCombat.comparisons
        .map((comparison) => (comparison.winner === "attacker" ? "A" : "D"))
        .join(" · ")
    : t("game.runtime.none");
  const combatBadgeLabel = snapshot?.lastCombat?.conqueredTerritory
    ? t("game.runtime.combat.conquered")
    : snapshot?.lastCombat?.defenderReducedToZero
      ? t("game.runtime.combat.defenseBroken")
      : t("game.runtime.combat.resolved");
  const showTradePanel = Boolean(playerHand.length) || mustTradeCards;
  const gameFeedbackMessage = feedbackMessage || actionError;
  const gameFeedbackIsError = !feedbackMessage && Boolean(actionError);

  useEffect(() => {
    if (snapshot?.playerId && resolvedGameId) {
      storeCurrentPlayerId(snapshot.playerId, resolvedGameId);
    }
  }, [resolvedGameId, snapshot?.playerId]);

  useEffect(() => {
    setSelectedAttackDiceCount("");
  }, [attackFromId]);

  useEffect(() => {
    if (snapshot?.turnPhase !== "fortify") {
      setFortifySelectionMode("from");
    }
  }, [snapshot?.turnPhase]);

  useEffect(() => {
    setSelectedTradeCardIds((current) =>
      current.filter((cardId) => playerHand.some((card) => card.id === cardId)).slice(0, 3)
    );
  }, [playerHand]);

  const applyMutationPayload = useEffectEvent(
    (payload: GameMutationResponse, options: { feedback?: string } = {}) => {
      if (payload.playerId) {
        storeCurrentPlayerId(payload.playerId, payload.state?.gameId || resolvedGameId || null);
      } else if (payload.state?.playerId) {
        storeCurrentPlayerId(
          payload.state.playerId,
          payload.state.gameId || resolvedGameId || null
        );
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
        storeCurrentPlayerId(
          versionConflict.state.playerId,
          versionConflict.state.gameId || resolvedGameId || null
        );
      }
      setActionError("");
      const versionConflictMessage = t("game.errors.versionConflict");
      setFeedbackMessage(versionConflictMessage);
      window.alert(versionConflictMessage);
      return;
    }

    setFeedbackMessage("");
    setActionError(translateGameplayError(error, t("errors.requestFailed")));
  });

  const handleEventMessage = useEffectEvent((nextPayload: GameStateResponse) => {
    setStreamStatus("live");
    queryClient.setQueryData(queryKey, nextPayload);
    if (nextPayload.playerId) {
      storeCurrentPlayerId(nextPayload.playerId, nextPayload.gameId || resolvedGameId || null);
    }
    setStreamStatus("live");
  });

  const joinMutation = useMutation({
    mutationFn: () =>
      joinGame(resolvedGameId || "", {
        errorMessage: t("errors.requestFailed"),
        fallbackMessage: t("errors.requestFailed")
      }),
    onSuccess: (payload) => applyMutationPayload(payload),
    onError: handleMutationError
  });

  const startMutation = useMutation({
    mutationFn: () => {
      if (!resolvedGameId || !myPlayerId) {
        throw new Error(t("game.invalidPlayer"));
      }

      return startGame(
        {
          gameId: resolvedGameId,
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

  const actionClientMessages = {
    errorMessage: t("errors.requestFailed"),
    fallbackMessage: t("errors.requestFailed")
  };

  const actionMutation = useMutation({
    mutationFn: (request: GameActionRequest) => sendGameAction(request, actionClientMessages),
    onSuccess: (payload) => applyMutationPayload(payload),
    onError: handleMutationError
  });

  const tradeMutation = useMutation({
    mutationFn: (request: TradeCardsRequest) => tradeCards(request, actionClientMessages),
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
    if (!resolvedGameId) {
      return;
    }

    setStreamStatus("connecting");
    const eventSource = subscribeToGameEvents({
      gameId: resolvedGameId,
      onOpen: () => {
        setStreamStatus("live");
      },
      onMessage: handleEventMessage,
      onInvalidPayload: () => {
        setStreamStatus("reconnecting");
      },
      onError: () => {
        setStreamStatus((current) => (current === "live" ? "reconnecting" : current));
      }
    });

    return () => {
      eventSource.close();
    };
  }, [resolvedGameId]);

  function submitGameAction(request: Parameters<typeof sendGameAction>[0]): Promise<void> {
    return actionMutation.mutateAsync(request).then(() => undefined);
  }

  async function handleJoinLobby(): Promise<void> {
    if (!resolvedGameId) {
      return;
    }

    await joinMutation.mutateAsync();
  }

  async function handleStartGame(): Promise<void> {
    await startMutation.mutateAsync();
  }

  async function handleReinforce(): Promise<void> {
    if (!resolvedGameId || !myPlayerId || !reinforceTerritoryId) {
      return;
    }

    const amount = clamp(
      parsePositiveInteger(reinforceAmount, 1),
      1,
      Math.max(1, Number(snapshot?.reinforcementPool || 1))
    );
    await submitGameAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type: "reinforce",
      territoryId: reinforceTerritoryId,
      amount,
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  async function handleReinforceAll(): Promise<void> {
    if (!resolvedGameId || !myPlayerId || !reinforceTerritoryId) {
      return;
    }

    await submitGameAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type: "reinforce",
      territoryId: reinforceTerritoryId,
      amount: Math.max(1, Number(snapshot?.reinforcementPool || 1)),
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  async function handleAttack(type: "attack" | "attackBanzai"): Promise<void> {
    if (!resolvedGameId || !myPlayerId || !attackFromId || !attackToId || !attackDiceCount) {
      return;
    }

    await submitGameAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type,
      fromId: attackFromId,
      toId: attackToId,
      attackDice: Number(attackDiceCount),
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  async function handleMoveAfterConquest(): Promise<void> {
    if (!resolvedGameId || !myPlayerId || !snapshot?.pendingConquest) {
      return;
    }

    const armies = clamp(
      parsePositiveInteger(conquestArmies, pendingConquestMin),
      pendingConquestMin,
      pendingConquestMax
    );
    await submitGameAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type: "moveAfterConquest",
      armies,
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  async function handleMoveAllAfterConquest(): Promise<void> {
    if (!resolvedGameId || !myPlayerId || !snapshot?.pendingConquest) {
      return;
    }

    await submitGameAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type: "moveAfterConquest",
      armies: pendingConquestMax,
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  async function handleFortify(): Promise<void> {
    if (!resolvedGameId || !myPlayerId || !fortifyFromId || !fortifyToId || maxFortifyArmies < 1) {
      return;
    }

    const armies = clamp(parsePositiveInteger(fortifyArmies, 1), 1, maxFortifyArmies);
    await submitGameAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type: "fortify",
      fromId: fortifyFromId,
      toId: fortifyToId,
      armies,
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  async function handleEndTurn(): Promise<void> {
    if (!resolvedGameId || !myPlayerId) {
      return;
    }

    await submitGameAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type: "endTurn",
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  async function handleTradeCards(): Promise<void> {
    if (!resolvedGameId || !myPlayerId || selectedTradeCardIds.length !== 3) {
      return;
    }

    await tradeMutation.mutateAsync({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      cardIds: selectedTradeCardIds,
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  async function handleInlineLogin(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmedUsername = inlineUsername.trim();
    if (!trimmedUsername || !inlinePassword) {
      setInlineAuthError(t("auth.login.requiredFields"));
      return;
    }

    setInlineAuthPending(true);
    setInlineAuthError("");

    try {
      await signIn({
        username: trimmedUsername,
        password: inlinePassword
      });
      setInlineUsername("");
      setInlinePassword("");
      window.location.assign(
        `${window.location.pathname}${window.location.search}${window.location.hash}`
      );
    } catch (error) {
      setInlineAuthError(
        error instanceof Error && error.message ? error.message : t("auth.login.invalidCredentials")
      );
    } finally {
      setInlineAuthPending(false);
    }
  }

  async function handleSurrender(): Promise<void> {
    if (!resolvedGameId || !myPlayerId || !window.confirm(t("game.runtime.confirmSurrender"))) {
      return;
    }

    await submitGameAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type: "surrender",
      ...(currentVersion ? { expectedVersion: currentVersion } : {})
    });
  }

  function toggleTradeCard(cardId: string): void {
    setActionError("");
    setFeedbackMessage("");

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

    if (showFortifyGroup) {
      if (territory.ownerId !== myPlayerId) {
        return;
      }

      const canSelectFortifyTarget =
        fortifySelectionMode === "to" &&
        fortifySource &&
        territory.id !== fortifySource.id &&
        fortifySource.neighbors.includes(territory.id);

      if (canSelectFortifyTarget) {
        setSelectedFortifyToId(territory.id);
        setFortifySelectionMode("from");
      } else {
        setSelectedFortifyFromId(territory.id);
        setSelectedFortifyToId("");
        setFortifySelectionMode("to");
      }

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
        </div>
      </section>
    );
  }

  if (!snapshot) {
    return null;
  }

  const canTradeCards = selectedTradeCardIds.length === 3 && !tradeMutation.isPending;
  const actionPending =
    joinMutation.isPending ||
    startMutation.isPending ||
    actionMutation.isPending ||
    tradeMutation.isPending;

  return (
    <section data-testid="react-shell-game-page">
      <section
        className="battlefield-layout game-battlefield-layout"
        data-testid="battlefield-layout"
      >
        <section className="game-main-column" data-testid="game-main-column">
          <section
            className="center-stage panel map-stage-panel game-map-stage campaign-map-shell"
            data-testid="map-panel"
          >
            <GameplayMapViewport
              attackFromId={attackFromId}
              attackToId={attackToId}
              fortifyFromId={fortifyFromId}
              fortifyToId={fortifyToId}
              myPlayerId={myPlayerId}
              pieceSkinClass={pieceSkinClass}
              playersById={playersById}
              reinforceTerritoryId={reinforceTerritoryId}
              snapshot={snapshot}
              onTerritorySelect={handleTerritorySelect}
            />
          </section>

          <section
            className="panel game-info-rail game-info-bottom campaign-shell"
            data-testid="info-panel"
          >
            <div className="panel-header tight-header game-compact-heading">
              <div>
                <p className="eyebrow">{t("game.command.eyebrow")}</p>
                <h1>{t("game.command.heading")}</h1>
              </div>
              <span id="turn-badge" className="badge" data-testid="phase-indicator">
                {phaseBadgeLabel}
              </span>
            </div>

            <div className="rail-section map-stage-command-strip game-status-bottom-strip">
              <div
                id="status-summary"
                className="status-summary command-summary map-command-summary"
                data-testid="status-summary"
              >
                <div>
                  Fase: <strong>{snapshot.phase}</strong>
                </div>
                <div>
                  {t("game.reinforcementBanner")} <strong>{snapshot.reinforcementPool}</strong>
                </div>
                <div>
                  {t("game.runtime.winner")}:{" "}
                  <strong>{winner ? winner.name : t("game.runtime.noneLower")}</strong>
                </div>
              </div>
              <div
                id="trade-alert"
                className="turn-alert turn-alert-danger map-trade-alert"
                hidden={!mustTradeCards}
              >
                <strong>{t("game.tradeAlert.title")}</strong>
                <span id="trade-alert-text">
                  {t("game.runtime.tradeAlert.mustTradeNow", {
                    cardCount: playerHand.length,
                    limit: snapshot.cardState?.maxHandBeforeForcedTrade || 5
                  })}
                </span>
              </div>
              <div
                id="game-feedback"
                className={`action-help${gameFeedbackIsError ? " is-error" : ""}`}
                data-testid="react-shell-game-feedback"
                hidden={!gameFeedbackMessage}
              >
                {gameFeedbackMessage}
              </div>
            </div>

            <div className="rail-section game-meta-stack game-session-card">
              <div className="game-meta-line">
                <span>{t("game.meta.player")}</span>
                <strong id="identity-status" data-testid="current-player-indicator">
                  {me?.name || t("game.runtime.notConnected")}
                </strong>
              </div>
              <div className="game-meta-line">
                <span>{t("game.meta.activeGame")}</span>
                <strong id="game-status">{gameStatusLabel}</strong>
              </div>
              <div className="game-meta-line">
                <span>{t("game.meta.map")}</span>
                <strong id="game-map-meta">{mapMetaLabel}</strong>
              </div>
              <div className="game-meta-line">
                <span>{t("game.meta.setup")}</span>
                <strong id="game-setup-meta">{setupMetaLabel}</strong>
              </div>
              <div className="game-meta-line">
                <span>{t("game.meta.access")}</span>
                <span id="auth-status">{accessStatusLabel}</span>
              </div>
            </div>
          </section>
        </section>

        <aside
          className="right-rail panel game-actions-rail campaign-shell"
          data-testid="actions-panel"
        >
          <div className="rail-section game-phase-banner" id="phase-banner">
            <span>
              <span>{t("game.phaseBanner")}</span>{" "}
              <strong id="phase-banner-value">{phaseBadgeLabel}</strong>
            </span>
          </div>

          <div
            className="rail-section game-reinforcement-banner"
            id="reinforcement-banner"
            hidden={snapshot.phase !== "active"}
          >
            <span>
              <span>{t("game.reinforcementBanner")}</span>{" "}
              <strong id="reinforcement-banner-value">{snapshot.reinforcementPool}</strong>
            </span>
          </div>

          <div
            className="rail-section game-objective-section"
            data-testid="assigned-objective-panel"
            hidden={!assignedVictoryObjective}
          >
            <div className="section-title-row">
              <h3>{t("game.objective.heading")}</h3>
              <span className="badge accent">{t("game.objective.badge")}</span>
            </div>
            <article className="action-meta-list">
              <strong>{assignedVictoryObjective?.title}</strong>
              <p className="action-help">{assignedVictoryObjective?.description}</p>
              <p className="action-help">
                {t("game.objective.module", {
                  moduleName: assignedVictoryObjective?.moduleName || ""
                })}
              </p>
            </article>
          </div>

          <div
            className="rail-section game-lobby-controls"
            id="lobby-controls-section"
            hidden={!showLobbyControls}
          >
            <form
              id="auth-form"
              className="auth-form compact-form rail-auth-form"
              hidden={Boolean(authenticatedUser)}
              onSubmit={(event) => void handleInlineLogin(event)}
            >
              <label className="field-stack auth-field">
                <span>{t("auth.usernameLabel")}</span>
                <input
                  id="auth-username"
                  name="username"
                  maxLength={32}
                  placeholder={t("game.auth.username.placeholder")}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={inlineUsername}
                  onChange={(event) => setInlineUsername(event.target.value)}
                  disabled={inlineAuthPending}
                />
              </label>
              <label className="field-stack auth-field">
                <span>{t("auth.passwordLabel")}</span>
                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  placeholder={t("game.auth.password.placeholder")}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={inlinePassword}
                  onChange={(event) => setInlinePassword(event.target.value)}
                  disabled={inlineAuthPending}
                />
              </label>
              <p
                id="auth-feedback"
                className="auth-feedback"
                aria-live="polite"
                hidden={!inlineAuthError}
              >
                {inlineAuthError}
              </p>
              <button
                id="login-button"
                type="submit"
                className="ghost-button"
                disabled={inlineAuthPending}
              >
                {inlineAuthPending ? "..." : t("auth.login")}
              </button>
              <Link
                id="register-link"
                className="ghost-button full-width"
                to={buildRegisterPath(namespace)}
              >
                {t("auth.register")}
              </Link>
            </form>
            <div
              className="identity-actions compact-actions rail-action-group"
              id="lobby-action-buttons"
            >
              <button
                id="join-button"
                type="button"
                onClick={() => void handleJoinLobby()}
                disabled={!showJoinLobby || actionPending}
              >
                {joinMutation.isPending ? "Joining..." : t("game.join")}
              </button>
              <button
                id="start-button"
                type="button"
                className="ghost-button"
                onClick={() => void handleStartGame()}
                disabled={!showStartGame || actionPending || snapshot.players.length < 2}
              >
                {startMutation.isPending ? "Starting..." : t("game.start")}
              </button>
            </div>
          </div>

          <div className="rail-section actions-section">
            <div
              className="action-group compact-group"
              id="reinforce-group"
              hidden={!showReinforceGroup}
            >
              <label htmlFor="reinforce-select">{t("game.actions.reinforce")}</label>
              <div className="action-stack">
                <select
                  id="reinforce-select"
                  value={reinforceTerritoryId}
                  onChange={(event) => setSelectedReinforceTerritoryId(event.target.value)}
                >
                  {myTerritories.map((territory) => (
                    <option key={territory.id} value={territory.id}>
                      {territoryOptionLabel(territory, playersById)}
                    </option>
                  ))}
                </select>
                <input
                  id="reinforce-amount"
                  inputMode="numeric"
                  value={reinforceAmount}
                  onChange={(event) => setReinforceAmount(event.target.value)}
                  aria-label={t("game.actions.reinforceAmountAria")}
                />
                <div className="action-row">
                  <button
                    id="reinforce-multi-button"
                    type="button"
                    onClick={() => void handleReinforce()}
                    disabled={!reinforceTerritoryId || actionPending}
                  >
                    {actionMutation.isPending ? "Applying..." : t("game.actions.add")}
                  </button>
                  <button
                    id="reinforce-all-button"
                    type="button"
                    onClick={() => void handleReinforceAll()}
                    disabled={!reinforceTerritoryId || actionPending}
                  >
                    Sposta tutto
                  </button>
                </div>
              </div>
            </div>

            <div className="action-group compact-group" id="attack-group" hidden={!showAttackGroup}>
              <label htmlFor="attack-from">{t("game.actions.attack")}</label>
              <div className="action-stack">
                <select
                  id="attack-from"
                  value={attackFromId}
                  onChange={(event) => {
                    setSelectedAttackFromId(event.target.value);
                    setSelectedAttackToId("");
                    setSelectedAttackDiceCount("");
                  }}
                >
                  {myTerritories.map((territory) => (
                    <option key={territory.id} value={territory.id}>
                      {territoryOptionLabel(territory, playersById)}
                    </option>
                  ))}
                </select>
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
                <select
                  id="attack-dice"
                  value={attackDiceCount}
                  onChange={(event) => setSelectedAttackDiceCount(event.target.value)}
                >
                  {!maxAttackDice ? (
                    <option value="">{t("game.runtime.noDiceAvailable")}</option>
                  ) : null}
                  {Array.from({ length: maxAttackDice }, (_, index) => index + 1).map((count) => (
                    <option key={count} value={String(count)}>
                      {t("game.runtime.attackDiceOption", {
                        count,
                        suffix: count === 1 ? "" : "i"
                      })}
                    </option>
                  ))}
                </select>
                <div className="action-row">
                  <button
                    id="attack-button"
                    type="button"
                    onClick={() => void handleAttack("attack")}
                    disabled={!attackFromId || !attackToId || !attackDiceCount || actionPending}
                  >
                    {actionMutation.isPending ? "Attacking..." : t("game.actions.launchAttack")}
                  </button>
                  <button
                    id="attack-banzai-button"
                    type="button"
                    onClick={() => void handleAttack("attackBanzai")}
                    disabled={!attackFromId || !attackToId || !attackDiceCount || actionPending}
                  >
                    {actionMutation.isPending
                      ? t("game.runtime.banzaiLoading")
                      : t("game.actions.banzai")}
                  </button>
                </div>
              </div>
            </div>

            <div
              className="action-group compact-group"
              id="conquest-group"
              hidden={!showConquestGroup}
            >
              <label htmlFor="conquest-armies">{t("game.actions.afterConquest")}</label>
              <div className="action-stack">
                <input
                  id="conquest-armies"
                  inputMode="numeric"
                  value={conquestArmies}
                  onChange={(event) => setConquestArmies(event.target.value)}
                  placeholder={String(pendingConquestMin)}
                />
                <div className="action-row">
                  <button
                    id="conquest-button"
                    type="button"
                    onClick={() => void handleMoveAfterConquest()}
                    disabled={actionPending}
                  >
                    {actionMutation.isPending ? "Moving..." : t("game.actions.moveArmies")}
                  </button>
                  <button
                    id="conquest-all-button"
                    type="button"
                    onClick={() => void handleMoveAllAfterConquest()}
                    disabled={actionPending}
                  >
                    Sposta tutto
                  </button>
                </div>
              </div>
            </div>

            <div
              className="action-group compact-group"
              id="fortify-group"
              hidden={!showFortifyGroup}
            >
              <label htmlFor="fortify-from">{t("game.actions.fortify")}</label>
              <div className="action-stack">
                <select
                  id="fortify-from"
                  value={fortifyFromId}
                  onChange={(event) => {
                    setSelectedFortifyFromId(event.target.value);
                    setSelectedFortifyToId("");
                    setFortifySelectionMode("to");
                  }}
                >
                  {myTerritories.map((territory) => (
                    <option key={territory.id} value={territory.id}>
                      {territoryOptionLabel(territory, playersById)}
                    </option>
                  ))}
                </select>
                <select
                  id="fortify-to"
                  value={fortifyToId}
                  onChange={(event) => {
                    setSelectedFortifyToId(event.target.value);
                    setFortifySelectionMode("from");
                  }}
                >
                  <option value="">{t("game.runtime.noAdjacentTerritory")}</option>
                  {fortifyTargets.map((territory) => (
                    <option key={territory.id} value={territory.id}>
                      {territoryOptionLabel(territory, playersById)}
                    </option>
                  ))}
                </select>
                <input
                  id="fortify-armies"
                  inputMode="numeric"
                  value={fortifyArmies}
                  onChange={(event) => setFortifyArmies(event.target.value)}
                  placeholder="1"
                />
                <button
                  id="fortify-button"
                  type="button"
                  onClick={() => void handleFortify()}
                  disabled={
                    !fortifyFromId ||
                    !fortifyToId ||
                    maxFortifyArmies < 1 ||
                    actionPending ||
                    Boolean(snapshot.fortifyUsed)
                  }
                >
                  {actionMutation.isPending ? "Fortifying..." : t("game.actions.moveArmies")}
                </button>
              </div>
            </div>

            <div
              className="action-group compact-group"
              id="card-trade-group"
              hidden={!showTradePanel}
            >
              <label htmlFor="card-trade-list">{t("game.actions.cards")}</label>
              <div id="card-trade-alert" className="trade-emphasis" hidden={!mustTradeCards}>
                <span>{t("game.cards.alert")}</span>
              </div>
              <div className="action-meta-list">
                <p id="card-trade-summary" className="action-help">
                  {playerHand.length
                    ? t("game.runtime.cardsInHand", { count: playerHand.length })
                    : t("game.runtime.noCardsAvailable")}
                </p>
                <p id="card-trade-bonus" className="action-help">
                  {snapshot.cardState?.nextTradeBonus != null
                    ? t("game.runtime.nextTradeBonus", {
                        bonus: snapshot.cardState.nextTradeBonus
                      })
                    : t("game.runtime.none")}
                </p>
                <p id="card-trade-help" className="action-help">
                  {mustTradeCards
                    ? t("game.runtime.tradeHelp.mustTrade", {
                        limit: snapshot.cardState?.maxHandBeforeForcedTrade || 5
                      })
                    : t("game.runtime.tradeHelp.selected", {
                        selected: selectedTradeCardIds.length
                      })}
                </p>
              </div>
              <div id="card-trade-list" className="card-trade-list">
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
              <p id="card-trade-success" className="action-help" hidden={!feedbackMessage}>
                {feedbackMessage}
              </p>
              <p id="card-trade-error" className="action-help" hidden={!actionError}>
                {actionError}
              </p>
              <button
                id="card-trade-button"
                type="button"
                onClick={() => void handleTradeCards()}
                disabled={!canTradeCards}
              >
                {tradeMutation.isPending ? "Trading..." : t("game.cards.tradeSet")}
              </button>
            </div>

            <button
              id="end-turn-button"
              type="button"
              hidden={!showEndTurn}
              onClick={() => void handleEndTurn()}
              disabled={actionPending || Boolean(snapshot.pendingConquest)}
            >
              {actionMutation.isPending ? "Updating..." : endTurnLabel}
            </button>
          </div>

          <div
            id="combat-result-group"
            className="rail-section combat-result-section"
            hidden={!snapshot.lastCombat}
          >
            <div className="section-title-row">
              <h3>{t("game.combat.heading")}</h3>
              <span className="badge accent" id="combat-result-badge">
                {combatBadgeLabel}
              </span>
            </div>
            <div id="combat-result-summary" className="combat-result-summary">
              {combatSummary}
            </div>
            <div className="combat-result-grid">
              <div className="combat-result-line">
                <span>{t("game.combat.attacker")}</span>
                <strong id="combat-attacker-rolls">{attackerRollsText}</strong>
              </div>
              <div className="combat-result-line">
                <span>{t("game.combat.defender")}</span>
                <strong id="combat-defender-rolls">{defenderRollsText}</strong>
              </div>
              <div className="combat-result-line">
                <span>{t("game.combat.comparisons")}</span>
                <strong id="combat-comparisons">{comparisonSummary}</strong>
              </div>
            </div>
          </div>

          <div className="rail-section game-roster-section">
            <div className="section-title-row">
              <h3>{t("game.players.heading")}</h3>
              <span className="badge accent">{t("game.players.badge")}</span>
            </div>
            <div className="players rail-players" id="players">
              {snapshot.players.map((player) => (
                <article
                  className={`player-card ${pieceSkinClass}`}
                  data-player-id={player.id}
                  key={player.id}
                  style={{ "--player-color": player.color || "#162033" } as CSSProperties}
                >
                  <strong>{player.name}</strong>
                  <div>
                    {t("game.runtime.territories")}: {player.territoryCount || 0}
                  </div>
                  <div>
                    {t("lobby.table.status")}:{" "}
                    {player.eliminated ? t("game.runtime.eliminated") : t("game.runtime.active")}
                  </div>
                  <div className="player-card-token" />
                </article>
              ))}
            </div>
          </div>

          <div className="rail-section log-section">
            <div className="section-title-row">
              <h3>{t("game.log.heading")}</h3>
              <span className="badge accent">{t("game.log.badge")}</span>
            </div>
            <div className="log-list rail-log" id="log">
              {localizedLog.length ? (
                localizedLog.map((entry, index) => (
                  <article className="game-log-entry" key={`${index}-${entry}`}>
                    {entry}
                  </article>
                ))
              ) : (
                <p className="action-help">{t("game.log.lobbyCreated")}</p>
              )}
            </div>
          </div>

          <div className="rail-section surrender-section">
            <button
              id="surrender-button"
              type="button"
              className="danger-button full-width"
              hidden={!showSurrender}
              onClick={() => void handleSurrender()}
              disabled={actionPending}
            >
              {t("game.surrender")}
            </button>
          </div>
        </aside>
      </section>
    </section>
  );
}
