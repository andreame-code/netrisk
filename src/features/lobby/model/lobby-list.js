export function createLobbyModel(lobbyPort) {
  return {
    async fetchLobbies() {
      try {
        const { lobbies } = await lobbyPort.listLobbies({});
        return lobbies;
      } catch {
        return [];
      }
    },
    subscribe(onChange) {
      return lobbyPort.subscribeToLobbyChanges(onChange);
    }
  };
}

export default createLobbyModel;
