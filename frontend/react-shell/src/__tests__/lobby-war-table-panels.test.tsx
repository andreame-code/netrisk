import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";

import type {
  CreateGameResponse,
  GameOptionsResponse,
  GameSummary,
  InstalledModuleSummary
} from "@frontend-generated/shared-runtime-validation.mts";

import { createGame, getGameOptions } from "@frontend-core/api/client.mts";
import { setLocale } from "@frontend-i18n";

import { openShellGame } from "@react-shell/game-navigation";
import { buildHumanPlayerSlots, LobbyWarTablePanels } from "@react-shell/lobby-war-table-panels";
import { storeCurrentPlayerId } from "@react-shell/player-session";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@frontend-core/api/client.mts", () => ({
  createGame: vi.fn(),
  getGameOptions: vi.fn()
}));

vi.mock("@react-shell/game-navigation", () => ({
  openShellGame: vi.fn()
}));

vi.mock("@react-shell/player-session", () => ({
  storeCurrentPlayerId: vi.fn()
}));

const createGameMock = vi.mocked(createGame);
const getGameOptionsMock = vi.mocked(getGameOptions);
const openShellGameMock = vi.mocked(openShellGame);
const storeCurrentPlayerIdMock = vi.mocked(storeCurrentPlayerId);

type WarTablePanelProps = ComponentProps<typeof LobbyWarTablePanels>;

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
    id: "selected-game",
    name: "Baltic War",
    phase: "lobby",
    playerCount: 1,
    updatedAt: "2026-04-20T06:00:00.000Z",
    totalPlayers: 4,
    ...overrides
  };
}

function createModule(id: string, displayName: string): InstalledModuleSummary {
  return {
    id,
    version: "1.0.0",
    displayName,
    description: null,
    kind: "game",
    sourcePath: `modules/${id}`,
    status: "enabled",
    enabled: true,
    compatible: true,
    warnings: [],
    errors: [],
    capabilities: []
  };
}

function createGameOptionsResponse(
  overrides: Partial<GameOptionsResponse> = {}
): GameOptionsResponse {
  const modules = [
    createModule("cards", "Cards"),
    createModule("objectives", "Objectives"),
    createModule("fog-of-war", "Fog of War")
  ];

  return {
    ruleSets: [],
    maps: [],
    diceRuleSets: [],
    victoryRuleSets: [],
    themes: [],
    pieceSkins: [],
    modules,
    enabledModules: [],
    gamePresets: [
      {
        id: "classic-risk",
        name: "Classic Risk",
        description: "The original experience",
        activeModuleIds: ["cards"]
      },
      {
        id: "fast-duel",
        name: "Fast Duel",
        description: "Quick 1v1 battles",
        activeModuleIds: ["objectives"]
      }
    ],
    contentProfiles: [],
    gameplayProfiles: [],
    uiProfiles: [],
    uiSlots: [],
    playerPieceSets: [],
    contentPacks: [],
    turnTimeoutHoursOptions: [24, 48, 72],
    playerRange: {
      min: 2,
      max: 4
    },
    ...overrides
  };
}

function createGameResponse(gameId = "created-game"): CreateGameResponse {
  return {
    ok: true,
    playerId: "player-1",
    game: {
      id: gameId,
      name: "Created Game"
    },
    games: [],
    activeGameId: gameId
  };
}

function renderPanels(overrides: Partial<WarTablePanelProps> = {}) {
  const props: WarTablePanelProps = {
    activeGame: null,
    canJoinSelected: false,
    joinDisabled: false,
    joinPending: false,
    openDisabled: false,
    openPending: false,
    onJoinSelected: vi.fn(),
    onOpenSelected: vi.fn(),
    selectedGame: createGameSummary(),
    ...overrides
  };

  return {
    props,
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={createQueryClient()}>
        <LobbyWarTablePanels {...props} />
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
  createGameMock.mockReset();
  openShellGameMock.mockClear();
  storeCurrentPlayerIdMock.mockClear();
});

