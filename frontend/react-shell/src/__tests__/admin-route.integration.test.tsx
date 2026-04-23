import { screen, waitFor } from "@testing-library/react";

import type {
  AdminAuthoredModuleDetailResponse,
  AdminAuthoredModuleEditorOptionsResponse,
  AdminAuthoredModuleMutationResponse,
  AdminAuthoredModulesListResponse,
  AdminAuthoredModuleValidateResponse,
  AdminConfigResponse,
  AdminGameDetailsResponse,
  AdminGamesResponse,
  AdminMaintenanceReport,
  AdminOverviewResponse,
  AdminUsersResponse,
  AuthSessionResponse,
  GameOptionsResponse,
  ModuleOptionsResponse
} from "@frontend-generated/shared-runtime-validation.mts";

import {
  createAdminAuthoredModule,
  disableAdminAuthoredModule,
  enableAdminAuthoredModule,
  getAdminAuthoredModule,
  getAdminContentStudioOptions,
  getAdminConfig,
  getAdminGameDetails,
  getAdminMaintenanceReport,
  getAdminOverview,
  getGameOptions,
  listAdminAuthoredModules,
  getModuleOptions,
  publishAdminAuthoredModule,
  getSession,
  listAdminGames,
  listAdminUsers,
  runAdminGameAction,
  runAdminMaintenanceAction,
  updateAdminAuthoredModule,
  updateAdminConfig,
  updateAdminUserRole,
  validateAdminAuthoredModule
} from "@frontend-core/api/client.mts";

import { renderReactShell } from "../../test/render-react-shell";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@frontend-core/api/client.mts", () => ({
  getSession: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getProfile: vi.fn(),
  updateThemePreference: vi.fn(),
  listGames: vi.fn(),
  getModuleOptions: vi.fn(),
  getGameOptions: vi.fn(),
  createGame: vi.fn(),
  openGame: vi.fn(),
  joinGame: vi.fn(),
  getAdminOverview: vi.fn(),
  getAdminContentStudioOptions: vi.fn(),
  listAdminAuthoredModules: vi.fn(),
  getAdminAuthoredModule: vi.fn(),
  validateAdminAuthoredModule: vi.fn(),
  createAdminAuthoredModule: vi.fn(),
  updateAdminAuthoredModule: vi.fn(),
  publishAdminAuthoredModule: vi.fn(),
  enableAdminAuthoredModule: vi.fn(),
  disableAdminAuthoredModule: vi.fn(),
  listAdminUsers: vi.fn(),
  updateAdminUserRole: vi.fn(),
  listAdminGames: vi.fn(),
  getAdminGameDetails: vi.fn(),
  runAdminGameAction: vi.fn(),
  getAdminConfig: vi.fn(),
  updateAdminConfig: vi.fn(),
  getAdminMaintenanceReport: vi.fn(),
  runAdminMaintenanceAction: vi.fn(),
  getAdminAudit: vi.fn()
}));

const getAdminOverviewMock = vi.mocked(getAdminOverview);
const getAdminContentStudioOptionsMock = vi.mocked(getAdminContentStudioOptions);
const listAdminAuthoredModulesMock = vi.mocked(listAdminAuthoredModules);
const getAdminAuthoredModuleMock = vi.mocked(getAdminAuthoredModule);
const validateAdminAuthoredModuleMock = vi.mocked(validateAdminAuthoredModule);
const createAdminAuthoredModuleMock = vi.mocked(createAdminAuthoredModule);
const updateAdminAuthoredModuleMock = vi.mocked(updateAdminAuthoredModule);
const publishAdminAuthoredModuleMock = vi.mocked(publishAdminAuthoredModule);
const enableAdminAuthoredModuleMock = vi.mocked(enableAdminAuthoredModule);
const disableAdminAuthoredModuleMock = vi.mocked(disableAdminAuthoredModule);
const getAdminConfigMock = vi.mocked(getAdminConfig);
const getAdminGameDetailsMock = vi.mocked(getAdminGameDetails);
const getAdminMaintenanceReportMock = vi.mocked(getAdminMaintenanceReport);
const getGameOptionsMock = vi.mocked(getGameOptions);
const getModuleOptionsMock = vi.mocked(getModuleOptions);
const getSessionMock = vi.mocked(getSession);
const listAdminGamesMock = vi.mocked(listAdminGames);
const listAdminUsersMock = vi.mocked(listAdminUsers);
const runAdminGameActionMock = vi.mocked(runAdminGameAction);
const runAdminMaintenanceActionMock = vi.mocked(runAdminMaintenanceAction);
const updateAdminConfigMock = vi.mocked(updateAdminConfig);
const updateAdminUserRoleMock = vi.mocked(updateAdminUserRole);

