const path = require("path");
const { createDatastore } = require("./datastore.cjs");
const { migrateGameStateExtensions } = require("../shared/extensions.cjs");
const { findSupportedMap } = require("../shared/maps/index.cjs");
const { mapMaybe } = require("./maybe-async.cjs");
import type { ParticipatingGameContract, ProfileContract } from "../shared/api-contracts.cjs";
import type { GameState, Player, TurnPhaseValue } from "../shared/models.cjs";

type GameEntry = {
  id: string;
  name: string;
  updatedAt: string;
  state: GameState & {
    gameConfig?: {
      players?: unknown[];
      totalPlayers?: number;
      contentPackId?: string | null;
      mapId?: string | null;
      mapName?: string | null;
      victoryRuleSetId?: string | null;
      pieceSetId?: string | null;
      activeModules?: Array<{ id?: string; version?: string }> | null;
      gamePresetId?: string | null;
      contentProfileId?: string | null;
      gameplayProfileId?: string | null;
      uiProfileId?: string | null;
    } | null;
    hands?: Record<string, unknown[]>;
  };
};

type PlayerProfileStore = {
  datastore: {
    listGames(): GameEntry[] | Promise<GameEntry[]>;
  };
  getPlayerProfile(username: string): ProfileContract | Promise<ProfileContract>;
};

function readableMapName(mapId: string | null | undefined): string | null {
  const map = findSupportedMap(mapId);
  return map ? map.name : mapId || null;
}

function normalizeEntry(entry: GameEntry): GameEntry {
  if (entry?.state && typeof entry.state === "object") {
    migrateGameStateExtensions(entry.state);
  }
  return entry;
}

function territoriesOwnedBy(entry: GameEntry, playerId: string | null | undefined): number {
  if (!playerId || !entry?.state?.territories) {
    return 0;
  }

  return Object.values(entry.state.territories).filter(
    (territory) => territory?.ownerId === playerId
  ).length;
}

function statusLabelForPlayer(
  entry: GameEntry,
  player: Player | null,
  territoryCount: number
): string {
  if (!player) {
    return "Profilo non collegato";
  }

  if (entry?.state?.phase === "lobby") {
    return "In attesa avvio";
  }

  if (entry?.state?.phase === "finished") {
    return entry.state.winnerId === player.id ? "Vittoria" : "Sconfitta";
  }

  return territoryCount > 0 && !player.surrendered ? "Operativo" : "Eliminato";
}

function focusLabelForPlayer(entry: GameEntry, player: Player | null): string {
  if (!player) {
    return "Non assegnato";
  }

  if (entry?.state?.phase !== "active") {
    return "Lobby";
  }

  return entry.state.players[entry.state.currentTurnIndex]?.id === player.id
    ? "Tocca a te"
    : "In attesa";
}

function turnPhaseLabel(turnPhase: TurnPhaseValue | string | null | undefined): string {
  if (turnPhase === "reinforcement") {
    return "Rinforzi";
  }
  if (turnPhase === "attack") {
    return "Attacco";
  }
  if (turnPhase === "fortify") {
    return "Fortifica";
  }
  return "Lobby";
}

function normalizeActiveModules(
  activeModules: Array<{ id?: string; version?: string }> | null | undefined
): Array<{ id: string; version: string }> {
  if (!Array.isArray(activeModules)) {
    return [];
  }

  return activeModules
    .filter((entry): entry is { id: string; version: string } =>
      Boolean(entry && typeof entry.id === "string" && typeof entry.version === "string")
    )
    .map((entry) => ({
      id: String(entry.id),
      version: String(entry.version)
    }));
}

