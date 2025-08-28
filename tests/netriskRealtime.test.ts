import { subscribeToMatch } from '../src/netriskRealtime.ts';
import type { Event } from '../src/types/netrisk';

// Mock Supabase client
const stateHandlers: any = {};
const eventHandlers: any = {};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    channel: jest.fn(() => ({
      on: jest.fn((_, cfg: any, cb: any) => {
        if (cfg.table === 'game_states') stateHandlers.cb = cb;
        if (cfg.table === 'events') eventHandlers.cb = cb;
        return this;
      }),
      subscribe: jest.fn(),
    })),
    removeChannel: jest.fn(),
  })),
}));

describe('netriskRealtime', () => {
  test('subscribeToMatch forwards realtime payloads', () => {
    const onState = jest.fn();
    const onEvent = jest.fn();
    const unsubscribe = subscribeToMatch('m1', { onState, onEvent });
    const client = (require('@supabase/supabase-js').createClient as jest.Mock).mock
      .results[0].value;
    const channel = client.channel.mock.results[0].value;

    // simulate incoming messages
    stateHandlers.cb({ new: { state: { turn: 1 } } });
    expect(onState).toHaveBeenCalledWith({ turn: 1 });

    const ev: Event<{ move: string }, { ok: boolean }> = {
      id: 'e1',
      matchId: 'm1',
      playerId: 'p1',
      action: { move: 'attack' },
      result: { ok: true },
      createdAt: 'now',
    };
    eventHandlers.cb({ new: ev });
    expect(onEvent).toHaveBeenCalledWith(ev);

    unsubscribe();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});
