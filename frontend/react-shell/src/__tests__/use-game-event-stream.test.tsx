import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";

import type { GameStateResponse } from "@frontend-generated/shared-runtime-validation.mts";

import { subscribeToGameEvents } from "@frontend-core/api/client.mts";

import { readCurrentPlayerId } from "@react-shell/player-session";
import { useGameEventStream } from "@react-shell/use-game-event-stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@frontend-core/api/client.mts", () => ({
  subscribeToGameEvents: vi.fn()
}));

const subscribeToGameEventsMock = vi.mocked(subscribeToGameEvents);

type StreamHandlers = Parameters<typeof subscribeToGameEvents>[0];

function createGameState(overrides: Partial<GameStateResponse> = {}): GameStateResponse {
  return {
    gameId: "game-1",
    gameName: "Stream Test",
    version: 1,
    playerId: "player-1",
    phase: "active",
    turnPhase: "reinforcement",
    currentPlayerId: "player-1",
    winnerId: null,
    players: [],
    map: [],
    continents: [],
    reinforcementPool: 3,
    playerHand: [],
    pendingConquest: null,
    lastAction: null,
    lastCombat: null,
    cardState: {
      ruleSetId: "standard",
      tradeCount: 0,
      deckCount: 0,
      discardCount: 0,
      nextTradeBonus: 4,
      maxHandBeforeForcedTrade: 5,
      currentPlayerMustTrade: false
    },
    gameConfig: {
      mapId: "classic-mini",
      mapName: "Classic Mini",
      totalPlayers: 2,
      players: []
    },
    fortifyUsed: false,
    attacksThisTurn: 0,
    conqueredTerritoryThisTurn: false,
    log: [],
    logEntries: [],
    ...overrides
  };
}

function StreamProbe({
  enabled = true,
  gameId = "game-1"
}: {
  enabled?: boolean;
  gameId?: string | null;
}) {
  const status = useGameEventStream({
    enabled,
    gameId,
    queryKey: ["game-state", gameId]
  });

  return <output data-testid="stream-status">{status}</output>;
}

function renderStreamProbe(
  options: {
    enabled?: boolean;
    gameId?: string | null;
    queryClient?: QueryClient;
  } = {}
) {
  const queryClient =
    options.queryClient ||
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <StreamProbe enabled={options.enabled} gameId={options.gameId ?? "game-1"} />
    </QueryClientProvider>
  );

  return { queryClient, ...view };
}

describe("useGameEventStream", () => {
  let handlers: StreamHandlers | null = null;
  let closeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = null;
    closeMock = vi.fn();
    subscribeToGameEventsMock.mockImplementation((nextHandlers) => {
      handlers = nextHandlers;
      return { close: closeMock } as unknown as EventSource;
    });
  });

  it("subscribes, updates query data, and stores the current player id", () => {
    const { queryClient } = renderStreamProbe();

    expect(subscribeToGameEventsMock).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: "game-1" })
    );

    act(() => {
      handlers?.onOpen?.();
    });
    expect(screen.getByTestId("stream-status")).toHaveTextContent("live");

    const nextState = createGameState({ version: 2, playerId: "player-2" });
    act(() => {
      handlers?.onMessage(nextState);
    });

    expect(queryClient.getQueryData(["game-state", "game-1"])).toEqual(nextState);
    expect(readCurrentPlayerId("game-1")).toBe("player-2");
    expect(screen.getByTestId("stream-status")).toHaveTextContent("live");
  });

  it("does not subscribe when disabled and closes the stream on unmount", () => {
    renderStreamProbe({ enabled: false });
    expect(subscribeToGameEventsMock).not.toHaveBeenCalled();

    const { unmount } = renderStreamProbe();
    unmount();

    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("marks an active stream as reconnecting after errors or invalid payloads", () => {
    renderStreamProbe();

    act(() => {
      handlers?.onOpen?.();
    });
    expect(screen.getByTestId("stream-status")).toHaveTextContent("live");

    act(() => {
      handlers?.onError?.(new Event("error"));
    });
    expect(screen.getByTestId("stream-status")).toHaveTextContent("reconnecting");

    act(() => {
      handlers?.onOpen?.();
      handlers?.onInvalidPayload?.(new Error("Invalid stream payload."));
    });
    expect(screen.getByTestId("stream-status")).toHaveTextContent("reconnecting");
  });
});
