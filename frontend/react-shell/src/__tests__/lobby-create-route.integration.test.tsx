import { screen, waitFor, within } from "@testing-library/react";

import type {
  AuthSessionResponse,
  GameOptionsResponse,
  ModuleOptionsResponse
} from "@frontend-generated/shared-runtime-validation.mts";

import {
  createGame,
  getGameOptions,
  getModuleOptions,
  getSession
} from "@frontend-core/api/client.mts";

import { openShellGame } from "@react-shell/game-navigation";
import { storeCurrentPlayerId } from "@react-shell/player-session";

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

vi.mock("@react-shell/game-navigation", () => ({
  openShellGame: vi.fn()
}));

vi.mock("@react-shell/player-session", () => ({
  storeCurrentPlayerId: vi.fn()
}));

const createGameMock = vi.mocked(createGame);
const getGameOptionsMock = vi.mocked(getGameOptions);
const getModuleOptionsMock = vi.mocked(getModuleOptions);
const getSessionMock = vi.mocked(getSession);
const openShellGameMock = vi.mocked(openShellGame);
const storeCurrentPlayerIdMock = vi.mocked(storeCurrentPlayerId);
const lobbyCreateRouteTimeoutMs = 30_000;

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

function createGameOptionsResponse(): GameOptionsResponse {
  return {
    contentPacks: [
      {
        id: "pack-standard",
        name: "Standard Command",
        description: "Classic content pack",
        defaultSiteThemeId: "theme-default",
        defaultMapId: "map-default",
        defaultDiceRuleSetId: "dice-default",
        defaultCardRuleSetId: "cards-standard",
        defaultVictoryRuleSetId: "victory-default",
        defaultPieceSetId: "pieces-default"
      }
    ],
    ruleSets: [
      {
        id: "rules-default",
        name: "Classic Rules",
        defaults: {
          extensionSchemaVersion: 1,
          mapId: "map-default",
          diceRuleSetId: "dice-default",
          victoryRuleSetId: "victory-default",
          themeId: "theme-default",
          pieceSkinId: "skin-default"
        }
      }
    ],
    maps: [
      {
        id: "map-default",
        name: "World Classic",
        territoryCount: 42,
        continentCount: 6,
        continentBonuses: []
      }
    ],
    diceRuleSets: [
      {
        id: "dice-default",
        name: "Classic Dice",
        attackerMaxDice: 3,
        defenderMaxDice: 2
      },
      {
        id: "dice-alt",
        name: "Extended Defense",
        attackerMaxDice: 3,
        defenderMaxDice: 3
      }
    ],
    victoryRuleSets: [
      {
        id: "victory-default",
        name: "Classic Victory",
        description: "Default victory"
      },
      {
        id: "victory-alt",
        name: "Majority Control",
        description: "Alternative victory"
      }
    ],
    themes: [
      {
        id: "theme-default",
        name: "Command Theme",
        description: "Default theme"
      },
      {
        id: "theme-alt",
        name: "Signal Theme",
        description: "Alternative theme"
      }
    ],
    pieceSkins: [
      {
        id: "skin-default",
        name: "Classic Pieces",
        description: "Default pieces",
        renderStyleId: "classic",
        usesPlayerColor: true,
        assetBaseUrl: null
      },
      {
        id: "skin-alt",
        name: "Modern Pieces",
        description: "Alternative pieces",
        renderStyleId: "modern",
        usesPlayerColor: true,
        assetBaseUrl: null
      }
    ],
    modules: [],
    enabledModules: [],
    gamePresets: [],
    contentProfiles: [],
    gameplayProfiles: [],
    uiProfiles: [],
    uiSlots: [],
    playerPieceSets: [],
    turnTimeoutHoursOptions: [24, 48],
    playerRange: {
      min: 2,
      max: 4
    }
  };
}

function createResolvedCatalogGameOptionsResponse(): GameOptionsResponse {
  const base = createGameOptionsResponse();

  return {
    ...base,
    gamePresets: [],
    contentProfiles: [],
    gameplayProfiles: [],
    uiProfiles: [],
    uiSlots: [],
    resolvedCatalog: {
      modules: base.modules || [],
      enabledModules: base.enabledModules || [],
      gameModules: [],
      content: {},
      maps: base.maps,
      ruleSets: base.ruleSets,
      playerPieceSets: base.playerPieceSets || [],
      diceRuleSets: base.diceRuleSets,
      contentPacks: base.contentPacks || [],
      victoryRuleSets: base.victoryRuleSets,
      themes: base.themes,
      pieceSkins: base.pieceSkins,
      gamePresets: [
        {
          id: "preset-resolved",
          name: "Resolved Strike Package",
          description: "Resolved preset for shell consumers",
          activeModuleIds: [],
          contentProfileId: "content-resolved",
          gameplayProfileId: "gameplay-resolved",
          uiProfileId: "ui-resolved"
        }
      ],
      uiSlots: [],
      contentProfiles: [
        {
          id: "content-resolved",
          name: "Resolved Content Profile"
        }
      ],
      gameplayProfiles: [
        {
          id: "gameplay-resolved",
          name: "Resolved Gameplay Profile"
        }
      ],
      uiProfiles: [
        {
          id: "ui-resolved",
          name: "Resolved UI Profile"
        }
      ]
    }
  };
}

