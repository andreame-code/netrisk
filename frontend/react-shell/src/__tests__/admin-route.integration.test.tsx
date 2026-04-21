import { screen, waitFor } from "@testing-library/react";

import type {
  AdminOverviewResponse,
  AuthSessionResponse,
  ModuleOptionsResponse
} from "@frontend-generated/shared-runtime-validation.mts";

import { getAdminOverview, getModuleOptions, getSession } from "@frontend-core/api/client.mts";

import { renderReactShell } from "../../test/render-react-shell";

import { beforeEach, describe, expect, it, vi } from "vitest";

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
const getModuleOptionsMock = vi.mocked(getModuleOptions);
const getSessionMock = vi.mocked(getSession);

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

beforeEach(() => {
  getModuleOptionsMock.mockResolvedValue(emptyModuleOptions());
  getAdminOverviewMock.mockResolvedValue(createOverviewResponse());
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
    expect(await screen.findByText("Operational command center")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByText("Current server defaults")).toBeInTheDocument();
    expect(screen.getByText("Latest admin actions")).toBeInTheDocument();
  });
});