function createAuthRequiredError(): Error & { code: string } {
  const error = new Error("Sign in to continue.") as Error & { code: string };
  error.code = "AUTH_REQUIRED";
  return error;
}

function createSession(theme = "command", role?: string): AuthSessionResponse {
  return {
    user: {
      id: "user-1",
      username: "Commander",
      ...(role ? { role } : {}),
      preferences: {
        theme
      }
    }
  };
}

function emptyModuleOptions(): ModuleOptionsResponse {
  return {
    modules: [],
    enabledModules: [],
    gameModules: [],
    content: {},
    gamePresets: [],
    uiSlots: [],
    contentProfiles: [],
    gameplayProfiles: [],
    uiProfiles: []
  };
}

function createOverviewResponse(): AdminOverviewResponse {
  return {
    summary: {
      totalUsers: 12,
      adminUsers: 2,
      activeGames: 3,
      lobbyGames: 4,
      finishedGames: 18,
      staleLobbies: 1,
      invalidGames: 1,
      enabledModules: 2
    },
    config: {
      defaults: {
        contentPackId: "core",
        ruleSetId: "classic",
        mapId: "middle-earth",
        themeId: "ember",
        activeModuleIds: ["demo.runtime"]
      },
      maintenance: {
        staleLobbyDays: 5,
        auditLogLimit: 120
      },
      updatedAt: "2026-04-21T10:00:00.000Z",
      updatedBy: {
        id: "admin-1",
        username: "Commander",
        role: "admin",
        preferences: {
          theme: "ember"
        }
      }
    },
    recentGames: [
      {
        id: "game-1",
        name: "Border Siege",
        phase: "active",
        playerCount: 3,
        updatedAt: "2026-04-21T11:00:00.000Z",
        stale: false,
        health: "warning",
        issueCount: 1,
        issues: [
          {
            code: "invalid-turn-index",
            severity: "warning",
            message: "Current turn index is invalid.",
            gameId: "game-1"
          }
        ]
      }
    ],
    issues: [
      {
        code: "stale-lobby",
        severity: "warning",
        message: "A lobby is stale.",
        gameId: "game-2",
        actionId: "cleanup-stale-lobbies"
      }
    ],
    audit: [
      {
        id: "audit-1",
        actorId: "admin-1",
        actorUsername: "Commander",
        action: "config.update",
        targetType: "config",
        targetId: "global",
        targetLabel: "Global defaults",
        result: "success",
        createdAt: "2026-04-21T10:00:00.000Z",
        details: null
      }
    ]
  };
}

function createAuditEntry(
  overrides: Partial<AdminOverviewResponse["audit"][number]> = {}
): AdminOverviewResponse["audit"][number] {
  return {
    id: "audit-1",
    actorId: "admin-1",
    actorUsername: "Commander",
    action: "config.update",
    targetType: "config",
    targetId: "global",
    targetLabel: "Global defaults",
    result: "success",
    createdAt: "2026-04-21T10:00:00.000Z",
    details: null,
    ...overrides
  };
}

