const assert = require("node:assert/strict");
const {
  Roles,
  actorForUser,
  authorize,
  canCreateGame,
  canManageAdmin,
  canManageModules,
  canOpenGame,
  canReadGame,
  canStartGame
} = require("../../../backend/authorization.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function user(id: string, username: string, role?: string) {
  return { id, username, role };
}

function actor(id: string, username: string, role = Roles.USER) {
  return { id, username, role };
}

function assertAuthorizationError(fn: () => unknown, statusCode: number, code: string) {
  assert.throws(
    fn,
    (error: unknown) =>
      error instanceof Error &&
      (error as any).statusCode === statusCode &&
      (error as any).code === code
  );
}

register("authorization actor helpers normalize missing and admin users", () => {
  assert.equal(actorForUser(null), null);
  assert.deepEqual(actorForUser(user("u-1", "Alice")), {
    id: "u-1",
    username: "Alice",
    role: Roles.USER
  });
  assert.deepEqual(actorForUser(user("admin-1", "Admin", Roles.ADMIN)), {
    id: "admin-1",
    username: "Admin",
    role: Roles.ADMIN
  });
});

register("authorization creation and management helpers require the expected actor roles", () => {
  assert.equal(canCreateGame(null), false);
  assert.equal(canCreateGame(actor("", "Ghost")), false);
  assert.equal(canCreateGame(actor("u-1", "Alice", "spectator")), false);
  assert.equal(canCreateGame(actor("u-1", "Alice")), true);
  assert.equal(canCreateGame(actor("admin-1", "Admin", Roles.ADMIN)), true);

  assert.equal(canManageModules(null), false);
  assert.equal(canManageModules(actor("", "Admin", Roles.ADMIN)), false);
  assert.equal(canManageModules(actor("u-1", "Alice")), false);
  assert.equal(canManageModules(actor("admin-1", "Admin", Roles.ADMIN)), true);

  assert.equal(canManageAdmin(null), false);
  assert.equal(canManageAdmin(actor("", "Admin", Roles.ADMIN)), false);
  assert.equal(canManageAdmin(actor("u-1", "Alice")), false);
  assert.equal(canManageAdmin(actor("admin-1", "Admin", Roles.ADMIN)), true);
});

register(
  "authorization game opening covers admin, lobby, creator, player and fallback access",
  () => {
    const alice = actor("u-1", "Alice");
    const admin = actor("admin-1", "Admin", Roles.ADMIN);

    assert.equal(canOpenGame(null, { phase: "active", creatorUserId: "host" }, null), false);
    assert.equal(canOpenGame(actor("", "Alice"), { phase: "active" }, null), false);
    assert.equal(canOpenGame(alice, null, null), false);
    assert.equal(canOpenGame(admin, { phase: "active", creatorUserId: "host" }, null), true);
    assert.equal(canOpenGame(alice, { phase: "lobby", creatorUserId: "host" }, null), true);
    assert.equal(canOpenGame(alice, { phase: "active", creatorUserId: "u-1" }, null), true);
    assert.equal(
      canOpenGame(
        alice,
        { phase: "active", creatorUserId: "host" },
        {
          players: [{ linkedUserId: "u-1", name: "Someone" }]
        }
      ),
      true
    );
    assert.equal(
      canOpenGame(
        alice,
        { phase: "active", creatorUserId: "host" },
        {
          players: [{ linkedUserId: null, name: "Alice" }]
        }
      ),
      true
    );
    assert.equal(
      canOpenGame(alice, { phase: "active", creatorUserId: null }, { players: null }),
      true
    );
    assert.equal(
      canOpenGame(
        alice,
        { phase: "active", creatorUserId: "host" },
        {
          players: [{ linkedUserId: "other", name: "Bob" }]
        }
      ),
      false
    );
  }
);

