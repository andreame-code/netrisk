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

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@frontend-core/api/client.mts", () => ({
  createGame: vi.fn(),
  getGameOptions: vi.fn(),
  joinGame: vi.fn(),
  listGames: vi.fn(),
  openGame: vi.fn()
}));

vi.mock("@react-shell/auth", () => ({
  useAuth: useAuthMock
}));

function authenticatedAuthContext() {
  return {
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
  };
}

vi.mock("@react-shell/game-navigation", () => ({
  buildShellGamePath: vi.fn((gameId: string) => `/react/game/${encodeURIComponent(gameId)}`),
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
  useAuthMock.mockReset();
  useAuthMock.mockReturnValue(authenticatedAuthContext());
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

  it("links the top game creation action to the default setup route", async () => {
    listGamesMock.mockResolvedValue(createLobbyGames());

    renderLobbyRoute("command");

    expect(await screen.findByRole("heading", { name: "Command Lobby" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create game" })).toHaveAttribute(
      "href",
      "/react/lobby/new"
    );
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

  it("sends guests to login with the selected game preserved instead of opening it", async () => {
    useAuthMock.mockReturnValue({
      state: {
        status: "unauthenticated",
        message: "Sign in to continue."
      }
    });
    listGamesMock.mockResolvedValue(
      createLobbyGames([
        createGameSummary({
          id: "active-game",
          name: "Active Campaign",
          phase: "active"
        })
      ])
    );
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());

    renderLobbyRoute("war-table");

    const row = await screen.findByTestId("react-shell-lobby-row-active-game");
    const loginLink = within(row).getByRole("link", { name: "Log in to view" });

    expect(loginLink).toHaveAttribute("href", "/react/login?next=%2Fgame%2Factive-game");
    expect(screen.getByTestId("react-shell-lobby-open-selected-login")).toHaveAttribute(
      "href",
      "/react/login?next=%2Fgame%2Factive-game"
    );
    expect(screen.getByTestId("react-shell-lobby-open-inline-login")).toHaveAttribute(
      "href",
      "/react/login?next=%2Fgame%2Factive-game"
    );
    expect(screen.queryByTestId("react-shell-lobby-join-inline-login")).not.toBeInTheDocument();
    expect(openGameMock).not.toHaveBeenCalled();
    expect(joinGameMock).not.toHaveBeenCalled();
    expect(openShellGameMock).not.toHaveBeenCalled();
  });

  it("sends guest detail-panel join actions to login without calling protected APIs", async () => {
    useAuthMock.mockReturnValue({
      state: {
        status: "unauthenticated",
        message: "Sign in to continue."
      }
    });
    listGamesMock.mockResolvedValue(createLobbyGames([createGameSummary()]));
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());

    renderLobbyRoute("command");

    expect(await screen.findByTestId("react-shell-lobby-open-inline-login")).toHaveAttribute(
      "href",
      "/react/login?next=%2Fgame%2Fjoinable-game"
    );
    expect(screen.getByTestId("react-shell-lobby-join-inline-login")).toHaveAttribute(
      "href",
      "/react/login?next=%2Fgame%2Fjoinable-game"
    );
    expect(openGameMock).not.toHaveBeenCalled();
    expect(joinGameMock).not.toHaveBeenCalled();
    expect(openShellGameMock).not.toHaveBeenCalled();
  });

  it("uses one War Table game icon color and glyph for each game state", async () => {
    readCurrentPlayerIdMock.mockReturnValue("player-1");
    listGamesMock.mockResolvedValue(
      createLobbyGames([
        createGameSummary({
          id: "waiting-game",
          name: "Waiting Game",
          phase: "lobby"
        }),
        createGameSummary({
          id: "active-game",
          name: "Active Game",
          phase: "active",
          currentPlayerId: "player-2"
        }),
        createGameSummary({
          id: "my-turn-game",
          name: "My Turn Game",
          phase: "active",
          currentPlayerId: "player-1"
        }),
        createGameSummary({
          id: "finished-game",
          name: "Finished Game",
          phase: "finished"
        })
      ])
    );
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());

    renderLobbyRoute("war-table");

    const waitingToken = (
      await screen.findByTestId("react-shell-lobby-row-waiting-game")
    ).querySelector(".war-table-game-token");
    const activeToken = screen
      .getByTestId("react-shell-lobby-row-active-game")
      .querySelector(".war-table-game-token");
    const myTurnToken = screen
      .getByTestId("react-shell-lobby-row-my-turn-game")
      .querySelector(".war-table-game-token");
    const finishedToken = screen
      .getByTestId("react-shell-lobby-row-finished-game")
      .querySelector(".war-table-game-token");

    expect(waitingToken).toHaveClass("is-lobby");
    expect(activeToken).toHaveClass("is-active");
    expect(myTurnToken).toHaveClass("is-active");
    expect(finishedToken).toHaveClass("is-finished");
    expect(waitingToken).toHaveAttribute("data-war-table-icon", "users");
    expect(activeToken).toHaveAttribute("data-war-table-icon", "medal");
    expect(myTurnToken).toHaveAttribute("data-war-table-icon", "objective");
    expect(finishedToken).toHaveAttribute("data-war-table-icon", "crosshair");
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

  it("paginates a large War Table lobby while filters and focus use the full dataset", async () => {
    const games = Array.from({ length: 70 }, (_, index) =>
      createGameSummary({
        id: `campaign-${String(index + 1).padStart(2, "0")}`,
        name: `Campaign ${String(index + 1).padStart(2, "0")}`,
        updatedAt: new Date(Date.UTC(2026, 3, 20, 6, 0, 0) - index * 60_000).toISOString()
      })
    );
    const focusedGame = games[69];
    const archivedGame = games[68];
    if (!focusedGame || !archivedGame) {
      throw new Error("Large lobby fixtures were not created.");
    }
    archivedGame.phase = "finished";

    listGamesMock.mockResolvedValue(createLobbyGames(games, focusedGame.id));
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());

    const { user } = renderLobbyRoute("war-table");

    await screen.findByTestId("react-shell-lobby-row-campaign-01");
    expect(screen.getAllByTestId(/^react-shell-lobby-row-/)).toHaveLength(15);
    expect(screen.queryByTestId(`react-shell-lobby-row-${focusedGame.id}`)).not.toBeInTheDocument();
    expect(document.querySelector("#lobby-active-focus")).toHaveTextContent(focusedGame.name);

    const loadMoreButton = screen.getByRole("button", { name: "Load more" });
    expect(loadMoreButton).toHaveAttribute("aria-controls", "game-session-list");
    await user.click(loadMoreButton);
    expect(screen.getAllByTestId(/^react-shell-lobby-row-/)).toHaveLength(30);

    const search = screen.getByPlaceholderText("Search games...");
    await user.type(search, focusedGame.name);
    expect(screen.getAllByTestId(/^react-shell-lobby-row-/)).toHaveLength(1);
    expect(screen.getByTestId(`react-shell-lobby-row-${focusedGame.id}`)).toBeInTheDocument();

    await user.clear(search);
    await user.click(screen.getByRole("tab", { name: "Finished" }));
    expect(screen.getAllByTestId(/^react-shell-lobby-row-/)).toHaveLength(1);
    expect(screen.getByTestId(`react-shell-lobby-row-${archivedGame.id}`)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "All" }));
    expect(screen.getAllByTestId(/^react-shell-lobby-row-/)).toHaveLength(15);
    for (const expectedCount of [30, 45, 60, 70]) {
      await user.click(screen.getByRole("button", { name: "Load more" }));
      expect(screen.getAllByTestId(/^react-shell-lobby-row-/)).toHaveLength(expectedCount);
    }
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    expect(screen.getByTestId("react-shell-lobby-load-more")).toHaveTextContent(
      "All 70 games are visible."
    );
  });

  it("announces loading and load failures explicitly", async () => {
    listGamesMock.mockReturnValue(new Promise(() => undefined));
    const loadingRender = renderLobbyRoute("command");

    expect(screen.getByText("Loading sessions...")).toBeInTheDocument();
    loadingRender.unmount();

    listGamesMock.mockRejectedValue(new Error("Lobby backend unavailable"));
    renderLobbyRoute("command");

    const errorState = await screen.findByText("Lobby backend unavailable");
    expect(errorState).toHaveClass("is-error");
  });

  it("shows an explicit empty state when full-dataset filters have no matches", async () => {
    listGamesMock.mockResolvedValue(createLobbyGames([createGameSummary()]));
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());

    const { user } = renderLobbyRoute("war-table");
    await screen.findByTestId("react-shell-lobby-row-joinable-game");
    await user.type(screen.getByPlaceholderText("Search games..."), "missing campaign");

    expect(
      screen.getByText("No games available. Create a new one to get started.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("react-shell-lobby-load-more")).toHaveClass("is-hidden");
  });
});
