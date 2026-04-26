const assert = require("node:assert/strict");
const { handleBasicGameActionRoute } = require("../../../backend/routes/game-actions-basic.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function createGameContext() {
  return {
    state: { phase: "active" },
    gameId: "game-1",
    version: 7,
    gameName: "Route Helper"
  };
}

register("handleBasicGameActionRoute returns false for unsupported action types", async () => {
  const handled = await handleBasicGameActionRoute(
    "unsupported",
    {},
    {},
    createGameContext(),
    "player-1",
    7,
    { id: "user-1" },
    () => {
      throw new Error("applyReinforcement should not run for unsupported actions.");
    },
    () => {
      throw new Error("moveAfterConquest should not run for unsupported actions.");
    },
    () => {
      throw new Error("applyFortify should not run for unsupported actions.");
    },
    async () => {
      throw new Error("persistGameContext should not run for unsupported actions.");
    },
    () => {
      throw new Error("broadcastGame should not run for unsupported actions.");
    },
    () => {
      throw new Error("snapshotForUser should not run for unsupported actions.");
    },
    () => false,
    () => true,
    () => {
      throw new Error("sendJson should not run for unsupported actions.");
    },
    () => {
      throw new Error("sendLocalizedError should not run for unsupported actions.");
    }
  );

  assert.equal(handled, false);
});

register(
  "handleBasicGameActionRoute reinforce stops cleanly on version conflicts",
  async () => {
    let broadcastCalls = 0;
    let sendJsonCalls = 0;
    let versionConflictCalls = 0;

    const handled = await handleBasicGameActionRoute(
      "reinforce",
      {},
      { territoryId: "aurora", amount: 2 },
      createGameContext(),
      "player-1",
      7,
      { id: "user-1" },
      () => ({ ok: true }),
      () => {
        throw new Error("moveAfterConquest should not run for reinforce.");
      },
      () => {
        throw new Error("applyFortify should not run for reinforce.");
      },
      async () => {
        throw new Error("stale version");
      },
      () => {
        broadcastCalls += 1;
      },
      () => ({ ok: true }),
      (error: unknown) => {
        versionConflictCalls += 1;
        return error instanceof Error && error.message === "stale version";
      },
      (territoryId: string) => territoryId === "aurora",
      () => {
        sendJsonCalls += 1;
      },
      () => {
        throw new Error("sendLocalizedError should not run for version conflicts.");
      }
    );

    assert.equal(handled, true);
    assert.equal(versionConflictCalls, 1);
    assert.equal(broadcastCalls, 0);
    assert.equal(sendJsonCalls, 0);
  }
);

register(
  "handleBasicGameActionRoute returns localized engine errors for move-after-conquest",
  async () => {
    let localizedErrorCall: any[] | null = null;

    const handled = await handleBasicGameActionRoute(
      "moveAfterConquest",
      {},
      { armies: 0 },
      createGameContext(),
      "player-1",
      7,
      { id: "user-1" },
      () => {
        throw new Error("applyReinforcement should not run for moveAfterConquest.");
      },
      () => ({
        ok: false,
        message: "Nessuna conquista in sospeso.",
        messageKey: "game.conquest.none"
      }),
      () => {
        throw new Error("applyFortify should not run for moveAfterConquest.");
      },
      async () => {
        throw new Error("persistGameContext should not run after a rejected conquest move.");
      },
      () => {
        throw new Error("broadcastGame should not run after a rejected conquest move.");
      },
      () => ({ ok: true }),
      () => false,
      () => true,
      () => {
        throw new Error("sendJson should not run after a rejected conquest move.");
      },
      (...args: any[]) => {
        localizedErrorCall = args;
      }
    );

    assert.equal(handled, true);
    assert.ok(localizedErrorCall);
    assert.equal(localizedErrorCall?.[1], 400);
    assert.equal(localizedErrorCall?.[3], "Nessuna conquista in sospeso.");
    assert.equal(localizedErrorCall?.[4], "game.conquest.none");
  }
);

register(
  "handleBasicGameActionRoute validates fortify territory ids before the engine runs",
  async () => {
    let localizedErrorCall: any[] | null = null;
    let fortifyCalls = 0;

    const handled = await handleBasicGameActionRoute(
      "fortify",
      {},
      { fromId: "aurora", toId: "invalid", armies: 3 },
      createGameContext(),
      "player-1",
      7,
      { id: "user-1" },
      () => {
        throw new Error("applyReinforcement should not run for fortify.");
      },
      () => {
        throw new Error("moveAfterConquest should not run for fortify.");
      },
      () => {
        fortifyCalls += 1;
        return { ok: true };
      },
      async () => {
        throw new Error("persistGameContext should not run for invalid territory ids.");
      },
      () => {
        throw new Error("broadcastGame should not run for invalid territory ids.");
      },
      () => ({ ok: true }),
      () => false,
      (territoryId: string) => territoryId === "aurora",
      () => {
        throw new Error("sendJson should not run for invalid fortify ids.");
      },
      (...args: any[]) => {
        localizedErrorCall = args;
      }
    );

    assert.equal(handled, true);
    assert.equal(fortifyCalls, 0);
    assert.ok(localizedErrorCall);
    assert.equal(localizedErrorCall?.[1], 400);
    assert.equal(localizedErrorCall?.[3], "Territorio non valido.");
    assert.equal(localizedErrorCall?.[4], "game.invalidTerritory");
  }
);
