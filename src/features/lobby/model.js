export function createLobbyModel({ lobbyPort, authPort }) {
  return {
    async listLobbies() {
      const { lobbies } = await lobbyPort.listLobbies({});
      return lobbies;
    },
    async currentUser() {
      try {
        return await authPort.currentUser({});
      } catch {
        return null;
      }
    },
    async getChatHistory() {
      // Chat history retrieval is not yet supported via ports.
      return [];
    },
  };
}

export default createLobbyModel;
