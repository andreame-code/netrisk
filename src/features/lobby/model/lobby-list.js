export function createLobbyModel(lobbyPort) {
  return {
    async fetchLobbies() {
      const { lobbies } = await lobbyPort.listLobbies({});
      return lobbies;
    },
    subscribe(onChange) {
      return lobbyPort.subscribeToLobbyChanges(onChange);
    }
  };
}

export default createLobbyModel;
