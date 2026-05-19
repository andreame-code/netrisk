import type {
  GameSnapshot,
  SnapshotCard,
  SnapshotPlayer,
  SnapshotTerritory
} from "@frontend-generated/shared-runtime-validation.mts";

export type GameplayViewState = {
  playersById: Record<string, SnapshotPlayer>;
  territoriesById: Record<string, SnapshotTerritory>;
  me: SnapshotPlayer | null;
  activePlayer: SnapshotPlayer | null;
  winner: SnapshotPlayer | null;
  playerHand: SnapshotCard[];
  myTerritories: SnapshotTerritory[];
  currentVersion: number | undefined;
  latestCombatKey: string;
  isMyTurn: boolean;
  mustTradeCards: boolean;
  showLobbyControls: boolean;
  showJoinLobby: boolean;
  showStartGame: boolean;
  showReinforceGroup: boolean;
  showAttackGroup: boolean;
  showConquestGroup: boolean;
  showFortifyGroup: boolean;
  showEndTurn: boolean;
  showSurrender: boolean;
};

function indexPlayersById(snapshot: GameSnapshot | null): Record<string, SnapshotPlayer> {
  const playersById: Record<string, SnapshotPlayer> = {};
  for (const player of snapshot?.players || []) {
    playersById[player.id] = player;
  }
  return playersById;
}

function indexTerritoriesById(snapshot: GameSnapshot | null): Record<string, SnapshotTerritory> {
  const territoriesById: Record<string, SnapshotTerritory> = {};
  for (const territory of snapshot?.map || []) {
    territoriesById[territory.id] = territory;
  }
  return territoriesById;
}

function combatKey(snapshot: GameSnapshot | null): string {
  return snapshot?.lastCombat
    ? [
        snapshot.lastCombat.fromTerritoryId,
        snapshot.lastCombat.toTerritoryId,
        snapshot.lastCombat.attackerRolls?.join(",") || "",
        snapshot.lastCombat.defenderRolls?.join(",") || "",
        snapshot.lastCombat.comparisons?.map((comparison) => comparison.winner).join(",") || "",
        snapshot.lastCombat.conqueredTerritory ? "conquered" : "",
        snapshot.lastCombat.defenderReducedToZero ? "defense-broken" : ""
      ].join(":")
    : "";
}

export function buildGameplayViewState(
  snapshot: GameSnapshot | null,
  myPlayerId: string | null
): GameplayViewState {
  const playersById = indexPlayersById(snapshot);
  const territoriesById = indexTerritoriesById(snapshot);
  const me = myPlayerId ? playersById[myPlayerId] || null : null;
  const activePlayer = snapshot?.currentPlayerId
    ? playersById[snapshot.currentPlayerId] || null
    : null;
  const winner = snapshot?.winnerId ? playersById[snapshot.winnerId] || null : null;
  const playerHand = Array.isArray(snapshot?.playerHand) ? snapshot.playerHand : [];
  const myTerritories = (snapshot?.map || []).filter(
    (territory) => territory.ownerId === myPlayerId
  );
  const currentVersion =
    snapshot && typeof snapshot.version === "number" && Number.isInteger(snapshot.version)
      ? snapshot.version
      : undefined;
  const latestCombatKey = combatKey(snapshot);
  const isMyTurn = Boolean(
    snapshot?.phase === "active" && myPlayerId && snapshot.currentPlayerId === myPlayerId
  );
  const mustTradeCards = Boolean(
    isMyTurn && snapshot?.cardState?.currentPlayerMustTrade && playerHand.length
  );

  return {
    playersById,
    territoriesById,
    me,
    activePlayer,
    winner,
    playerHand,
    myTerritories,
    currentVersion,
    latestCombatKey,
    isMyTurn,
    mustTradeCards,
    showLobbyControls: snapshot?.phase === "lobby",
    showJoinLobby: snapshot?.phase === "lobby" && !myPlayerId,
    showStartGame: snapshot?.phase === "lobby" && Boolean(myPlayerId),
    showReinforceGroup: Boolean(
      isMyTurn &&
        snapshot?.turnPhase === "reinforcement" &&
        Number(snapshot?.reinforcementPool || 0) > 0
    ),
    showAttackGroup: Boolean(
      isMyTurn && snapshot?.turnPhase === "attack" && !snapshot?.pendingConquest
    ),
    showConquestGroup: Boolean(isMyTurn && snapshot?.pendingConquest),
    showFortifyGroup: Boolean(isMyTurn && snapshot?.turnPhase === "fortify"),
    showEndTurn: Boolean(
      isMyTurn && snapshot?.phase === "active" && snapshot?.turnPhase !== "reinforcement"
    ),
    showSurrender: Boolean(myPlayerId && snapshot?.phase === "active")
  };
}
