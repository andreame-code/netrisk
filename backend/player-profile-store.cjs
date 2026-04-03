const path = require("path");
const { readJsonFile } = require("./json-file-store.cjs");

function readGamesDatabase(filePath) {
  const parsed = readJsonFile(filePath, { games: [] }, (value) => Boolean(value) && typeof value === "object");
  return {
    games: Array.isArray(parsed.games) ? parsed.games : []
  };
}

function createPlayerProfileStore(options = {}) {
  const gamesFile = options.gamesFile || path.join(__dirname, "..", "data", "games.json");

  function getPlayerProfile(username) {
    const normalizedUsername = String(username || "").trim();
    if (!normalizedUsername) {
      throw new Error("Il profilo richiede un nome giocatore valido.");
    }

    const database = readGamesDatabase(gamesFile);
    const relevantGames = database.games.filter((entry) =>
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
    getPlayerProfile
  };
}

module.exports = {
  createPlayerProfileStore
};
