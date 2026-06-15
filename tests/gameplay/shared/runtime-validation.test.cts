const assert = require("node:assert/strict");
const {
  accountSettingsRequestSchema,
  accountSettingsResponseSchema,
  adminAuthoredModuleUpsertRequestSchema,
  authoredModuleSchema,
  authSessionResponseSchema,
  createGameRequestSchema,
  formatValidationPath,
  gameIdRequestSchema,
  gameListResponseSchema,
  gameMutationResponseSchema,
  loginRequestSchema,
  logoutResponseSchema,
  messagePayloadSchema,
  netRiskUiSlotContributionSchema,
  parseWithSchema,
  profileResponseSchema,
  registerRequestSchema,
  themePreferenceResponseSchema,
  transportErrorPayloadSchema,
  toValidationErrors
} = require("../../../shared/runtime-validation.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

register("shared runtime validation parses the auth/profile slice payloads", () => {
  const longLegacyPassword = "legacy-password-".repeat(8);
  const accountSettingsRequest = parseWithSchema(accountSettingsRequestSchema, {
    currentPassword: longLegacyPassword,
    email: "commander@example.com",
    newPassword: "newsecret",
    confirmNewPassword: "newsecret"
  });
  const accountSettingsResponse = parseWithSchema(accountSettingsResponseSchema, {
    ok: true,
    user: {
      id: "u-1",
      username: "commander",
      hasEmail: true,
      preferences: { theme: "command" }
    }
  });
  const loginRequest = parseWithSchema(loginRequestSchema, {
    username: "commander",
    password: longLegacyPassword
  });
  const sessionResponse = parseWithSchema(authSessionResponseSchema, {
    user: {
      id: "u-1",
      username: "commander",
      role: "user",
      authMethods: ["password"],
      hasEmail: false,
      preferences: { theme: "command" }
    }
  });
  const profileResponse = parseWithSchema(profileResponseSchema, {
    profile: {
      playerName: "commander",
      gamesPlayed: 3,
      wins: 2,
      losses: 1,
      gamesInProgress: 1,
      participatingGames: [
        {
          id: "g-1",
          name: "Campaign",
          phase: "lobby",
          playerCount: 1,
          updatedAt: new Date("2026-04-17T08:30:00.000Z").toISOString(),
          totalPlayers: 4,
          mapName: "World Classic",
          myLobby: {
            playerName: "commander",
            statusLabel: "In attesa avvio",
            focusLabel: "Teatro operativo",
            turnPhaseLabel: "Lobby",
            territoryCount: 0,
            cardCount: 0
          }
        }
      ],
      winRate: 67,
      hasHistory: true,
      placeholders: {
        recentGames: false,
        ranking: false
      },
      preferences: {
        theme: "command"
      }
    }
  });
  const themePreferenceResponse = parseWithSchema(themePreferenceResponseSchema, {
    ok: true,
    user: {
      id: "u-1",
      username: "commander"
    },
    preferences: {
      theme: "midnight"
    }
  });
  const gameIdRequest = parseWithSchema(gameIdRequestSchema, {
    gameId: "g-1"
  });
  const registerRequest = parseWithSchema(registerRequestSchema, {
    username: "commander",
    password: "secret123",
    email: "commander@example.com"
  });
  const gameListResponse = parseWithSchema(gameListResponseSchema, {
    games: [
      {
        id: "g-1",
        name: "Campaign",
        phase: "lobby",
        playerCount: 2,
        updatedAt: new Date("2026-04-17T08:30:00.000Z").toISOString(),
        totalPlayers: 4,
        mapName: "World Classic"
      }
    ],
    activeGameId: "g-1"
  });
  const gameMutationResponse = parseWithSchema(gameMutationResponseSchema, {
    ok: true,
    game: {
      id: "g-1",
      name: "Campaign"
    },
    games: [
      {
        id: "g-1",
        name: "Campaign",
        phase: "lobby",
        playerCount: 2,
        updatedAt: new Date("2026-04-17T08:30:00.000Z").toISOString()
      }
    ],
    activeGameId: "g-1",
    playerId: "p-1",
    user: {
      id: "u-1",
      username: "commander"
    }
  });
  const logoutResponse = parseWithSchema(logoutResponseSchema, {
    ok: true
  });
  const messagePayload = parseWithSchema(messagePayloadSchema, {
    message: "Everything is fine.",
    messageKey: "server.ok",
    messageParams: {
      scope: "auth"
    }
  });
  const transportErrorPayload = parseWithSchema(transportErrorPayloadSchema, {
    code: "REQUEST_VALIDATION_FAILED",
    error: "Richiesta non valida.",
    validationErrors: [
      {
        code: "invalid_type",
        path: "players.0.slot",
        message: "Expected number."
      }
    ]
  });

  assert.equal(accountSettingsRequest.currentPassword, longLegacyPassword);
  assert.equal(accountSettingsResponse.user.hasEmail, true);
  assert.equal(loginRequest.username, "commander");
  assert.equal(loginRequest.password, longLegacyPassword);
  assert.equal(sessionResponse.user.username, "commander");
  assert.equal(profileResponse.profile.participatingGames.length, 1);
  assert.equal(themePreferenceResponse.preferences.theme, "midnight");
  assert.equal(gameIdRequest.gameId, "g-1");
  assert.equal(registerRequest.email, "commander@example.com");
  assert.equal(gameListResponse.games[0].id, "g-1");
  assert.equal(gameMutationResponse.playerId, "p-1");
  assert.equal(logoutResponse.ok, true);
  assert.equal(messagePayload.messageKey, "server.ok");
  assert.equal(transportErrorPayload.validationErrors[0].path, "players.0.slot");
});

register("shared runtime validation exposes deterministic validation issue paths", () => {
  const invalidResponse = {
    profile: {
      playerName: 99,
      gamesPlayed: "three",
      wins: 2,
      losses: 1,
      gamesInProgress: 0,
      participatingGames: [],
      winRate: null,
      hasHistory: true,
      placeholders: {
        recentGames: false,
        ranking: false
      }
    }
  };

  const result = profileResponseSchema.safeParse(invalidResponse);
  assert.equal(result.success, false);

  const validationErrors = toValidationErrors(result.error);
  assert.deepEqual(
    validationErrors.map((entry: { code: string; path: string }) => ({
      code: entry.code,
      path: entry.path
    })),
    [
      { code: "invalid_type", path: "profile.playerName" },
      { code: "invalid_type", path: "profile.gamesPlayed" }
    ]
  );
  assert.ok(
    validationErrors.every(
      (entry: { message: string }) => typeof entry.message === "string" && entry.message.length > 0
    )
  );
});

register("shared runtime validation formats root issue paths deterministically", () => {
  assert.equal(formatValidationPath([]), "$");
  assert.equal(formatValidationPath(undefined), "$");
});

register("shared runtime validation validates lobby route payload shapes", () => {
  const longModuleId = "runtime-module-".repeat(8);
  const validCreateGameRequest = createGameRequestSchema.safeParse({
    activeModuleIds: [longModuleId]
  });
  const invalidGameList = gameListResponseSchema.safeParse({
    games: [
      {
        id: "g-1",
        name: "Campaign",
        phase: "lobby",
        playerCount: "two",
        updatedAt: new Date("2026-04-17T08:30:00.000Z").toISOString()
      }
    ]
  });
  const invalidJoinResponse = gameMutationResponseSchema.safeParse({
    user: {
      username: "commander"
    }
  });

  assert.equal(validCreateGameRequest.success, true);
  assert.equal(invalidGameList.success, false);
  assert.equal(invalidJoinResponse.success, false);
  assert.deepEqual(
    toValidationErrors(invalidGameList.error).map((entry: { path: string }) => entry.path),
    ["games.0.playerCount"]
  );
  assert.deepEqual(
    toValidationErrors(invalidJoinResponse.error).map((entry: { path: string }) => entry.path),
    ["user.id"]
  );
});

register("shared runtime validation constrains module UI slot routes to same-origin paths", () => {
  const validSlot = parseWithSchema(netRiskUiSlotContributionSchema, {
    slotId: "top-nav-bar",
    itemId: "demo.safe-route",
    title: "Demo Route",
    kind: "nav-item",
    route: " /modules/demo.safe?panel=overview#details "
  });
  assert.equal(validSlot.route, "/modules/demo.safe?panel=overview#details");

  const invalidRoutes = [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "https://example.test/modules/demo",
    "//example.test/modules/demo",
    "/\\example.test/modules/demo"
  ];

  invalidRoutes.forEach((route) => {
    const result = netRiskUiSlotContributionSchema.safeParse({
      slotId: "top-nav-bar",
      itemId: `demo.unsafe-route.${route.length}`,
      title: "Unsafe Route",
      kind: "nav-item",
      route
    });

    assert.equal(result.success, false, `Expected route to be rejected: ${route}`);
  });
});

register("shared runtime validation rejects passwords exceeding 128 characters", () => {
  const tooLongPassword = "a".repeat(129);

  const invalidLogin = loginRequestSchema.safeParse({
    username: "commander",
    password: tooLongPassword
  });
  assert.equal(invalidLogin.success, false);

  const invalidAccountSettings = accountSettingsRequestSchema.safeParse({
    currentPassword: tooLongPassword
  });
  assert.equal(invalidAccountSettings.success, false);

  const invalidRegister = registerRequestSchema.safeParse({
    username: "commander",
    password: tooLongPassword
  });
  assert.equal(invalidRegister.success, false);
});

register(
  "shared runtime validation bounds authored module requests without invalidating legacy storage",
  () => {
    const baseRequest = {
      id: "victory.request-limits",
      name: "Request Limits",
      description: "Valid authored module metadata.",
      version: "1.0.0",
      moduleType: "victory-objectives",
      content: {
        mapId: "world-classic",
        objectives: [
          {
            id: "hold-north-america",
            title: "Hold North America",
            description: "Control North America.",
            enabled: true,
            type: "control-continents",
            continentIds: ["north_america"]
          }
        ]
      }
    };

    const incompleteDraft = {
      ...baseRequest,
      name: "",
      description: "",
      version: "",
      content: {
        mapId: "",
        objectives: [
          {
            ...baseRequest.content.objectives[0],
            id: "",
            title: "",
            description: "",
            continentIds: [""]
          }
        ]
      }
    };

    assert.equal(adminAuthoredModuleUpsertRequestSchema.safeParse(incompleteDraft).success, true);

    const oversizedRequests = [
      { ...baseRequest, id: "a".repeat(65) },
      { ...baseRequest, name: "n".repeat(129) },
      { ...baseRequest, description: "d".repeat(1025) },
      { ...baseRequest, version: "v".repeat(33) },
      { ...baseRequest, content: { ...baseRequest.content, mapId: "m".repeat(65) } },
      {
        ...baseRequest,
        content: {
          ...baseRequest.content,
          objectives: [{ ...baseRequest.content.objectives[0], id: "o".repeat(65) }]
        }
      },
      {
        ...baseRequest,
        content: {
          ...baseRequest.content,
          objectives: [{ ...baseRequest.content.objectives[0], title: "t".repeat(256) }]
        }
      },
      {
        ...baseRequest,
        content: {
          ...baseRequest.content,
          objectives: [{ ...baseRequest.content.objectives[0], description: "d".repeat(1025) }]
        }
      },
      {
        ...baseRequest,
        content: {
          ...baseRequest.content,
          objectives: [{ ...baseRequest.content.objectives[0], continentIds: ["c".repeat(65)] }]
        }
      }
    ];

    oversizedRequests.forEach((request) => {
      assert.equal(adminAuthoredModuleUpsertRequestSchema.safeParse(request).success, false);
    });

    const legacyStoredModule = {
      ...baseRequest,
      name: "n".repeat(129),
      description: "d".repeat(1025),
      version: "v".repeat(33),
      content: {
        mapId: "m".repeat(65),
        objectives: [
          {
            ...baseRequest.content.objectives[0],
            id: "o".repeat(65),
            title: "t".repeat(256),
            description: "d".repeat(1025),
            continentIds: ["c".repeat(65)]
          }
        ]
      },
      status: "draft",
      createdAt: "2026-06-05T10:00:00.000Z",
      updatedAt: "2026-06-05T10:00:00.000Z"
    };

    assert.equal(authoredModuleSchema.safeParse(legacyStoredModule).success, true);
  }
);
