import { screen, waitFor, within } from "@testing-library/react";

import type {
  AuthSessionResponse,
  GameOptionsResponse,
  GameListResponse,
  ModuleOptionsResponse
} from "@frontend-generated/shared-runtime-validation.mts";

import {
  getGameOptions,
  getModuleOptions,
  getProfile,
  getSession,
  getSetupStatus,
  listGames,
  login,
  logout
} from "@frontend-core/api/client.mts";

import { createDeferred } from "../../test/deferred";
import { renderReactShell } from "../../test/render-react-shell";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@frontend-core/api/client.mts", () => ({
  getSession: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getProfile: vi.fn(),
  getSetupStatus: vi.fn(),
  updateThemePreference: vi.fn(),
  listGames: vi.fn(),
  getModuleOptions: vi.fn(),
  getGameOptions: vi.fn(),
  createGame: vi.fn(),
  openGame: vi.fn(),
  joinGame: vi.fn()
}));

const getModuleOptionsMock = vi.mocked(getModuleOptions);
const getGameOptionsMock = vi.mocked(getGameOptions);
const getProfileMock = vi.mocked(getProfile);
const getSessionMock = vi.mocked(getSession);
const getSetupStatusMock = vi.mocked(getSetupStatus);
const listGamesMock = vi.mocked(listGames);
const loginMock = vi.mocked(login);
const logoutMock = vi.mocked(logout);

function createAuthRequiredError(): Error & { code: string } {
  const error = new Error("Sign in to continue.") as Error & { code: string };
  error.code = "AUTH_REQUIRED";
  return error;
}

function createSessionExpiredError(): Error & { category: "auth"; code: string } {
  const error = new Error("Session expired.") as Error & { category: "auth"; code: string };
  error.category = "auth";
  error.code = "SESSION_EXPIRED";
  return error;
}

function createSession(theme = "command"): AuthSessionResponse {
  return {
    user: {
      id: "user-1",
      username: "Commander",
      preferences: {
        theme
      }
    }
  };
}

function createLobbyGames(): GameListResponse {
  return {
    games: [],
    activeGameId: null
  };
}

