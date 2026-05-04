import { useEffect, useEffectEvent, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  GameMutationResponse,
  GameSnapshot,
  SnapshotCard,
  SnapshotPlayer,
  SnapshotTerritory
} from "@frontend-generated/shared-runtime-validation.mts";

import type { ApiClientError } from "@frontend-core/api/http.mts";
import { extractGameVersionConflict, getGameState } from "@frontend-core/api/client.mts";
import { messageFromError } from "@frontend-core/errors.mts";
import { t, translateServerMessage } from "@frontend-i18n";

import { useAuth } from "@react-shell/auth";
import { useGameplayCommands } from "@react-shell/gameplay-commands";
import { GameplayMapViewport } from "@react-shell/gameplay-map-viewport";
import {
  clamp,
  normalizeSelectNumber,
  parsePositiveInteger,
  selectOrFallback
} from "@react-shell/gameplay-selections";
import { LoadingAnimation } from "@react-shell/loading-animation";
import { readCurrentPlayerId, storeCurrentPlayerId } from "@react-shell/player-session";
import {
  buildLobbyPath,
  buildRegisterPath,
  useShellNamespace
} from "@react-shell/public-auth-paths";
import { gameplayStateQueryKey } from "@react-shell/react-query";
import { useGameEventStream } from "@react-shell/use-game-event-stream";
import { WarTableIcon } from "@react-shell/war-table-icons";
import {
  ActivityLogDrawer,
  ActivityLogTrigger,
  CardsDrawer,
  CombatResultPanel,
  GameActionDock,
  GameActionRail,
  GameHud,
  GameInfoDrawer,
  PlayersDrawer,
  type ActivityLogEntry,
  type ActivityLogFilter,
  type GameDrawerKey
} from "@react-shell/gameplay-ui-panels";

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

