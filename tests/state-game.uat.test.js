import Game from '../src/game.js';
import { gameState, initGameState, setSelectedTerritory } from '../src/game/state/index.js';

test('initGameState synchronizes game properties', () => {
  const players = [{ name: 'A' }, { name: 'B' }];
  const territories = [
    { id: 't1', neighbors: [], x: 0, y: 0 },
    { id: 't2', neighbors: [], x: 1, y: 1 },
  ];
  const game = new Game(players, territories, [], [], false, false);
  initGameState(game);

  const snapshot = gameState.getSnapshot();
  expect(snapshot.currentPlayer).toBe(game.currentPlayer);
  expect(snapshot.players).toEqual(game.players);
  expect(snapshot.territories).toEqual(game.territories);
  expect(snapshot.phase).toBe(game.getPhase());
});

test('setSelectedTerritory updates selection', () => {
  const players = [{ name: 'A' }, { name: 'B' }];
  const territories = [
    { id: 't1', neighbors: [], x: 0, y: 0 },
    { id: 't2', neighbors: [], x: 1, y: 1 },
  ];
  const game = new Game(players, territories, [], [], false, false);
  initGameState(game);
  const selected = game.territories[0];

  setSelectedTerritory(selected);
  expect(gameState.selectedTerritory).toBe(selected);

  setSelectedTerritory(null);
  expect(gameState.selectedTerritory).toBeNull();
});
