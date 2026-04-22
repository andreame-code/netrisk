import { screen, waitFor, within } from "@testing-library/react";

import type {
  AuthSessionResponse,
  GameListResponse,
  ProfileResponse
} from "@frontend-generated/shared-runtime-validation.mts";

import { getProfile, getSession, listGames, login, register } from "@frontend-core/api/client.mts";

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
  getGameOptions: vi.fn(),
  createGame: vi.fn(),
  openGame: vi.fn(),
  joinGame: vi.fn()
}));

const getSessionMock = vi.mocked(getSession);
const getProfileMock = vi.mocked(getProfile);
const listGamesMock = vi.mocked(listGames);
const loginMock = vi.mocked(login);
const registerMock = vi.mocked(register);
const registerRouteTimeoutMs = 30000;

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

function createProfileResponse(): ProfileResponse {
  return {
    profile: {
      playerName: "Commander",
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      gamesInProgress: 0,
      participatingGames: [],
      winRate: null,
      hasHistory: false,
      placeholders: {
        recentGames: true,
        ranking: true
      },
      preferences: {
        theme: "command"
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

describe("RegisterRoute integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
  });

  it(
    "shows a client validation error and does not submit when passwords do not match",
    async () => {
      getSessionMock.mockRejectedValue(createAuthRequiredError());

      const { user } = renderReactShell("/react/register");

      const registerPage = await screen.findByTestId("react-shell-register-page");
      const route = within(registerPage);

      expect(registerPage).toBeInTheDocument();

      await user.type(route.getByLabelText("Username"), "Commander");
      await user.type(route.getByLabelText("Password"), "secret123");
      await user.type(route.getByLabelText("Conferma password"), "secret321");
      await user.click(route.getByRole("button", { name: "Registrati" }));

      expect(await screen.findByTestId("react-shell-register-error")).toHaveTextContent(
        "Le password non coincidono."
      );
      expect(registerMock).not.toHaveBeenCalled();
      expect(loginMock).not.toHaveBeenCalled();
    },
    registerRouteTimeoutMs
  );

  it(
    "registers a guest and redirects to the requested protected route",
    async () => {
      getSessionMock.mockRejectedValue(createAuthRequiredError());
      registerMock.mockResolvedValue({
        ok: true,
        user: createSession().user,
        nextAuthProviders: ["password", "email", "google", "discord"]
      });
      loginMock.mockResolvedValue({
        ok: true,
        user: createSession().user,
        availableAuthProviders: ["password", "email", "google", "discord"]
      });
      listGamesMock.mockResolvedValue(createLobbyGames());

      const { user } = renderReactShell("/react/register?next=%2Flobby");

      const registerPage = await screen.findByTestId("react-shell-register-page");
      const route = within(registerPage);

      expect(registerPage).toBeInTheDocument();

      await user.type(route.getByLabelText("Username"), "Commander");
      await user.type(route.getByLabelText("Password"), "secret123");
      await user.type(route.getByLabelText("Conferma password"), "secret123");
      await user.click(route.getByRole("button", { name: "Registrati" }));

      expect(registerMock).toHaveBeenCalledWith(
        {
          username: "Commander",
          password: "secret123"
        },
        expect.any(Object)
      );
      expect(loginMock).toHaveBeenCalledWith(
        {
          username: "Commander",
          password: "secret123"
        },
        expect.any(Object)
      );

      expect(await screen.findByTestId("react-shell-lobby-page")).toBeInTheDocument();
      await waitFor(() => {
        expect(window.location.pathname).toBe("/react/lobby");
      });
    },
    registerRouteTimeoutMs
  );

  it(
    "redirects authenticated users away from the register route",
    async () => {
      getSessionMock.mockResolvedValue(createSession());
      getProfileMock.mockResolvedValue(createProfileResponse());

      renderReactShell("/react/register");

      expect(await screen.findByTestId("react-shell-profile-page")).toBeInTheDocument();
      await waitFor(() => {
        expect(window.location.pathname).toBe("/react/profile");
      });
    },
    registerRouteTimeoutMs
  );
});
