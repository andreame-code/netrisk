import { screen, waitFor, within } from "@testing-library/react";

import type {
  AuthSessionResponse,
  ModuleOptionsResponse,
  ModulesCatalogResponse,
  ProfileResponse,
  ThemePreferenceResponse
} from "@frontend-generated/shared-runtime-validation.mts";

import {
  getModuleOptions,
  getModulesCatalog,
  getProfile,
  getSession,
  setModuleEnabled,
  updateThemePreference
} from "@frontend-core/api/client.mts";

import { useAuthStore } from "@react-shell/auth-store";

import { createDeferred } from "../../test/deferred";
import { renderReactShell } from "../../test/render-react-shell";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@frontend-core/api/client.mts", () => ({
  getSession: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getProfile: vi.fn(),
  getModulesCatalog: vi.fn(),
  getModuleOptions: vi.fn(),
  rescanModules: vi.fn(),
  setModuleEnabled: vi.fn(),
  updateThemePreference: vi.fn(),
  listGames: vi.fn(),
  getGameOptions: vi.fn(),
  createGame: vi.fn(),
  openGame: vi.fn(),
  joinGame: vi.fn()
}));

const getSessionMock = vi.mocked(getSession);
const getProfileMock = vi.mocked(getProfile);
const getModulesCatalogMock = vi.mocked(getModulesCatalog);
const getModuleOptionsMock = vi.mocked(getModuleOptions);
const setModuleEnabledMock = vi.mocked(setModuleEnabled);
const updateThemePreferenceMock = vi.mocked(updateThemePreference);

