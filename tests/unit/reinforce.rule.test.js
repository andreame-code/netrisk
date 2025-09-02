import reinforce from '../../src/game/rules/reinforce.js';

describe('reinforce rule', () => {
  test("increments armies and decrements reinforcements for current player's territory", () => {
    const state = {
      currentPlayer: 0,
      reinforcements: 2,
      territories: [
        { id: 'a', owner: 0, armies: 1 },
        { id: 'b', owner: 1, armies: 2 },
      ],
    };

    const { state: newState } = reinforce(state, 'a');

    expect(newState.reinforcements).toBe(1);
    const territory = newState.territories.find((t) => t.id === 'a');
    expect(territory.armies).toBe(2);
  });

  test('no change when reinforcements are zero', () => {
    const state = {
      currentPlayer: 0,
      reinforcements: 0,
      territories: [{ id: 'a', owner: 0, armies: 1 }],
    };

    const { state: newState } = reinforce(state, 'a');

    expect(newState.reinforcements).toBe(0);
    expect(newState.territories[0].armies).toBe(1);
  });

  test.each([
    [
      'unowned territory',
      {
        currentPlayer: 0,
        reinforcements: 2,
        territories: [{ id: 'a', owner: 1, armies: 1 }],
      },
      'a',
    ],
    [
      'nonexistent territory',
      {
        currentPlayer: 0,
        reinforcements: 2,
        territories: [{ id: 'a', owner: 0, armies: 1 }],
      },
      'b',
    ],
  ])('no change when %s is provided', (_label, state, territoryId) => {
    const original = JSON.parse(JSON.stringify(state));

    const { state: newState } = reinforce(state, territoryId);

    expect(newState.reinforcements).toBe(original.reinforcements);
    expect(newState.territories).toEqual(original.territories);
  });
});
