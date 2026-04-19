import { screen, waitFor, within } from "@testing-library/react";

import type {
  AuthSessionResponse,
  GameListResponse
} from "@frontend-generated/shared-runtime-validation.mts";

import { getSession, listGames } from "@frontend-core/api/client.mts";

import { createDeferred } from "../../test/deferred";
import { renderReactShell } from "../../test/render-react-shell";

import { describe, expect, it, vi } from "vitest";

vi.mock("@frontend-core/api/client.mts", () => ({
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  getProfile: vi.fn(),
  updateThemePreference: vi.fn(),
  listGames: vi.fn(),
  getGameOptions: vi.fn(),
  createGame: vi.fn(),
  openGame: vi.fn(),
  joinGame: vi.fn()
}));

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

describe("React shell routing and session integration", () => {
  it("shows protected route loading while the session request is pending", async () => {
    const sessionRequest = createDeferred<AuthSessionResponse>();

    getSessionMock.mockReturnValue(sessionRequest.promise);

    renderReactShell("/react/profile");

    expect(screen.getByTestId("react-shell-loading")).toBeInTheDocument();
    expect(screen.getByText("Checking route access")).toBeInTheDocument();
  });

  it("redirects unauthenticated protected routes to login and preserves the next path", async () => {
    getSessionMock.mockRejectedValue(createAuthRequiredError());

    renderReactShell("/react/profile?tab=stats");

    expect(await screen.findByTestId("react-shell-login-page")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/react/login");
    expect(new URLSearchParams(window.location.search).get("next")).toBe("/profile?tab=stats");
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
});
