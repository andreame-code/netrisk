import { listLobbiesInputSchema } from '../../shared/ports/lobby';
import { currentUserInputSchema } from '../../shared/ports/auth';
import { subscribeInputSchema, unsubscribeInputSchema } from '../../shared/ports/realtime';

export function createLobbyModel({ lobbyPort, authPort, realtimePort }) {
  return {
    async listLobbies() {
      const input = listLobbiesInputSchema.parse({});
      const { lobbies } = await lobbyPort.listLobbies(input);
      return lobbies;
    },
    async currentUser() {
      const input = currentUserInputSchema.parse({});
      try {
        return await authPort.currentUser(input);
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
      const input = subscribeInputSchema.parse({
        channel: 'public:lobbies',
        event: '*',
        schema: 'public',
        table: 'lobbies',
        callback: handler,
      });
      const { subscriptionId } = await realtimePort.subscribe(input);
      return {
        unsubscribe: () =>
          realtimePort
            .unsubscribe(unsubscribeInputSchema.parse({ subscriptionId }))
            .catch(() => undefined),
      };
    },
  };
}

export default createLobbyModel;
