import { initGameState, gameState, reinforce, attack, move } from '../../src/game/index.js';
import { REINFORCE, ATTACK, FORTIFY, GAME_OVER } from '../../src/phases.js';

function sync(state, phase) {
  initGameState({ ...state, getPhase: () => phase });
  return gameState.getSnapshot();
}

test('match flow transitions', () => {
  let state = {
    currentPlayer: 0,
    players: [
      { name: 'P1', color: 'red' },
      { name: 'P2', color: 'blue' },
    ],
    territories: [
      { id: 'a', neighbors: ['b'], owner: 0, armies: 3 },
      { id: 'b', neighbors: ['a'], owner: 1, armies: 1 },
    ],
    reinforcements: 1,
    phase: REINFORCE,
  };

  // Reinforce phase
  let snap = sync(state, state.phase);
  expect(snap.phase).toBe(REINFORCE);
  expect(snap).toMatchSnapshot();

  const reinforced = reinforce({ ...snap, reinforcements: 1 }, 'a').state;
  reinforced.phase = ATTACK;
  snap = sync(reinforced, reinforced.phase);
  expect(snap.phase).toBe(ATTACK);
  expect(snap).toMatchSnapshot();

  // Mock dice so attacker always wins
  const randMock = jest
    .spyOn(Math, 'random')
    .mockReturnValueOnce(0.9)
    .mockReturnValueOnce(0.9)
    .mockReturnValueOnce(0.9)
    .mockReturnValueOnce(0.1)
    .mockReturnValueOnce(0.1);
  const attacked = attack(snap, 'a', 'b').state;
  randMock.mockRestore();
  attacked.phase = FORTIFY;
  snap = sync(attacked, attacked.phase);
  expect(snap.phase).toBe(FORTIFY);
  expect(snap).toMatchSnapshot();

  const moved = move(snap, 'a', 'b', 1).state;
  const ownedByP1 = moved.territories.every((t) => t.owner === 0);
  moved.phase = ownedByP1 ? GAME_OVER : REINFORCE;
  snap = sync(moved, moved.phase);
  expect(snap.phase).toBe(GAME_OVER);
  expect(snap).toMatchSnapshot();
});