function createSession(theme = "ember", role?: string): AuthSessionResponse {
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

function createModuleCatalogResponse(enabled = false): ModulesCatalogResponse {
  return {
    modules: [
      {
        id: "core.base",
        version: "1.0.0",
        displayName: "Core",
        description: "Base runtime",
        kind: "hybrid",
        sourcePath: "modules/core.base",
        status: "enabled",
        enabled: true,
        compatible: true,
        warnings: [],
        errors: [],
        capabilities: []
      },
      {
        id: "demo.valid",
        version: "1.2.0",
        displayName: "Demo Module",
        description: "Adds admin controls.",
        kind: "ui",
        sourcePath: "modules/demo.valid",
        status: enabled ? "enabled" : "validated",
        enabled,
        compatible: true,
        warnings: [],
        errors: [],
        capabilities: [
          {
            kind: "ui-slot",
            scope: "global",
            hook: "profile",
            targetId: "admin-modules-page"
          }
        ],
        manifest: {
          schemaVersion: 1,
          id: "demo.valid",
          version: "1.2.0",
          displayName: "Demo Module",
          description: "Adds admin controls.",
          engineVersion: "1.0.0",
          kind: "ui",
          dependencies: [
            {
              id: "core.base"
            }
          ],
          conflicts: [],
          capabilities: [
            {
              kind: "ui-slot",
              scope: "global",
              hook: "profile",
              targetId: "admin-modules-page"
            }
          ],
          permissions: []
        },
        clientManifest: {
          ui: {
            slots: [
              {
                slotId: "admin-modules-page",
                itemId: "demo-card",
                title: "Demo admin card",
                kind: "admin-card",
                route: "/modules/demo.valid"
              }
            ],
            stylesheets: ["demo.css"],
            locales: ["it"]
          },
          profiles: {
            ui: [
              {
                id: "demo.ui",
                name: "Demo UI profile"
              }
            ]
          },
          gamePresets: [
            {
              id: "demo.preset",
              name: "Demo preset"
            }
          ]
        }
      }
    ],
    enabledModules: enabled
      ? [
          {
            id: "core.base",
            version: "1.0.0"
          },
          {
            id: "demo.valid",
            version: "1.2.0"
          }
        ]
      : [
          {
            id: "core.base",
            version: "1.0.0"
          }
        ],
    engineVersion: "1.0.0"
  };
}

function createModuleOptionsResponse(): ModuleOptionsResponse {
  return {
    modules: createModuleCatalogResponse().modules,
    enabledModules: [
      {
        id: "core.base",
        version: "1.0.0"
      }
    ],
    gameModules: [],
    content: {},
    gamePresets: [
      {
        id: "demo.preset",
        name: "Demo preset"
      }
    ],
    uiSlots: [
      {
        slotId: "admin-modules-page",
        itemId: "demo-card",
        title: "Demo admin card",
        kind: "admin-card",
        route: "/modules/demo.valid"
      }
    ],
    contentProfiles: [],
    gameplayProfiles: [],
    uiProfiles: [
      {
        id: "demo.ui",
        name: "Demo UI profile"
      }
    ]
  };
}

function createResolvedCatalogModuleOptionsResponse(): ModuleOptionsResponse {
  const base = createModuleOptionsResponse();

  return {
    ...base,
    gamePresets: [],
    uiSlots: [],
    contentProfiles: [],
    gameplayProfiles: [],
    uiProfiles: [],
    resolvedCatalog: {
      modules: base.modules,
      enabledModules: base.enabledModules,
      gameModules: base.gameModules,
      content: base.content,
      maps: [],
      diceRuleSets: [],
      victoryRuleSets: [],
      themes: [],
      pieceSkins: [],
      playerPieceSets: [],
      contentPacks: [],
      gamePresets: base.gamePresets,
      uiSlots: base.uiSlots,
      contentProfiles: base.contentProfiles,
      gameplayProfiles: base.gameplayProfiles,
      uiProfiles: base.uiProfiles
    }
  };
}

function emptyModuleOptionsResponse(): ModuleOptionsResponse {
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

beforeEach(() => {
  vi.clearAllMocks();
  getModuleOptionsMock.mockResolvedValue(emptyModuleOptionsResponse());
});

describe("ProfileRoute integration", () => {
  it("shows a profile loading state while the profile query is pending", async () => {
    const profileRequest = createDeferred<ProfileResponse>();

    getSessionMock.mockResolvedValue(createSession());
    getProfileMock.mockReturnValue(profileRequest.promise);

    renderReactShell("/react/profile");

    expect(await screen.findByTestId("player-profile-shell")).toBeInTheDocument();
    expect(screen.getByText("Caricamento dati giocatore...")).toBeInTheDocument();
    expect(screen.queryByTestId("react-shell-profile-metrics")).not.toBeInTheDocument();
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
    expect(screen.getByTestId("react-shell-profile-open-game-42")).toHaveTextContent(
      "Mediterranean Command"
    );
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

  it("renders admin module controls and toggles a module from the React profile", async () => {
    getSessionMock.mockResolvedValue(createSession("ember", "admin"));
    getProfileMock.mockResolvedValue(createProfileResponse());
    getModulesCatalogMock.mockResolvedValue(createModuleCatalogResponse(false));
    getModuleOptionsMock
      .mockResolvedValueOnce(emptyModuleOptionsResponse())
      .mockResolvedValueOnce(createResolvedCatalogModuleOptionsResponse())
      .mockResolvedValueOnce(createResolvedCatalogModuleOptionsResponse());
    setModuleEnabledMock.mockResolvedValue(createModuleCatalogResponse(true));

    const { user } = renderReactShell("/react/profile");

    expect(await screen.findByTestId("react-shell-profile-modules")).toBeInTheDocument();
    expect(await screen.findByTestId("react-shell-profile-module-demo.valid")).toBeInTheDocument();
    expect(
      await screen.findByTestId("react-shell-profile-module-slot-demo-card")
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("react-shell-profile-module-toggle-demo.valid"));

    expect(setModuleEnabledMock).toHaveBeenCalledWith("demo.valid", true, expect.any(Object));

    await waitFor(() => {
      expect(screen.getByTestId("react-shell-profile-modules-status")).toHaveTextContent(
        "Catalogo moduli aggiornato."
      );
      expect(screen.getByTestId("react-shell-profile-module-toggle-demo.valid")).toHaveTextContent(
        "Disabilita"
      );
    });
  });

  it("surfaces a module options refresh error after toggling a module", async () => {
    getSessionMock.mockResolvedValue(createSession("ember", "admin"));
    getProfileMock.mockResolvedValue(createProfileResponse());
    getModulesCatalogMock.mockResolvedValue(createModuleCatalogResponse(false));
    getModuleOptionsMock
      .mockResolvedValueOnce(emptyModuleOptionsResponse())
      .mockResolvedValueOnce(createModuleOptionsResponse())
      .mockRejectedValueOnce(new Error("Module options unavailable."));
    setModuleEnabledMock.mockResolvedValue(createModuleCatalogResponse(true));

    const { user } = renderReactShell("/react/profile");

    expect(await screen.findByTestId("react-shell-profile-modules")).toBeInTheDocument();
    const toggle = await screen.findByTestId("react-shell-profile-module-toggle-demo.valid");

    await user.click(toggle);

    await waitFor(() => {
      expect(screen.getByTestId("react-shell-profile-modules-status")).toHaveTextContent(
        "Module options unavailable."
      );
    });
  });

  it("keeps module actions disabled until the post-toggle refetch finishes", async () => {
    const moduleOptionsRefresh = createDeferred<ModuleOptionsResponse>();

    getSessionMock.mockResolvedValue(createSession("ember", "admin"));
    getProfileMock.mockResolvedValue(createProfileResponse());
    getModulesCatalogMock.mockResolvedValue(createModuleCatalogResponse(false));
    getModuleOptionsMock
      .mockResolvedValueOnce(emptyModuleOptionsResponse())
      .mockResolvedValueOnce(createModuleOptionsResponse())
      .mockImplementationOnce(() => moduleOptionsRefresh.promise);
    setModuleEnabledMock.mockResolvedValue(createModuleCatalogResponse(true));

    const { user } = renderReactShell("/react/profile");

    const toggle = await screen.findByTestId("react-shell-profile-module-toggle-demo.valid");

    await user.click(toggle);

    await waitFor(() => {
      expect(screen.getByTestId("react-shell-profile-module-toggle-demo.valid")).toBeDisabled();
      expect(screen.getByTestId("react-shell-profile-modules-refresh")).toBeDisabled();
      expect(screen.getByTestId("react-shell-profile-modules-rescan")).toBeDisabled();
    });

    moduleOptionsRefresh.resolve(createModuleOptionsResponse());

    await waitFor(() => {
      expect(screen.getByTestId("react-shell-profile-module-toggle-demo.valid")).not.toBeDisabled();
      expect(screen.getByTestId("react-shell-profile-modules-status")).toHaveTextContent(
        "Catalogo moduli aggiornato."
      );
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
