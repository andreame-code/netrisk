import attack from '../../src/game/rules/attack.js';

/**
 * Tests for the attack rule covering different battle outcomes.
 */
describe('attack rule', () => {
  test('attacker wins rolls but defender survives', () => {
    const state = {
      territories: [
        { id: 'a', owner: 0, armies: 5 },
        { id: 'b', owner: 1, armies: 3 },
      ],
    };
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.9) // attack 6
      .mockReturnValueOnce(0.8) // attack 5
      .mockReturnValueOnce(0.7) // attack 5
      .mockReturnValueOnce(0.1) // defend 1
      .mockReturnValueOnce(0.2); // defend 2
    const { state: newState, result } = attack(state, 'a', 'b');
    expect(result.conquered).toBe(false);
    expect(result.defenderLosses).toBe(2);
    expect(result.attackerLosses).toBe(0);
    const from = newState.territories.find((t) => t.id === 'a');
    const to = newState.territories.find((t) => t.id === 'b');
    expect(from.armies).toBe(5);
    expect(to.armies).toBe(1);
    Math.random.mockRestore();
  });

  test('defender wins rolls causing attacker losses', () => {
    const state = {
      territories: [
        { id: 'a', owner: 0, armies: 3 },
        { id: 'b', owner: 1, armies: 2 },
      ],
    };
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.1) // attack 1
      .mockReturnValueOnce(0.2) // attack 2
      .mockReturnValueOnce(0.9) // defend 6
      .mockReturnValueOnce(0.8); // defend 5
    const { state: newState, result } = attack(state, 'a', 'b');
    expect(result.conquered).toBe(false);
    expect(result.attackerLosses).toBe(2);
    expect(result.defenderLosses).toBe(0);
    const from = newState.territories.find((t) => t.id === 'a');
    const to = newState.territories.find((t) => t.id === 'b');
    expect(from.armies).toBe(1);
    expect(to.armies).toBe(2);
    Math.random.mockRestore();
  });

  test('attacker conquers territory when defender defeated', () => {
    const state = {
      territories: [
        { id: 'a', owner: 0, armies: 4 },
        { id: 'b', owner: 1, armies: 1 },
      ],
    };
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.9) // attack 6
      .mockReturnValueOnce(0.8) // attack 5
      .mockReturnValueOnce(0.7) // attack 5
      .mockReturnValueOnce(0.1); // defend 1
    const { state: newState, result } = attack(state, 'a', 'b');
    expect(result.conquered).toBe(true);
    expect(result.movableArmies).toBe(2);
    const from = newState.territories.find((t) => t.id === 'a');
    const to = newState.territories.find((t) => t.id === 'b');
    expect(from.armies).toBe(3);
    expect(to.owner).toBe(0);
    expect(to.armies).toBe(1);
    Math.random.mockRestore();
  });
});
