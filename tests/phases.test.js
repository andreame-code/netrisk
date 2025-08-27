import PHASES, { REINFORCE, ATTACK, FORTIFY, GAME_OVER } from "../phases.js";

describe("PHASES constants", () => {
  test("have expected values", () => {
    expect(REINFORCE).toBe("reinforce");
    expect(ATTACK).toBe("attack");
    expect(FORTIFY).toBe("fortify");
    expect(GAME_OVER).toBe("gameover");
  });

  test("object is frozen", () => {
    expect(Object.isFrozen(PHASES)).toBe(true);
  });
});
