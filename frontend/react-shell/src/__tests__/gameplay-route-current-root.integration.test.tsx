import { act, screen, waitFor, within } from "@testing-library/react";

import type {
  AuthSessionResponse,
  GameStateResponse,
  GameListResponse,
  GameOptionsResponse,
  ModuleOptionsResponse
} from "@frontend-generated/shared-runtime-validation.mts";

import {
  getGameOptions,
  getGameState,
  getModuleOptions,
  getSession,
  listGames,
  subscribeToGameEvents
} from "@frontend-core/api/client.mts";

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
  getGameState: vi.fn(),
  sendGameAction: vi.fn(),
  startGame: vi.fn(),
  tradeCards: vi.fn(),
  subscribeToGameEvents: vi.fn(),
  extractGameVersionConflict: vi.fn(() => null)
}));

vi.mock("@react-shell/gameplay-map-viewport", () => ({
  GameplayMapViewport: () => <div data-testid="mock-gameplay-map-viewport" />
}));

const getGameStateMock = vi.mocked(getGameState);
const getGameOptionsMock = vi.mocked(getGameOptions);
const getModuleOptionsMock = vi.mocked(getModuleOptions);
const getSessionMock = vi.mocked(getSession);
const listGamesMock = vi.mocked(listGames);
const subscribeToGameEventsMock = vi.mocked(subscribeToGameEvents);

type StreamHandlers = Parameters<typeof subscribeToGameEvents>[0];

let streamHandlers: StreamHandlers | null = null;
let closeStreamMock: ReturnType<typeof vi.fn>;

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

function createAuthRequiredError(): Error & { code: string } {
  const error = new Error("Sign in to continue.") as Error & { code: string };
  error.code = "AUTH_REQUIRED";
  return error;
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

function createGameplayState(overrides: Partial<GameStateResponse> = {}): GameStateResponse {
  return {
    phase: "active",
    turnPhase: "reinforcement",
    players: [
      {
        id: "p1",
        name: "Commander",
        color: "#e85d04",
        connected: true,
        isAi: false,
        territoryCount: 1,
        eliminated: false,
        cardCount: 0
      },
      {
        id: "p2",
        name: "CPU",
        color: "#0f4c5c",
        connected: true,
        isAi: true,
        territoryCount: 1,
        eliminated: false,
        cardCount: 0
      }
    ],
    map: [
      {
        id: "aurora",
        name: "Aurora",
        neighbors: ["bastion"],
        continentId: "north",
        ownerId: "p1",
        armies: 3,
        x: 0.2,
        y: 0.3
      },
      {
        id: "bastion",
        name: "Bastion",
        neighbors: ["aurora"],
        continentId: "north",
        ownerId: "p2",
        armies: 1,
        x: 0.65,
        y: 0.45
      }
    ],
    continents: [],
    currentPlayerId: "p1",
    reinforcementPool: 3,
    winnerId: null,
    gameConfig: {
      mapId: "classic-mini",
      mapName: "Classic Mini",
      totalPlayers: 2,
      players: [{ type: "human" }, { type: "ai" }]
    },
    log: ["Gameplay route integration"],
    lastAction: null,
    pendingConquest: null,
    fortifyUsed: false,
    conqueredTerritoryThisTurn: false,
    attacksThisTurn: 0,
    cardState: {
      ruleSetId: "standard",
      tradeCount: 0,
      deckCount: 5,
      discardCount: 0,
      nextTradeBonus: 4,
      maxHandBeforeForcedTrade: 5,
      currentPlayerMustTrade: false
    },
    diceRuleSet: {
      id: "standard",
      attackerMaxDice: 3,
      defenderMaxDice: 2
    },
    gameId: "g-1",
    version: 4,
    gameName: "Integration Match",
    playerId: "p1",
    playerHand: [],
    ...overrides
  } as GameStateResponse;
}

describe("GameRoute canonical root", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    closeStreamMock = vi.fn();
    streamHandlers = null;

    getSessionMock.mockResolvedValue(createSession());
    getModuleOptionsMock.mockResolvedValue(emptyModuleOptions());
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());
    listGamesMock.mockResolvedValue(createLobbyGames());
    getGameStateMock.mockResolvedValue(createGameplayState());
    subscribeToGameEventsMock.mockImplementation((handlers) => {
      streamHandlers = handlers;
      return {
        close: closeStreamMock,
        onopen: null,
        onmessage: null,
        onerror: null,
        readyState: 1,
        url: "/api/events?gameId=g-1",
        withCredentials: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
        CONNECTING: 0,
        OPEN: 1,
        CLOSED: 2
      } as unknown as EventSource;
    });
  });

  it("loads the current active game from the canonical game root", async () => {
    const { unmount } = renderReactShell("/game");

    expect(await screen.findByTestId("react-shell-game-page")).toBeInTheDocument();
    await waitFor(() => {
      expect(getGameStateMock).toHaveBeenCalledWith(
        "",
        expect.objectContaining({
          errorMessage: expect.any(String),
          fallbackMessage: expect.any(String)
        })
      );
      expect(subscribeToGameEventsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          gameId: "g-1"
        })
      );
    });
    expect(screen.getByText("Integration Match")).toBeInTheDocument();

    await act(async () => {
      streamHandlers?.onOpen?.();
    });

    unmount();

    expect(closeStreamMock).toHaveBeenCalledTimes(1);
  });

  it("returns unauthenticated game-root traffic to the lobby without loading current game", async () => {
    getSessionMock.mockRejectedValue(createAuthRequiredError());

    renderReactShell("/react/game");

    expect(await screen.findByTestId("react-shell-lobby-page")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/react/lobby");
    expect(getGameStateMock).not.toHaveBeenCalled();
    expect(subscribeToGameEventsMock).not.toHaveBeenCalled();
  });

  it("shows recovery UI when session bootstrap fails on the game root", async () => {
    getSessionMock.mockRejectedValue(new Error("Session service unavailable."));
    getGameStateMock.mockRejectedValue(new Error("Unable to load active game."));

    renderReactShell("/react/game");

    const errorPanel = await screen.findByTestId("react-shell-game-error");
    expect(errorPanel).toBeInTheDocument();
    expect(getGameStateMock).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        errorMessage: expect.any(String),
        fallbackMessage: expect.any(String)
      })
    );
    expect(within(errorPanel).getByRole("link", { name: "Lobby" })).toHaveAttribute(
      "href",
      "/react/lobby"
    );
    expect(subscribeToGameEventsMock).not.toHaveBeenCalled();
  });
});
