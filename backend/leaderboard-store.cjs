function createLeaderboardStore(options = {}) {
  const datastore = options.datastore;
  if (!datastore) {
    throw new Error("Leaderboard store richiede un datastore.");
  }

  async function listLeaderboardEntries(communityId, gameModeId = null) {
    const games = await datastore.listGames();
    const totals = new Map();

    games.forEach((game) => {
      const state = game?.state;
      if (!state || state.phase !== "finished" || !state.communityId || state.communityId !== communityId) {
        return;
      }

      const modeId = state.gameModeId || state.gameModeDefinition?.id || null;
      if (gameModeId && modeId !== gameModeId) {
        return;
      }

      const winnerId = state.winnerId || null;
      const players = Array.isArray(state.players) ? state.players : [];
      players.forEach((player) => {
        if (!player || player.isAi) {
          return;
        }

        const key = `${communityId}:${modeId || "default"}:${player.id}`;
        const current = totals.get(key) || {
          communityId,
          gameModeId: modeId,
          playerId: player.id,
          playerName: player.name,
          wins: 0,
          losses: 0,
          gamesPlayed: 0
        };

        current.gamesPlayed += 1;
        if (winnerId && winnerId === player.id) {
          current.wins += 1;
        } else {
          current.losses += 1;
        }

        totals.set(key, current);
      });
    });

    return [...totals.values()]
      .sort((left, right) => {
        if (right.wins !== left.wins) {
          return right.wins - left.wins;
        }
        if (left.losses !== right.losses) {
          return left.losses - right.losses;
        }
        return left.playerName.localeCompare(right.playerName);
      });
  }

  return {
    listLeaderboardEntries
  };
}

module.exports = {
  createLeaderboardStore
};
