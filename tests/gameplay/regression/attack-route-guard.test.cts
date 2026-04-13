const assert = require("node:assert/strict");
const { handleAttackGameActionRoute } = require("../../../backend/routes/game-actions-attack.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("handleAttackGameActionRoute maps stale attack dice runtime errors to a localized 400", async () => {
  let localizedErrorCall: any[] | null = null;

  const handled = await handleAttackGameActionRoute(
    "attack",
    {},
    { fromId: "aurora", toId: "bastion", attackDice: 3 },
    { state: {}, gameId: "g-1", version: 4, gameName: "Attack Guard" },
    "p1",
    4,
    { id: "u1" },
    () => {
      throw new Error("Attacker dice must be between 1 and 1.");
    },
    () => {
      throw new Error("Banzai resolver should not run in this scenario.");
    },
    () => null,
    async () => {
      throw new Error("Persist should not run after a rejected attack.");
    },
    () => {
      throw new Error("Broadcast should not run after a rejected attack.");
    },
    () => ({}),
    () => false,
    (territoryId: string) => territoryId === "aurora" || territoryId === "bastion",
    () => {
      throw new Error("sendJson should not be called for a mapped validation error.");
    },
    (...args: any[]) => {
      localizedErrorCall = args;
    }
  );

  assert.equal(handled, true);
  assert.ok(localizedErrorCall);
  assert.equal(localizedErrorCall?.[1], 400);
  assert.equal(localizedErrorCall?.[3], "Numero di dadi di attacco non valido.");
  assert.equal(localizedErrorCall?.[4], "game.attack.invalidDiceCount");
});
