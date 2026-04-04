const path = require("path");
const { createDatastore } = require("./datastore.cjs");
const { findSupportedMap } = require("../shared/maps/index.cjs");

function readableMapName(mapId) {
  const map = findSupportedMap(mapId);
  return map ? map.name : (mapId || null);
}

function territoriesOwnedBy(entry, playerId) {
  if (!playerId || !entry?.state?.territories) {
    return 0;
  }

  return Object.values(entry.state.territories).filter((territory) => territory?.ownerId === playerId).length;
}

function statusLabelForPlayer(entry, player, territoryCount) {
  if (!player) {
    return "Profilo non collegato";
  }

  if (entry?.state?.phase === "lobby") {
    return "In attesa avvio";
  }

  if (entry?.state?.phase === "finished") {
    return entry.state.winnerId === player.id ? "Vittoria" : "Sconfitta";
  }

  return territoryCount > 0 ? "Operativo" : "Eliminato";
}

function focusLabelForPlayer(entry, player) {
  if (!player) {
    return "Non assegnato";
  }

  if (entry?.state?.phase !== "active") {
    return "Lobby";
  }

  return entry.state.players[entry.state.currentTurnIndex]?.id === player.id ? "Tocca a te" : "In attesa";
}

function turnPhaseLabel(turnPhase) {
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

function summarizeParticipatingGame(entry, username) {
  const config = entry?.state?.gameConfig || null;
  const configuredPlayers = Array.isArray(config?.players) ? config.players : [];
  const totalPlayers = Number.isInteger(config?.totalPlayers) ? config.totalPlayers : configuredPlayers.length;
  const player = Array.isArray(entry?.state?.players)
    ? entry.state.players.find((candidate) => candidate?.name === username)
    : null;
  const territoryCount = territoriesOwnedBy(entry, player?.id);
  const cardCount = player?.id && Array.isArray(entry?.state?.hands?.[player.id]) ? entry.state.hands[player.id].length : 0;

  return {
    id: entry.id,
    name: entry.name,
    phase: entry?.state?.phase || "lobby",
    playerCount: Array.isArray(entry?.state?.players) ? entry.state.players.length : 0,
    totalPlayers: totalPlayers || null,
    mapName: config ? (config.mapName || readableMapName(config.mapId)) : null,
    updatedAt: entry.updatedAt,
    myLobby: {
      playerName: player?.name || username,
      statusLabel: statusLabelForPlayer(entry, player, territoryCount),
      focusLabel: focusLabelForPlayer(entry, player),
      turnPhaseLabel: turnPhaseLabel(entry?.state?.turnPhase),
      territoryCount,
      cardCount
    }
  };
}

function createPlayerProfileStore(options = {}) {
  const datastore = options.datastore || createDatastore({
    dbFile: options.dbFile || path.join(__dirname, "..", "data", "netrisk.sqlite"),
    legacyGamesFile: options.gamesFile || path.join(__dirname, "..", "data", "games.json"),
    legacyUsersFile: options.usersFile || options.dataFile || path.join(__dirname, "..", "data", "users.json"),
    legacySessionsFile: options.sessionsFile || path.join(__dirname, "..", "data", "sessions.json")
  });

  function getPlayerProfile(username) {
    const normalizedUsername = String(username || "").trim();
    if (!normalizedUsername) {
      throw new Error("Il profilo richiede un nome giocatore valido.");
    }

    const relevantGames = datastore.listGames().filter((entry) =>
      Array.isArray(entry?.state?.players) &&
      entry.state.players.some((player) => player.name === normalizedUsername)
    );

    const completedGames = relevantGames.filter((entry) => entry?.state?.phase === "finished");
    const gamesInProgress = relevantGames.filter((entry) => entry?.state?.phase === "active" || entry?.state?.phase === "lobby");
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
        .sort((left, right) => String(right?.updatedAt || "").localeCompare(String(left?.updatedAt || "")))
        .map((entry) => summarizeParticipatingGame(entry, normalizedUsername)),
      winRate,
      hasHistory: relevantGames.length > 0,
      placeholders: {
        recentGames: false,
        ranking: false
      }
    };
  }

  return {
    datastore,
    getPlayerProfile
  };
}

module.exports = {
  createPlayerProfileStore
};
