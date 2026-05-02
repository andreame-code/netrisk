import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";

import type {
  GameOptionsResponse,
  InstalledModuleSummary
} from "@frontend-generated/shared-runtime-validation.mts";

import { getGameOptions } from "@frontend-core/api/client.mts";
import { setLocale } from "@frontend-i18n";

import { filterVisibleModuleIds, LobbyWarTablePanels } from "@react-shell/lobby-war-table-panels";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@frontend-core/api/client.mts", () => ({
  getGameOptions: vi.fn()
}));

const getGameOptionsMock = vi.mocked(getGameOptions);

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

function renderPanels(overrides: Partial<WarTablePanelProps> = {}) {
  const queryClient = createQueryClient();
  const props: WarTablePanelProps = {
    canCreateGame: true,
    ...overrides
  };

  return {
    props,
    queryClient,
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/react/lobby"]}>
          <LobbyWarTablePanels {...props} />
        </MemoryRouter>
      </QueryClientProvider>
    )
  };
}

async function findSinglePlayerCreateLink() {
  return screen.findByRole("link", { name: "Single player" });
}

async function findMultiplayerCreateLink() {
  return screen.findByRole("link", { name: "Multiplayer" });
}

beforeEach(() => {
  setLocale("en", {
    storage: window.localStorage,
    applyDocument: true
  });
  getGameOptionsMock.mockReset();
});

