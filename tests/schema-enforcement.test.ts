import { createProfileAdapter } from '../src/infra/supabase/profile.adapter';
import { createLobbyAdapter } from '../src/infra/supabase/lobby.adapter';
import { createLobbyModel } from '../src/features/lobby/model';

describe('Supabase adapters', () => {
  test('profile adapter validates response', async () => {
    const client: any = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  user_id: 'u1',
                  name: 'Alice',
                  avatar_url: 'https://example.com/a.png',
                },
                error: null,
              }),
          }),
        }),
      }),
    };
    const adapter = createProfileAdapter(client);
    await expect(adapter.getProfile({ userId: 'u1' })).resolves.toEqual({
      userId: 'u1',
      name: 'Alice',
      avatarUrl: 'https://example.com/a.png',
    });
  });

  test('profile adapter throws on invalid response', async () => {
    const client: any = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: { name: 'Alice' },
                error: null,
              }),
          }),
        }),
      }),
    };
    const adapter = createProfileAdapter(client);
    await expect(adapter.getProfile({ userId: 'u1' })).rejects.toThrow();
  });

  test('lobby adapter rejects invalid lobby row', async () => {
    const client: any = {
      from: () => ({
        select: () =>
          Promise.resolve({
            data: [{ name: 'Lobby' }],
            error: null,
          }),
      }),
    };
    const adapter = createLobbyAdapter(client);
    await expect(adapter.listLobbies({})).rejects.toThrow();
  });

  test('lobby adapter returns validated lobbies', async () => {
    const client: any = {
      from: () => ({
        select: () =>
          Promise.resolve({
            data: [{ id: '1', name: 'L1', max_players: 4, player_count: 2 }],
            error: null,
          }),
      }),
    };
    const adapter = createLobbyAdapter(client);
    const { lobbies } = await adapter.listLobbies({});
    expect(lobbies).toEqual([{ id: '1', name: 'L1', maxPlayers: 4, playerCount: 2 }]);
  });
});

describe('Model input validation', () => {
  test('subscribeToLobbyChanges enforces handler', async () => {
    const lobbyPort: any = {
      listLobbies: () => Promise.resolve({ lobbies: [] }),
    };
    const authPort: any = { currentUser: () => Promise.resolve({ id: '1' }) };
    const realtimePort = {
      subscribe: jest.fn().mockResolvedValue({ subscriptionId: 's1' }),
      unsubscribe: jest.fn().mockResolvedValue({ success: true }),
    };
    const model = createLobbyModel({ lobbyPort, authPort, realtimePort });
    await expect(model.subscribeToLobbyChanges(() => {})).resolves.toHaveProperty('unsubscribe');
    await expect(
      // @ts-expect-error deliberate invalid handler
      model.subscribeToLobbyChanges('not a function'),
    ).rejects.toThrow();
    expect(realtimePort.subscribe).toHaveBeenCalledTimes(1);
  });
});
