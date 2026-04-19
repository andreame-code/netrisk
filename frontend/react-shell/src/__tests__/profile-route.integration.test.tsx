import { screen, waitFor, within } from "@testing-library/react";

import type {
  AuthSessionResponse,
  ProfileResponse,
  ThemePreferenceResponse
} from "@frontend-generated/shared-runtime-validation.mts";

import { getProfile, getSession, updateThemePreference } from "@frontend-core/api/client.mts";

import { useAuthStore } from "@react-shell/auth-store";

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
const getProfileMock = vi.mocked(getProfile);
const updateThemePreferenceMock = vi.mocked(updateThemePreference);

function createSession(theme = "ember"): AuthSessionResponse {
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
      gamesPlayed: 12,
      wins: 7,
      losses: 5,
      gamesInProgress: 2,
      participatingGames: [
        {
          id: "game-42",
          name: "Mediterranean Command",
          phase: "active",
          playerCount: 4,
          updatedAt: "2026-04-18T18:30:00.000Z",
          totalPlayers: 6,
          mapName: "World Classic",
          mapId: "world-classic",
          myLobby: {
            playerName: "Commander",
            statusLabel: "In corso",
            focusLabel: "Tocca a te",
            turnPhaseLabel: "Rinforzo",
            territoryCount: 14,
            cardCount: 3
          }
        }
      ],
      winRate: 58,
      hasHistory: true,
      placeholders: {
        recentGames: false,
        ranking: false
      },
      preferences: {
        theme: "ember"
      }
    }
  };
}

function createThemePreferenceResponse(theme: string): ThemePreferenceResponse {
  return {
    ok: true,
    user: {
      id: "user-1",
      username: "Commander",
      preferences: {
        theme
      }
    },
    preferences: {
      theme
    }
  };
}

describe("ProfileRoute integration", () => {
  it("shows a profile loading state while the profile query is pending", async () => {
    const profileRequest = createDeferred<ProfileResponse>();

    getSessionMock.mockResolvedValue(createSession());
    getProfileMock.mockReturnValue(profileRequest.promise);

    renderReactShell("/react/profile");

    expect(await screen.findByTestId("react-shell-profile-loading")).toBeInTheDocument();
  });

  it("shows an error state and retries the profile flow", async () => {
    getSessionMock.mockResolvedValue(createSession());
    getProfileMock
      .mockRejectedValueOnce(new Error("Profile unavailable."))
      .mockResolvedValue(createProfileResponse());

    const { user } = renderReactShell("/react/profile");

    expect(await screen.findByTestId("react-shell-profile-error")).toBeInTheDocument();
    expect(screen.getByText("Profile unavailable.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry profile" }));

    expect(await screen.findByTestId("react-shell-profile-metrics")).toBeInTheDocument();
    await waitFor(() => {
      expect(getProfileMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders the success state with metrics and participating games", async () => {
    getSessionMock.mockResolvedValue(createSession());
    getProfileMock.mockResolvedValue(createProfileResponse());

    renderReactShell("/react/profile");

    const metrics = await screen.findByTestId("react-shell-profile-metrics");
    expect(within(metrics).getByText("12")).toBeInTheDocument();
    expect(within(metrics).getByText("7")).toBeInTheDocument();
    expect(within(metrics).getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Mediterranean Command")).toBeInTheDocument();
    expect(screen.getByTestId("react-shell-profile-open-game-42").getAttribute("href")).toMatch(
      /\/game\/game-42$/
    );
  });

  it("updates the selected theme, auth state, and shell theme on success", async () => {
    getSessionMock.mockResolvedValue(createSession("ember"));
    getProfileMock.mockResolvedValue(createProfileResponse());
    updateThemePreferenceMock.mockResolvedValue(createThemePreferenceResponse("midnight"));

    const { user } = renderReactShell("/react/profile");

    const select = (await screen.findByTestId(
      "react-shell-profile-theme-select"
    )) as HTMLSelectElement;

    await user.selectOptions(select, "midnight");

    expect(updateThemePreferenceMock).toHaveBeenCalledWith("midnight", expect.any(Object));

    await waitFor(() => {
      expect(select.value).toBe("midnight");
      expect(document.documentElement.dataset.theme).toBe("midnight");
      expect(screen.getByTestId("react-shell-profile-theme-status")).toHaveTextContent(
        "Mezzanotte"
      );
      expect(useAuthStore.getState().state).toMatchObject({
        status: "authenticated",
        user: {
          preferences: {
            theme: "midnight"
          }
        }
      });
    });
  });

  it("rolls back theme selection and surfaces an error when the save fails", async () => {
    getSessionMock.mockResolvedValue(createSession("ember"));
    getProfileMock.mockResolvedValue(createProfileResponse());
    updateThemePreferenceMock.mockRejectedValue(new Error("Unable to save theme."));

    const { user } = renderReactShell("/react/profile");

    const select = (await screen.findByTestId(
      "react-shell-profile-theme-select"
    )) as HTMLSelectElement;

    await user.selectOptions(select, "midnight");

    await waitFor(() => {
      expect(select.value).toBe("ember");
      expect(document.documentElement.dataset.theme).toBe("ember");
      expect(screen.getByTestId("react-shell-profile-theme-status")).toHaveTextContent(
        "Unable to save theme."
      );
    });
  });
});