describe("LobbyWarTablePanels", () => {
  it("builds human player slots for create-game requests", () => {
    expect(buildHumanPlayerSlots(3)).toEqual([
      { slot: 1, type: "human" },
      { slot: 2, type: "human" },
      { slot: 3, type: "human" }
    ]);
  });

  it("keeps fallback quick-create choices backend-compatible when options fail", async () => {
    getGameOptionsMock.mockRejectedValue(new Error("options offline"));
    createGameMock.mockResolvedValue(createGameResponse());

    const { user } = renderPanels();
    const createButton = await screen.findByRole("button", { name: "Create Game" });

    await waitFor(() => {
      expect(createButton).toBeEnabled();
    });

    const playerGroup = screen.getByRole("group", { name: "Players" });
    expect(within(playerGroup).getByRole("button", { name: "2" })).toBeInTheDocument();
    expect(within(playerGroup).getByRole("button", { name: "3" })).toBeInTheDocument();
    expect(within(playerGroup).getByRole("button", { name: "4" })).toBeInTheDocument();
    expect(within(playerGroup).queryByRole("button", { name: "5" })).not.toBeInTheDocument();
    expect(within(playerGroup).queryByRole("button", { name: "6" })).not.toBeInTheDocument();

    await user.click(within(playerGroup).getByRole("button", { name: "3" }));
    await user.click(createButton);

    await waitFor(() => {
      expect(createGameMock).toHaveBeenCalledTimes(1);
    });
    expect(createGameMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activeModuleIds: [],
        gamePresetId: null,
        name: "Classic Risk",
        players: buildHumanPlayerSlots(3),
        totalPlayers: 3,
        turnTimeoutHours: 48
      }),
      expect.any(Object)
    );
    expect(storeCurrentPlayerIdMock).toHaveBeenCalledWith("player-1", "created-game");
    expect(openShellGameMock).toHaveBeenCalledWith("created-game");
  });

  it("submits selected presets, player counts and module toggles", async () => {
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());
    createGameMock.mockResolvedValue(createGameResponse());

    const { user } = renderPanels();
    const createButton = await screen.findByRole("button", { name: "Create Game" });
    const playerGroup = screen.getByRole("group", { name: "Players" });

    await user.click(await screen.findByRole("button", { name: /Fast Duel/ }));
    await user.click(screen.getByRole("button", { name: "Cards" }));
    await user.click(within(playerGroup).getByRole("button", { name: "2" }));
    await user.click(createButton);

    await waitFor(() => {
      expect(createGameMock).toHaveBeenCalledTimes(1);
    });
    expect(createGameMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activeModuleIds: ["objectives", "cards"],
        gamePresetId: "fast-duel",
        name: "Fast Duel",
        players: buildHumanPlayerSlots(2),
        totalPlayers: 2
      }),
      expect.any(Object)
    );
  });

  it("routes the secondary action through join when the selected lobby is joinable", async () => {
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());
    const onJoinSelected = vi.fn<() => Promise<void>>().mockResolvedValue();
    const onOpenSelected = vi.fn<() => Promise<void>>().mockResolvedValue();

    const { user } = renderPanels({
      canJoinSelected: true,
      onJoinSelected,
      onOpenSelected
    });

    await user.click(await screen.findByRole("button", { name: "Join Battle" }));

    expect(onJoinSelected).toHaveBeenCalledTimes(1);
    expect(onOpenSelected).not.toHaveBeenCalled();
  });

  it("routes the secondary action through open when there is no joinable lobby", async () => {
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());
    const onJoinSelected = vi.fn<() => Promise<void>>().mockResolvedValue();
    const onOpenSelected = vi.fn<() => Promise<void>>().mockResolvedValue();

    const { user } = renderPanels({
      activeGame: createGameSummary({ id: "active-game", phase: "active" }),
      canJoinSelected: false,
      onJoinSelected,
      onOpenSelected
    });

    await user.click(await screen.findByRole("button", { name: "Resume Battle" }));

    expect(onOpenSelected).toHaveBeenCalledTimes(1);
    expect(onJoinSelected).not.toHaveBeenCalled();
  });
});