describe("LobbyWarTablePanels", () => {
  it("filters preset module ids to the visible War Table toggles", () => {
    expect(
      filterVisibleModuleIds(["cards", "hidden-module"], [createModule("cards", "Cards")])
    ).toEqual(["cards"]);
  });

  it("keeps fallback setup choices in the full create form link when options fail", async () => {
    getGameOptionsMock.mockRejectedValue(new Error("options offline"));

    const { user } = renderPanels();
    const singlePlayerCreateLink = await findSinglePlayerCreateLink();
    const multiplayerCreateLink = await findMultiplayerCreateLink();

    const playerGroup = screen.getByRole("group", { name: "Players" });
    expect(within(playerGroup).getByRole("button", { name: "2" })).toBeInTheDocument();
    expect(within(playerGroup).getByRole("button", { name: "3" })).toBeInTheDocument();
    expect(within(playerGroup).getByRole("button", { name: "4" })).toBeInTheDocument();
    expect(within(playerGroup).queryByRole("button", { name: "5" })).not.toBeInTheDocument();
    expect(within(playerGroup).queryByRole("button", { name: "6" })).not.toBeInTheDocument();

    await user.click(within(playerGroup).getByRole("button", { name: "3" }));

    await waitFor(() => {
      expect(singlePlayerCreateLink).toHaveAttribute(
        "href",
        expect.stringContaining(
          "/react/lobby/new?preset=&players=3&turnHours=48&modules=&mode=single-player"
        )
      );
      expect(multiplayerCreateLink).toHaveAttribute(
        "href",
        expect.stringContaining(
          "/react/lobby/new?preset=&players=3&turnHours=48&modules=&mode=multiplayer"
        )
      );
    });
  });

  it("keeps create-form navigation disabled while setup options are loading", async () => {
    getGameOptionsMock.mockReturnValue(new Promise(() => undefined));

    renderPanels();

    const singlePlayerCreateButton = await screen.findByRole("button", { name: "Single player" });
    const multiplayerCreateButton = await screen.findByRole("button", { name: "Multiplayer" });
    expect(singlePlayerCreateButton).toBeDisabled();
    expect(multiplayerCreateButton).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Single player" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Multiplayer" })).not.toBeInTheDocument();
  });

  it("links selected presets, player counts and module toggles to the full create form", async () => {
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());

    const { user } = renderPanels();
    const multiplayerCreateLink = await findMultiplayerCreateLink();
    const playerGroup = screen.getByRole("group", { name: "Players" });

    await user.click(await screen.findByRole("button", { name: /Fast Duel/ }));
    await user.click(screen.getByRole("button", { name: "Cards" }));
    await user.click(within(playerGroup).getByRole("button", { name: "2" }));

    await waitFor(() => {
      expect(multiplayerCreateLink).toHaveAttribute(
        "href",
        expect.stringContaining(
          "/react/lobby/new?preset=fast-duel&players=2&turnHours=48&modules=objectives%2Ccards&mode=multiplayer"
        )
      );
    });
  });

  it("allows users to clear all preset modules before opening the full form", async () => {
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());

    const { user } = renderPanels();
    const multiplayerCreateLink = await findMultiplayerCreateLink();
    const cardsButton = await screen.findByRole("button", { name: "Cards" });

    await waitFor(() => {
      expect(cardsButton).toHaveClass("is-active");
    });
    await user.click(cardsButton);
    await waitFor(() => {
      expect(cardsButton).not.toHaveClass("is-active");
    });

    await waitFor(() => {
      expect(multiplayerCreateLink).toHaveAttribute(
        "href",
        expect.stringContaining(
          "/react/lobby/new?preset=classic-risk&players=4&turnHours=48&modules=&mode=multiplayer"
        )
      );
    });
  });

  it("does not pass preset modules hidden from the lobby toggles", async () => {
    getGameOptionsMock.mockResolvedValue(
      createGameOptionsResponse({
        modules: [
          createModule("cards", "Cards"),
          createModule("objectives", "Objectives"),
          createModule("fog-of-war", "Fog of War"),
          createModule("advanced-cards", "Advanced Cards")
        ],
        gamePresets: [
          {
            id: "advanced-risk",
            name: "Advanced Risk",
            description: "Extra module preset",
            activeModuleIds: ["cards", "advanced-cards"]
          }
        ]
      })
    );

    renderPanels();
    const cardsButton = await screen.findByRole("button", { name: "Cards" });
    const multiplayerCreateLink = await findMultiplayerCreateLink();

    expect(screen.queryByRole("button", { name: "Advanced Cards" })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(cardsButton).toHaveClass("is-active");
    });
    expect(multiplayerCreateLink).toHaveAttribute(
      "href",
      expect.stringContaining(
        "/react/lobby/new?preset=advanced-risk&players=4&turnHours=48&modules=cards&mode=multiplayer"
      )
    );
  });

  it("does not show or pass the internal core module in lobby toggles", async () => {
    getGameOptionsMock.mockResolvedValue(
      createGameOptionsResponse({
        modules: [
          createModule("core.base", "Base"),
          createModule("cards", "Cards"),
          createModule("objectives", "Objectives"),
          createModule("fog-of-war", "Fog of War")
        ],
        gamePresets: [
          {
            id: "classic-risk",
            name: "Classic Risk",
            description: "The original experience",
            activeModuleIds: ["core.base", "cards"]
          }
        ]
      })
    );

    renderPanels();
    const cardsButton = await screen.findByRole("button", { name: "Cards" });
    const multiplayerCreateLink = await findMultiplayerCreateLink();

    expect(screen.queryByRole("button", { name: "Base" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Objectives" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fog of War" })).toBeInTheDocument();
    await waitFor(() => {
      expect(cardsButton).toHaveClass("is-active");
    });
    expect(multiplayerCreateLink).toHaveAttribute(
      "href",
      expect.stringContaining(
        "/react/lobby/new?preset=classic-risk&players=4&turnHours=48&modules=cards&mode=multiplayer"
      )
    );
  });

  it("blocks create-form navigation when the lobby session is unauthenticated", async () => {
    getGameOptionsMock.mockResolvedValue(createGameOptionsResponse());

    const { user } = renderPanels({
      canCreateGame: false
    });
    const singlePlayerCreateButton = await screen.findByRole("button", { name: "Single player" });
    const multiplayerCreateButton = await screen.findByRole("button", { name: "Multiplayer" });

    await screen.findByRole("button", { name: "Cards" });
    expect(singlePlayerCreateButton).toBeDisabled();
    expect(multiplayerCreateButton).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Single player" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Multiplayer" })).not.toBeInTheDocument();
    await user.click(singlePlayerCreateButton);
  });

  it("drops stale selected module ids after game options refresh", async () => {
    const initialOptions = createGameOptionsResponse({
      gamePresets: [
        {
          id: "classic-risk",
          name: "Classic Risk",
          description: "The original experience",
          activeModuleIds: ["cards", "objectives"]
        }
      ]
    });
    const refreshedOptions = createGameOptionsResponse({
      modules: [createModule("cards", "Cards")],
      gamePresets: [
        {
          id: "classic-risk",
          name: "Classic Risk",
          description: "The original experience",
          activeModuleIds: ["cards", "objectives"]
        }
      ]
    });
    getGameOptionsMock.mockResolvedValueOnce(initialOptions).mockResolvedValue(refreshedOptions);

    const { queryClient } = renderPanels();

    const objectivesButton = await screen.findByRole("button", { name: "Objectives" });
    await waitFor(() => {
      expect(objectivesButton).toHaveClass("is-active");
    });
    await queryClient.invalidateQueries();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Objectives" })).not.toBeInTheDocument();
    });
    expect(await findMultiplayerCreateLink()).toHaveAttribute(
      "href",
      expect.stringContaining(
        "/react/lobby/new?preset=classic-risk&players=4&turnHours=48&modules=cards&mode=multiplayer"
      )
    );
  });

  it("expands the preset panel through the view-all action", async () => {
    getGameOptionsMock.mockResolvedValue(
      createGameOptionsResponse({
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
          },
          {
            id: "objective-mode",
            name: "Objective Mode",
            description: "Play with mission goals",
            activeModuleIds: ["objectives"]
          },
          {
            id: "world-domination",
            name: "World Domination",
            description: "Large map, epic game",
            activeModuleIds: ["cards"]
          },
          {
            id: "continental-war",
            name: "Continental War",
            description: "Extended campaign",
            activeModuleIds: ["cards", "objectives"]
          }
        ]
      })
    );

    const { user } = renderPanels();

    expect(await screen.findByRole("button", { name: "View All Presets" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continental War/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View All Presets" }));

    expect(await screen.findByRole("button", { name: /Continental War/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Fewer Presets" })).toBeInTheDocument();
  });
});
