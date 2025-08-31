export function createLobbyModel(lobbyPort) {
  return {
    async fetchLobbies(ui) {
      try {
        const { lobbies } = await lobbyPort.listLobbies({});
        ui.renderLobbies(lobbies);
      } catch {
        ui.renderLobbies([]);
      }
    }
  };
}

export default createLobbyModel;
