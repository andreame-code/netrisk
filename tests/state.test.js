import { initGameState } from '../src/game/state/index.js';

// This test ensures that the central game state can be reused
// across different UI layers (e.g. different layout skins) by
// importing the state module multiple times. Each import should
// reference the same state object and reflect updates made
// through the provided API.

test('game state is shared across layouts', async () => {
  const dummyGame = {
    currentPlayer: 2,
    players: [{ name: 'A' }, { name: 'B' }],
    territories: [1, 2],
    getPhase: () => 'REINFORCE',
  };

  initGameState(dummyGame);

  const { gameState: layout1 } = await import('../src/game/state/index.js');
  const { gameState: layout2 } = await import('../src/game/state/index.js');

  expect(layout1).toBe(layout2);
  expect(layout1.currentPlayer).toBe(2);
});
