import { screen } from "@testing-library/react";

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
const getModuleOptionsMock = vi.mocked(getModuleOptions);
const getSessionMock = vi.mocked(getSession);
const subscribeToGameEventsMock = vi.mocked(subscribeToGameEvents);

function createSession(): AuthSessionResponse {
  return {
    user: {
      id: "user-1",
      username: "Commander",
      preferences: {
        theme: "command"
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

function createGameplayState(): GameStateResponse {
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
    log: ["Gameplay objective integration"],
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
    assignedVictoryObjective: {
      moduleId: "victory.na-asia",
      moduleName: "North America and Asia",
      id: "hold-na-asia",
      title: "Hold North America and Asia",
      description: "Control North America and Asia at the same time.",
      type: "control-continents",
      summary: "Control North America and Asia simultaneously."
    }
  } as GameStateResponse;
}

describe("GameRoute assigned objective", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getSessionMock.mockResolvedValue(createSession());
    getModuleOptionsMock.mockResolvedValue(emptyModuleOptions());
    getGameStateMock.mockResolvedValue(createGameplayState());
    subscribeToGameEventsMock.mockReturnValue({
      close: vi.fn(),
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
    } as unknown as EventSource);
  });

  it("shows the assigned authored victory objective for the current player", async () => {
    const { queryClient, unmount } = renderReactShell("/react/game/g-1");

    expect(await screen.findByTestId("assigned-objective-panel")).toBeInTheDocument();
    expect(screen.getByText("Obiettivo assegnato")).toBeInTheDocument();
    expect(screen.getByText("Hold North America and Asia")).toBeInTheDocument();
    expect(
      screen.getByText("Control North America and Asia at the same time.")
    ).toBeInTheDocument();
    expect(screen.getByText("Modulo: North America and Asia")).toBeInTheDocument();

    unmount();
    queryClient.clear();
  });
});