function createGameOptionsResponse(): GameOptionsResponse {
  return {
    ruleSets: [],
    maps: [],
    diceRuleSets: [],
    victoryRuleSets: [],
    themes: [],
    pieceSkins: [],
    modules: [],
    enabledModules: [],
    gamePresets: [],
    contentProfiles: [],
    gameplayProfiles: [],
    uiProfiles: [],
    uiSlots: [],
    playerPieceSets: [],
    contentPacks: [],
    turnTimeoutHoursOptions: [24, 48],
    playerRange: {
      min: 2,
      max: 4
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

function resolvedCatalogModuleOptions(): ModuleOptionsResponse {
  const base = emptyModuleOptions();

  return {
    ...base,
    resolvedCatalog: {
      modules: base.modules,
      enabledModules: base.enabledModules,
      gameModules: base.gameModules,
      content: base.content,
      maps: [],
      ruleSets: [],
      playerPieceSets: [],
      diceRuleSets: [],
      contentPacks: [],
      victoryRuleSets: [],
      themes: [],
      pieceSkins: [],
      gamePresets: [],
      uiSlots: [
        {
          slotId: "top-nav-bar",
          itemId: "ops-center",
          title: "Ops Center",
          kind: "nav-link",
          route: "/ops-center",
          order: 10
        }
      ],
      contentProfiles: [],
      gameplayProfiles: [],
      uiProfiles: []
    }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getModuleOptionsMock.mockResolvedValue(emptyModuleOptions());
  getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());
  getSetupStatusMock.mockResolvedValue({
    setupRequired: false,
    setupCompleted: true,
    hasAdminUser: true,
    datastoreOk: true,
    missingRequiredSecrets: false,
    setupActionsAllowed: false,
    setupPageAvailable: false
  });
  logoutMock.mockResolvedValue({ ok: true });
});

describe("React shell routing and session integration", () => {
  it("renders the canonical landing route on the root path", async () => {
    renderReactShell("/");

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Conquista il Mondo."
    );
    expect(window.location.pathname).toBe("/");
  });

  it("shows the loading animation while the shell bootstrap is pending", async () => {
    const sessionRequest = createDeferred<AuthSessionResponse>();

    getSessionMock.mockReturnValue(sessionRequest.promise);

    renderReactShell("/react/");

    expect(await screen.findByTestId("react-shell-loading")).toBeInTheDocument();
    expect(screen.getByTestId("loading-animation")).toBeInTheDocument();
  });

  it("keeps protected route content unmounted while the session request is pending", async () => {
    const sessionRequest = createDeferred<AuthSessionResponse>();

    getSessionMock.mockReturnValue(sessionRequest.promise);

    renderReactShell("/react/profile");

    expect(await screen.findByTestId("react-shell-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("player-profile-shell")).not.toBeInTheDocument();
    expect(getProfileMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      requestedPath: "/profile",
      loginPath: "/login",
      nextPath: "/profile"
    },
    {
      requestedPath: "/react/profile?tab=stats",
      loginPath: "/react/login",
      nextPath: "/profile?tab=stats"
    },
    {
      requestedPath: "/lobby/new",
      loginPath: "/login",
      nextPath: "/lobby/new"
    },
    {
      requestedPath: "/react/lobby/new?map=world-classic",
      loginPath: "/react/login",
      nextPath: "/lobby/new?map=world-classic"
    }
  ])(
    "redirects an anonymous $requestedPath request before protected content mounts",
    async ({ requestedPath, loginPath, nextPath }) => {
      getSessionMock.mockRejectedValue(createAuthRequiredError());

      renderReactShell(requestedPath);

      expect(await screen.findByTestId("react-shell-login-page")).toBeInTheDocument();
      expect(window.location.pathname).toBe(loginPath);
      expect(new URLSearchParams(window.location.search).get("next")).toBe(nextPath);
      expect(screen.queryByTestId("player-profile-shell")).not.toBeInTheDocument();
      expect(screen.queryByTestId("new-game-shell")).not.toBeInTheDocument();
      expect(getProfileMock).not.toHaveBeenCalled();
      expect(getGameOptionsMock).not.toHaveBeenCalled();
    }
  );

  it("preserves locale and the exact protected destination through login", async () => {
    getSessionMock.mockRejectedValue(createAuthRequiredError());
    loginMock.mockResolvedValue({
      ok: true,
      user: createSession().user
    });
    getProfileMock.mockResolvedValue({
      profile: {
        playerName: "Commander",
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        winRate: null,
        gamesInProgress: 0,
        hasHistory: false,
        participatingGames: [],
        placeholders: {
          recentGames: true,
          ranking: true
        },
        preferences: {
          theme: "command"
        }
      }
    });

    const { user } = renderReactShell("/react/profile/?lang=en&tab=stats", "en");

    const loginPage = await screen.findByTestId("react-shell-login-page");
    expect(
      within(loginPage).getByRole("heading", { name: "Log in to command" })
    ).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("next")).toBe(
      "/profile/?lang=en&tab=stats"
    );

    await user.type(within(loginPage).getByLabelText("Username"), "Commander");
    await user.type(within(loginPage).getByLabelText("Password"), "secret123");
    await user.click(within(loginPage).getByRole("button", { name: "Log in" }));

    expect(await screen.findByTestId("player-profile-shell")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/react/profile/");
    expect(window.location.search).toBe("?lang=en&tab=stats");
    expect(document.documentElement.lang).toBe("en");
    await waitFor(() => expect(getProfileMock).toHaveBeenCalledTimes(1));
  });

  it("redirects an expired protected session with a clear login message", async () => {
    getSessionMock.mockRejectedValue(createSessionExpiredError());

    renderReactShell("/profile");

    expect(await screen.findByTestId("react-shell-login-page")).toBeInTheDocument();
    expect(screen.getByTestId("react-shell-session-expired")).toHaveTextContent(
      "Sessione scaduta."
    );
    expect(window.location.pathname).toBe("/login");
    expect(new URLSearchParams(window.location.search).get("next")).toBe("/profile");
    expect(getProfileMock).not.toHaveBeenCalled();
  });

  it("routes authenticated bootstrap traffic from the shell root to the lobby", async () => {
    getSessionMock.mockResolvedValue(createSession());
    listGamesMock.mockResolvedValue(createLobbyGames());

    renderReactShell("/react/");

    expect(await screen.findByTestId("react-shell-lobby-page")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/react/lobby");
  });

  it("shows bootstrap errors and retries session bootstrap from the error panel", async () => {
    getSessionMock
      .mockRejectedValueOnce(new Error("Session service offline."))
      .mockResolvedValue(createSession());
    listGamesMock.mockResolvedValue(createLobbyGames());

    const { user } = renderReactShell("/react/");
    const errorPanel = await screen.findByTestId("react-shell-error");

    expect(errorPanel).toBeInTheDocument();
    expect(within(errorPanel).getByText("Session service offline.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByTestId("react-shell-lobby-page")).toBeInTheDocument();
    await waitFor(() => {
      expect(getSessionMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders authenticated top-nav slots when they are provided through resolvedCatalog", async () => {
    getSessionMock.mockResolvedValue(createSession());
    listGamesMock.mockResolvedValue(createLobbyGames());
    getModuleOptionsMock.mockResolvedValue(resolvedCatalogModuleOptions());

    renderReactShell("/react/");

    expect(await screen.findByTestId("react-shell-lobby-page")).toBeInTheDocument();

    const opsCenterLink = await screen.findByRole("link", { name: "Ops Center" });
    expect(opsCenterLink).toHaveAttribute("href", "/ops-center");
  });

  it("keeps guest game navigation on the lobby", async () => {
    getSessionMock.mockRejectedValue(createAuthRequiredError());
    listGamesMock.mockResolvedValue(createLobbyGames());

    renderReactShell("/react/lobby");

    expect(await screen.findByTestId("react-shell-lobby-page")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("react-shell-nav")).getByRole("link", { name: "Partita" })
    ).toHaveAttribute("href", "/react/lobby");
  });

  it("exposes logout from the authenticated war-table user menu", async () => {
    getSessionMock.mockResolvedValue(createSession("war-table"));
    listGamesMock.mockResolvedValue(createLobbyGames());

    const { user } = renderReactShell("/react/lobby");

    expect(await screen.findByTestId("react-shell-lobby-page")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Commander/i }));

    const userMenu = screen.getByRole("menu");
    const logoutItem = within(userMenu).getByRole("menuitem", { name: "Esci" });

    expect(logoutItem).toBeVisible();

    await user.click(logoutItem);

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
    });
  });
});
