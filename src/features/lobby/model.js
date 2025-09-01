export function createLobbyModel({ lobbyPort, authPort, realtimePort }) {
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
    async subscribeToLobbyChanges(handler) {
      if (!realtimePort) return { unsubscribe: () => {} };
      const { subscriptionId } = await realtimePort.subscribe({
        channel: "public:lobbies",
        event: "*",
        schema: "public",
        table: "lobbies",
        callback: handler,
      });
      return {
        unsubscribe: () =>
          realtimePort.unsubscribe({ subscriptionId }).catch(() => undefined),
      };
    },
  };
}

export default createLobbyModel;
