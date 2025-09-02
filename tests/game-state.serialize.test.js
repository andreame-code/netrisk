import { GameState, serialize, deserialize } from '../src/game/state/index.js';
import { REINFORCE } from '../src/phases.js';

test('serialize returns plain object and deserialize hydrates', () => {
  const gs = new GameState();
  gs.setSelectedTerritory('t1');
  const obj = serialize(gs);
  expect(obj).toEqual({
    turnNumber: 1,
    currentPlayer: 0,
    players: [],
    territories: [],
    selectedTerritory: 't1',
    tokenPosition: null,
    phase: REINFORCE,
    log: [],
  });
  const restored = deserialize(obj);
  expect(restored).toBeInstanceOf(GameState);
  expect(restored.getSnapshot()).toEqual(obj);
});

test('deserialize validates structure', () => {
  expect(() => deserialize({ foo: 'bar' })).toThrow();
});
