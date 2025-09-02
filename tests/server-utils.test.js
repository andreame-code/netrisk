import { jest } from '@jest/globals';

// Mock supabase and logger
var mockUpsert;
var mockMaybeSingle;
var mockEq;
var mockSelect;
var mockFrom;
var mockSupabase;
var mockInfo;
var mockError;

jest.mock('../src/init/supabase-client.js', () => {
  mockUpsert = jest.fn();
  mockMaybeSingle = jest.fn();
  mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
  mockSelect = jest.fn(() => ({ eq: mockEq }));
  mockFrom = jest.fn(() => ({ upsert: mockUpsert, select: mockSelect }));
  mockSupabase = { from: mockFrom };
  return { __esModule: true, default: mockSupabase };
});

jest.mock('../src/logger.js', () => {
  mockInfo = jest.fn();
  mockError = jest.fn();
  return { __esModule: true, info: mockInfo, error: mockError };
});

import { persistLobby, loadLobby, validateMessage } from '../src/server/utils.js';

describe('server utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('persistLobby sends correct upsert', async () => {
    const lobby = {
      code: 'abc',
      host: 'h',
      players: [
        { id: 'p1', name: 'Alice', color: 'red', ready: true, lastSeen: 1 },
        { id: 'p2', name: 'Bob', color: 'blue', ready: false },
      ],
      started: false,
      currentPlayer: 'p1',
      state: { foo: 'bar' },
      map: 'world',
      maxPlayers: 8,
    };

    await persistLobby(lobby);

    expect(mockFrom).toHaveBeenCalledWith('lobbies');
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        code: 'abc',
        host: 'h',
        players: [
          { id: 'p1', name: 'Alice', color: 'red', ready: true, lastSeen: 1 },
          { id: 'p2', name: 'Bob', color: 'blue', ready: false },
        ],
        started: false,
        current_player: 'p1',
        state: { foo: 'bar' },
        map: 'world',
        max_players: 8,
      },
      { onConflict: 'code' },
    );
    expect(mockInfo).toHaveBeenCalledWith('Persisting lobby abc');
    expect(mockInfo).toHaveBeenCalledWith('Lobby abc persisted');
    expect(mockError).not.toHaveBeenCalled();
  });

  test('loadLobby retrieves from DB and filters stale players', async () => {
    const lobbies = new Map();
    const code = 'xyz';
    const fixedTime = 10_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(fixedTime);
    mockMaybeSingle.mockResolvedValue({
      data: {
        code,
        host: 'h',
        players: [
          { id: 'recent', lastSeen: fixedTime - 500 },
          { id: 'old', lastSeen: fixedTime - 5_000 },
          { id: 'nols' },
        ],
        state: null,
        started: false,
        current_player: null,
        map: null,
        max_players: 8,
      },
      error: null,
    });

    const lobby = await loadLobby(lobbies, code, 1_000);

    expect(mockFrom).toHaveBeenCalledWith('lobbies');
    expect(mockSelect).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('code', code);
    expect(lobby.players.map((p) => p.id)).toEqual(['recent', 'nols']);
    expect(lobbies.get(code)).toBe(lobby);
    expect(mockInfo).toHaveBeenCalledWith(`Loading lobby ${code} from database`);
    expect(mockInfo).toHaveBeenCalledWith(`Lobby ${code} loaded from database`);
    spy.mockRestore();
  });

  test('validateMessage accepts valid message', () => {
    const msg = { type: 'joinLobby', code: 'abc', player: { id: 'p1' } };
    const result = validateMessage(msg);
    expect(result.success).toBe(true);
  });

  test('validateMessage rejects invalid message', () => {
    const msg = { type: 'joinLobby', code: 123, player: {} };
    const result = validateMessage(msg);
    expect(result.success).toBe(false);
  });

  test('validateMessage rejects unknown type', () => {
    const msg = { type: 'unknown' };
    const result = validateMessage(msg);
    expect(result).toEqual({ success: false, error: 'unknownType' });
  });
});
