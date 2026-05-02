import { act, screen, waitFor } from "@testing-library/react";

import type {
  AuthSessionResponse,
  GameStateResponse,
  ModuleOptionsResponse
} from "@frontend-generated/shared-runtime-validation.mts";

import {
  getGameState,
  getModuleOptions,
  getSession,
  subscribeToGameEvents
} from "@frontend-core/api/client.mts";

import { renderReactShell } from "../../test/render-react-shell";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const getModuleOptionsMock = vi.mocked(getModuleOptions);
const getSessionMock = vi.mocked(getSession);
const subscribeToGameEventsMock = vi.mocked(subscribeToGameEvents);

type StreamHandlers = Parameters<typeof subscribeToGameEvents>[0];

let streamHandlers: StreamHandlers | null = null;
let closeStreamMock: ReturnType<typeof vi.fn>;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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

describe("GameRoute integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    closeStreamMock = vi.fn();
    streamHandlers = null;

    getSessionMock.mockResolvedValue(createSession());
    getModuleOptionsMock.mockResolvedValue(emptyModuleOptions());
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

  afterEach(() => {
    streamHandlers = null;
  });

  it("falls back to polling after an invalid stream payload and returns to live updates after recovery", async () => {
    const recoveredState = createGameplayState({
      reinforcementPool: 0,
      version: 5
    });

    const { unmount } = renderReactShell("/react/game/g-1");

    expect(await screen.findByTestId("react-shell-game-page")).toBeInTheDocument();
    await waitFor(() => {
      expect(getGameStateMock.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(subscribeToGameEventsMock).toHaveBeenCalledTimes(1);
    });
    const initialFetchCount = getGameStateMock.mock.calls.length;

    await act(async () => {
      streamHandlers?.onOpen?.();
    });

    await act(async () => {
      await delay(1_700);
    });

    const fetchCountBeforeFallback = getGameStateMock.mock.calls.length;
    expect(fetchCountBeforeFallback).toBeGreaterThanOrEqual(initialFetchCount);

    await act(async () => {
      streamHandlers?.onInvalidPayload?.(new Error("Malformed event payload."));
    });

    await act(async () => {
      await delay(1_700);
    });

    await waitFor(() => {
      expect(getGameStateMock.mock.calls.length).toBeGreaterThan(fetchCountBeforeFallback);
    });
    const fetchCountAfterFallback = getGameStateMock.mock.calls.length;

    await act(async () => {
      streamHandlers?.onMessage(recoveredState);
    });

    await waitFor(() => {
      expect(screen.getByTestId("status-summary")).toHaveTextContent(/Rinforzi disponibili:\s*0/i);
    });

    await act(async () => {
      await delay(1_700);
    });

    expect(getGameStateMock).toHaveBeenCalledTimes(fetchCountAfterFallback);

    unmount();

    expect(closeStreamMock).toHaveBeenCalledTimes(1);
  }, 20_000);

  it("hides the empty action section while the game is still in the lobby", async () => {
    getGameStateMock.mockResolvedValue(
      createGameplayState({
        phase: "lobby",
        turnPhase: "lobby",
        reinforcementPool: 0
      })
    );

    const { container } = renderReactShell("/react/game/g-1");

    expect(await screen.findByTestId("react-shell-game-page")).toBeInTheDocument();
    expect(container.querySelector(".actions-section")).toHaveAttribute("hidden");
  });
});
