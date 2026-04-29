import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import type {
  GameListResponse,
  GameMutationResponse,
  GameOptionsResponse,
  GameSummary
} from "@frontend-generated/shared-runtime-validation.mts";

import { getGameOptions, joinGame, listGames, openGame } from "@frontend-core/api/client.mts";
import { setLocale } from "@frontend-i18n";

import { openShellGame } from "@react-shell/game-navigation";
import { LobbyRoute } from "@react-shell/lobby-route";
import {
  readCurrentPlayerId,
  storeCurrentPlayerId,
  subscribeCurrentPlayerIdChanges
} from "@react-shell/player-session";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@frontend-core/api/client.mts", () => ({
  createGame: vi.fn(),
  getGameOptions: vi.fn(),
  joinGame: vi.fn(),
  listGames: vi.fn(),
  openGame: vi.fn()
}));

vi.mock("@react-shell/auth", () => ({
  useAuth: () => ({
    state: {
      status: "authenticated",
      user: {
        id: "user-1",
        username: "Commander",
        preferences: {
          theme: document.documentElement.dataset.theme || "command"
        }
      }
    }
  })
}));

vi.mock("@react-shell/game-navigation", () => ({
  openShellGame: vi.fn()
}));

vi.mock("@react-shell/player-session", () => ({
  readCurrentPlayerId: vi.fn(),
  storeCurrentPlayerId: vi.fn(),
  subscribeCurrentPlayerIdChanges: vi.fn()
}));

const getGameOptionsMock = vi.mocked(getGameOptions);
const joinGameMock = vi.mocked(joinGame);
const listGamesMock = vi.mocked(listGames);
const openGameMock = vi.mocked(openGame);
const openShellGameMock = vi.mocked(openShellGame);
const readCurrentPlayerIdMock = vi.mocked(readCurrentPlayerId);
const storeCurrentPlayerIdMock = vi.mocked(storeCurrentPlayerId);
const subscribeCurrentPlayerIdChangesMock = vi.mocked(subscribeCurrentPlayerIdChanges);

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
}

function createGameSummary(overrides: Partial<GameSummary> = {}): GameSummary {
  return {
    id: "joinable-game",
    name: "Baltic War",
    phase: "lobby",
    playerCount: 1,
    updatedAt: "2026-04-20T06:00:00.000Z",
    totalPlayers: 4,
    ...overrides
  };
}

function createLobbyGames(
  games: GameSummary[] = [],
  activeGameId: string | null = null
): GameListResponse {
  return {
    games,
    activeGameId
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

function createJoinResponse(gameId = "joinable-game"): GameMutationResponse {
  return {
    ok: true,
    playerId: "player-2",
    game: {
      id: gameId,
      name: "Baltic War"
    },
    games: [createGameSummary({ id: gameId, playerCount: 2 })],
    activeGameId: gameId
  };
}

function renderLobbyRoute(theme = "command") {
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <LobbyRoute />
        </MemoryRouter>
      </QueryClientProvider>
    )
  };
}

beforeEach(() => {
  setLocale("en", {
    storage: window.localStorage,
    applyDocument: true
  });
  getGameOptionsMock.mockReset();
  joinGameMock.mockReset();
  listGamesMock.mockReset();
  openGameMock.mockReset();
  openShellGameMock.mockClear();
  readCurrentPlayerIdMock.mockReset();
  storeCurrentPlayerIdMock.mockClear();
  subscribeCurrentPlayerIdChangesMock.mockReset();
  subscribeCurrentPlayerIdChangesMock.mockReturnValue(() => undefined);
});

describe("LobbyRoute War Table theme behavior", () => {
  it("does not mount War Table campaign controls for non-War-Table themes", async () => {
    listGamesMock.mockResolvedValue(createLobbyGames());

    renderLobbyRoute("command");

    expect(await screen.findByRole("heading", { name: "Command Lobby" })).toBeInTheDocument();
    await waitFor(() => {
      expect(listGamesMock).toHaveBeenCalledTimes(1);
    });
    expect(getGameOptionsMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Create New Game" })).not.toBeInTheDocument();
  });

  it("renders War Table campaign copy and keeps join wired to the lobby action", async () => {
    listGamesMock.mockResolvedValue(createLobbyGames([createGameSummary()]));
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());
    joinGameMock.mockResolvedValue(createJoinResponse());

    const { user } = renderLobbyRoute("war-table");

    expect(await screen.findByRole("heading", { name: "Campaign Hall" })).toBeInTheDocument();
    expect(screen.getByText("Choose your next war table.")).toBeInTheDocument();
    await waitFor(() => {
      expect(getGameOptionsMock).toHaveBeenCalledTimes(1);
    });

    const joinableRow = await screen.findByTestId("react-shell-lobby-row-joinable-game");
    await user.click(within(joinableRow).getByRole("button", { name: "Join" }));

    await waitFor(() => {
      expect(joinGameMock).toHaveBeenCalledWith("joinable-game", expect.any(Object));
    });
    expect(storeCurrentPlayerIdMock).toHaveBeenCalledWith("player-2", "joinable-game");
    expect(openShellGameMock).toHaveBeenCalledWith("joinable-game");
  });

  it("keeps the War Table My Turn tab scoped to the current turn owner", async () => {
    let playerSessionListener: () => void = () => undefined;
    subscribeCurrentPlayerIdChangesMock.mockImplementation((listener) => {
      playerSessionListener = listener;
      return () => undefined;
    });
    readCurrentPlayerIdMock.mockReturnValue("player-1");
    listGamesMock.mockResolvedValue(
      createLobbyGames(
        [
          createGameSummary({
            id: "player-active-game",
            name: "Player Active Game",
            phase: "active",
            currentPlayerId: "player-1"
          }),
          createGameSummary({
            id: "other-active-game",
            name: "Other Active Game",
            phase: "active",
            currentPlayerId: "player-2"
          })
        ],
        "other-active-game"
      )
    );
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());

    const { user } = renderLobbyRoute("war-table");

    expect(
      await screen.findByTestId("react-shell-lobby-row-player-active-game")
    ).toBeInTheDocument();
    expect(screen.getByTestId("react-shell-lobby-row-other-active-game")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "My Turn" }));

    expect(screen.getByTestId("react-shell-lobby-row-player-active-game")).toBeInTheDocument();
    expect(screen.queryByTestId("react-shell-lobby-row-other-active-game")).not.toBeInTheDocument();

    readCurrentPlayerIdMock.mockReturnValue("player-2");
    act(() => {
      playerSessionListener();
    });

    expect(
      screen.queryByTestId("react-shell-lobby-row-player-active-game")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("react-shell-lobby-row-other-active-game")).toBeInTheDocument();
  });

  it("renders the opponent turn label with localized War Table copy", async () => {
    readCurrentPlayerIdMock.mockReturnValue("player-2");
    listGamesMock.mockResolvedValue(
      createLobbyGames(
        [
          createGameSummary({
            id: "player-active-game",
            name: "Player Active Game",
            phase: "active",
            currentPlayerId: "player-1"
          })
        ],
        "player-active-game"
      )
    );
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());

    renderLobbyRoute("war-table");

    expect(await screen.findByText("Waiting for opponent")).toBeInTheDocument();
  });
});
