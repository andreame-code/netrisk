import { attachStatsListeners, getStats, exportStats } from '../src/stats.js';
import { REINFORCE } from '../src/phases.js';

function createGame(players, territories) {
  return {
    players,
    territories,
    currentPlayer: 0,
    handlers: {},
    on(event, cb) {
      this.handlers[event] = this.handlers[event] || [];
      this.handlers[event].push(cb);
    },
    emit(event, payload) {
      (this.handlers[event] || []).forEach((cb) => cb(payload));
    },
  };
}

describe('stats uat', () => {
  test('accumulates stats and attaches listeners', () => {
    const game = createGame([{},{ }], [
      { id: 'a', owner: 0 },
      { id: 'b', owner: 1 },
    ]);
    attachStatsListeners(game);
    expect(Object.keys(game.handlers)).toEqual(
      expect.arrayContaining(['turnStart', REINFORCE, 'attackResolved'])
    );
    let s = getStats();
    expect(s.territories[0][0]).toBe(1);
    game.emit(REINFORCE, { player: 0 });
    game.emit('attackResolved', { result: { conquered: true } });
    game.territories[1].owner = 0;
    game.emit('attackResolved', { result: { conquered: false } });
    game.emit('turnStart');
    s = getStats();
    expect(s.territories[0]).toEqual([1, 2]);
    expect(s.territories[1]).toEqual([1, 0]);
    expect(s.armies[0]).toEqual([1, 0]);
    expect(s.attacksWon[0]).toEqual([1, 0]);
    expect(s.attacksLost[0]).toEqual([1, 0]);
  });

  test('exports stats as json string', () => {
    const game = createGame([{},{ }], [
      { id: 'a', owner: 0 },
      { id: 'b', owner: 1 },
    ]);
    attachStatsListeners(game);
    game.emit(REINFORCE, { player: 0 });
    const statsBefore = getStats();
    const json = exportStats();
    expect(typeof json).toBe('string');
    expect(JSON.parse(json)).toEqual(statsBefore);
  });

  test('handles empty datasets', () => {
    const game = createGame([], []);
    attachStatsListeners(game);
    const emptyStats = getStats();
    expect(emptyStats.territories).toEqual([]);
    expect(emptyStats.armies).toEqual([]);
    expect(emptyStats.attacksWon).toEqual([]);
    expect(emptyStats.attacksLost).toEqual([]);
    const exported = JSON.parse(exportStats());
    expect(exported).toEqual(emptyStats);
  });
});

