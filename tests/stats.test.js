import { attachStatsListeners, getStats } from "../src/stats.js";
import { REINFORCE } from "../src/phases.js";

describe("stats tracking", () => {
  test("records armies and attacks per turn", () => {
    const game = {
      players: [{}, {}],
      territories: [
        { id: "a", owner: 0 },
        { id: "b", owner: 1 },
      ],
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
    attachStatsListeners(game);
    game.emit(REINFORCE, { player: 0 });
    game.emit("attackResolved", { result: { conquered: true } });
    game.emit("turnStart");
    const s = getStats();
    expect(s.armies[0][0]).toBe(1);
    expect(s.attacksWon[0][0]).toBe(1);
    expect(s.territories[0].length).toBe(2);
  });
});
