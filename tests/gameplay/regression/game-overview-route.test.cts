const assert = require("node:assert/strict");
const { handleGameOptionsRoute } = require("../../../backend/routes/game-overview.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("handleGameOptionsRoute exposes modular options for new game setup", () => {
  const payloads: Array<Record<string, unknown>> = [];

  handleGameOptionsRoute(
    {},
    () => [{ id: "classic" }],
    () => [{ id: "classic-mini" }],
    () => [{ id: "standard" }],
    () => [{ id: "conquest" }],
    () => [{ id: "command" }],
    () => [{ id: "classic-color" }],
    () => [12, 24],
    (_res: unknown, _statusCode: number, payload: Record<string, unknown>) => {
      payloads.push(payload);
    }
  );

  assert.equal(payloads.length, 1);
  assert.deepEqual(payloads[0].victoryRuleSets, [{ id: "conquest" }]);
  assert.deepEqual(payloads[0].themes, [{ id: "command" }]);
  assert.deepEqual(payloads[0].pieceSkins, [{ id: "classic-color" }]);
});
