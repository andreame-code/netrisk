import { screen, waitFor, within } from "@testing-library/react";

import type {
  AuthSessionResponse,
  GameListResponse,
  ModuleOptionsResponse
} from "@frontend-generated/shared-runtime-validation.mts";

import { getModuleOptions, getSession, listGames } from "@frontend-core/api/client.mts";

import { createDeferred } from "../../test/deferred";
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
  joinGame: vi.fn()
}));

const getModuleOptionsMock = vi.mocked(getModuleOptions);
const getSessionMock = vi.mocked(getSession);
const listGamesMock = vi.mocked(listGames);

function createAuthRequiredError(): Error & { code: string } {
  const error = new Error("Sign in to continue.") as Error & { code: string };
  error.code = "AUTH_REQUIRED";
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

function createActiveLobbyGames(activeGameId = "game-42"): GameListResponse {
  return {
    games: [
      {
        id: activeGameId,
        name: "Bridge Match",
        phase: "active",
        playerCount: 2,
        updatedAt: "2026-04-20T06:00:00.000Z",
        totalPlayers: 2
      }
    ],
    activeGameId
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
  getModuleOptionsMock.mockResolvedValue(emptyModuleOptions());
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

  it("shows the profile loading state while the session request is pending", async () => {
    const sessionRequest = createDeferred<AuthSessionResponse>();

    getSessionMock.mockReturnValue(sessionRequest.promise);

    renderReactShell("/react/profile");

    expect(await screen.findByTestId("player-profile-shell")).toBeInTheDocument();
    expect(screen.getByText("Caricamento dati giocatore...")).toBeInTheDocument();
    expect(screen.getByText("Verifica della sessione in corso...")).toBeInTheDocument();
  });

  it("keeps unauthenticated profile routes inline and shows the guest state", async () => {
    getSessionMock.mockRejectedValue(createAuthRequiredError());

    renderReactShell("/react/profile?tab=stats");

    expect(await screen.findByTestId("player-profile-shell")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/react/profile");
    expect(new URLSearchParams(window.location.search).get("tab")).toBe("stats");
    expect(
      screen.getByText("Accedi prima di consultare il profilo giocatore.")
    ).toBeInTheDocument();
    expect(screen.getByText("Sessione non disponibile.")).toBeInTheDocument();
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
});