function summarizeParticipatingGame(entry: GameEntry, username: string): ParticipatingGameContract {
  const config = entry?.state?.gameConfig || null;
  const configuredPlayers = Array.isArray(config?.players) ? config.players : [];
  const configuredTotalPlayers = config?.totalPlayers;
  const totalPlayers = Number.isInteger(configuredTotalPlayers)
    ? configuredTotalPlayers
    : configuredPlayers.length;
  const activeModules = normalizeActiveModules(config?.activeModules);
  const player = Array.isArray(entry?.state?.players)
    ? entry.state.players.find((candidate) => candidate?.name === username)
    : null;
  const territoryCount = territoriesOwnedBy(entry, player?.id);
  const cardCount =
    player?.id && Array.isArray(entry?.state?.hands?.[player.id])
      ? entry.state.hands[player.id].length
      : 0;

  return {
    id: entry.id,
    name: entry.name,
    phase: entry?.state?.phase || "lobby",
    playerCount: Array.isArray(entry?.state?.players) ? entry.state.players.length : 0,
    totalPlayers: totalPlayers || null,
    mapName: config ? config.mapName || readableMapName(config?.mapId) : null,
    updatedAt: entry.updatedAt,
    activeModules,
    gamePresetId: typeof config?.gamePresetId === "string" ? config.gamePresetId : null,
    contentProfileId: typeof config?.contentProfileId === "string" ? config.contentProfileId : null,
    gameplayProfileId:
      typeof config?.gameplayProfileId === "string" ? config.gameplayProfileId : null,
    uiProfileId: typeof config?.uiProfileId === "string" ? config.uiProfileId : null,
    myLobby: {
      playerName: player?.name || username,
      statusLabel: statusLabelForPlayer(entry, player || null, territoryCount),
      focusLabel: focusLabelForPlayer(entry, player || null),
      turnPhaseLabel: turnPhaseLabel(entry?.state?.turnPhase),
      territoryCount,
      cardCount
    }
  };
}

function createPlayerProfileStore(options: Record<string, unknown> = {}): PlayerProfileStore {
  const datastore =
    options.datastore ||
    createDatastore({
      dbFile: options.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite"),
      legacyGamesFile: options.gamesFile || path.join(__dirname, "..", "data", "games.json"),
      legacyUsersFile:
        options.usersFile || options.dataFile || path.join(__dirname, "..", "data", "users.json"),
      legacySessionsFile:
        options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json")
    });

  function getPlayerProfile(username: string): ProfileContract | Promise<ProfileContract> {
    const normalizedUsername = String(username || "").trim();
    if (!normalizedUsername) {
      throw new Error("Il profilo richiede un nome giocatore valido.");
    }

    return mapMaybe(datastore.listGames(), (games: GameEntry[]) => {
      const relevantGames = games
        .map(normalizeEntry)
        .filter(
          (entry) =>
            Array.isArray(entry?.state?.players) &&
            entry.state.players.some((player) => player.name === normalizedUsername)
        );

      const completedGames = relevantGames.filter((entry) => entry?.state?.phase === "finished");
      const gamesInProgress = relevantGames.filter(
        (entry) => entry?.state?.phase === "active" || entry?.state?.phase === "lobby"
      );
      const wins = completedGames.filter((entry) => {
        const winner = entry.state.players.find((player) => player.id === entry.state.winnerId);
        return winner && winner.name === normalizedUsername;
      }).length;
      const losses = completedGames.length - wins;
      const gamesPlayed = completedGames.length;
      const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : null;

      return {
        playerName: normalizedUsername,
        gamesPlayed,
        wins,
        losses,
        gamesInProgress: gamesInProgress.length,
        participatingGames: gamesInProgress
          .slice()
          .sort((left, right) =>
            String(right?.updatedAt || "").localeCompare(String(left?.updatedAt || ""))
          )
          .map((entry) => summarizeParticipatingGame(entry, normalizedUsername)),
        winRate,
        hasHistory: relevantGames.length > 0,
        placeholders: {
          recentGames: false,
          ranking: false
        }
      };
    });
  }

  return {
    datastore,
    getPlayerProfile
  };
}

module.exports = {
  createPlayerProfileStore
};