function createUserSummary(
  overrides: Partial<AdminUsersResponse["users"][number]> = {}
): AdminUsersResponse["users"][number] {
  return {
    id: "user-2",
    username: "Strategist",
    role: "user",
    hasEmail: true,
    preferences: {
      theme: "ember"
    },
    createdAt: "2026-04-20T08:00:00.000Z",
    gamesPlayed: 7,
    gamesInProgress: 2,
    wins: 3,
    canPromote: true,
    canDemote: false,
    ...overrides
  };
}

function createUsersResponse(): AdminUsersResponse {
  return {
    users: [createUserSummary()],
    total: 1,
    filteredTotal: 1,
    query: "",
    role: null
  };
}

function createGameSummary(
  overrides: Partial<AdminGamesResponse["games"][number]> = {}
): AdminGamesResponse["games"][number] {
  return {
    id: "game-1",
    name: "Border Siege",
    phase: "lobby",
    playerCount: 3,
    updatedAt: "2026-04-21T11:00:00.000Z",
    contentPackId: "core",
    diceRuleSetId: "standard-dice",
    totalPlayers: 4,
    mapName: "Middle Earth",
    mapId: "middle-earth",
    aiCount: 0,
    creatorUserId: "user-1",
    activeModules: [{ id: "demo.runtime", version: "1.0.0" }],
    gamePresetId: "preset-1",
    contentProfileId: "content-profile",
    gameplayProfileId: "gameplay-profile",
    uiProfileId: "ui-profile",
    stale: false,
    health: "warning",
    issueCount: 1,
    issues: [
      {
        code: "invalid-turn-index",
        severity: "warning",
        message: "Current turn index is invalid.",
        gameId: "game-1"
      }
    ],
    ...overrides
  };
}

function createGamesResponse(): AdminGamesResponse {
  return {
    games: [createGameSummary()],
    total: 1,
    filteredTotal: 1,
    status: null,
    query: ""
  };
}

function createGameDetailsResponse(): AdminGameDetailsResponse {
  return {
    game: createGameSummary(),
    players: [
      {
        id: "player-1",
        name: "Commander",
        linkedUserId: "user-1",
        isAi: false,
        surrendered: false,
        territoryCount: 12,
        cardCount: 3
      }
    ],
    rawState: {
      phase: "lobby",
      turnIndex: 0
    }
  };
}

function createAdminConfigResponse(): AdminConfigResponse {
  return {
    config: {
      defaults: {
        totalPlayers: 4,
        contentPackId: "core",
        ruleSetId: "classic",
        mapId: "middle-earth",
        diceRuleSetId: "standard-dice",
        victoryRuleSetId: "classic-victory",
        pieceSetId: "wooden-armies",
        themeId: "ember",
        pieceSkinId: "standard-skin",
        gamePresetId: "preset-1",
        contentProfileId: "content-profile",
        gameplayProfileId: "gameplay-profile",
        uiProfileId: "ui-profile",
        turnTimeoutHours: 24,
        activeModuleIds: ["demo.runtime"]
      },
      maintenance: {
        staleLobbyDays: 5,
        auditLogLimit: 120
      },
      updatedAt: "2026-04-21T10:00:00.000Z",
      updatedBy: {
        id: "admin-1",
        username: "Commander",
        role: "admin",
        preferences: {
          theme: "ember"
        }
      }
    }
  };
}