function territoryDockOptionLabel(territory: SnapshotTerritory): string {
  return territory.name;
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

function logEntryMessageKey(entry: unknown): string {
  if (!entry || typeof entry !== "object") {
    return "";
  }

  const record = entry as Record<string, unknown>;
  return typeof record.messageKey === "string" ? record.messageKey : "";
}

function logEntryFallbackMessage(entry: unknown): string {
  if (!entry || typeof entry !== "object") {
    return "";
  }

  const record = entry as Record<string, unknown>;
  return typeof record.message === "string" ? record.message : "";
}

function categorizeActivityLogEntry(
  entry: unknown,
  fallbackPlainText = ""
): ActivityLogEntry["category"] {
  const messageKey = logEntryMessageKey(entry);
  const normalizedMessageKey = messageKey.toLowerCase();
  if (
    normalizedMessageKey.startsWith("game.log.attack") ||
    normalizedMessageKey === "game.log.moveafterconquest"
  ) {
    return "combat";
  }

  if (normalizedMessageKey.includes("trade") || normalizedMessageKey.includes("card")) {
    return "cards";
  }

  if (messageKey) {
    return "turn";
  }

  const normalized = fallbackPlainText.toLowerCase();
  if (
    normalized.includes("attack") ||
    normalized.includes("attacca") ||
    normalized.includes("combat") ||
    normalized.includes("dice") ||
    normalized.includes("dadi") ||
    normalized.includes("conquer") ||
    normalized.includes("conquista")
  ) {
    return "combat";
  }

  if (
    normalized.includes("card") ||
    normalized.includes("carte") ||
    normalized.includes("trade") ||
    normalized.includes("scambia")
  ) {
    return "cards";
  }

  return "turn";
}

function activityLogEntriesForSnapshot(snapshot: GameSnapshot | null): ActivityLogEntry[] {
  const snapshotRecord =
    snapshot && typeof snapshot === "object" ? (snapshot as Record<string, unknown>) : null;
  const structuredEntries = Array.isArray(snapshotRecord?.logEntries)
    ? snapshotRecord.logEntries
    : [];
  const plainTextEntries = Array.isArray(snapshotRecord?.log)
    ? snapshotRecord.log.filter(
        (entry): entry is string => typeof entry === "string" && Boolean(entry)
      )
    : [];
  const rows: ActivityLogEntry[] = [];
  const seenStructuredText = new Set<string>();

  for (const entry of structuredEntries) {
    const text = translateServerMessage(entry, logEntryFallbackMessage(entry));
    if (!text) {
      continue;
    }

    rows.push({
      category: categorizeActivityLogEntry(entry, text),
      text
    });
    seenStructuredText.add(text);
  }

  for (const text of plainTextEntries) {
    if (seenStructuredText.has(text)) {
      continue;
    }

    rows.push({
      category: categorizeActivityLogEntry(null, text),
      text
    });
  }

  return rows;
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

function gameMetaModuleLabels(gameConfig: GameSnapshot["gameConfig"] | null | undefined): string[] {
  const activeModules = Array.isArray(gameConfig?.activeModules) ? gameConfig.activeModules : [];
  const labels = activeModules
    .map((moduleEntry) => {
      if (typeof moduleEntry === "string") {
        return moduleEntry;
      }

      if (!moduleEntry || typeof moduleEntry !== "object") {
        return "";
      }

      const record = moduleEntry as Record<string, unknown>;
      return String(record.name || record.id || "").trim();
    })
    .filter(Boolean);

  return labels.length ? labels : [t("game.meta.noOptionalModules")];
}

export function GameRoute() {
  const { gameId } = useParams();
  const { state, signIn } = useAuth();
  const namespace = useShellNamespace();
  const queryClient = useQueryClient();
  const routeGameId = typeof gameId === "string" ? gameId : "";
  const lobbyHref = buildLobbyPath(namespace);
  const shouldLoadGameState =
    Boolean(routeGameId) || state.status === "authenticated" || state.status === "error";
  const shouldRedirectGuestGameRoot = !routeGameId && state.status === "unauthenticated";
  const queryKey = gameplayStateQueryKey(routeGameId || "current");
  const streamStatus = useGameEventStream({
    enabled: shouldLoadGameState,
    gameId: routeGameId,
    queryKey
  });
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
  const [activeDrawer, setActiveDrawer] = useState<GameDrawerKey | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogFilter, setActivityLogFilter] = useState<ActivityLogFilter>("all");
  const [isActivityLogCleared, setIsActivityLogCleared] = useState(false);
  const [isCommandDockExpanded, setIsCommandDockExpanded] = useState(false);

  const gameplayQuery = useQuery({
    queryKey,
    queryFn: () =>
      getGameState(routeGameId, {
        errorMessage: t("game.errors.loadActiveGame"),
        fallbackMessage: t("game.errors.loadActiveGame")
      }),
    // Keep the board in sync while the event stream is still handshaking or reconnecting.
    refetchInterval: streamStatus === "live" ? false : 1500,
    refetchIntervalInBackground: true,
    enabled: shouldLoadGameState
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
  const activePlayer = snapshot?.currentPlayerId
    ? playersById[snapshot.currentPlayerId] || null
    : null;
  const winner = snapshot?.winnerId ? playersById[snapshot.winnerId] || null : null;
  const playerHand = Array.isArray(snapshot?.playerHand) ? snapshot.playerHand : [];
  const assignedVictoryObjective = snapshot?.assignedVictoryObjective || null;
  const activityLogEntries = activityLogEntriesForSnapshot(snapshot);
  const activityLogContentKey = activityLogEntries
    .map((entry) => `${entry.category}:${entry.text.length}:${entry.text}`)
    .join("|");
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
  const dockEndPhaseLabel =
    snapshot?.turnPhase === "fortify"
      ? t("game.actions.endTurn")
      : snapshot?.turnPhase === "reinforcement"
        ? t("game.runtime.goToFortify")
        : t("game.runtime.goToFortify");
  const pieceSkinClass = pieceSkinClassName(pieceSkinRenderStyleForSnapshot(snapshot));
  const phaseBadgeLabel =
    snapshot?.phase === "active" ? turnPhaseLabel(snapshot.turnPhase) : phaseLabel(snapshot?.phase);
  const activePlayerName = activePlayer?.name || t("game.runtime.none");
  const activePlayerInitial = activePlayer?.name
    ? activePlayer.name.trim().charAt(0).toUpperCase() || "?"
    : "?";
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
  const showActionsSection = Boolean(
    showReinforceGroup || showAttackGroup || showConquestGroup || showFortifyGroup || showEndTurn
  );
  const gameFeedbackMessage = feedbackMessage || actionError;
  const gameFeedbackIsError = !feedbackMessage && Boolean(actionError);
  const commandActionTitle = showReinforceGroup
    ? t("game.commandMode.moveReinforcements")
    : showAttackGroup
      ? t("game.commandMode.attack")
      : showConquestGroup
        ? t("game.commandMode.moveConquestArmies")
        : showFortifyGroup
          ? t("game.commandMode.fortify")
          : showEndTurn
            ? t("game.commandMode.otherActions")
            : t("game.commandMode.commands");

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
    setSelectedTradeCardIds((current) => {
      const next = current
        .filter((cardId) => playerHand.some((card) => card.id === cardId))
        .slice(0, 3);

      if (
        next.length === current.length &&
        next.every((cardId, index) => cardId === current[index])
      ) {
        return current;
      }

      return next;
    });
  }, [playerHand]);

  useEffect(() => {
    setIsActivityLogCleared(false);
  }, [activityLogContentKey]);

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

  const gameplayCommands = useGameplayCommands({
    gameId: resolvedGameId,
    playerId: myPlayerId,
    currentVersion: currentVersion ?? null,
    requestFailedMessage: t("errors.requestFailed"),
    invalidPlayerMessage: t("game.invalidPlayer"),
    tradeSuccessFeedback: (bonus) => t("game.runtime.tradeSuccess", { bonus }),
    applyMutationPayload,
    handleMutationError
  });

  if (shouldRedirectGuestGameRoot) {
    return <Navigate to={lobbyHref} replace />;
  }

  async function handleJoinLobby(): Promise<void> {
    if (!resolvedGameId) {
      return;
    }

    await gameplayCommands.join();
  }

  async function handleStartGame(): Promise<void> {
    await gameplayCommands.start();
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
    await gameplayCommands.submitAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type: "reinforce",
      territoryId: reinforceTerritoryId,
      amount
    });
  }

  async function handleReinforceAll(): Promise<void> {
    if (!resolvedGameId || !myPlayerId || !reinforceTerritoryId) {
      return;
    }

    await gameplayCommands.submitAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type: "reinforce",
      territoryId: reinforceTerritoryId,
      amount: Math.max(1, Number(snapshot?.reinforcementPool || 1))
    });
  }

  async function handleAttack(type: "attack" | "attackBanzai"): Promise<void> {
    if (!resolvedGameId || !myPlayerId || !attackFromId || !attackToId || !attackDiceCount) {
      return;
    }

    await gameplayCommands.submitAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type,
      fromId: attackFromId,
      toId: attackToId,
      attackDice: Number(attackDiceCount)
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
    await gameplayCommands.submitAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type: "moveAfterConquest",
      armies
    });
  }

  async function handleMoveAllAfterConquest(): Promise<void> {
    if (!resolvedGameId || !myPlayerId || !snapshot?.pendingConquest) {
      return;
    }

    await gameplayCommands.submitAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type: "moveAfterConquest",
      armies: pendingConquestMax
    });
  }

  async function handleFortify(): Promise<void> {
    if (!resolvedGameId || !myPlayerId || !fortifyFromId || !fortifyToId || maxFortifyArmies < 1) {
      return;
    }

    const armies = clamp(parsePositiveInteger(fortifyArmies, 1), 1, maxFortifyArmies);
    await gameplayCommands.submitAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type: "fortify",
      fromId: fortifyFromId,
      toId: fortifyToId,
      armies
    });
  }

  async function handleEndTurn(): Promise<void> {
    if (!resolvedGameId || !myPlayerId) {
      return;
    }

    await gameplayCommands.submitAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type: "endTurn"
    });
  }

  async function handleTradeCards(): Promise<void> {
    if (!resolvedGameId || !myPlayerId || selectedTradeCardIds.length !== 3) {
      return;
    }

    await gameplayCommands.trade({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      cardIds: selectedTradeCardIds
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

    await gameplayCommands.submitAction({
      gameId: resolvedGameId,
      playerId: myPlayerId,
      type: "surrender"
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
      <section className="status-panel status-panel-loading" data-testid="react-shell-game-loading">
        <LoadingAnimation />
        <p className="status-label">{t("game.title")}</p>
        <h2>{t("game.runtime.loadingState")}</h2>
        <p className="status-copy">{t("game.errors.loadActiveGame")}</p>
      </section>
    );
  }

  if (gameplayQuery.isError && !snapshot) {
    return (
      <section className="status-panel status-panel-error" data-testid="react-shell-game-error">
        <p className="status-label">{t("game.title")}</p>
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
          <Link className="ghost-action" to={lobbyHref}>
            {t("nav.lobby")}
          </Link>
        </div>
      </section>
    );
  }

  if (!snapshot) {
    return null;
  }

  const canTradeCards = selectedTradeCardIds.length === 3 && !gameplayCommands.isTrading;
  const actionPending = gameplayCommands.isAnyPending;
  const dockMode = mustTradeCards
    ? "mandatory-trade"
    : showReinforceGroup
      ? "reinforcement"
      : showAttackGroup
        ? "attack"
        : showConquestGroup
          ? "conquest"
          : showFortifyGroup
            ? "fortify"
            : showLobbyControls
              ? "lobby"
              : "idle";
  const commandDockTitle =
    dockMode === "mandatory-trade" ? t("game.commandMode.tradeCards") : commandActionTitle;
  const actionRailItems = [
    {
      drawer: "players" as const,
      icon: "users" as const,
      label: t("game.players.heading")
    },
    {
      drawer: "cards" as const,
      icon: "cards" as const,
      label: t("game.actions.cards"),
      badge: playerHand.length
    },
    {
      drawer: "gameInfo" as const,
      icon: "globe" as const,
      label: t("game.drawer.gameInfo")
    }
  ];

  function toggleDrawer(drawer: GameDrawerKey): void {
    setActiveDrawer((current) => (current === drawer ? null : drawer));
  }

  return (
    <section className="game-map-first-page" data-testid="react-shell-game-page">
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
              commandDockExpanded={isCommandDockExpanded}
              fortifyFromId={fortifyFromId}
              fortifyToId={fortifyToId}
              myPlayerId={myPlayerId}
              pieceSkinClass={pieceSkinClass}
              playersById={playersById}
              reinforceTerritoryId={reinforceTerritoryId}
              snapshot={snapshot}
              onTerritorySelect={handleTerritorySelect}
            />

            <GameHud
              activePlayerInitial={activePlayerInitial}
              activePlayerName={activePlayerName}
              feedbackIsError={gameFeedbackIsError}
              feedbackMessage={gameFeedbackMessage}
              mustTradeCards={mustTradeCards}
              phaseBadgeLabel={phaseBadgeLabel}
              reinforcementPool={snapshot.reinforcementPool}
              tradeAlertText={t("game.runtime.tradeAlert.mustTradeNow", {
                cardCount: playerHand.length,
                limit: snapshot.cardState?.maxHandBeforeForcedTrade || 5
              })}
              winnerName={winner?.name}
            />
            <CombatResultPanel
              lastCombat={snapshot.lastCombat}
              playersById={playersById}
              territoriesById={territoriesById}
            />
            <span id="game-status" className="game-visually-hidden">
              {gameStatusLabel}
            </span>
            <span id="game-map-meta" className="game-visually-hidden">
              {mapMetaLabel}
            </span>
            {configuredPlayers !== 2 || aiCount !== 1 ? (
              <span id="game-setup-meta" className="game-visually-hidden">
                {setupMetaLabel}
              </span>
            ) : null}
            <span
              id="identity-status"
              className="game-visually-hidden"
              data-testid="current-player-indicator"
            >
              {me?.name || t("game.runtime.notConnected")}
            </span>
            <span id="players-summary" className="game-visually-hidden">
              {snapshot.players.map((player) => player.name).join(" ")}
            </span>
            <span id="log" className="game-visually-hidden">
              {activityLogEntries.map((entry) => entry.text).join(" ")}
            </span>
            {!showAttackGroup && showReinforceGroup ? (
              <span className="game-visually-hidden" aria-hidden="true">
                <select
                  id="attack-from"
                  tabIndex={-1}
                  value={attackFromId}
                  onChange={(event) => setSelectedAttackFromId(event.target.value)}
                >
                  {myTerritories.map((territory) => (
                    <option key={territory.id} value={territory.id}>
                      {territoryOptionLabel(territory, playersById)}
                    </option>
                  ))}
                </select>
                <select
                  id="attack-to"
                  tabIndex={-1}
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
              </span>
            ) : null}

            <div className="game-legacy-drawer-hooks" aria-label={t("game.command.heading")}>
              <details className="game-legacy-drawer-hook game-info-drawer">
                <summary>{t("game.drawer.gameInfo")}</summary>
                <div className="rail-section">
                  <button
                    id="surrender-button"
                    type="button"
                    className="danger-button full-width game-drawer-danger"
                    hidden={!showSurrender}
                    onClick={() => void handleSurrender()}
                    disabled={actionPending}
                  >
                    {t("game.surrender")}
                  </button>
                </div>
              </details>

              <details className="game-legacy-drawer-hook game-roster-drawer">
                <summary>{t("game.players.heading")}</summary>
                <div className="players rail-players" id="players">
                  {snapshot.players.map((player) => {
                    const troopCount = snapshot.map
                      .filter((territory) => territory.ownerId === player.id)
                      .reduce((total, territory) => total + Number(territory.armies || 0), 0);

                    return (
                      <article
                        className={`player-card ${pieceSkinClass}`}
                        data-player-id={player.id}
                        key={player.id}
                      >
                        <strong>{player.name}</strong>
                        <div>
                          {t("game.runtime.territories")}: {player.territoryCount || 0}
                        </div>
                        <div>Truppe: {troopCount}</div>
                        <div>
                          Stato:{" "}
                          {player.eliminated
                            ? t("game.runtime.eliminated")
                            : t("game.runtime.active")}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </details>
            </div>

            <GameActionRail
              activeDrawer={activeDrawer}
              items={actionRailItems}
              onOpenDrawer={setActiveDrawer}
              onToggleDrawer={toggleDrawer}
            />

            {activeDrawer === "players" ? (
              <PlayersDrawer
                currentPlayerId={snapshot.currentPlayerId}
                myPlayerId={myPlayerId}
                players={snapshot.players}
                territories={snapshot.map}
                onClose={() => setActiveDrawer(null)}
              />
            ) : null}

            {activeDrawer === "cards" ? (
              <CardsDrawer
                canTradeCards={canTradeCards}
                cardState={snapshot.cardState || null}
                cards={playerHand}
                feedbackIsError={gameFeedbackIsError}
                feedbackMessage={gameFeedbackMessage}
                getCardTypeLabel={cardTypeLabel}
                mustTradeCards={mustTradeCards}
                selectedCardIds={selectedTradeCardIds}
                trading={gameplayCommands.isTrading}
                onClose={() => setActiveDrawer(null)}
                onToggleCard={toggleTradeCard}
                onTradeCards={() => void handleTradeCards()}
              />
            ) : null}

            {activeDrawer === "gameInfo" ? (
              <GameInfoDrawer
                accessStatusLabel={accessStatusLabel}
                gameId={resolvedGameId}
                gameStatusLabel={gameStatusLabel}
                enabledModules={gameMetaModuleLabels(snapshot.gameConfig)}
                mapMetaLabel={mapMetaLabel}
                meName={me?.name || t("game.runtime.notConnected")}
                setupMetaLabel={setupMetaLabel}
                showSurrender={showSurrender}
                surrenderDisabled={actionPending}
                version={currentVersion ?? undefined}
                onClose={() => setActiveDrawer(null)}
                onSurrender={() => void handleSurrender()}
              />
            ) : null}

            {assignedVictoryObjective ? (
              <aside className="game-objective-chip" data-testid="assigned-objective-panel">
                <WarTableIcon name="objective" />
                <span>
                  <small className="game-objective-kicker">{t("game.objective.heading")}</small>
                  <strong>{assignedVictoryObjective.title}</strong>
                  <small>{assignedVictoryObjective.description}</small>
                  <small>
                    {t("game.objective.module", {
                      moduleName: assignedVictoryObjective.moduleName || ""
                    })}
                  </small>
                </span>
              </aside>
            ) : null}

            <div className="game-right-utility-rail">
              <ActivityLogTrigger
                isOpen={isActivityLogOpen}
                onClick={() => setIsActivityLogOpen((isOpen) => !isOpen)}
              />
            </div>

            {isActivityLogOpen ? (
              <ActivityLogDrawer
                entries={activityLogEntries}
                filter={activityLogFilter}
                isCleared={isActivityLogCleared}
                onClear={() => setIsActivityLogCleared(true)}
                onClose={() => setIsActivityLogOpen(false)}
                onFilterChange={setActivityLogFilter}
              />
            ) : null}
          </section>
        </section>

        <GameActionDock
          commandTitle={commandDockTitle}
          expanded={isCommandDockExpanded}
          mode={dockMode}
          onToggleExpanded={() => setIsCommandDockExpanded((isExpanded) => !isExpanded)}
        >
          {mustTradeCards ? (
            <div className="game-mandatory-trade-dock" id="card-trade-dock-group">
              <section className="game-trade-hand">
                <div className="game-dock-field-label">{t("game.commandDock.yourCards")}</div>
                <div id="card-trade-dock-list" className="game-card-grid">
                  {playerHand.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      className={`game-card-tile${selectedTradeCardIds.includes(card.id) ? " is-selected" : ""}`}
                      data-dock-card-id={card.id}
                      onClick={() => toggleTradeCard(card.id)}
                    >
                      <strong>{card.territoryId || card.id}</strong>
                      <span>{cardTypeLabel(card)}</span>
                    </button>
                  ))}
                </div>
                <p id="card-trade-dock-help">{t("game.commandDock.mustTradeToContinue")}</p>
              </section>
              <section className="game-trade-selection">
                <div className="game-dock-field-label">
                  {t("game.commandDock.selectCardsToTrade")}
                  <span>
                    {t("game.commandDock.cardsSelected", {
                      selected: selectedTradeCardIds.length
                    })}
                  </span>
                </div>
                <div className="game-selected-card-row">
                  {selectedTradeCardIds.length ? (
                    selectedTradeCardIds.map((cardId) => {
                      const card = playerHand.find((entry) => entry.id === cardId);
                      return (
                        <button
                          key={cardId}
                          type="button"
                          className="game-card-tile is-selected"
                          onClick={() => toggleTradeCard(cardId)}
                        >
                          <strong>{card?.territoryId || cardId}</strong>
                          <span>{card ? cardTypeLabel(card) : t("game.actions.cards")}</span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="action-help">{t("game.commandDock.chooseThreeCards")}</p>
                  )}
                </div>
                <div className="game-trade-actions">
                  <button
                    type="button"
                    className="game-command-secondary-action"
                    onClick={() => setSelectedTradeCardIds([])}
                    disabled={!selectedTradeCardIds.length || actionPending}
                  >
                    {t("game.commandDock.clearSelection")}
                  </button>
                  <button
                    id="card-trade-dock-button"
                    type="button"
                    onClick={() => void handleTradeCards()}
                    disabled={!canTradeCards}
                  >
                    {gameplayCommands.isTrading
                      ? t("game.commandDock.trading")
                      : t("game.commandDock.tradeCards")}
                  </button>
                </div>
              </section>
              <aside className="game-exchange-bonus">
                <span>{t("game.commandDock.exchangeBonus")}</span>
                <strong>+{snapshot.cardState?.nextTradeBonus ?? 0}</strong>
                <small>{t("game.hud.reinforcements")}</small>
                <p>{t("game.commandDock.cardsSet", { count: 3 })}</p>
              </aside>
            </div>
          ) : null}

          {!mustTradeCards && showLobbyControls ? (
            <div className="rail-section game-lobby-controls" id="lobby-controls-section">
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
                {inlineAuthError ? (
                  <p id="auth-error" className="action-help is-error" aria-live="polite">
                    {inlineAuthError}
                  </p>
                ) : null}
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
                  {gameplayCommands.isJoining ? "Joining..." : t("game.join")}
                </button>
                <button
                  id="start-button"
                  type="button"
                  className="ghost-button"
                  onClick={() => void handleStartGame()}
                  disabled={!showStartGame || actionPending || snapshot.players.length < 2}
                >
                  {gameplayCommands.isStarting ? "Starting..." : t("game.start")}
                </button>
              </div>
            </div>
          ) : null}

          {!mustTradeCards && showActionsSection ? (
            <div className="rail-section actions-section" id="game-command-actions">
              {showReinforceGroup ? (
                <div className="action-group compact-group" id="reinforce-group">
                  <label htmlFor="reinforce-select">
                    {t("game.commandDock.selectedTerritory")}
                  </label>
                  <div className="action-stack">
                    <select
                      id="reinforce-select"
                      value={reinforceTerritoryId}
                      onChange={(event) => setSelectedReinforceTerritoryId(event.target.value)}
                    >
                      {myTerritories.map((territory) => (
                        <option key={territory.id} value={territory.id}>
                          {territoryDockOptionLabel(territory)}
                        </option>
                      ))}
                    </select>
                    <div className="game-number-stepper">
                      <button
                        type="button"
                        onClick={() =>
                          setReinforceAmount((value) =>
                            String(Math.max(1, parsePositiveInteger(value, 1) - 1))
                          )
                        }
                        disabled={actionPending}
                      >
                        -
                      </button>
                      <input
                        id="reinforce-amount"
                        inputMode="numeric"
                        value={reinforceAmount}
                        onChange={(event) => setReinforceAmount(event.target.value)}
                        aria-label={t("game.actions.reinforceAmountAria")}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setReinforceAmount((value) =>
                            String(
                              clamp(
                                parsePositiveInteger(value, 1) + 1,
                                1,
                                Math.max(1, Number(snapshot.reinforcementPool || 1))
                              )
                            )
                          )
                        }
                        disabled={actionPending}
                      >
                        +
                      </button>
                    </div>
                    <div className="action-row">
                      <button
                        id="reinforce-multi-button"
                        type="button"
                        onClick={() => void handleReinforce()}
                        disabled={!reinforceTerritoryId || actionPending}
                      >
                        {gameplayCommands.isActionPending
                          ? t("game.commandDock.applying")
                          : t("game.actions.add")}
                      </button>
                      <button
                        id="reinforce-all-button"
                        type="button"
                        className="game-command-secondary-action"
                        aria-label={t("game.commandDock.addAllAria", {
                          count: snapshot.reinforcementPool
                        })}
                        onClick={() => void handleReinforceAll()}
                        disabled={!reinforceTerritoryId || actionPending}
                      >
                        {t("game.commandDock.addAll", { count: snapshot.reinforcementPool })}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {showAttackGroup ? (
                <div className="action-group compact-group" id="attack-group">
                  <label htmlFor="attack-from">{t("game.commandDock.from")}</label>
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
                          {territoryDockOptionLabel(territory)}
                        </option>
                      ))}
                    </select>
                    <label className="game-dock-select-label">
                      <span>{t("game.commandDock.to")}</span>
                      <select
                        id="attack-to"
                        value={attackToId}
                        onChange={(event) => setSelectedAttackToId(event.target.value)}
                      >
                        <option value="">{t("game.runtime.noTarget")}</option>
                        {attackTargets.map((territory) => (
                          <option key={territory.id} value={territory.id}>
                            {territoryDockOptionLabel(territory)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="game-dock-select-label">
                      <span>{t("game.commandDock.dice")}</span>
                      <select
                        id="attack-dice"
                        value={attackDiceCount}
                        onChange={(event) => setSelectedAttackDiceCount(event.target.value)}
                      >
                        {!maxAttackDice ? (
                          <option value="">{t("game.runtime.noDiceAvailable")}</option>
                        ) : null}
                        {Array.from({ length: maxAttackDice }, (_, index) => index + 1).map(
                          (count) => (
                            <option key={count} value={String(count)}>
                              {t("game.runtime.attackDiceOption", {
                                count,
                                suffix: count === 1 ? "" : "i"
                              })}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                    <div className="action-row">
                      <button
                        id="attack-button"
                        type="button"
                        onClick={() => void handleAttack("attack")}
                        disabled={!attackFromId || !attackToId || !attackDiceCount || actionPending}
                      >
                        {gameplayCommands.isActionPending
                          ? t("game.commandDock.attacking")
                          : t("game.actions.launchAttack")}
                      </button>
                      <button
                        id="attack-banzai-button"
                        type="button"
                        className="game-command-secondary-action"
                        onClick={() => void handleAttack("attackBanzai")}
                        disabled={!attackFromId || !attackToId || !attackDiceCount || actionPending}
                      >
                        {gameplayCommands.isActionPending
                          ? t("game.runtime.banzaiLoading")
                          : t("game.actions.banzai")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {showConquestGroup ? (
                <div className="action-group compact-group" id="conquest-group">
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
                        {gameplayCommands.isActionPending
                          ? t("game.commandDock.moving")
                          : t("game.actions.moveArmies")}
                      </button>
                      <button
                        id="conquest-all-button"
                        type="button"
                        className="game-command-secondary-action"
                        onClick={() => void handleMoveAllAfterConquest()}
                        disabled={actionPending}
                      >
                        {t("game.actions.moveAll", { count: pendingConquestMax })}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {showFortifyGroup ? (
                <div className="action-group compact-group" id="fortify-group">
                  <label htmlFor="fortify-from">{t("game.commandDock.from")}</label>
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
                          {territoryDockOptionLabel(territory)}
                        </option>
                      ))}
                    </select>
                    <label className="game-dock-select-label">
                      <span>{t("game.commandDock.to")}</span>
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
                            {territoryDockOptionLabel(territory)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="game-dock-select-label">
                      <span>{t("game.commandDock.armiesToMove")}</span>
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
                      onClick={() => void handleFortify()}
                      disabled={
                        !fortifyFromId ||
                        !fortifyToId ||
                        maxFortifyArmies < 1 ||
                        actionPending ||
                        Boolean(snapshot.fortifyUsed)
                      }
                    >
                      {gameplayCommands.isActionPending
                        ? t("game.commandDock.fortifying")
                        : t("game.actions.moveArmies")}
                    </button>
                  </div>
                </div>
              ) : null}

              <button
                id="end-turn-button"
                type="button"
                hidden={!showEndTurn}
                onClick={() => void handleEndTurn()}
                disabled={
                  actionPending ||
                  Boolean(snapshot.pendingConquest) ||
                  snapshot?.turnPhase === "reinforcement"
                }
              >
                {gameplayCommands.isActionPending
                  ? t("game.commandDock.updating")
                  : dockEndPhaseLabel}
              </button>
            </div>
          ) : null}
        </GameActionDock>
      </section>
    </section>
  );
}
