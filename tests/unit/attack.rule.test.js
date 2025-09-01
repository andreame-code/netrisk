import attack from "../../src/game/rules/attack.js";

describe("attack rule", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("attacker wins without conquest", () => {
    const state = {
      territories: [
        { id: "a", owner: 0, armies: 2 },
        { id: "b", owner: 1, armies: 2 },
      ],
    };
    jest
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.9) // attacker roll 6
      .mockReturnValueOnce(0.5) // defender roll 3
      .mockReturnValueOnce(0.6); // defender roll 4

    const { state: newState, result } = attack(state, "a", "b");
    const from = newState.territories.find((t) => t.id === "a");
    const to = newState.territories.find((t) => t.id === "b");

    expect(from.armies).toBe(2);
    expect(to.armies).toBe(1);
    expect(result.attackerLosses).toBe(0);
    expect(result.defenderLosses).toBe(1);
    expect(result.conquered).toBe(false);
    expect(result.movableArmies).toBe(0);
    expect(result.attackRolls).toEqual([6]);
    expect(result.defendRolls).toEqual([4, 3]);
  });

  test("defender wins", () => {
    const state = {
      territories: [
        { id: "a", owner: 0, armies: 2 },
        { id: "b", owner: 1, armies: 1 },
      ],
    };
    jest
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.2) // attacker roll 2
      .mockReturnValueOnce(0.9); // defender roll 6

    const { state: newState, result } = attack(state, "a", "b");
    const from = newState.territories.find((t) => t.id === "a");
    const to = newState.territories.find((t) => t.id === "b");

    expect(from.armies).toBe(1);
    expect(to.armies).toBe(1);
    expect(result.attackerLosses).toBe(1);
    expect(result.defenderLosses).toBe(0);
    expect(result.conquered).toBe(false);
    expect(result.movableArmies).toBe(0);
    expect(result.attackRolls).toEqual([2]);
    expect(result.defendRolls).toEqual([6]);
  });

  test("conquers territory", () => {
    const state = {
      territories: [
        { id: "a", owner: 0, armies: 3 },
        { id: "b", owner: 1, armies: 1 },
      ],
    };
    jest
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.9) // attacker roll 6
      .mockReturnValueOnce(0.8) // attacker roll 5
      .mockReturnValueOnce(0.2); // defender roll 2

    const { state: newState, result } = attack(state, "a", "b");
    const from = newState.territories.find((t) => t.id === "a");
    const to = newState.territories.find((t) => t.id === "b");

    expect(from.armies).toBe(2);
    expect(to.armies).toBe(1);
    expect(to.owner).toBe(0);
    expect(result.attackerLosses).toBe(0);
    expect(result.defenderLosses).toBe(1);
    expect(result.conquered).toBe(true);
    expect(result.movableArmies).toBe(1);
    expect(result.attackRolls).toEqual([6, 5]);
    expect(result.defendRolls).toEqual([2]);
  });
});