function createGameOptionsResponse(): GameOptionsResponse {
  return {
    ruleSets: [
      {
        id: "classic",
        name: "Classic",
        defaults: {
          extensionSchemaVersion: 1,
          mapId: "middle-earth",
          diceRuleSetId: "standard-dice",
          victoryRuleSetId: "classic-victory",
          themeId: "ember",
          pieceSkinId: "standard-skin"
        },
        defaultDiceRuleSetId: "standard-dice",
        defaultVictoryRuleSetId: "classic-victory"
      }
    ],
    maps: [
      {
        id: "middle-earth",
        name: "Middle Earth",
        territoryCount: 42,
        continentCount: 6
      }
    ],
    diceRuleSets: [
      {
        id: "standard-dice",
        name: "Standard dice",
        attackerMaxDice: 3,
        defenderMaxDice: 2
      }
    ],
    victoryRuleSets: [
      {
        id: "classic-victory",
        name: "Classic victory",
        description: "Hold the world."
      }
    ],
    themes: [
      {
        id: "ember",
        name: "Ember",
        description: "Warm operator theme."
      }
    ],
    pieceSkins: [
      {
        id: "standard-skin",
        name: "Standard skin",
        description: "Default board skin.",
        renderStyleId: "standard",
        usesPlayerColor: true
      }
    ],
    modules: [
      {
        id: "demo.runtime",
        version: "1.0.0",
        displayName: "Demo Runtime",
        description: "Optional runtime module.",
        kind: "runtime",
        sourcePath: "modules/demo.runtime",
        status: "ready",
        enabled: true,
        compatible: true,
        warnings: [],
        errors: [],
        capabilities: []
      }
    ],
    enabledModules: [{ id: "demo.runtime", version: "1.0.0" }],
    gamePresets: [
      {
        id: "preset-1",
        name: "Standard preset",
        description: "Default runtime preset.",
        activeModuleIds: ["demo.runtime"],
        defaults: {
          ruleSetId: "classic",
          mapId: "middle-earth",
          diceRuleSetId: "standard-dice",
          victoryRuleSetId: "classic-victory",
          themeId: "ember",
          pieceSkinId: "standard-skin",
          pieceSetId: "wooden-armies"
        }
      }
    ],
    contentProfiles: [
      {
        id: "content-profile",
        name: "Core Content",
        description: "Default content profile.",
        moduleId: "demo.runtime"
      }
    ],
    gameplayProfiles: [
      {
        id: "gameplay-profile",
        name: "Classic Gameplay",
        description: "Default gameplay profile.",
        moduleId: "demo.runtime"
      }
    ],
    uiProfiles: [
      {
        id: "ui-profile",
        name: "Ops UI",
        description: "Default UI profile.",
        moduleId: "demo.runtime"
      }
    ],
    uiSlots: [],
    playerPieceSets: [
      {
        id: "wooden-armies",
        name: "Wooden armies",
        paletteSize: 6
      }
    ],
    contentPacks: [
      {
        id: "core",
        name: "Core Pack",
        description: "Core content pack.",
        defaultSiteThemeId: "ember",
        defaultMapId: "middle-earth",
        defaultDiceRuleSetId: "standard-dice",
        defaultCardRuleSetId: "classic-cards",
        defaultVictoryRuleSetId: "classic-victory",
        defaultPieceSetId: "wooden-armies"
      }
    ],
    turnTimeoutHoursOptions: [12, 24, 48],
    playerRange: {
      min: 2,
      max: 6
    }
  };
}

function createMaintenanceReport(): AdminMaintenanceReport {
  return {
    summary: {
      totalGames: 4,
      staleLobbies: 1,
      invalidGames: 1,
      orphanedModuleReferences: 0
    },
    issues: [
      {
        code: "stale-lobby",
        severity: "warning",
        message: "A lobby is stale.",
        gameId: "game-2",
        actionId: "cleanup-stale-lobbies"
      }
    ]
  };
}

function createContentStudioOptionsResponse(): AdminAuthoredModuleEditorOptionsResponse {
  return {
    moduleTypes: ["victory-objectives"],
    maps: [
      {
        id: "classic-mini",
        name: "Classic Mini",
        territoryCount: 42,
        continentCount: 6,
        continents: [
          {
            id: "north_america",
            name: "North America",
            bonus: 5,
            territoryCount: 9
          },
          {
            id: "asia",
            name: "Asia",
            bonus: 7,
            territoryCount: 12
          }
        ]
      }
    ]
  };
}

