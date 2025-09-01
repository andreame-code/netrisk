import playCard from "../../src/game/rules/play-card.js";

describe("playCard", () => {
  test("awards +5 reinforcements for three of the same type", () => {
    const state = {
      currentPlayer: 0,
      hands: [
        [{ type: "infantry" }, { type: "infantry" }, { type: "infantry" }],
      ],
      reinforcements: 0,
    };

    const result = playCard(state, [0, 1, 2]);

    expect(result.played).toBe(true);
    expect(result.state.reinforcements).toBe(5);
  });

  test("awards +5 reinforcements for one of each type", () => {
    const state = {
      currentPlayer: 0,
      hands: [
        [{ type: "infantry" }, { type: "cavalry" }, { type: "artillery" }],
      ],
      reinforcements: 0,
    };

    const result = playCard(state, [0, 1, 2]);

    expect(result.played).toBe(true);
    expect(result.state.reinforcements).toBe(5);
  });

  test("returns played false for duplicates or missing cards", () => {
    const state = {
      currentPlayer: 0,
      hands: [
        [{ type: "infantry" }, { type: "infantry" }, { type: "cavalry" }],
      ],
      reinforcements: 0,
    };

    const duplicate = playCard(state, [0, 1, 2]);
    expect(duplicate.played).toBe(false);

    const missing = playCard(state, [0, 1, 3]);
    expect(missing.played).toBe(false);
  });
});