register("authorization game reading mirrors member and public fallback access", () => {
  const alice = actor("u-1", "Alice");
  const admin = actor("admin-1", "Admin", Roles.ADMIN);

  assert.equal(canReadGame(null, { phase: "active", creatorUserId: "host" }, null), false);
  assert.equal(canReadGame(actor("", "Alice"), { phase: "active" }, null), false);
  assert.equal(canReadGame(alice, null, null), false);
  assert.equal(canReadGame(admin, { phase: "active", creatorUserId: "host" }, null), true);
  assert.equal(canReadGame(alice, { phase: "lobby", creatorUserId: "host" }, null), true);
  assert.equal(canReadGame(alice, { phase: "active", creatorUserId: "u-1" }, null), true);
  assert.equal(
    canReadGame(
      alice,
      { phase: "active", creatorUserId: "host" },
      {
        players: [{ linkedUserId: "u-1", name: "Someone" }]
      }
    ),
    true
  );
  assert.equal(
    canReadGame(
      alice,
      { phase: "active", creatorUserId: "host" },
      {
        players: [{ linkedUserId: null, name: "Alice" }]
      }
    ),
    true
  );
  assert.equal(
    canReadGame(alice, { phase: "active", creatorUserId: null }, { players: null }),
    true
  );
  assert.equal(
    canReadGame(
      alice,
      { phase: "active", creatorUserId: "host" },
      {
        players: [{ linkedUserId: "other", name: "Bob" }]
      }
    ),
    false
  );
});

register("authorization start game helper covers host, admin and legacy creatorless games", () => {
  const alice = actor("u-1", "Alice");
  const admin = actor("admin-1", "Admin", Roles.ADMIN);

  assert.equal(canStartGame(null, { creatorUserId: "u-1" }), false);
  assert.equal(canStartGame(actor("", "Alice"), { creatorUserId: "u-1" }), false);
  assert.equal(canStartGame(alice, null), false);
  assert.equal(canStartGame(admin, { creatorUserId: "host" }), true);
  assert.equal(canStartGame(alice, { creatorUserId: null }), true);
  assert.equal(canStartGame(alice, { creatorUserId: "u-1" }), true);
  assert.equal(canStartGame(alice, { creatorUserId: "host" }), false);
});

register("authorize returns actors for allowed policies and structured errors for denials", () => {
  assert.equal(authorize("game:create", { user: user("u-1", "Alice") }).actor.id, "u-1");
  assert.equal(
    authorize("game:open", {
      user: user("u-1", "Alice"),
      game: { phase: "active", creatorUserId: "host" },
      state: { players: [{ linkedUserId: "u-1", name: "Alice" }] }
    }).actor.username,
    "Alice"
  );
  assert.equal(
    authorize("game:read", {
      user: user("u-1", "Alice"),
      game: { phase: "active", creatorUserId: null },
      state: { players: null }
    }).actor.id,
    "u-1"
  );
  assert.equal(
    authorize("game:start", {
      user: user("admin-1", "Admin", Roles.ADMIN),
      game: { creatorUserId: "host" }
    }).actor.role,
    Roles.ADMIN
  );
  assert.equal(
    authorize("modules:manage", { user: user("admin-1", "Admin", Roles.ADMIN) }).ok,
    true
  );
  assert.equal(authorize("admin:manage", { user: user("admin-1", "Admin", Roles.ADMIN) }).ok, true);

  assertAuthorizationError(() => authorize("game:create"), 401, "AUTH_REQUIRED");
  assertAuthorizationError(
    () => authorize("game:create", { user: user("", "Ghost") }),
    403,
    "FORBIDDEN"
  );
  assertAuthorizationError(
    () =>
      authorize("game:open", {
        user: user("u-1", "Alice"),
        game: { phase: "active", creatorUserId: "host" },
        state: { players: [{ linkedUserId: "other", name: "Bob" }] }
      }),
    403,
    "MEMBER_ONLY"
  );
  assertAuthorizationError(
    () =>
      authorize("game:read", {
        user: user("u-1", "Alice"),
        game: { phase: "active", creatorUserId: "host" },
        state: { players: [] }
      }),
    403,
    "MEMBER_ONLY"
  );
  assertAuthorizationError(
    () => authorize("game:start", { user: user("u-1", "Alice"), game: { creatorUserId: "host" } }),
    403,
    "HOST_ONLY"
  );
  assertAuthorizationError(
    () => authorize("modules:manage", { user: user("u-1", "Alice") }),
    403,
    "ADMIN_ONLY"
  );
  assertAuthorizationError(
    () => authorize("admin:manage", { user: user("u-1", "Alice") }),
    403,
    "ADMIN_ONLY"
  );
  assertAuthorizationError(
    () => authorize("unknown:policy", { user: user("u-1", "Alice") }),
    500,
    "POLICY_NOT_IMPLEMENTED"
  );
});