function createAuthoredModuleDetail(
  overrides: Partial<AdminAuthoredModuleDetailResponse["module"]> = {}
): AdminAuthoredModuleDetailResponse {
  return {
    module: {
      id: "victory.na-asia",
      name: "North America and Asia",
      description: "Control both continents simultaneously.",
      version: "1.0.0",
      status: "draft",
      moduleType: "victory-objectives",
      createdAt: "2026-04-21T09:00:00.000Z",
      updatedAt: "2026-04-21T10:00:00.000Z",
      content: {
        mapId: "classic-mini",
        objectives: [
          {
            id: "hold-na-asia",
            title: "Hold North America and Asia",
            description: "Control North America and Asia at the same time.",
            enabled: true,
            type: "control-continents",
            continentIds: ["north_america", "asia"]
          }
        ]
      },
      ...overrides
    },
    validation: {
      valid: true,
      errors: [],
      warnings: []
    },
    preview: {
      summary: "Win condition: Control North America and Asia simultaneously.",
      objectiveSummaries: ["Control North America and Asia simultaneously."]
    },
    runtime: {
      id: "victory.na-asia",
      name: "North America and Asia",
      description: "Control both continents simultaneously.",
      version: "1.0.0",
      moduleType: "victory-objectives",
      kind: "authored-victory-objectives",
      map: {
        id: "classic-mini",
        name: "Classic Mini",
        territoryCount: 42,
        continentCount: 6
      },
      objectives: [
        {
          id: "hold-na-asia",
          title: "Hold North America and Asia",
          description: "Control North America and Asia at the same time.",
          enabled: true,
          type: "control-continents",
          continentIds: ["north_america", "asia"],
          continentNames: ["North America", "Asia"],
          summary: "Control North America and Asia simultaneously."
        }
      ],
      preview: {
        summary: "Win condition: Control North America and Asia simultaneously.",
        objectiveSummaries: ["Control North America and Asia simultaneously."]
      }
    }
  };
}

function createAuthoredModulesResponse(): AdminAuthoredModulesListResponse {
  const detail = createAuthoredModuleDetail();

  return {
    modules: [
      {
        ...detail.module,
        validation: detail.validation,
        preview: detail.preview,
        map: {
          id: "classic-mini",
          name: "Classic Mini",
          territoryCount: 42,
          continentCount: 6
        },
        objectiveCount: 1,
        enabledObjectiveCount: 1
      }
    ]
  };
}

function createAuthoredValidationResponse(): AdminAuthoredModuleValidateResponse {
  const detail = createAuthoredModuleDetail();

  return {
    validation: detail.validation,
    preview: detail.preview,
    runtime: detail.runtime
  };
}

