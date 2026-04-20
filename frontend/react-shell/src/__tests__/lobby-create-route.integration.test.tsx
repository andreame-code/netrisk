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

import { openReactGame } from "@react-shell/legacy-game-handoff";
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

vi.mock("@react-shell/legacy-game-handoff", () => ({
  openReactGame: vi.fn()
}));

vi.mock("@react-shell/player-session", () => ({
  storeCurrentPlayerId: vi.fn()
}));

const createGameMock = vi.mocked(createGame);
const getGameOptionsMock = vi.mocked(getGameOptions);
const getModuleOptionsMock = vi.mocked(getModuleOptions);
const getSessionMock = vi.mocked(getSession);
const openReactGameMock = vi.mocked(openReactGame);
const storeCurrentPlayerIdMock = vi.mocked(storeCurrentPlayerId);

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

  it("submits the displayed default advanced options when customization is turned back off", async () => {
    const { user } = renderReactShell("/react/lobby/new");

    const customizeOptionsToggle = await screen.findByTestId(
      "react-shell-new-game-customize-options"
    );
    const createPage = await screen.findByTestId("react-shell-lobby-create-page");
    const route = within(createPage);

    await user.click(customizeOptionsToggle);
    await user.selectOptions(route.getByTestId("react-shell-new-game-dice"), "dice-alt");
    await user.selectOptions(route.getByTestId("react-shell-new-game-victory"), "victory-alt");
    await user.selectOptions(route.getByTestId("react-shell-new-game-theme"), "theme-alt");
    await user.selectOptions(route.getByTestId("react-shell-new-game-piece-skin"), "skin-alt");
    await user.click(route.getByTestId("react-shell-new-game-customize-options"));
    await user.click(route.getByTestId("react-shell-new-game-submit"));

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
    expect(openReactGameMock).toHaveBeenCalledWith("game-99");
  });
});
