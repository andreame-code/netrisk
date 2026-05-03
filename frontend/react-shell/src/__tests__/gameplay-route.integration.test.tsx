import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
    expect(container.querySelector("#game-command-actions")).not.toBeInTheDocument();
    expect(screen.getByTestId("actions-panel")).toHaveAttribute("data-command-mode", "lobby");
  });

  it("renders the reference attack command dock", async () => {
    getGameStateMock.mockResolvedValue(
      createGameplayState({
        turnPhase: "attack",
        reinforcementPool: 0,
        lastCombat: {
          fromTerritoryId: "aurora",
          toTerritoryId: "bastion",
          attackerPlayerId: "p1",
          defenderPlayerId: "p2",
          attackerRolls: [6, 4],
          defenderRolls: [5],
          comparisons: [{ winner: "attacker", attackDie: 6, defendDie: 5 }]
        }
      })
    );

    renderReactShell("/react/game/g-1");

    const dock = await screen.findByTestId("actions-panel");
    expect(dock).toHaveAttribute("data-command-mode", "attack");
    expect(within(dock).getByLabelText("Da")).toHaveAttribute("id", "attack-from");
    expect(dock.querySelector("#attack-to")).toBeInTheDocument();
    expect(within(dock).getByText("Dadi")).toBeInTheDocument();
    expect(dock.querySelector("#attack-button")).toHaveTextContent("Lancia attacco");
    expect(dock.querySelector("#attack-banzai-button")).toHaveTextContent("Banzai");
    expect(dock.querySelector("#end-turn-button")).toHaveTextContent("Vai a fortifica");
    expect(screen.getByText("Ultimo combattimento")).toBeInTheDocument();
    expect(screen.getByText("Aurora -> Bastion")).toBeInTheDocument();
    expect(screen.getByText(/Commander · 6, 4/)).toBeInTheDocument();
  });

  it("renders the reference reinforcement command dock", async () => {
    renderReactShell("/react/game/g-1");

    const dock = await screen.findByTestId("actions-panel");
    expect(dock).toHaveAttribute("data-command-mode", "reinforcement");
    expect(within(dock).getByText("Territorio selezionato")).toBeInTheDocument();
    expect(dock.querySelector("#reinforce-select")).toBeInTheDocument();
    expect(dock.querySelector("#reinforce-amount")).toBeInTheDocument();
    expect(dock.querySelector("#reinforce-multi-button")).toHaveTextContent("Aggiungi");
    expect(dock.querySelector("#reinforce-all-button")).toHaveTextContent("Aggiungi tutto (3)");
    expect(dock.querySelector("#end-turn-button")).toHaveAttribute("hidden");
  });

  it("renders the reference fortify command dock", async () => {
    getGameStateMock.mockResolvedValue(
      createGameplayState({
        turnPhase: "fortify",
        reinforcementPool: 0,
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
            ownerId: "p1",
            armies: 1,
            x: 0.65,
            y: 0.45
          }
        ]
      })
    );

    renderReactShell("/react/game/g-1");

    const dock = await screen.findByTestId("actions-panel");
    expect(dock).toHaveAttribute("data-command-mode", "fortify");
    expect(within(dock).getByLabelText("Da")).toHaveAttribute("id", "fortify-from");
    expect(dock.querySelector("#fortify-to")).toBeInTheDocument();
    expect(within(dock).getByText("Armate da spostare")).toBeInTheDocument();
    expect(dock.querySelector("#fortify-button")).toHaveTextContent("Sposta armate");
    expect(dock.querySelector("#end-turn-button")).toHaveTextContent("Termina turno");
  });

  it("renders mandatory card trade flow in the bottom dock", async () => {
    getGameStateMock.mockResolvedValue(
      createGameplayState({
        reinforcementPool: 5,
        cardState: {
          ruleSetId: "standard",
          tradeCount: 2,
          deckCount: 12,
          discardCount: 0,
          nextTradeBonus: 8,
          maxHandBeforeForcedTrade: 5,
          currentPlayerMustTrade: true
        },
        playerHand: [
          { id: "card-1", territoryId: "Aurora", type: "infantry" },
          { id: "card-2", territoryId: "Bastion", type: "artillery" },
          { id: "card-3", territoryId: "Cinder", type: "cavalry" },
          { id: "card-4", territoryId: "Delta", type: "wild" },
          { id: "card-5", territoryId: "Ember", type: "infantry" }
        ]
      })
    );

    renderReactShell("/react/game/g-1");

    const dock = await screen.findByTestId("actions-panel");
    expect(dock).toHaveAttribute("data-command-mode", "mandatory-trade");
    expect(within(dock).getByText("Seleziona 3 carte da scambiare")).toBeInTheDocument();
    expect(within(dock).getByText("Bonus scambio")).toBeInTheDocument();
    expect(within(dock).getByText("+8")).toBeInTheDocument();
    expect(dock.querySelectorAll("[data-dock-card-id]")).toHaveLength(5);
    expect(dock.querySelector("#card-trade-dock-button")).toHaveTextContent("Scambia carte");
  });

  it("opens reference drawers and filters the activity log", async () => {
    const user = userEvent.setup();
    getGameStateMock.mockResolvedValue(
      createGameplayState({
        log: [
          "Attack initiated: Commander attacked Bastion",
          "Attack keyless: Commander attacked Cinder",
          "Card traded: Commander traded 3 cards",
          "Card traded: Commander traded 3 cards",
          "Turn ended: Commander ended their turn"
        ],
        logEntries: [
          {
            message: "Attack initiated: Commander attacked Bastion",
            messageKey: "game.log.attackDamaged"
          },
          {
            message: "Card awarded: Commander drew a card",
            messageKey: "game.log.turnCardAwarded",
            messageParams: { playerName: "Commander" }
          },
          {
            message: "Attack keyless: Commander attacked Cinder"
          }
        ],
        playerHand: [{ id: "card-1", territoryId: "Aurora", type: "infantry" }]
      })
    );

    const { container } = renderReactShell("/react/game/g-1");

    expect(await screen.findByTestId("react-shell-game-page")).toBeInTheDocument();
    const railButtons = container.querySelectorAll(".game-action-rail-button");
    await user.click(railButtons[0]);
    expect(screen.getByText(/2 giocatori/i)).toBeInTheDocument();
    await user.click(container.querySelector(".game-cards-drawer summary") as HTMLElement);
    expect(screen.getByText(/Le tue carte 1\/5/i)).toBeInTheDocument();
    await user.click(railButtons[2]);
    expect(screen.getByText(/Moduli attivi/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /registro attivita/i }));
    expect(screen.getByText("Attack initiated: Commander attacked Bastion")).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("tablist", { name: "Filtri registro attivita" })).getByRole("tab", {
        name: "Combattimento"
      })
    );
    expect(screen.getByText("Attack keyless: Commander attacked Cinder")).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("tablist", { name: "Filtri registro attivita" })).getByRole("tab", {
        name: "Carte"
      })
    );
    expect(screen.getAllByText("Card traded: Commander traded 3 cards")).toHaveLength(2);
    expect(screen.getByText("Commander riceve una carta territorio.")).toBeInTheDocument();
    expect(
      screen.queryByText("Attack initiated: Commander attacked Bastion")
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Map" })).not.toBeInTheDocument();
  });

  it("restores cleared activity log entries when same-length log content changes", async () => {
    const user = userEvent.setup();
    getGameStateMock.mockResolvedValue(
      createGameplayState({
        log: [
          "Attack initiated: Commander attacked Bastion",
          "Turn ended: Commander ended their turn"
        ]
      })
    );

    renderReactShell("/react/game/g-1");

    expect(await screen.findByTestId("react-shell-game-page")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /registro attivita/i }));
    expect(screen.getByText("Attack initiated: Commander attacked Bastion")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancella registro" }));
    expect(
      screen.queryByText("Attack initiated: Commander attacked Bastion")
    ).not.toBeInTheDocument();

    await act(async () => {
      streamHandlers?.onMessage(
        createGameplayState({
          version: 5,
          log: ["Card traded: Commander traded 3 cards", "New turn: CPU's turn has started"]
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Card traded: Commander traded 3 cards")).toBeInTheDocument();
    });
  });
});