function createAuthoredMutationResponse(
  overrides: Partial<AdminAuthoredModuleDetailResponse["module"]> = {}
): AdminAuthoredModuleMutationResponse {
  const detail = createAuthoredModuleDetail(overrides);

  return {
    ok: true,
    module: detail.module,
    validation: detail.validation,
    preview: detail.preview,
    runtime: detail.runtime,
    audit: createAuditEntry({
      action: "content-studio.module.save-draft",
      targetType: "authored-module",
      targetId: detail.module.id,
      targetLabel: detail.module.name
    })
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getModuleOptionsMock.mockResolvedValue(emptyModuleOptions());
  getAdminOverviewMock.mockResolvedValue(createOverviewResponse());
  getAdminContentStudioOptionsMock.mockResolvedValue(createContentStudioOptionsResponse());
  listAdminAuthoredModulesMock.mockResolvedValue(createAuthoredModulesResponse());
  getAdminAuthoredModuleMock.mockResolvedValue(createAuthoredModuleDetail());
  validateAdminAuthoredModuleMock.mockResolvedValue(createAuthoredValidationResponse());
  createAdminAuthoredModuleMock.mockResolvedValue(createAuthoredMutationResponse());
  updateAdminAuthoredModuleMock.mockResolvedValue(createAuthoredMutationResponse());
  publishAdminAuthoredModuleMock.mockResolvedValue(
    createAuthoredMutationResponse({
      status: "published"
    })
  );
  enableAdminAuthoredModuleMock.mockResolvedValue(
    createAuthoredMutationResponse({
      status: "published"
    })
  );
  disableAdminAuthoredModuleMock.mockResolvedValue(
    createAuthoredMutationResponse({
      status: "disabled"
    })
  );
  getSessionMock.mockResolvedValue(createSession("ember", "admin"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Admin route integration", () => {
  it("redirects unauthenticated admin traffic to the login route", async () => {
    getSessionMock.mockRejectedValue(createAuthRequiredError());

    renderReactShell("/react/admin");

    expect(await screen.findByTestId("react-shell-login-page")).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/react/login");
    });
  });

  it("blocks authenticated non-admin users and hides the admin navigation link", async () => {
    getSessionMock.mockResolvedValue(createSession("command"));

    renderReactShell("/react/admin");

    expect(await screen.findByTestId("admin-forbidden-page")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("loads the real admin overview for admin sessions", async () => {
    getSessionMock.mockResolvedValue(createSession("ember", "admin"));

    renderReactShell("/react/admin");

    expect(await screen.findByTestId("admin-route-page")).toBeInTheDocument();
    expect(await screen.findByText("Operator console")).toBeInTheDocument();
    expect(await screen.findByText("Operational command center")).toBeInTheDocument();
    expect(screen.getByText("Monitor")).toBeInTheDocument();
    expect(screen.getByText("Operate")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByText("Current server defaults")).toBeInTheDocument();
    expect(screen.getByText("Latest admin actions")).toBeInTheDocument();
  });

  it("requires confirmation before clearing config overrides and saving the reset", async () => {
    getAdminConfigMock.mockResolvedValue(createAdminConfigResponse());
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());
    updateAdminConfigMock.mockResolvedValue({
      ok: true,
      config: createAdminConfigResponse().config,
      audit: createAuditEntry()
    });

    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const { user } = renderReactShell("/react/admin/config");

    const ruleSetField = (await screen.findByRole("combobox", {
      name: /Rule set/i
    })) as HTMLSelectElement;
    expect(ruleSetField.value).toBe("classic");

    await user.click(screen.getByRole("button", { name: "Clear default overrides" }));

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("Clear all configured default overrides")
    );
    expect(ruleSetField.value).toBe("classic");
    expect(updateAdminConfigMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Clear default overrides" }));

    await waitFor(() => {
      expect(ruleSetField.value).toBe("");
    });

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateAdminConfigMock).toHaveBeenCalledWith(
        {
          defaults: {
            totalPlayers: null,
            contentPackId: null,
            ruleSetId: null,
            mapId: null,
            diceRuleSetId: null,
            victoryRuleSetId: null,
            pieceSetId: null,
            themeId: null,
            pieceSkinId: null,
            gamePresetId: null,
            contentProfileId: null,
            gameplayProfileId: null,
            uiProfileId: null,
            turnTimeoutHours: null,
            activeModuleIds: []
          },
          maintenance: {
            staleLobbyDays: 5,
            auditLogLimit: 120
          }
        },
        expect.anything()
      );
    });
  });

  it("requires confirmation before changing a user role", async () => {
    const usersResponse = createUsersResponse();
    listAdminUsersMock.mockResolvedValue(usersResponse);
    updateAdminUserRoleMock.mockResolvedValue({
      ok: true,
      user: createUserSummary({ role: "admin", canPromote: false, canDemote: true }),
      audit: createAuditEntry({
        action: "user.role.update",
        targetType: "user",
        targetId: "user-2",
        targetLabel: "Strategist"
      })
    });

    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const { user } = renderReactShell("/react/admin/users");

    await screen.findByText("Strategist");

    await user.click(screen.getByRole("button", { name: "Promote to admin" }));

    expect(confirmSpy).toHaveBeenCalledWith("Promote Strategist to administrator?");
    expect(updateAdminUserRoleMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Promote to admin" }));

    await waitFor(() => {
      expect(updateAdminUserRoleMock).toHaveBeenCalledWith(
        {
          userId: usersResponse.users[0].id,
          role: "admin"
        },
        expect.anything()
      );
    });
  });

  it("guards destructive game actions when typed confirmation is cancelled", async () => {
    listAdminGamesMock.mockResolvedValue(createGamesResponse());
    getAdminGameDetailsMock.mockResolvedValue(createGameDetailsResponse());
    runAdminGameActionMock.mockResolvedValue({
      ok: true,
      game: createGameSummary({ phase: "finished", health: "ok", issueCount: 0, issues: [] }),
      players: createGameDetailsResponse().players,
      rawState: {
        phase: "finished"
      },
      audit: createAuditEntry({
        action: "game.close-lobby",
        targetType: "game",
        targetId: "game-1",
        targetLabel: "Border Siege"
      })
    });

    const promptSpy = vi
      .spyOn(window, "prompt")
      .mockReturnValueOnce(null)
      .mockReturnValueOnce("game-1");
    const { user } = renderReactShell("/react/admin/games");

    await screen.findByText("Inspect lobbies and sessions");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Close lobby" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Close lobby" }));

    expect(promptSpy).toHaveBeenCalledWith("Type game-1 to confirm close-lobby.");
    expect(runAdminGameActionMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Close lobby" }));

    await waitFor(() => {
      expect(runAdminGameActionMock).toHaveBeenCalledWith(
        {
          gameId: "game-1",
          action: "close-lobby",
          confirmation: "game-1"
        },
        expect.anything()
      );
    });
  });

  it("guards stale-lobby cleanup when the typed confirmation is cancelled", async () => {
    const report = createMaintenanceReport();
    getAdminMaintenanceReportMock.mockResolvedValue(report);
    runAdminMaintenanceActionMock.mockResolvedValue({
      ok: true,
      report,
      affectedGameIds: ["game-2"],
      audit: createAuditEntry({
        action: "maintenance.cleanup-stale-lobbies",
        targetType: "maintenance",
        targetId: "cleanup-stale-lobbies",
        targetLabel: "Stale lobbies"
      })
    });

    const promptSpy = vi
      .spyOn(window, "prompt")
      .mockReturnValueOnce(null)
      .mockReturnValueOnce("cleanup-stale-lobbies");
    const { user } = renderReactShell("/react/admin/maintenance");

    await screen.findByText("Validation and repair operations");

    await user.click(screen.getByRole("button", { name: "Cleanup stale lobbies" }));

    expect(promptSpy).toHaveBeenCalledWith("Type cleanup-stale-lobbies to confirm cleanup.");
    expect(runAdminMaintenanceActionMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cleanup stale lobbies" }));

    await waitFor(() => {
      expect(runAdminMaintenanceActionMock).toHaveBeenCalledWith(
        {
          action: "cleanup-stale-lobbies",
          confirmation: "cleanup-stale-lobbies"
        },
        expect.anything()
      );
    });
  });

  it("loads the content studio editor, shows preview data, and saves a draft", async () => {
    const { user } = renderReactShell("/react/admin/content-studio");

    expect(await screen.findByText("Author victory objective modules")).toBeInTheDocument();
    expect(await screen.findByText("North America and Asia")).toBeInTheDocument();
    expect(
      await screen.findByText("Win condition: Control North America and Asia simultaneously.")
    ).toBeInTheDocument();

    const nameField = (await screen.findByRole("textbox", {
      name: "Name"
    })) as HTMLInputElement;
    expect(nameField.value).toBe("North America and Asia");

    await user.clear(nameField);
    await user.type(nameField, "Updated objective module");

    await waitFor(() => {
      expect(validateAdminAuthoredModuleMock).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(updateAdminAuthoredModuleMock).toHaveBeenCalledWith(
        "victory.na-asia",
        expect.objectContaining({
          id: "victory.na-asia",
          name: "Updated objective module",
          moduleType: "victory-objectives"
        }),
        expect.anything()
      );
    });

    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(publishAdminAuthoredModuleMock).toHaveBeenCalledWith(
        "victory.na-asia",
        expect.anything()
      );
    });

    expect(screen.getByText("Engine-ready JSON")).toBeInTheDocument();
    expect(screen.getByText(/authored-victory-objectives/)).toBeInTheDocument();
  });
  it("keeps generated objective ids unique after removing an existing objective", async () => {
    const detail = createAuthoredModuleDetail({
      content: {
        mapId: "classic-mini",
        objectives: [
          {
            id: "objective-1",
            title: "First objective",
            description: "Original first objective.",
            enabled: true,
            type: "control-continents",
            continentIds: ["north_america"]
          },
          {
            id: "objective-2",
            title: "Second objective",
            description: "Original second objective.",
            enabled: true,
            type: "control-territory-count",
            territoryCount: 12
          }
        ]
      }
    });
    getAdminAuthoredModuleMock.mockResolvedValue(detail);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user } = renderReactShell("/react/admin/content-studio");

    expect(await screen.findByText("Author victory objective modules")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("objective-1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove objective" }));
    await user.click(screen.getByRole("button", { name: "Add territory objective" }));

    expect(confirmSpy).toHaveBeenCalledWith(
      'Remove objective "objective-1" from this draft? This change is not reversible.'
    );
    expect(await screen.findByDisplayValue("objective-3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(updateAdminAuthoredModuleMock).toHaveBeenCalledWith(
        "victory.na-asia",
        expect.objectContaining({
          content: expect.objectContaining({
            objectives: expect.arrayContaining([
              expect.objectContaining({ id: "objective-2" }),
              expect.objectContaining({ id: "objective-3" })
            ])
          })
        }),
        expect.anything()
      );
    });
  });

  it("starts a new draft with a generated module id and saves it", async () => {
    const { user } = renderReactShell("/react/admin/content-studio");

    expect(await screen.findByText("Author victory objective modules")).toBeInTheDocument();

    validateAdminAuthoredModuleMock.mockClear();
    createAdminAuthoredModuleMock.mockClear();
    createAdminAuthoredModuleMock
      .mockResolvedValueOnce(
        createAuthoredMutationResponse({
          id: "victory.new-draft"
        })
      )
      .mockResolvedValueOnce(
        createAuthoredMutationResponse({
          id: "victory.new-draft-2"
        })
      );

    await user.click(screen.getByRole("button", { name: "New draft" }));

    const moduleIdField = (await screen.findByDisplayValue(
      "victory.new-draft"
    )) as HTMLInputElement;
    expect(moduleIdField.value).toBe("victory.new-draft");

    await waitFor(() => {
      expect(validateAdminAuthoredModuleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "victory.new-draft",
          moduleType: "victory-objectives"
        }),
        expect.anything()
      );
    });

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(createAdminAuthoredModuleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "victory.new-draft",
          moduleType: "victory-objectives"
        }),
        expect.anything()
      );
    });

    await user.click(screen.getByRole("button", { name: "New draft" }));

    const nextModuleIdField = (await screen.findByDisplayValue(
      "victory.new-draft-2"
    )) as HTMLInputElement;
    expect(nextModuleIdField.value).toBe("victory.new-draft-2");

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(createAdminAuthoredModuleMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          id: "victory.new-draft-2",
          moduleType: "victory-objectives"
        }),
        expect.anything()
      );
    });
  });
});
