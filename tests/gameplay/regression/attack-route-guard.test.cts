const assert = require("node:assert/strict");
const { handleAttackGameActionRoute } = require("../../../backend/routes/game-actions-attack.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

async function callAttackRoute(overrides: Record<string, any> = {}): Promise<any> {
  const calls: Record<string, any> = {
    broadcastCount: 0,
    handledVersionConflict: null,
    localizedError: null,
    persisted: false,
    sentJson: null
  };
  const gameContext = overrides.gameContext || {
    state: {},
    gameId: "g-1",
    version: 4,
    gameName: "Attack Guard"
  };

  const handled = await handleAttackGameActionRoute(
    Object.prototype.hasOwnProperty.call(overrides, "type") ? overrides.type : "attack",
    overrides.res || {},
    overrides.body || { fromId: "aurora", toId: "bastion", attackDice: 2 },
    gameContext,
    overrides.playerId || "p1",
    Object.prototype.hasOwnProperty.call(overrides, "expectedVersion")
      ? overrides.expectedVersion
      : 4,
    overrides.user || { id: "u1" },
    overrides.resolveAttack ||
      (() => ({
        ok: true
      })),
    overrides.resolveBanzaiAttack ||
      (() => ({
        ok: true,
        rounds: [{ round: 1 }]
      })),
    overrides.consumeQueuedAttackRandom || (() => null),
    overrides.persistGameContext ||
      (async () => {
        calls.persisted = true;
        return { version: 5 };
      }),
    overrides.broadcastGame ||
      (() => {
        calls.broadcastCount += 1;
      }),
    overrides.snapshotForUser || (() => ({ ok: true })),
    overrides.handleVersionConflict ||
      ((error: unknown) => {
        calls.handledVersionConflict = error;
        return false;
      }),
    overrides.isValidTerritoryId ||
      ((territoryId: string) => territoryId === "aurora" || territoryId === "bastion"),
    overrides.sendJson ||
      ((_res: unknown, statusCode: number, payload: Record<string, unknown>) => {
        calls.sentJson = { statusCode, payload };
      }),
    overrides.sendLocalizedError ||
      ((...args: any[]) => {
        calls.localizedError = args;
      })
  );

  return {
    ...calls,
    gameContext,
    handled
  };
}

register(
  "handleAttackGameActionRoute maps stale attack dice runtime errors to a localized 400",
  async () => {
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
  }
);

register(
  "handleAttackGameActionRoute falls back to engine randomness when no queued rolls exist",
  async () => {
    let receivedRandom: unknown = Symbol("unset");
    let sentPayload: Record<string, unknown> | null = null;

    const handled = await handleAttackGameActionRoute(
      "attack",
      {},
      { fromId: "aurora", toId: "bastion", attackDice: 3 },
      { state: {}, gameId: "g-1", version: 4, gameName: "Attack Guard" },
      "p1",
      4,
      { id: "u1" },
      (_state: unknown, _playerId: string, _fromId: string, _toId: string, random: unknown) => {
        receivedRandom = random;
        return { ok: true, rounds: [] };
      },
      () => {
        throw new Error("Banzai resolver should not run in this scenario.");
      },
      () => null,
      async () => ({ version: 5 }),
      () => {},
      () => ({ ok: true }),
      () => false,
      (territoryId: string) => territoryId === "aurora" || territoryId === "bastion",
      (_res: unknown, _statusCode: number, payload: Record<string, unknown>) => {
        sentPayload = payload;
      },
      () => {
        throw new Error(
          "sendLocalizedError should not run when the engine can use its default randomness."
        );
      }
    );

    assert.equal(handled, true);
    assert.equal(receivedRandom, undefined);
    assert.deepEqual(sentPayload, {
      ok: true,
      state: { ok: true },
      rounds: []
    });
  }
);

register("handleAttackGameActionRoute ignores unsupported action types", async () => {
  const result = await callAttackRoute({
    type: "reinforce",
    consumeQueuedAttackRandom: () => {
      throw new Error("Random queue should not be touched for unsupported action types.");
    },
    resolveAttack: () => {
      throw new Error("Attack resolver should not run for unsupported action types.");
    }
  });

  assert.equal(result.handled, false);
  assert.equal(result.localizedError, null);
  assert.equal(result.sentJson, null);
  assert.equal(result.persisted, false);
  assert.equal(result.broadcastCount, 0);
});

register(
  "handleAttackGameActionRoute rejects invalid territories before resolving combat",
  async () => {
    const result = await callAttackRoute({
      body: { fromId: "invalid-territory", toId: "bastion", attackDice: 1 },
      resolveAttack: () => {
        throw new Error("Attack resolver should not run for invalid route territory ids.");
      }
    });

    assert.equal(result.handled, true);
    assert.ok(result.localizedError);
    assert.equal(result.localizedError?.[1], 400);
    assert.equal(result.localizedError?.[3], "Territorio non valido.");
    assert.equal(result.localizedError?.[4], "game.invalidTerritory");
    assert.equal(result.persisted, false);
    assert.equal(result.broadcastCount, 0);
  }
);

register(
  "handleAttackGameActionRoute delegates banzai attacks with queued randomness",
  async () => {
    const queuedRandom = () => 0.5;
    let banzaiArgs: any[] | null = null;

    const result = await callAttackRoute({
      type: "attackBanzai",
      body: { fromId: "aurora", toId: "bastion", attackDice: "" },
      consumeQueuedAttackRandom: () => queuedRandom,
      resolveAttack: () => {
        throw new Error("Single attack resolver should not run for banzai attacks.");
      },
      resolveBanzaiAttack: (...args: any[]) => {
        banzaiArgs = args;
        return {
          ok: true,
          rounds: [{ round: 1, conqueredTerritory: true }]
        };
      }
    });

    assert.equal(result.handled, true);
    assert.ok(banzaiArgs);
    assert.equal(banzaiArgs?.[1], "p1");
    assert.equal(banzaiArgs?.[2], "aurora");
    assert.equal(banzaiArgs?.[3], "bastion");
    assert.equal(banzaiArgs?.[4], queuedRandom);
    assert.equal(banzaiArgs?.[5], null);
    assert.deepEqual(result.sentJson?.payload, {
      ok: true,
      state: { ok: true },
      rounds: [{ round: 1, conqueredTerritory: true }]
    });
    assert.equal(result.persisted, true);
    assert.equal(result.broadcastCount, 1);
  }
);

register("handleAttackGameActionRoute maps failed combat results to localized errors", async () => {
  const result = await callAttackRoute({
    resolveAttack: () => ({
      ok: false,
      message: "Attacco non consentito.",
      messageKey: "game.attack.blocked",
      messageParams: { reason: "phase" }
    })
  });

  assert.equal(result.handled, true);
  assert.ok(result.localizedError);
  assert.equal(result.localizedError?.[1], 400);
  assert.equal(result.localizedError?.[3], "Attacco non consentito.");
  assert.equal(result.localizedError?.[4], "game.attack.blocked");
  assert.deepEqual(result.localizedError?.[5], { reason: "phase" });
  assert.equal(result.persisted, false);
  assert.equal(result.sentJson, null);
});

register("handleAttackGameActionRoute maps defender dice runtime errors", async () => {
  const result = await callAttackRoute({
    resolveAttack: () => {
      throw new Error("Defender dice must be between 1 and 2.");
    }
  });

  assert.equal(result.handled, true);
  assert.ok(result.localizedError);
  assert.equal(result.localizedError?.[1], 400);
  assert.equal(result.localizedError?.[3], "Territori non validi.");
  assert.equal(result.localizedError?.[4], "game.attack.invalidTerritories");
  assert.equal(result.persisted, false);
});

register("handleAttackGameActionRoute rethrows unmapped resolver errors", async () => {
  await assert.rejects(
    () =>
      callAttackRoute({
        resolveAttack: () => {
          throw new Error("Unexpected resolver failure.");
        }
      }),
    /Unexpected resolver failure/
  );
});

register("handleAttackGameActionRoute stops response handling on version conflicts", async () => {
  const conflictError = new Error("Version conflict.");

  const result = await callAttackRoute({
    persistGameContext: async () => {
      throw conflictError;
    },
    handleVersionConflict: (error: unknown) => {
      assert.equal(error, conflictError);
      return true;
    }
  });

  assert.equal(result.handled, true);
  assert.equal(result.sentJson, null);
  assert.equal(result.localizedError, null);
  assert.equal(result.broadcastCount, 0);
});
