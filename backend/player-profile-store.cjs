const path = require("path");
const { createDatastore } = require("./datastore.cjs");

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