async function renderLobbyCreateRoute(path = "/react/lobby/new") {
  const rendered = renderReactShell(path);
  const createPage = await screen.findByTestId("react-shell-lobby-create-page");
  const route = within(createPage);
  const customizeOptionsToggle = (await route.findByTestId(
    "react-shell-new-game-customize-options"
  )) as HTMLInputElement;
  const submitButton = (await route.findByTestId(
    "react-shell-new-game-submit"
  )) as HTMLButtonElement;

  await waitFor(() => {
    expect(submitButton).toBeEnabled();
  });

  return {
    ...rendered,
    route,
    customizeOptionsToggle,
    submitButton,
    mapSelect: (await route.findByTestId("react-shell-new-game-map")) as HTMLSelectElement,
    diceSelect: (await route.findByTestId("react-shell-new-game-dice")) as HTMLSelectElement,
    victorySelect: (await route.findByTestId("react-shell-new-game-victory")) as HTMLSelectElement,
    themeSelect: (await route.findByTestId("react-shell-new-game-theme")) as HTMLSelectElement,
    pieceSkinSelect: (await route.findByTestId(
      "react-shell-new-game-piece-skin"
    )) as HTMLSelectElement
  };
}

describe("LobbyCreateRoute integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    getSessionMock.mockResolvedValue(createSession());
    getModuleOptionsMock.mockResolvedValue(emptyModuleOptions());
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());
    createGameMock.mockResolvedValue({
      ok: true,
      playerId: "player-1",
      game: {
        id: "game-99",
        name: "Created Match"
      },
      games: [],
      activeGameId: "game-99"
    } as Awaited<ReturnType<typeof createGame>>);
  });

  it(
    "submits the displayed default advanced options when customization is turned back off",
    async () => {
      const {
        user,
        route,
        customizeOptionsToggle,
        submitButton,
        diceSelect,
        victorySelect,
        themeSelect,
        pieceSkinSelect
      } = await renderLobbyCreateRoute();

      await user.click(customizeOptionsToggle);

      await waitFor(() => {
        expect(customizeOptionsToggle).toBeChecked();
      });

      await user.selectOptions(diceSelect, "dice-alt");
      await user.selectOptions(victorySelect, "victory-alt");
      await user.selectOptions(themeSelect, "theme-alt");
      await user.selectOptions(pieceSkinSelect, "skin-alt");

      await waitFor(() => {
        expect(diceSelect).toHaveValue("dice-alt");
        expect(victorySelect).toHaveValue("victory-alt");
        expect(themeSelect).toHaveValue("theme-alt");
        expect(pieceSkinSelect).toHaveValue("skin-alt");
      });

      await user.click(route.getByTestId("react-shell-new-game-customize-options"));

      await waitFor(() => {
        expect(customizeOptionsToggle).not.toBeChecked();
        expect(submitButton).toBeEnabled();
      });

      await user.click(submitButton);

      await waitFor(() => {
        expect(createGameMock).toHaveBeenCalledTimes(1);
      });

      expect(createGameMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleSetId: "rules-default",
          mapId: "map-default",
          diceRuleSetId: "dice-default",
          victoryRuleSetId: "victory-default",
          themeId: "theme-default",
          pieceSkinId: "skin-default"
        }),
        expect.any(Object)
      );
      expect(storeCurrentPlayerIdMock).toHaveBeenCalledWith("player-1", "game-99");
      expect(openShellGameMock).toHaveBeenCalledWith("game-99");
    },
    lobbyCreateRouteTimeoutMs
  );

  it(
    "preserves the selected rule-set defaults when admin fallback setup ids are omitted",
    async () => {
      const baseOptions = createGameOptionsResponse();
      getGameOptionsMock.mockResolvedValue({
        ...baseOptions,
        maps: [
          {
            id: "map-alt",
            name: "Aurora Front",
            territoryCount: 24,
            continentCount: 4,
            continentBonuses: []
          },
          ...baseOptions.maps
        ],
        diceRuleSets: [baseOptions.diceRuleSets[1], baseOptions.diceRuleSets[0]],
        victoryRuleSets: [baseOptions.victoryRuleSets[1], baseOptions.victoryRuleSets[0]],
        themes: [baseOptions.themes[1], baseOptions.themes[0]],
        pieceSkins: [baseOptions.pieceSkins[1], baseOptions.pieceSkins[0]],
        adminDefaults: {
          ruleSetId: "rules-default"
        }
      });

      const { mapSelect, diceSelect, victorySelect, themeSelect, pieceSkinSelect } =
        await renderLobbyCreateRoute();

      await waitFor(() => {
        expect(mapSelect).toHaveValue("map-default");
        expect(diceSelect).toHaveValue("dice-default");
        expect(victorySelect).toHaveValue("victory-default");
        expect(themeSelect).toHaveValue("theme-default");
        expect(pieceSkinSelect).toHaveValue("skin-default");
      });
    },
    lobbyCreateRouteTimeoutMs
  );

  it(
    "renders presets and profiles from resolvedCatalog and submits the resolved selections",
    async () => {
      getGameOptionsMock.mockResolvedValue(createResolvedCatalogGameOptionsResponse());

      const { user, route, customizeOptionsToggle, submitButton } = await renderLobbyCreateRoute();

      await user.click(customizeOptionsToggle);

      await waitFor(() => {
        expect(customizeOptionsToggle).toBeChecked();
      });

      const presetSelect = (await route.findByTestId(
        "react-shell-new-game-preset"
      )) as HTMLSelectElement;
      const contentProfileSelect = (await route.findByTestId(
        "react-shell-new-game-content-profile"
      )) as HTMLSelectElement;
      const gameplayProfileSelect = (await route.findByTestId(
        "react-shell-new-game-gameplay-profile"
      )) as HTMLSelectElement;
      const uiProfileSelect = (await route.findByTestId(
        "react-shell-new-game-ui-profile"
      )) as HTMLSelectElement;

      expect(
        within(presetSelect).getByRole("option", { name: "Resolved Strike Package" })
      ).toBeInTheDocument();
      expect(
        within(contentProfileSelect).getByRole("option", {
          name: "Resolved Content Profile"
        })
      ).toBeInTheDocument();
      expect(
        within(gameplayProfileSelect).getByRole("option", {
          name: "Resolved Gameplay Profile"
        })
      ).toBeInTheDocument();
      expect(
        within(uiProfileSelect).getByRole("option", { name: "Resolved UI Profile" })
      ).toBeInTheDocument();

      await user.selectOptions(presetSelect, "preset-resolved");

      await waitFor(() => {
        expect(presetSelect).toHaveValue("preset-resolved");
        expect(contentProfileSelect).toHaveValue("content-resolved");
        expect(gameplayProfileSelect).toHaveValue("gameplay-resolved");
        expect(uiProfileSelect).toHaveValue("ui-resolved");
        expect(submitButton).toBeEnabled();
      });

      await user.click(submitButton);

      await waitFor(() => {
        expect(createGameMock).toHaveBeenCalledTimes(1);
      });

      expect(createGameMock).toHaveBeenCalledWith(
        expect.objectContaining({
          gamePresetId: "preset-resolved",
          contentProfileId: "content-resolved",
          gameplayProfileId: "gameplay-resolved",
          uiProfileId: "ui-resolved"
        }),
        expect.any(Object)
      );
    },
    lobbyCreateRouteTimeoutMs
  );

  it(
    "applies lobby setup params and submits the prefilled setup from the quick confirm action",
    async () => {
      getGameOptionsMock.mockResolvedValue(createResolvedCatalogGameOptionsResponse());

      const { user, route } = await renderLobbyCreateRoute(
        "/react/lobby/new?preset=preset-resolved&players=2&turnHours=48&modules="
      );
      const quickConfirmButton = await route.findByTestId("react-shell-new-game-confirm-default");

      await user.click(quickConfirmButton);

      await waitFor(() => {
        expect(createGameMock).toHaveBeenCalledTimes(1);
      });

      expect(createGameMock).toHaveBeenCalledWith(
        expect.objectContaining({
          gamePresetId: "preset-resolved",
          contentProfileId: "content-resolved",
          gameplayProfileId: "gameplay-resolved",
          uiProfileId: "ui-resolved",
          totalPlayers: 2,
          turnTimeoutHours: 48,
          players: [
            {
              slot: 1,
              type: "human"
            },
            {
              slot: 2,
              type: "human"
            }
          ]
        }),
        expect.any(Object)
      );
    },
    lobbyCreateRouteTimeoutMs
  );
});
